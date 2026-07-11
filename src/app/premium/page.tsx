import Link from "next/link";
import { redirect } from "next/navigation";
import { BadgeCheck, Rocket, ShieldCheck, Sparkles } from "lucide-react";
import { startPremiumSubscription } from "@/app/actions";
import { formatNaira } from "@/lib/format";
import { isFlutterwaveConfigured } from "@/lib/flutterwave";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const PREMIUM_PLANS = [
  {
    id: "premium_seller",
    icon: Rocket,
    name: "Premium Seller",
    price: 5000,
    fit: "Best for individual sellers",
    boostAllowance: "5 auction boosts",
    benefits: ["5 auction boosts", "Priority discovery placement", "Seller trust badge"]
  },
  {
    id: "premium_agent",
    icon: BadgeCheck,
    name: "Premium Agent",
    price: 10000,
    fit: "Best for declutter agents",
    boostAllowance: "30 auction boosts",
    benefits: ["30 auction boosts", "Agent visibility", "Lead-ready profile"]
  },
  {
    id: "premium_business",
    icon: ShieldCheck,
    name: "Premium Business",
    price: 15000,
    fit: "Best for shops and offices",
    boostAllowance: "Unlimited auction boosts",
    benefits: ["Unlimited auction boosts", "Business trust signals", "Priority marketplace presence"]
  }
];

const BOOST_LABELS: Record<string, string> = {
  listing_boost_7d: "7-day boost",
  listing_boost_14d: "14-day boost",
  listing_boost_30d: "30-day boost"
};

type PremiumPageSearchParams = {
  auction_id?: string;
  boost_plan?: string;
  error?: string;
};

export default async function PremiumPage({
  searchParams
}: {
  searchParams?: Promise<PremiumPageSearchParams>;
}) {
  const query = await searchParams;
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return (
      <main className="container py-10">
        <div className="card p-6">Add Supabase environment variables to manage premium subscriptions.</div>
      </main>
    );
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    const nextPath = `/premium${query?.auction_id ? `?auction_id=${query.auction_id}&boost_plan=${query.boost_plan ?? "listing_boost_7d"}` : ""}`;
    redirect(`/auth?next=${encodeURIComponent(nextPath)}`);
  }

  const auctionId = query?.auction_id ?? "";
  const boostPlan = query?.boost_plan ?? "listing_boost_7d";
  const paymentReady = isFlutterwaveConfigured();
  const [{ data: auction }, { data: activePremium }] = await Promise.all([
    auctionId
      ? supabase
          .from("auctions")
          .select("id,title,status,is_premium,seller_id")
          .eq("id", auctionId)
          .eq("seller_id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("premium_subscriptions")
      .select("id,plan,provider,ends_at")
      .eq("user_id", user.id)
      .is("auction_id", null)
      .in("plan", ["premium_seller", "premium_business", "premium_agent"])
      .eq("status", "active")
      .or(`ends_at.is.null,ends_at.gt.${new Date().toISOString()}`)
      .order("starts_at", { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);
  const hasActivePremium = Boolean(activePremium);

  if (hasActivePremium && auctionId) {
    redirect(`/dashboard/listings?boost=subscription-ready`);
  }

  const errorMessage = query?.error === "payment"
    ? "Flutterwave is not configured yet, so premium checkout cannot start."
    : query?.error === "auction"
      ? "That listing cannot be boosted. Choose an active or paused listing."
      : query?.error === "plan"
        ? "Choose a valid premium plan."
        : null;

  return (
    <main className="container py-10">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="badge badge-premium"><Sparkles size={14} /> Premium</span>
          <h1 className="section-title mt-4">Choose a premium subscription</h1>
          <p className="mt-2 max-w-2xl text-[var(--muted)]">Subscribe first, then Hazi.ng will apply your selected listing boost.</p>
        </div>
        <Link href="/dashboard" className="button button-outline">Back to dashboard</Link>
      </div>

      {auction ? (
        <div className="mb-6 rounded-xl border border-[var(--line)] bg-[var(--surface-soft)] p-4">
          <p className="text-sm font-extrabold text-[var(--primary)]">Boost request</p>
          <p className="mt-1 text-sm text-[var(--muted)]">{auction.title} - {BOOST_LABELS[boostPlan] ?? "Listing boost"}</p>
        </div>
      ) : null}

      {errorMessage ? (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        {PREMIUM_PLANS.map((plan) => {
          const Icon = plan.icon;

          return (
            <section key={plan.id} className="card flex flex-col p-6">
              <Icon className="text-[var(--primary)]" size={28} />
              <h2 className="mt-4 text-2xl font-extrabold text-[var(--primary)]">{plan.name}</h2>
              <p className="mt-1 text-sm font-bold text-[var(--muted)]">{plan.fit}</p>
              <p className="mt-5 text-3xl font-extrabold text-[var(--primary)]">{formatNaira(plan.price)}</p>
              <p className="mt-1 text-xs font-bold text-[var(--muted)]">30 days - {plan.boostAllowance}</p>
              <ul className="mt-5 flex-1 space-y-3 text-sm font-semibold text-[var(--muted)]">
                {plan.benefits.map((benefit) => (
                  <li key={benefit} className="flex items-center gap-2">
                    <BadgeCheck size={16} className="text-[var(--primary)]" />
                    {benefit}
                  </li>
                ))}
              </ul>
              <form action={startPremiumSubscription} className="mt-6">
                <input type="hidden" name="plan" value={plan.id} />
                <input type="hidden" name="auction_id" value={auctionId} />
                <input type="hidden" name="boost_plan" value={boostPlan} />
                <button className="button button-primary w-full" type="submit" disabled={!paymentReady || activePremium?.plan === plan.id}>
                  {activePremium?.plan === plan.id ? "Subscribed" : paymentReady ? "Subscribe" : "Payment unavailable"}
                </button>
              </form>
            </section>
          );
        })}
      </div>
    </main>
  );
}
