import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Banknote,
  BarChart3,
  BellRing,
  BriefcaseBusiness,
  CircleDollarSign,
  ClipboardList,
  CreditCard,
  Eye,
  FileText,
  HandCoins,
  Headphones,
  HeartPulse,
  IdCard,
  Landmark,
  ScrollText,
  ShieldAlert,
  TriangleAlert,
  Truck,
  Users
} from "lucide-react";
import { adminDeleteAuction, adminUpdateAuctionStatus, resolveDispute } from "@/app/actions";
import { requireAdmin } from "@/lib/supabase/admin";
import { formatNaira } from "@/lib/format";

export default async function AdminPage() {
  const supabase = await requireAdmin("/admin");
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(todayStart);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [{ count: auctions }, { count: users }, { count: reports }, { count: suspendedUsers }, { count: agentLeads }, { count: pendingPayments }, { count: pendingPayouts }, { count: activeDeliveries }, { count: queuedExternal }, { count: auditEvents }, { count: openErrors }, { count: totalVisits }, { count: todayVisits }, { count: weekVisits }, { data: latest }, { data: disputes }, { data: premiumRows }] = supabase
    ? await Promise.all([
        supabase.from("auctions").select("*", { count: "exact", head: true }),
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("reports").select("*", { count: "exact", head: true }),
        supabase.from("profiles").select("*", { count: "exact", head: true }).eq("account_status", "suspended"),
        supabase.from("agent_leads").select("*", { count: "exact", head: true }).in("status", ["new", "contacted", "assigned"]),
        supabase.from("transaction_payments").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("withdrawal_requests").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("delivery_orders").select("*", { count: "exact", head: true }).in("status", ["booked", "assigned", "picked_up", "in_transit"]),
        supabase.from("external_notification_outbox").select("*", { count: "exact", head: true }).eq("status", "queued"),
        supabase.from("audit_logs").select("*", { count: "exact", head: true }),
        supabase.from("app_error_events").select("*", { count: "exact", head: true }).is("resolved_at", null),
        supabase.from("site_visit_events").select("*", { count: "exact", head: true }),
        supabase.from("site_visit_events").select("*", { count: "exact", head: true }).gte("visited_at", todayStart.toISOString()),
        supabase.from("site_visit_events").select("*", { count: "exact", head: true }).gte("visited_at", sevenDaysAgo.toISOString()),
        supabase.from("auctions").select("id,title,status,location,created_at").order("created_at", { ascending: false }).limit(8),
        supabase
          .from("transactions")
          .select("id,auction_id,buyer_id,seller_id,amount,status,created_at,auctions(id,title,location)")
          .eq("status", "disputed")
          .order("created_at", { ascending: false })
          .limit(8),
        supabase.from("premium_subscriptions").select("amount,status").eq("status", "active")
      ])
    : [{ count: 3 }, { count: 0 }, { count: 0 }, { count: 0 }, { count: 0 }, { count: 0 }, { count: 0 }, { count: 0 }, { count: 0 }, { count: 0 }, { count: 0 }, { count: 0 }, { count: 0 }, { count: 0 }, { data: [] }, { data: [] }, { data: [] }];

  const premiumRevenue = premiumRows?.reduce((total, row) => total + Number(row.amount ?? 0), 0) ?? 0;
  const overviewItems = [
    { icon: HeartPulse, label: "Health", value: "Open", hint: "Launch readiness checks." },
    { icon: Eye, label: "Site visits", value: String(totalVisits ?? 0), hint: `${todayVisits ?? 0} today, ${weekVisits ?? 0} in the last 7 days.` },
    { icon: Activity, label: "Auctions", value: String(auctions ?? 0), hint: "Total marketplace listings." },
    { icon: Users, label: "Users", value: String(users ?? 0), hint: "Profiles created in Supabase." },
    { icon: ShieldAlert, label: "Reports", value: String(reports ?? 0), hint: "Open moderation workload." },
    { icon: ShieldAlert, label: "Suspended", value: String(suspendedUsers ?? 0), hint: "Accounts under restriction." },
    { icon: BriefcaseBusiness, label: "Agent leads", value: String(agentLeads ?? 0), hint: "Open declutter requests." },
    { icon: Banknote, label: "Payments", value: String(pendingPayments ?? 0), hint: "Proofs waiting for review." },
    { icon: Landmark, label: "Payouts", value: String(pendingPayouts ?? 0), hint: "Withdrawal requests awaiting approval." },
    { icon: Truck, label: "Deliveries", value: String(activeDeliveries ?? 0), hint: "Active logistics orders." },
    { icon: BellRing, label: "Outbox", value: String(queuedExternal ?? 0), hint: "Queued SMS/email notices." },
    { icon: ClipboardList, label: "Audit", value: String(auditEvents ?? 0), hint: "Recorded sensitive events." },
    { icon: TriangleAlert, label: "Errors", value: String(openErrors ?? 0), hint: "Unresolved production crashes." },
    { icon: CircleDollarSign, label: "Premium revenue", value: formatNaira(premiumRevenue), hint: "Active listing boosts." }
  ];
  const adminLinks = [
    { href: "/admin/health", label: "Health", icon: HeartPulse },
    { href: "/admin/kyc", label: "KYC queue", icon: IdCard },
    { href: "/admin/users", label: "Users", icon: Users },
    { href: "/admin/payments", label: "Payments", icon: CreditCard },
    { href: "/admin/payouts", label: "Payouts", icon: HandCoins },
    { href: "/admin/deliveries", label: "Deliveries", icon: Truck },
    { href: "/admin/notifications", label: "Notifications", icon: BellRing },
    { href: "/admin/reports", label: "Reports", icon: FileText },
    { href: "/admin/agent-leads", label: "Agent leads", icon: BriefcaseBusiness },
    { href: "/admin/audit", label: "Audit trail", icon: ScrollText },
    { href: "/admin/finance", label: "Finance", icon: Landmark },
    { href: "/admin/analytics", label: "Site analytics", icon: BarChart3, primary: true },
    { href: "/admin/support", label: "Support", icon: Headphones },
    { href: "/admin/errors", label: "Errors", icon: TriangleAlert }
  ];

  return (
    <main className="container py-10">
      <div className="mb-8">
        <span className="badge badge-premium">Operations</span>
        <h1 className="section-title mt-4">Admin dashboard</h1>
        <p className="mt-2 text-[var(--muted)]">Marketplace overview for auctions, users, verification, reports, revenue, and premium placement.</p>
      </div>

      <section className="dashboard-shell">
        <aside className="dashboard-shell__menu" aria-label="Admin menu">
          <p className="dashboard-shell__menu-title">Operations</p>
          {adminLinks.map((item) => (
            <AdminShortcutLink key={item.href} {...item} />
          ))}
        </aside>

        <div className="dashboard-shell__content">
          <section className="card overflow-hidden">
            <div className="border-b border-[var(--line)] p-5">
              <h2 className="text-2xl font-extrabold text-[var(--primary)]">Operations overview</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">Live marketplace metrics arranged for quick desktop scanning.</p>
            </div>
            <div className="divide-y divide-[var(--line)]">
              {overviewItems.map((item) => (
                <AdminOverviewRow key={item.label} {...item} />
              ))}
            </div>
          </section>
          <section className="card mt-8 overflow-hidden">
            <div className="border-b border-[var(--line)] p-5">
              <h2 className="text-2xl font-extrabold text-[var(--primary)]">Latest auctions</h2>
            </div>
            <div className="divide-y divide-[var(--line)]">
              {latest?.length ? latest.map((item) => (
                <div key={item.id} className="grid gap-3 p-5 lg:grid-cols-[1fr_120px_150px_260px]">
                  <strong>{item.title}</strong>
                  <span className="font-bold text-[var(--muted)]">{item.status}</span>
                  <span className="font-bold text-[var(--muted)]">{item.location}</span>
                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <form action={adminUpdateAuctionStatus}>
                      <input type="hidden" name="auction_id" value={item.id} />
                      <input type="hidden" name="status" value={item.status === "paused" ? "active" : "paused"} />
                      <button className="button button-outline" type="submit">{item.status === "paused" ? "Resume" : "Pause"}</button>
                    </form>
                    <form action={adminDeleteAuction}>
                      <input type="hidden" name="auction_id" value={item.id} />
                      <button className="button button-outline text-red-700" type="submit">Delete</button>
                    </form>
                  </div>
                </div>
              )) : <p className="p-5 text-[var(--muted)]">No live Supabase auctions yet.</p>}
            </div>
          </section>

          <section className="card mt-8 overflow-hidden">
            <div className="border-b border-[var(--line)] p-5">
              <h2 className="text-2xl font-extrabold text-[var(--primary)]">Dispute queue</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">Admin-only transaction disputes. Resolution updates both parties and closes the dispute.</p>
            </div>
            <div className="divide-y divide-[var(--line)]">
              {disputes?.length ? disputes.map((item) => {
                const auction = Array.isArray(item.auctions) ? item.auctions[0] : item.auctions;

                return (
                  <div key={item.id} className="grid gap-4 p-5 lg:grid-cols-[1fr_150px_260px]">
                    <div>
                      <Link href={`/admin/disputes/${item.id}`} className="font-extrabold text-[var(--primary)] hover:underline">
                        {auction?.title ?? "Disputed transaction"}
                      </Link>
                      <p className="mt-1 text-sm font-bold text-[var(--muted)]">{auction?.location ?? "Location pending"}</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[var(--muted)]">Amount</p>
                      <p className="font-extrabold text-[var(--primary)]">{formatNaira(Number(item.amount))}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      <form action={resolveDispute}>
                        <input type="hidden" name="transaction_id" value={item.id} />
                        <input type="hidden" name="resolution" value="release" />
                        <button className="button button-primary" type="submit">Release funds</button>
                      </form>
                      <form action={resolveDispute}>
                        <input type="hidden" name="transaction_id" value={item.id} />
                        <input type="hidden" name="resolution" value="refund" />
                        <button className="button button-outline" type="submit">Refund buyer</button>
                      </form>
                    </div>
                  </div>
                );
              }) : <p className="p-5 text-[var(--muted)]">No disputed transactions waiting for review.</p>}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

function AdminShortcutLink({
  href,
  label,
  icon: Icon,
  primary = false
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  primary?: boolean;
}) {
  return (
    <Link href={href} className={primary ? "dashboard-shell__menu-primary" : ""}>
      <Icon size={17} />
      {label}
    </Link>
  );
}

function AdminOverviewRow({
  icon: Icon,
  label,
  value,
  hint
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <article className="grid gap-4 p-5 sm:grid-cols-[44px_1fr_auto] sm:items-center">
      <div className="grid size-11 place-items-center rounded-xl bg-[var(--surface-soft)] text-[var(--primary)]">
        <Icon size={20} />
      </div>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-extrabold text-[var(--primary)]">{label}</h3>
          <span className="badge badge-live">Live</span>
        </div>
        <p className="mt-1 text-sm text-[var(--muted)]">{hint}</p>
      </div>
      <p className="text-3xl font-extrabold text-[var(--primary)] sm:text-right">{value}</p>
    </article>
  );
}
