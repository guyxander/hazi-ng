import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { formatDateTime, formatNaira } from "@/lib/format";
import { requireAdmin } from "@/lib/supabase/admin";

export default async function AdminAnalyticsPage() {
  const supabase = await requireAdmin("/admin/analytics");

  if (!supabase) {
    return null;
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(todayStart);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data: adminProfiles } = await supabase
    .from("profiles")
    .select("id")
    .in("role", ["admin", "superadmin"]);
  const excludedVisitUserIds = (adminProfiles ?? []).map((profile) => profile.id).filter(Boolean);
  // Supabase's query builder type becomes recursive here after several chained filters.
  // Keep this helper intentionally loose while preserving the exact runtime query.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const applyVisitExclusion = (query: any): any => excludedVisitUserIds.length
    ? query.or(`user_id.is.null,user_id.not.in.(${excludedVisitUserIds.join(",")})`)
    : query;

  const [{ count: users }, { count: auctions }, { count: bids }, { data: premium }, { data: settlements }, { count: agents }, { data: auctionRows }, { data: bidRows }, { data: agentJobs }, { count: totalVisits }, { count: todayVisits }, { count: weekVisits }, { count: signedInVisits }, { count: mobileVisits }, { count: desktopVisits }, { data: recentVisits }] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("auctions").select("*", { count: "exact", head: true }),
    supabase.from("bids").select("*", { count: "exact", head: true }),
    supabase.from("premium_subscriptions").select("amount,status,plan,created_at").order("starts_at", { ascending: false }).limit(200),
    supabase.from("finance_settlements").select("net_amount,settlement_type,created_at").order("created_at", { ascending: false }).limit(200),
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "agent"),
    supabase.from("auctions").select("status,created_at,seller_price,current_bid").order("created_at", { ascending: false }).limit(300),
    supabase.from("bids").select("status,amount,created_at").order("created_at", { ascending: false }).limit(300),
    supabase.from("agent_jobs").select("status,commission_amount,created_at").order("created_at", { ascending: false }).limit(200),
    applyVisitExclusion(supabase.from("site_visit_events").select("*", { count: "exact", head: true })),
    applyVisitExclusion(supabase.from("site_visit_events").select("*", { count: "exact", head: true }).gte("visited_at", todayStart.toISOString())),
    applyVisitExclusion(supabase.from("site_visit_events").select("*", { count: "exact", head: true }).gte("visited_at", sevenDaysAgo.toISOString())),
    applyVisitExclusion(supabase.from("site_visit_events").select("*", { count: "exact", head: true }).not("user_id", "is", null)),
    applyVisitExclusion(supabase.from("site_visit_events").select("*", { count: "exact", head: true }).eq("device_type", "mobile")),
    applyVisitExclusion(supabase.from("site_visit_events").select("*", { count: "exact", head: true }).eq("device_type", "desktop")),
    applyVisitExclusion(supabase.from("site_visit_events").select("path,referrer,device_type,visited_at").order("visited_at", { ascending: false }).limit(200))
  ]);

  const premiumRevenue = premium?.filter((item) => item.status === "active").reduce((sum, item) => sum + Number(item.amount ?? 0), 0) ?? 0;
  const settlementRevenue = settlements?.reduce((sum, item) => sum + Number(item.net_amount ?? 0), 0) ?? 0;
  const conversion = Number(users ?? 0) ? Math.round((Number(bids ?? 0) / Number(users ?? 1)) * 100) : 0;
  const recentVisitRows = (recentVisits ?? []) as Array<{
    path: string;
    referrer: string | null;
    device_type: string | null;
    visited_at: string;
  }>;
  const topVisitPaths = toChartRows(
    recentVisitRows.reduce<Record<string, number>>((paths, visit) => {
      paths[visit.path] = (paths[visit.path] ?? 0) + 1;
      return paths;
    }, {})
  );
  const deviceRows = toChartRows({
    mobile: mobileVisits ?? 0,
    desktop: desktopVisits ?? 0,
    other: Math.max(0, Number(totalVisits ?? 0) - Number(mobileVisits ?? 0) - Number(desktopVisits ?? 0))
  });
  const auctionStatusRows = toChartRows(countBy(auctionRows ?? [], "status"));
  const bidStatusRows = toChartRows(countBy(bidRows ?? [], "status"));
  const premiumPlanRows = toChartRows(sumBy(premium ?? [], "plan", "amount"));
  const agentJobRows = toChartRows(countBy(agentJobs ?? [], "status"));
  const agentCommission = agentJobs?.reduce((sum, job) => sum + Number(job.commission_amount ?? 0), 0) ?? 0;

  return (
    <main className="container py-10">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="badge badge-premium"><BarChart3 size={14} /> Analytics</span>
          <h1 className="section-title mt-4">Platform analytics</h1>
          <p className="mt-2 text-[var(--muted)]">User growth, auction performance, premium revenue, conversion, and agent analytics.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/analytics/export" className="button button-primary">Export CSV</Link>
          <Link href="/admin" className="button button-outline">Back to admin</Link>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <Metric label="Site visits" value={String(totalVisits ?? 0)} />
        <Metric label="Visits today" value={String(todayVisits ?? 0)} />
        <Metric label="Visits in 7 days" value={String(weekVisits ?? 0)} />
        <Metric label="Users" value={String(users ?? 0)} />
        <Metric label="Auctions" value={String(auctions ?? 0)} />
        <Metric label="Bids" value={String(bids ?? 0)} />
        <Metric label="Bid/user conversion" value={`${conversion}%`} />
        <Metric label="Signed-in visits" value={String(signedInVisits ?? 0)} />
        <Metric label="Mobile visits" value={String(mobileVisits ?? 0)} />
        <Metric label="Premium revenue" value={formatNaira(premiumRevenue)} />
        <Metric label="Settlement revenue" value={formatNaira(settlementRevenue)} />
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <Chart title="Top pages" rows={topVisitPaths} />
        <Chart title="Device traffic" rows={deviceRows} />
      </section>

      <section className="card mt-8 overflow-hidden">
        <div className="border-b border-[var(--line)] p-5">
          <h2 className="text-2xl font-extrabold text-[var(--primary)]">Recent visits</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Latest tracked page loads across Hazi.ng.</p>
        </div>
        <div className="divide-y divide-[var(--line)]">
          {recentVisitRows.slice(0, 20).map((visit, index) => (
            <div key={`${visit.path}-${visit.visited_at}-${index}`} className="grid gap-2 p-4 md:grid-cols-[1fr_120px_180px] md:items-center">
              <div className="min-w-0">
                <p className="truncate font-extrabold text-[var(--primary)]">{visit.path}</p>
                {visit.referrer ? <p className="truncate text-sm text-[var(--muted)]">From {visit.referrer}</p> : null}
              </div>
              <span className="badge badge-live capitalize">{visit.device_type}</span>
              <span className="text-sm font-bold text-[var(--muted)] md:text-right">
                {formatDateTime(visit.visited_at)}
              </span>
            </div>
          )) ?? <p className="p-5 text-[var(--muted)]">Visits will appear here after people load the site.</p>}
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="text-2xl font-extrabold text-[var(--primary)]">Premium analytics</h2>
          <div className="mt-4 space-y-3">
            {premium?.slice(0, 12).map((item, index) => (
              <div key={`${item.plan}-${index}`} className="flex items-center justify-between rounded-xl bg-[var(--surface-soft)] p-3">
                <span className="font-bold">{item.plan}</span>
                <span className="font-extrabold text-[var(--primary)]">{formatNaira(Number(item.amount))}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card p-5">
          <h2 className="text-2xl font-extrabold text-[var(--primary)]">Agent analytics</h2>
          <p className="mt-4 text-4xl font-extrabold text-[var(--primary)]">{agents ?? 0}</p>
          <p className="mt-2 text-[var(--muted)]">Registered agent profiles with tracked jobs and commission movement.</p>
          <p className="mt-4 text-2xl font-extrabold text-[var(--primary)]">{formatNaira(agentCommission)}</p>
          <p className="mt-1 text-sm text-[var(--muted)]">Total tracked commission.</p>
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <Chart title="Auction status" rows={auctionStatusRows} />
        <Chart title="Bid status" rows={bidStatusRows} />
        <Chart title="Premium plans" rows={premiumPlanRows} currency />
        <Chart title="Agent job status" rows={agentJobRows} />
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="card p-5"><p className="text-sm font-bold text-[var(--muted)]">{label}</p><p className="mt-2 text-2xl font-extrabold text-[var(--primary)]">{value}</p></div>;
}

type ChartRow = {
  label: string;
  value: number;
};

function countBy(rows: Array<Record<string, unknown>>, key: string) {
  return rows.reduce<Record<string, number>>((totals, row) => {
    const label = String(row[key] ?? "unknown");
    totals[label] = (totals[label] ?? 0) + 1;
    return totals;
  }, {});
}

function sumBy(rows: Array<Record<string, unknown>>, key: string, valueKey: string) {
  return rows.reduce<Record<string, number>>((totals, row) => {
    const label = String(row[key] ?? "unknown");
    totals[label] = (totals[label] ?? 0) + Number(row[valueKey] ?? 0);
    return totals;
  }, {});
}

function toChartRows(values: Record<string, number>) {
  return Object.entries(values)
    .map(([label, value]) => ({ label, value }))
    .sort((first, second) => second.value - first.value)
    .slice(0, 8);
}

function Chart({ title, rows, currency = false }: { title: string; rows: ChartRow[]; currency?: boolean }) {
  const max = Math.max(...rows.map((row) => row.value), 1);

  return (
    <section className="card p-5">
      <h2 className="text-2xl font-extrabold text-[var(--primary)]">{title}</h2>
      <div className="mt-5 space-y-4">
        {rows.length ? rows.map((row) => (
          <div key={row.label}>
            <div className="mb-2 flex items-center justify-between gap-3 text-sm font-bold">
              <span className="capitalize text-[var(--muted)]">{row.label.replaceAll("_", " ")}</span>
              <span className="text-[var(--primary)]">{currency ? formatNaira(row.value) : row.value}</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-[var(--surface-soft)]">
              <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${Math.max(8, Math.round((row.value / max) * 100))}%` }} />
            </div>
          </div>
        )) : <p className="text-sm text-[var(--muted)]">No data yet.</p>}
      </div>
    </section>
  );
}
