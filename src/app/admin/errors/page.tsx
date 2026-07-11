import { formatDateTime } from "@/lib/format";
import Link from "next/link";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { resolveAppErrorEvent } from "@/app/actions";
import { requireAdmin } from "@/lib/supabase/admin";

export default async function AdminErrorsPage() {
  const supabase = await requireAdmin("/admin/errors");

  if (!supabase) {
    return null;
  }

  const { data: events } = await supabase
    .from("app_error_events")
    .select("id,source,message,digest,path,user_agent,metadata,resolved_at,created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  const unresolved = events?.filter((event) => !event.resolved_at) ?? [];
  const resolved = events?.filter((event) => event.resolved_at) ?? [];

  return (
    <main className="container py-10">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="badge badge-premium"><AlertTriangle size={14} /> Monitoring</span>
          <h1 className="section-title mt-4">Production errors</h1>
          <p className="mt-2 text-[var(--muted)]">Review client and route crashes recorded from live error boundaries.</p>
        </div>
        <Link href="/admin" className="button button-outline">Back to admin</Link>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="card p-5">
          <p className="text-sm font-bold text-[var(--muted)]">Unresolved</p>
          <p className="mt-2 text-3xl font-extrabold text-[var(--primary)]">{unresolved.length}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm font-bold text-[var(--muted)]">Resolved</p>
          <p className="mt-2 text-3xl font-extrabold text-[var(--primary)]">{resolved.length}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm font-bold text-[var(--muted)]">Recent events</p>
          <p className="mt-2 text-3xl font-extrabold text-[var(--primary)]">{events?.length ?? 0}</p>
        </div>
      </section>

      <section className="card mt-8 overflow-hidden">
        <div className="border-b border-[var(--line)] p-5">
          <h2 className="text-2xl font-extrabold text-[var(--primary)]">Error events</h2>
        </div>
        <div className="divide-y divide-[var(--line)]">
          {events?.length ? events.map((event) => (
            <article key={event.id} className="grid gap-4 p-5 lg:grid-cols-[1fr_220px]">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={event.resolved_at ? "badge badge-trust" : "badge badge-premium"}>
                    {event.resolved_at ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                    {event.resolved_at ? "Resolved" : "Open"}
                  </span>
                  <span className="badge badge-live">{event.source}</span>
                  {event.digest ? <span className="rounded-full bg-[var(--surface-soft)] px-3 py-1 text-xs font-extrabold text-[var(--muted)]">{event.digest}</span> : null}
                </div>
                <h3 className="mt-3 text-lg font-extrabold text-[var(--primary)]">{event.message}</h3>
                {event.path ? <p className="mt-2 break-all text-sm font-bold text-[var(--muted)]">{event.path}</p> : null}
                {event.user_agent ? <p className="mt-2 line-clamp-2 text-xs font-semibold text-[var(--muted)]">{event.user_agent}</p> : null}
              </div>
              <div className="space-y-3 text-sm font-bold text-[var(--muted)] lg:text-right">
                <p>{formatDateTime(event.created_at)}</p>
                {!event.resolved_at ? (
                  <form action={resolveAppErrorEvent}>
                    <input type="hidden" name="error_id" value={event.id} />
                    <button className="button button-outline" type="submit">Mark resolved</button>
                  </form>
                ) : (
                  <p>Resolved {formatDateTime(event.resolved_at)}</p>
                )}
              </div>
            </article>
          )) : <p className="p-5 text-[var(--muted)]">No production errors have been recorded yet.</p>}
        </div>
      </section>
    </main>
  );
}
