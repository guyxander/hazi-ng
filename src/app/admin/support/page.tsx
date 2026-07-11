import { formatDateTime } from "@/lib/format";
import Link from "next/link";
import { LifeBuoy } from "lucide-react";
import { updateSupportTicket } from "@/app/actions";
import { requireAdmin } from "@/lib/supabase/admin";

export default async function AdminSupportPage() {
  const supabase = await requireAdmin("/admin/support");

  if (!supabase) {
    return null;
  }

  const [{ data: tickets }, { data: admins }] = await Promise.all([
    supabase
      .from("support_tickets")
      .select("id,category,subject,description,status,priority,assigned_to,admin_notes,created_at,updated_at,resolved_at,escalation_level,escalation_reason,escalated_at,appeal_decision,appeal_decided_at,profiles(id,full_name,phone)")
      .order("created_at", { ascending: false })
      .limit(80),
    supabase
      .from("profiles")
      .select("id,full_name")
      .in("role", ["admin", "superadmin"])
      .order("full_name", { ascending: true })
  ]);

  return (
    <main className="container py-10">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="badge badge-premium"><LifeBuoy size={14} /> Support ops</span>
          <h1 className="section-title mt-4">Support tickets</h1>
          <p className="mt-2 text-[var(--muted)]">Escalate, resolve, and track customer support cases.</p>
        </div>
        <Link href="/admin" className="button button-outline">Back to admin</Link>
      </div>

      <section className="card divide-y divide-[var(--line)] overflow-hidden">
        {tickets?.length ? tickets.map((ticket) => {
          const profile = Array.isArray(ticket.profiles) ? ticket.profiles[0] : ticket.profiles;

          return (
            <article key={ticket.id} className="grid gap-5 p-5 lg:grid-cols-[1fr_320px]">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="text-[var(--primary)]">{ticket.subject}</strong>
                  <span className="badge badge-live capitalize">{ticket.status.replaceAll("_", " ")}</span>
                  <span className="badge badge-trust">{ticket.priority}</span>
                  {ticket.escalation_level > 0 ? <span className="badge badge-premium">Escalated L{ticket.escalation_level}</span> : null}
                  {ticket.category === "appeal" ? <span className="badge badge-premium">Appeal</span> : null}
                </div>
                <p className="mt-2 text-sm text-[var(--muted)]">{profile?.full_name ?? "Hazi user"} - {profile?.phone ?? "No phone"}</p>
                <p className="mt-1 text-xs font-bold text-[var(--muted)]">
                  Opened {formatDateTime(ticket.created_at)} - Updated {formatDateTime(ticket.updated_at ?? ticket.created_at)}
                </p>
                <p className="mt-3 leading-6 text-[var(--muted)]">{ticket.description}</p>
                {ticket.escalation_reason ? <p className="mt-3 text-sm font-bold text-[#693c00]">{ticket.escalation_reason}{ticket.escalated_at ? ` - ${formatDateTime(ticket.escalated_at)}` : ""}</p> : null}
                {ticket.appeal_decision ? <p className="mt-3 text-sm font-bold text-[var(--primary)]">Appeal: {ticket.appeal_decision.replaceAll("_", " ")}{ticket.appeal_decided_at ? ` - ${formatDateTime(ticket.appeal_decided_at)}` : ""}</p> : null}
                {ticket.resolved_at ? <p className="mt-2 text-sm font-bold text-emerald-700">Resolved {formatDateTime(ticket.resolved_at)}</p> : null}
              </div>
              <form action={updateSupportTicket} className="grid gap-2 rounded-xl bg-[var(--surface-soft)] p-3">
                <input type="hidden" name="ticket_id" value={ticket.id} />
                <select className="select" name="status" defaultValue={ticket.status}>
                  <option value="open">Open</option>
                  <option value="in_progress">In progress</option>
                  <option value="waiting_on_user">Waiting on user</option>
                  <option value="escalated">Escalated</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
                <select className="select" name="priority" defaultValue={ticket.priority}>
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
                <select className="select" name="assigned_to" defaultValue={ticket.assigned_to ?? ""}>
                  <option value="">Unassigned</option>
                  {admins?.map((admin) => (
                    <option key={admin.id} value={admin.id}>{admin.full_name ?? "Admin"}</option>
                  ))}
                </select>
                <div className="grid gap-2 sm:grid-cols-[110px_1fr]">
                  <input className="input" name="escalation_level" type="number" min="0" max="3" defaultValue={ticket.escalation_level ?? 0} />
                  <input className="input" name="escalation_reason" defaultValue={ticket.escalation_reason ?? ""} placeholder="Escalation reason" />
                </div>
                {ticket.category === "appeal" ? (
                  <select className="select" name="appeal_decision" defaultValue={ticket.appeal_decision ?? ""}>
                    <option value="">Appeal pending</option>
                    <option value="approved">Appeal approved</option>
                    <option value="denied">Appeal denied</option>
                    <option value="needs_more_information">Needs more information</option>
                  </select>
                ) : null}
                <textarea className="textarea min-h-[100px]" name="admin_notes" defaultValue={ticket.admin_notes ?? ""} placeholder="Admin notes" />
                <button className="button button-primary" type="submit">Update ticket</button>
              </form>
            </article>
          );
        }) : <p className="p-5 text-[var(--muted)]">No support tickets yet.</p>}
      </section>
    </main>
  );
}
