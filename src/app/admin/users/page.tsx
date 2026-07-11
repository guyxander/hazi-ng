import { formatDate } from "@/lib/format";
import Link from "next/link";
import { ShieldAlert, ShieldCheck, UserRoundCog } from "lucide-react";
import { grantFreePremiumSubscription, updateUserModerationStatus, updateUserRole } from "@/app/actions";
import { isSuperAdminRole } from "@/lib/roles";
import { requireAdmin } from "@/lib/supabase/admin";

export default async function AdminUsersPage({
  searchParams
}: {
  searchParams?: Promise<{ q?: string; status?: string; role?: string; premium?: string; role_updated?: string }>;
}) {
  const supabase = await requireAdmin("/admin/users");
  const params = await searchParams;
  const q = params?.q?.trim() ?? "";
  const status = params?.status ?? "all";
  const role = params?.role ?? "all";

  if (!supabase) {
    return null;
  }

  const { data: currentUserData } = await supabase.auth.getUser();
  const { data: currentProfile } = currentUserData.user
    ? await supabase.from("profiles").select("role").eq("id", currentUserData.user.id).maybeSingle()
    : { data: null };
  const canAssignRoles = isSuperAdminRole(currentProfile?.role);

  let query = supabase
    .from("profiles")
    .select("id,email,full_name,company_name,phone,location,role,verification_status,account_status,suspension_reason,suspended_at,created_at")
    .order("created_at", { ascending: false })
    .limit(80);

  const searchTerm = q.replace(/[%,()]/g, " ").slice(0, 80).trim();

  if (searchTerm) {
    query = query.or(
      [
        `full_name.ilike.%${searchTerm}%`,
        `email.ilike.%${searchTerm}%`,
        `company_name.ilike.%${searchTerm}%`,
        `phone.ilike.%${searchTerm}%`,
        `location.ilike.%${searchTerm}%`,
        `role.ilike.%${searchTerm}%`,
        `verification_status.ilike.%${searchTerm}%`
      ].join(",")
    );
  }

  if (status !== "all") {
    query = query.eq("account_status", status);
  }

  if (role !== "all") {
    query = query.eq("role", role);
  }

  const { data: users } = await query;
  const userIds = users?.map((user) => user.id) ?? [];
  const { data: premiumRows } = userIds.length
    ? await supabase
        .from("premium_subscriptions")
        .select("id,user_id,plan,status,ends_at,provider,starts_at")
        .in("user_id", userIds)
        .is("auction_id", null)
        .eq("status", "active")
        .or(`ends_at.is.null,ends_at.gt.${new Date().toISOString()}`)
        .order("starts_at", { ascending: false })
    : { data: [] };
  const premiumByUserId = new Map((premiumRows ?? []).map((subscription) => [subscription.user_id, subscription]));

  return (
    <main className="container py-10">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="badge badge-premium"><UserRoundCog size={14} /> User moderation</span>
          <h1 className="section-title mt-4">User controls</h1>
          <p className="mt-2 text-[var(--muted)]">Review profile status, suspend risky accounts, and reactivate users after moderation checks.</p>
        </div>
        <Link href="/admin" className="button button-outline">Back to admin</Link>
      </div>

      <form action="/admin/users" className="card mb-8 grid gap-3 p-4 md:grid-cols-[minmax(220px,1fr)_180px_180px_160px]">
        <input
          className="input"
          name="q"
          defaultValue={q}
          placeholder="Search users by email, name, phone, location..."
        />
        <select className="select" name="status" defaultValue={status}>
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
        <select className="select" name="role" defaultValue={role}>
          <option value="all">All roles</option>
          <option value="buyer">Buyer</option>
          <option value="seller">Seller</option>
          <option value="agent">Agent</option>
          <option value="business">Business</option>
          <option value="admin">Admin</option>
          <option value="superadmin">Superadmin</option>
        </select>
        <button className="button button-primary" type="submit">Filter</button>
      </form>

      {params?.premium === "granted" ? (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
          Free premium package granted.
        </div>
      ) : null}

      {params?.role_updated === "1" ? (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
          User role updated.
        </div>
      ) : null}

      <section className="card overflow-hidden">
        <div className="divide-y divide-[var(--line)]">
          {users?.length ? users.map((profile) => {
            const activePremium = premiumByUserId.get(profile.id);

            return (
            <article key={profile.id} className="grid gap-4 p-5 lg:grid-cols-[1fr_220px_360px]">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="text-lg text-[var(--primary)]">{profile.full_name || "Hazi user"}</strong>
                  <span className={`badge ${profile.account_status === "suspended" ? "badge-live" : "badge-trust"} capitalize`}>
                    {profile.account_status ?? "active"}
                  </span>
                </div>
                <p className="mt-2 text-sm font-bold text-[var(--primary)]">{profile.email || "Email unavailable"}</p>
                <p className="mt-2 text-sm font-bold text-[var(--muted)]">{profile.company_name || profile.location || "Profile details pending"}</p>
                {profile.suspension_reason ? <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{profile.suspension_reason}</p> : null}
              </div>

              <div className="space-y-2 text-sm">
                <p><span className="font-bold text-[var(--muted)]">Role:</span> {profile.role}</p>
                <p><span className="font-bold text-[var(--muted)]">Verification:</span> {profile.verification_status}</p>
                <p><span className="font-bold text-[var(--muted)]">Premium:</span> {activePremium ? activePremium.plan.replaceAll("_", " ") : "None"}</p>
                {activePremium?.ends_at ? <p><span className="font-bold text-[var(--muted)]">Premium ends:</span> {formatDate(activePremium.ends_at)}</p> : null}
                <p><span className="font-bold text-[var(--muted)]">Phone:</span> {profile.phone || "Not set"}</p>
                <p><span className="font-bold text-[var(--muted)]">Joined:</span> {formatDate(profile.created_at)}</p>
              </div>

              <div className="space-y-3 lg:justify-self-end">
                {canAssignRoles ? (
                  <form action={updateUserRole} className="grid gap-2 rounded-xl border border-[var(--line)] bg-white p-3">
                    <input type="hidden" name="user_id" value={profile.id} />
                    <select className="select" name="role" defaultValue={profile.role}>
                      <option value="buyer">Buyer</option>
                      <option value="seller">Seller</option>
                      <option value="agent">Agent</option>
                      <option value="business">Business</option>
                      <option value="admin">Admin</option>
                      <option value="superadmin">Superadmin</option>
                    </select>
                    <button className="button button-primary w-full" type="submit">Assign role</button>
                  </form>
                ) : null}
                {canAssignRoles ? (
                  <form action={grantFreePremiumSubscription} className="grid gap-2 rounded-xl bg-[var(--surface-soft)] p-3">
                    <input type="hidden" name="user_id" value={profile.id} />
                    <select className="select" name="plan" defaultValue="premium_seller">
                      <option value="premium_seller">Premium Seller</option>
                      <option value="premium_agent">Premium Agent</option>
                      <option value="premium_business">Premium Business</option>
                    </select>
                    <select className="select" name="duration_days" defaultValue="30">
                      <option value="30">30 days</option>
                      <option value="90">90 days</option>
                      <option value="365">1 year</option>
                      <option value="lifetime">Lifetime</option>
                    </select>
                    <button className="button button-accent w-full" type="submit">Grant free premium</button>
                  </form>
                ) : null}
                {profile.account_status === "suspended" ? (
                  <form action={updateUserModerationStatus}>
                    <input type="hidden" name="user_id" value={profile.id} />
                    <input type="hidden" name="account_status" value="active" />
                    <button className="button button-primary w-full" type="submit"><ShieldCheck size={16} /> Reactivate</button>
                  </form>
                ) : (
                  <form action={updateUserModerationStatus} className="space-y-2">
                    <input type="hidden" name="user_id" value={profile.id} />
                    <input type="hidden" name="account_status" value="suspended" />
                    <textarea className="textarea min-h-[92px]" name="suspension_reason" placeholder="Reason for suspension" />
                    <button className="button button-outline w-full" type="submit"><ShieldAlert size={16} /> Suspend</button>
                  </form>
                )}
              </div>
            </article>
          );
          }) : <p className="p-5 text-[var(--muted)]">No users match the current filters{q ? ` for "${q}"` : ""}.</p>}
        </div>
      </section>
    </main>
  );
}
