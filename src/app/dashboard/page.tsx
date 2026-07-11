import Link from "next/link";
import { redirect } from "next/navigation";
import { BadgeCheck, Bell, Bookmark, Gavel, LayoutDashboard, Package, ShieldCheck, Sparkles, UserCircle, WalletCards } from "lucide-react";
import { CopyReferralLink } from "@/components/copy-referral-link";
import { StatCard } from "@/components/stat-card";
import { formatNaira } from "@/lib/format";
import { isAdminRole } from "@/lib/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const PREMIUM_PLAN_LABELS: Record<string, string> = {
  premium_seller: "Premium Seller",
  premium_agent: "Premium Agent",
  premium_business: "Premium Business"
};

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return <MissingEnvDashboard />;
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    redirect("/auth?next=/dashboard");
  }

  const [{ count: listingCount }, { data: notifications }, { count: unreadNotifications }, { count: savedCount }, { count: bidCount }, { data: profile }, { data: wallet }, { count: referralCount }, { count: referralRewards }, { data: activePremium }] = await Promise.all([
    supabase.from("auctions").select("*", { count: "exact", head: true }).or(`seller_id.eq.${user.id},listed_for_user_id.eq.${user.id}`),
    supabase.from("notifications").select("id,title,body,created_at,read_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5),
    supabase.from("notifications").select("*", { count: "exact", head: true }).eq("user_id", user.id).is("read_at", null),
    supabase.from("auction_watchlist").select("*", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("bids").select("*", { count: "exact", head: true }).eq("bidder_id", user.id),
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("wallet_accounts")
      .select("available_balance,earnings_balance,refund_balance,pending_withdrawal_balance")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase.from("user_referrals").select("*", { count: "exact", head: true }).eq("inviter_id", user.id),
    supabase.from("referral_boost_rewards").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "unused"),
    supabase
      .from("premium_subscriptions")
      .select("id,plan,ends_at,provider")
      .eq("user_id", user.id)
      .is("auction_id", null)
      .in("plan", ["premium_seller", "premium_agent", "premium_business"])
      .eq("status", "active")
      .or(`ends_at.is.null,ends_at.gt.${new Date().toISOString()}`)
      .order("starts_at", { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);

  const walletBalance = Number(wallet?.available_balance ?? 0) + Number(wallet?.earnings_balance ?? 0) + Number(wallet?.refund_balance ?? 0);
  const referralLink = `https://hazi.ng/auth?mode=signup&ref=${user.id}`;

  return (
    <main className="container py-10">
      <div className="mb-8">
        <div>
          <div className="flex flex-wrap gap-2">
            <span className="badge badge-trust"><ShieldCheck size={14} /> {profile?.verification_status ?? "Profile pending"}</span>
            {activePremium ? (
              <span className="badge badge-premium"><Sparkles size={14} /> {PREMIUM_PLAN_LABELS[activePremium.plan] ?? activePremium.plan}</span>
            ) : null}
          </div>
          <h1 className="section-title mt-4">Welcome, {profile?.full_name || user.email}</h1>
          <p className="mt-2 text-[var(--muted)]">Manage listings, bids, notifications, verification, premium, and payouts.</p>
        </div>
      </div>

      <section className="dashboard-shell">
        <aside className="dashboard-shell__menu dashboard-shell__menu--desktop" aria-label="Dashboard menu">
          <p className="dashboard-shell__menu-title">Account</p>
          <Link href="/dashboard/profile"><UserCircle size={17} /> Profile</Link>
          <Link href="/dashboard"><LayoutDashboard size={17} /> Dashboard</Link>
          <Link href="/dashboard/listings"><Package size={17} /> Your listings</Link>
          <Link href="/dashboard/wallet"><WalletCards size={17} /> Wallet</Link>
          <Link href="/dashboard/payout-settings"><WalletCards size={17} /> Payouts</Link>
          <Link href="/dashboard/bids"><Gavel size={17} /> Bids</Link>
          <Link href="/dashboard/verification"><BadgeCheck size={17} /> Verification</Link>
          {isAdminRole(profile?.role) ? <Link href="/admin"><ShieldCheck size={17} /> Admin page</Link> : null}
        </aside>

        <div className="dashboard-shell__content">
          <section className="grid gap-4 md:grid-cols-5">
            <StatCard icon={Package} label="Listings" value={String(listingCount ?? 0)} hint="Seller auction inventory." />
            <StatCard icon={WalletCards} label="Wallet" value={formatNaira(walletBalance)} hint="Available, earnings, and refunds." />
            <StatCard icon={Bell} label="Notifications" value={String(unreadNotifications ?? 0)} hint="Unread updates." />
            <StatCard icon={Bookmark} label="Watchlist" value={String(savedCount ?? 0)} hint="Saved auctions." />
            <StatCard icon={Gavel} label="Bids" value={String(bidCount ?? 0)} hint="Offers placed." />
          </section>

      <section className="card mt-8 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-extrabold text-[var(--primary)]">Referral bonus</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">Invite 3 friends who register on Hazi.ng and get 1 free promoted listing.</p>
            <CopyReferralLink value={referralLink} />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl bg-[var(--surface-soft)] p-4">
              <p className="text-sm font-bold text-[var(--muted)]">Registered invites</p>
              <p className="text-2xl font-extrabold text-[var(--primary)]">{referralCount ?? 0}</p>
            </div>
            <div className="rounded-xl bg-[var(--accent-soft)] p-4">
              <p className="text-sm font-bold text-[#693c00]">Free boosts</p>
              <p className="text-2xl font-extrabold text-[#2c1600]">{referralRewards ?? 0}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="card mt-8 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-extrabold text-[var(--primary)]">Recent notifications</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">Quick updates from your listings, bids, escrow, and account activity.</p>
          </div>
          <Link href="/dashboard/notifications" className="button button-outline px-3">View all</Link>
        </div>
        <div className="mt-4 grid gap-3">
          {notifications?.length ? notifications.map((item) => (
            <div key={item.id} className="rounded-xl bg-[var(--surface-soft)] p-4">
              <div className="flex items-center justify-between gap-3">
                <strong>{item.title}</strong>
                {!item.read_at ? <span className="badge badge-live">New</span> : null}
              </div>
              <p className="mt-1 text-sm text-[var(--muted)]">{item.body}</p>
            </div>
          )) : <p className="text-sm text-[var(--muted)]">No notifications yet.</p>}
        </div>
      </section>
        </div>
      </section>
    </main>
  );
}

function MissingEnvDashboard() {
  return (
    <main className="container py-10">
      <div className="card max-w-2xl p-6">
        <h1 className="text-3xl font-extrabold text-[var(--primary)]">Supabase keys needed locally</h1>
        <p className="mt-3 text-[var(--muted)]">The database schema is created, but the app needs <code>.env.local</code> with your Supabase URL and publishable key to use Auth and protected dashboard data.</p>
      </div>
    </main>
  );
}
