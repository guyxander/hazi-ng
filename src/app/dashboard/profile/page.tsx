import { formatDate } from "@/lib/format";
import { redirect } from "next/navigation";
import Link from "next/link";
import { BadgeCheck, Building2, MapPin, Phone, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { updateProfile } from "@/app/actions";
import { GeolocationFields } from "@/components/geolocation-fields";
import { SuccessAnimation } from "@/components/success-animation";
import { SELF_SELECTABLE_PROFILE_ROLES, isAgentRole } from "@/lib/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const PREMIUM_PLAN_LABELS: Record<string, string> = {
  premium_seller: "Premium Seller",
  premium_agent: "Premium Agent",
  premium_business: "Premium Business"
};

export default async function ProfilePage({
  searchParams
}: {
  searchParams?: Promise<{ saved?: string; next?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return (
      <main className="container py-10">
        <div className="card p-6">Add Supabase environment variables to edit your profile.</div>
      </main>
    );
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    redirect("/auth?next=/dashboard/profile");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id,full_name,company_name,phone,location,latitude,longitude,avatar_url,role,verification_status,response_rate,rating")
    .eq("id", user.id)
    .single();
  const { data: activePremium } = await supabase
    .from("premium_subscriptions")
    .select("id,plan,ends_at,provider")
    .eq("user_id", user.id)
    .is("auction_id", null)
    .in("plan", ["premium_seller", "premium_agent", "premium_business"])
    .eq("status", "active")
    .or(`ends_at.is.null,ends_at.gt.${new Date().toISOString()}`)
    .order("starts_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const premiumLabel = activePremium ? PREMIUM_PLAN_LABELS[activePremium.plan] ?? activePremium.plan : "No premium plan";
  const premiumExpiry = activePremium?.ends_at ? `Ends ${formatDate(activePremium.ends_at)}` : activePremium ? "Lifetime" : "Not active";
  const selfSelectableRole = SELF_SELECTABLE_PROFILE_ROLES.has(profile?.role ?? "") ? profile?.role : "buyer";

  return (
    <main className="container py-10">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="badge badge-trust"><UserRound size={14} /> Account profile</span>
          <h1 className="section-title mt-4">Your Hazi.ng profile</h1>
          <p className="mt-2 max-w-2xl text-[var(--muted)]">Keep your seller, buyer, agent, or business profile current for trust signals across listings and transactions.</p>
        </div>
        <Link href="/dashboard" className="button button-outline">Back to dashboard</Link>
      </div>

      {params?.saved === "1" ? (
        <div className="mb-6">
          <SuccessAnimation title="Profile saved" message="Your public details and delivery location are up to date." />
        </div>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <form action={updateProfile} className="card space-y-5 p-6">
          {params?.next ? <input type="hidden" name="next" value={params.next} /> : null}
          <div>
            <label className="text-sm font-bold text-[var(--muted)]">Full name</label>
            <input className="input mt-2" name="full_name" required defaultValue={profile?.full_name ?? user.email?.split("@")[0] ?? ""} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-bold text-[var(--muted)]">Marketplace role</label>
              <select className="select mt-2" name="role" defaultValue={selfSelectableRole}>
                <option value="buyer">Buyer</option>
                <option value="seller">Seller</option>
                <option value="business">Business seller</option>
              </select>
              {isAgentRole(profile?.role) ? (
                <p className="mt-2 text-xs font-bold text-[var(--primary)]">Assigned agent role is managed by Hazi.ng admin.</p>
              ) : null}
            </div>
            <div>
              <label className="text-sm font-bold text-[var(--muted)]">Company or display brand</label>
              <input className="input mt-2" name="company_name" defaultValue={profile?.company_name ?? ""} placeholder="Optional" />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-bold text-[var(--muted)]">Phone</label>
              <input className="input mt-2" name="phone" defaultValue={profile?.phone ?? ""} placeholder="+234..." />
            </div>
          </div>

          <div>
            <label className="text-sm font-bold text-[var(--muted)]">Avatar URL</label>
            <input className="input mt-2" name="avatar_url" type="url" defaultValue={profile?.avatar_url ?? ""} placeholder="https://..." />
          </div>

          <GeolocationFields
            addressName="location"
            defaultAddress={profile?.location ?? ""}
            defaultLatitude={profile?.latitude ?? null}
            defaultLongitude={profile?.longitude ?? null}
          />

          <button className="button button-primary w-full" type="submit">Save profile</button>
        </form>

        <aside className="space-y-4">
          <div className="card p-5">
            <h2 className="text-2xl font-extrabold text-[var(--primary)]">Trust snapshot</h2>
            <div className="mt-5 space-y-3">
              <SnapshotRow icon={ShieldCheck} label="Verification" value={profile?.verification_status ?? "unverified"} />
              <SnapshotRow icon={Sparkles} label="Premium plan" value={`${premiumLabel} - ${premiumExpiry}`} />
              <SnapshotRow icon={BadgeCheck} label="Response rate" value={`${profile?.response_rate ?? 0}%`} />
              <SnapshotRow icon={UserRound} label="Rating" value={String(profile?.rating ?? 0)} />
            </div>
          </div>

          <div className="card p-5">
            <h2 className="text-2xl font-extrabold text-[var(--primary)]">Public details</h2>
            <div className="mt-5 space-y-3 text-sm text-[var(--muted)]">
              <p className="flex items-center gap-2"><Building2 size={16} /> {profile?.company_name || "No brand set"}</p>
              <p className="flex items-center gap-2"><Phone size={16} /> {profile?.phone || "No phone set"}</p>
              <p className="flex items-center gap-2"><MapPin size={16} /> {profile?.location || "No location set"}</p>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}

function SnapshotRow({
  icon: Icon,
  label,
  value
}: {
  icon: typeof ShieldCheck;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl bg-[var(--surface-soft)] p-4">
      <span className="flex items-center gap-2 font-bold text-[var(--muted)]"><Icon size={16} /> {label}</span>
      <span className="font-extrabold text-[var(--primary)]">{value}</span>
    </div>
  );
}
