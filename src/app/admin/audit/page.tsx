import { formatDateTime } from "@/lib/format";
import Link from "next/link";
import { ClipboardList, UserRoundCog } from "lucide-react";
import { requireAdmin } from "@/lib/supabase/admin";

export default async function AdminAuditPage() {
  const supabase = await requireAdmin("/admin/audit");

  if (!supabase) {
    return null;
  }

  const { data: logs } = await supabase
    .from("audit_logs")
    .select("id,action,entity_type,entity_id,metadata,created_at,profiles!audit_logs_actor_id_fkey(id,full_name,role)")
    .order("created_at", { ascending: false })
    .limit(80);

  return (
    <main className="container py-10">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="badge badge-premium"><ClipboardList size={14} /> Audit trail</span>
          <h1 className="section-title mt-4">Admin activity</h1>
          <p className="mt-2 text-[var(--muted)]">Track sensitive moderation, verification, dispute, and agent-lead decisions.</p>
        </div>
        <Link href="/admin" className="button button-outline">Back to admin</Link>
      </div>

      <section className="card overflow-hidden">
        <div className="divide-y divide-[var(--line)]">
          {logs?.length ? logs.map((log) => {
            const actor = Array.isArray(log.profiles) ? log.profiles[0] : log.profiles;

            return (
              <article key={log.id} className="grid gap-4 p-5 lg:grid-cols-[1fr_220px_260px]">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-lg text-[var(--primary)]">{formatAction(log.action)}</strong>
                    <span className="badge badge-trust">{log.entity_type}</span>
                  </div>
                  <p className="mt-2 break-all text-sm font-bold text-[var(--muted)]">{log.entity_id ?? "No entity id"}</p>
                  <MetadataView metadata={log.metadata} />
                </div>
                <div className="space-y-2 text-sm">
                  <p className="flex items-center gap-2 font-extrabold text-[var(--primary)]"><UserRoundCog size={16} /> {actor?.full_name ?? "Admin user"}</p>
                  <p className="font-bold text-[var(--muted)]">Role: {actor?.role ?? "admin"}</p>
                </div>
                <div className="text-sm font-bold text-[var(--muted)] lg:text-right">
                  {formatDateTime(log.created_at)}
                </div>
              </article>
            );
          }) : <p className="p-5 text-[var(--muted)]">No audit events recorded yet.</p>}
        </div>
      </section>
    </main>
  );
}

function formatAction(action: string) {
  return action.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function MetadataView({ metadata }: { metadata: unknown }) {
  if (!metadata || typeof metadata !== "object") {
    return null;
  }

  const entries = Object.entries(metadata as Record<string, unknown>).filter(([, value]) => value !== null && value !== "");

  if (!entries.length) {
    return null;
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {entries.map(([key, value]) => (
        <span key={key} className="rounded-full bg-[var(--surface-soft)] px-3 py-1 text-xs font-extrabold text-[var(--muted)]">
          {formatAction(key)}: {String(value)}
        </span>
      ))}
    </div>
  );
}
