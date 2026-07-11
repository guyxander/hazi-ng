import Link from "next/link";
import { Flag, ShieldAlert } from "lucide-react";
import { resolveReport } from "@/app/actions";
import { requireAdmin } from "@/lib/supabase/admin";

export default async function AdminReportsPage() {
  const supabase = await requireAdmin("/admin/reports");

  const { data: reports } = supabase
    ? await supabase
        .from("reports")
        .select(`
          id,
          reason,
          details,
          status,
          created_at,
          auctions(id,title,location,status),
          reporter:profiles!reports_reporter_id_fkey(id,full_name,verification_status),
          reported_user:profiles!reports_reported_user_id_fkey(id,full_name,verification_status)
        `)
        .in("status", ["open", "reviewing"])
        .order("created_at", { ascending: false })
    : { data: [] };

  return (
    <main className="container py-10">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="badge badge-premium"><ShieldAlert size={14} /> Moderation</span>
          <h1 className="section-title mt-4">Report queue</h1>
          <p className="mt-2 text-[var(--muted)]">Review listing and seller reports from authenticated users.</p>
        </div>
        <Link href="/admin" className="button button-outline">Back to admin</Link>
      </div>

      <section className="card overflow-hidden">
        <div className="divide-y divide-[var(--line)]">
          {reports?.length ? reports.map((report) => {
            const auction = Array.isArray(report.auctions) ? report.auctions[0] : report.auctions;
            const reporter = Array.isArray(report.reporter) ? report.reporter[0] : report.reporter;
            const reportedUser = Array.isArray(report.reported_user) ? report.reported_user[0] : report.reported_user;

            return (
              <article key={report.id} className="grid gap-4 p-5 lg:grid-cols-[1fr_220px_270px]">
                <div>
                  <p className="flex items-center gap-2 font-extrabold text-[var(--primary)]">
                    <Flag size={17} /> {formatReason(report.reason)}
                  </p>
                  <p className="mt-1 text-sm font-bold text-[var(--muted)]">
                    {auction ? <Link className="hover:underline" href={`/auctions/${auction.id}`}>{auction.title}</Link> : "User report"}
                  </p>
                  {report.details ? <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{report.details}</p> : null}
                </div>
                <div className="space-y-2 text-sm">
                  <p><span className="font-bold text-[var(--muted)]">Reporter:</span> {reporter?.full_name ?? "Hazi user"}</p>
                  <p><span className="font-bold text-[var(--muted)]">Reported:</span> {reportedUser?.full_name ?? "Listing seller"}</p>
                  <p><span className="font-bold text-[var(--muted)]">Status:</span> {report.status}</p>
                </div>
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <form action={resolveReport}>
                    <input type="hidden" name="report_id" value={report.id} />
                    <input type="hidden" name="status" value="reviewing" />
                    <button className="button button-outline" type="submit">Reviewing</button>
                  </form>
                  <form action={resolveReport}>
                    <input type="hidden" name="report_id" value={report.id} />
                    <input type="hidden" name="status" value="resolved" />
                    <button className="button button-primary" type="submit">Resolve</button>
                  </form>
                  <form action={resolveReport}>
                    <input type="hidden" name="report_id" value={report.id} />
                    <input type="hidden" name="status" value="dismissed" />
                    <button className="button button-outline" type="submit">Dismiss</button>
                  </form>
                </div>
              </article>
            );
          }) : <p className="p-5 text-[var(--muted)]">No open reports in the moderation queue.</p>}
        </div>
      </section>
    </main>
  );
}

function formatReason(reason: string) {
  return reason.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
