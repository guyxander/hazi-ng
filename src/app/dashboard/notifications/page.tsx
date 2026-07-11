import { redirect } from "next/navigation";
import { Bell } from "lucide-react";
import { markAllNotificationsRead, markNotificationRead, updateNotificationPreferences } from "@/app/actions";
import { NotificationsRealtimeRefresh } from "@/components/notifications-realtime-refresh";
import { PushNotificationControl } from "@/components/push-notification-control";
import { getSafeUser } from "@/lib/supabase/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function NotificationsPage() {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return (
      <main className="container py-10">
        <div className="card p-6">Add Supabase environment variables to view notifications.</div>
      </main>
    );
  }

  const user = await getSafeUser(supabase);

  if (!user) {
    redirect("/auth?next=/dashboard/notifications");
  }

  const [{ data: notifications }, { data: preferences }, { count: activePushCount }] = await Promise.all([
    supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("notification_preferences")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("push_subscriptions")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "active")
  ]);

  const unreadCount = notifications?.filter((notification) => !notification.read_at).length ?? 0;

  return (
    <main className="container py-10">
      <NotificationsRealtimeRefresh userId={user.id} />
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="badge badge-live"><Bell size={14} /> Notification center</span>
          <h1 className="section-title mt-4">Notifications</h1>
          <p className="mt-2 text-[var(--muted)]">{unreadCount} unread update{unreadCount === 1 ? "" : "s"}.</p>
        </div>
        {unreadCount ? (
          <form action={markAllNotificationsRead}>
            <button className="button button-outline" type="submit">Mark all read</button>
          </form>
        ) : null}
      </div>
      <section className="mb-8 grid gap-6 lg:grid-cols-[1fr_360px]">
        <form action={updateNotificationPreferences} className="card grid gap-3 p-5">
          <h2 className="text-2xl font-extrabold text-[var(--primary)]">Preferences</h2>
          {[
            ["sms_enabled", "SMS"],
            ["email_enabled", "Email"],
            ["push_enabled", "Browser push"],
            ["escrow_updates", "Escrow updates"],
            ["bid_updates", "Bid updates"],
            ["delivery_updates", "Delivery updates"],
            ["marketing_updates", "Marketing updates"]
          ].map(([name, label]) => (
            <label key={name} className="flex items-center justify-between rounded-xl bg-[var(--surface-soft)] p-3 font-bold text-[var(--primary)]">
              {label}
              <input type="checkbox" name={name} defaultChecked={preferences ? Boolean(preferences[name]) : name !== "push_enabled" && name !== "marketing_updates"} />
            </label>
          ))}
          <button className="button button-primary" type="submit">Save preferences</button>
        </form>

        <div className="card p-5">
          <h2 className="text-2xl font-extrabold text-[var(--primary)]">Real-time updates</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">In-app notifications refresh through Supabase data and unread states.</p>
        </div>
      </section>

      <section className="mb-8">
        <PushNotificationControl userId={user.id} existingCount={activePushCount ?? 0} />
      </section>

      <section className="card divide-y divide-[var(--line)] overflow-hidden">
        {notifications?.length ? notifications.map((notification) => (
          <article key={notification.id} className={`grid gap-4 p-5 md:grid-cols-[1fr_160px] ${notification.read_at ? "" : "bg-[var(--surface-soft)]"}`}>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-extrabold text-[var(--primary)]">{notification.title}</h2>
                {!notification.read_at ? <span className="badge badge-live">New</span> : null}
              </div>
              <p className="mt-1 text-[var(--muted)]">{notification.body}</p>
            </div>
            {!notification.read_at ? (
              <form action={markNotificationRead} className="md:justify-self-end">
                <input type="hidden" name="notification_id" value={notification.id} />
                <button className="button button-outline" type="submit">Mark read</button>
              </form>
            ) : (
              <span className="text-sm font-bold text-[var(--muted)] md:justify-self-end">Read</span>
            )}
          </article>
        )) : <p className="p-5 text-[var(--muted)]">No notifications yet.</p>}
      </section>
    </main>
  );
}
