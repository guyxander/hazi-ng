import { formatDateTime } from "@/lib/format";
import Link from "next/link";
import { BellRing, CheckCircle2, XCircle } from "lucide-react";
import { updateExternalNotificationStatus } from "@/app/actions";
import { requireAdmin } from "@/lib/supabase/admin";

export default async function AdminExternalNotificationsPage() {
  const supabase = await requireAdmin("/admin/notifications");

  if (!supabase) {
    return null;
  }

  const [{ data: notifications }, { count: activePushCount }, { count: failedPushCount }, { count: sentPushCount }, { count: failedPushDeliveryCount }] = await Promise.all([
    supabase
      .from("external_notification_outbox")
      .select("id,recipient_user_id,channel,destination,subject,body,status,related_entity_type,related_entity_id,provider,provider_message_id,failure_reason,sent_at,created_at,profiles!external_notification_outbox_recipient_user_id_fkey(id,full_name,phone)")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("push_subscriptions").select("*", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("push_subscriptions").select("*", { count: "exact", head: true }).eq("status", "failed"),
    supabase.from("notification_push_deliveries").select("*", { count: "exact", head: true }).eq("status", "sent"),
    supabase.from("notification_push_deliveries").select("*", { count: "exact", head: true }).eq("status", "failed")
  ]);

  return (
    <main className="container py-10">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="badge badge-premium"><BellRing size={14} /> External notifications</span>
          <h1 className="section-title mt-4">Notification delivery</h1>
          <p className="mt-2 text-[var(--muted)]">Review queued SMS/email messages and browser push delivery health.</p>
        </div>
        <Link href="/admin" className="button button-outline">Back to admin</Link>
      </div>

      <section className="mb-6 grid gap-4 md:grid-cols-4">
        <div className="card p-5">
          <p className="text-sm font-bold text-[var(--muted)]">Active browser push subscriptions</p>
          <p className="mt-2 text-3xl font-extrabold text-[var(--primary)]">{activePushCount ?? 0}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm font-bold text-[var(--muted)]">Failed browser push subscriptions</p>
          <p className="mt-2 text-3xl font-extrabold text-[var(--primary)]">{failedPushCount ?? 0}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm font-bold text-[var(--muted)]">Sent browser pushes</p>
          <p className="mt-2 text-3xl font-extrabold text-[var(--primary)]">{sentPushCount ?? 0}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm font-bold text-[var(--muted)]">Failed browser pushes</p>
          <p className="mt-2 text-3xl font-extrabold text-[var(--primary)]">{failedPushDeliveryCount ?? 0}</p>
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="divide-y divide-[var(--line)]">
          {notifications?.length ? notifications.map((notification) => {
            const recipient = Array.isArray(notification.profiles) ? notification.profiles[0] : notification.profiles;

            return (
              <article key={notification.id} className="grid gap-4 p-5 lg:grid-cols-[1fr_230px_320px]">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-lg text-[var(--primary)]">{notification.subject}</strong>
                    <span className="badge badge-trust uppercase">{notification.channel}</span>
                    <span className="badge badge-live capitalize">{notification.status}</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{notification.body}</p>
                  {notification.failure_reason ? <p className="mt-2 text-sm font-bold text-red-700">{notification.failure_reason}</p> : null}
                </div>

                <div className="space-y-2 text-sm">
                  <p><span className="font-bold text-[var(--muted)]">Recipient:</span> {recipient?.full_name ?? "Hazi user"}</p>
                  <p><span className="font-bold text-[var(--muted)]">Destination:</span> {notification.destination || recipient?.phone || "Missing"}</p>
                  <p><span className="font-bold text-[var(--muted)]">Related:</span> {notification.related_entity_type || "None"}</p>
                  <p><span className="font-bold text-[var(--muted)]">Queued:</span> {formatDateTime(notification.created_at)}</p>
                  {notification.sent_at ? <p><span className="font-bold text-[var(--muted)]">Sent:</span> {formatDateTime(notification.sent_at)}</p> : null}
                </div>

                <div className="space-y-3">
                  <form action={updateExternalNotificationStatus} className="space-y-2">
                    <input type="hidden" name="notification_id" value={notification.id} />
                    <input type="hidden" name="status" value="sent" />
                    <input className="input" name="provider" defaultValue={notification.provider ?? "manual"} placeholder="Provider" />
                    <input className="input" name="provider_message_id" defaultValue={notification.provider_message_id ?? ""} placeholder="Message ID" />
                    <button className="button button-primary w-full" type="submit"><CheckCircle2 size={16} /> Mark sent</button>
                  </form>
                  <form action={updateExternalNotificationStatus} className="space-y-2">
                    <input type="hidden" name="notification_id" value={notification.id} />
                    <input type="hidden" name="status" value="failed" />
                    <input className="input" name="failure_reason" placeholder="Failure reason" />
                    <button className="button button-outline w-full" type="submit"><XCircle size={16} /> Mark failed</button>
                  </form>
                  {["failed", "cancelled"].includes(notification.status) ? (
                    <form action={updateExternalNotificationStatus}>
                      <input type="hidden" name="notification_id" value={notification.id} />
                      <input type="hidden" name="status" value="queued" />
                      <button className="button button-accent w-full" type="submit">Retry delivery</button>
                    </form>
                  ) : null}
                </div>
              </article>
            );
          }) : <p className="p-5 text-[var(--muted)]">No external notifications queued yet.</p>}
        </div>
      </section>
    </main>
  );
}
