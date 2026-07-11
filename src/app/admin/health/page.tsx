import { formatDateTime } from "@/lib/format";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, HeartPulse, Play, Send } from "lucide-react";
import { runFlutterwaveWebhookSmokeTest, sendLaunchNotificationTest, startFlutterwaveLaunchTest, updateLaunchChecklistItem } from "@/app/actions";
import { requireAdmin } from "@/lib/supabase/admin";

const providerChecks = [
  {
    label: "Flutterwave payments",
    env: ["FLUTTERWAVE_SECRET_KEY", "NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY", "FLUTTERWAVE_WEBHOOK_SECRET_HASH", "FLUTTERWAVE_PAYMENT_OPTIONS"],
    fallback: "Manual payment proof review and wallet ledger controls are active."
  },
  {
    label: "OpenRouter AI estimates",
    env: ["OPENROUTER_API_KEY", "OPENROUTER_FREE_MODEL"],
    fallback: "Formula-based delivery estimates remain active."
  },
  {
    label: "SMS provider",
    env: ["TERMII_API_KEY", "TERMII_SENDER_ID"],
    fallback: "External notification outbox is active."
  },
  {
    label: "Email provider",
    env: ["RESEND_API_KEY"],
    fallback: "External notification outbox is active."
  },
  {
    label: "Browser push",
    env: ["NEXT_PUBLIC_VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY"],
    fallback: "Push subscription capture is active; add VAPID keys to enable browser delivery."
  }
];

const launchChecklist = [
  {
    id: "flutterwave_live_payment",
    category: "payments",
    label: "Full Flutterwave live payment test",
    detail: "Run a real successful checkout and confirm wallet/escrow reconciliation."
  },
  {
    id: "flutterwave_webhooks",
    category: "payments",
    label: "Flutterwave webhook scenarios",
    detail: "Confirm successful, failed, abandoned, and duplicate events are idempotent."
  },
  {
    id: "opay_checkout",
    category: "payments",
    label: "OPay checkout through Flutterwave",
    detail: "Confirm OPay appears in checkout and completes provider verification."
  },
  {
    id: "android_chrome_qa",
    category: "qa",
    label: "Android Chrome end-to-end QA",
    detail: "Test signup, Google auth, posting, images, bidding, wallet, checkout, delivery quote, dashboard, and admin."
  },
  {
    id: "mobile_overflow_qa",
    category: "qa",
    label: "Small-screen overflow QA",
    detail: "Inspect remaining layout overflow and header density on smaller Android screens."
  },
  {
    id: "termii_live_sms",
    category: "notifications",
    label: "Termii live SMS sending",
    detail: "Send a real transactional SMS and confirm provider message ID/status."
  },
  {
    id: "resend_live_email",
    category: "notifications",
    label: "Resend live email sending",
    detail: "Send a real transactional email and confirm delivery status."
  },
  {
    id: "kyc_provider_selected",
    category: "kyc",
    label: "Automated ID/liveness provider selected",
    detail: "Choose and connect a real provider for ID verification and face match."
  },
  {
    id: "payout_provider_selected",
    category: "payouts",
    label: "Real payout provider connected",
    detail: "Connect bank payout execution beyond manual admin approval."
  }
];

export default async function AdminHealthPage({
  searchParams
}: {
  searchParams?: Promise<{ test?: string; test_error?: string; flutterwave_test_ref?: string }>;
}) {
  const supabase = await requireAdmin("/admin/health");

  if (!supabase) {
    return null;
  }

  const [
    { count: users },
    { count: activeAuctions },
    { count: pendingPayments },
    { count: activeDeliveries },
    { count: queuedOutbox },
    { count: openReports },
    { count: auditLogs },
    { count: pendingWithdrawals },
    { data: savedChecklist }
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("auctions").select("*", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("transaction_payments").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("delivery_orders").select("*", { count: "exact", head: true }).in("status", ["booked", "assigned", "picked_up", "in_transit"]),
    supabase.from("external_notification_outbox").select("*", { count: "exact", head: true }).eq("status", "queued"),
    supabase.from("reports").select("*", { count: "exact", head: true }).in("status", ["open", "reviewing"]),
    supabase.from("audit_logs").select("*", { count: "exact", head: true }),
    supabase.from("withdrawal_requests").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("launch_checklist_items").select("id,status,notes,checked_at")
  ]);

  const supabaseReady = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  const checklistById = new Map((savedChecklist ?? []).map((item) => [item.id, item]));
  const query = await searchParams;

  return (
    <main className="container py-10">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="badge badge-premium"><HeartPulse size={14} /> Launch readiness</span>
          <h1 className="section-title mt-4">Health check</h1>
          <p className="mt-2 text-[var(--muted)]">Review backend connectivity, provider configuration, and operational queues before launch.</p>
        </div>
        <Link href="/admin" className="button button-outline">Back to admin</Link>
      </div>

      {query?.test ? (
        <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-bold text-green-800">
          Test completed: {query.test.replaceAll("_", " ")}.
        </div>
      ) : null}

      {query?.test_error ? (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">
          Test failed: {decodeURIComponent(query.test_error).replaceAll("_", " ")}.
        </div>
      ) : null}

      {query?.flutterwave_test_ref ? (
        <div className="mb-6 rounded-xl border border-[var(--line)] bg-[var(--accent-soft)] p-4 text-sm font-bold text-[var(--primary)]">
          Flutterwave returned from launch checkout reference {query.flutterwave_test_ref}. Confirm payment/webhook reconciliation before marking the test passed.
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <HealthCard label="Supabase" ready={supabaseReady} detail={supabaseReady ? "Connected with publishable key." : "Missing public Supabase env vars."} />
        <HealthCard label="Auth sessions" ready detail="Server-side Supabase Auth is configured." />
        <HealthCard label="Audit trail" ready={Number(auditLogs ?? 0) >= 0} detail={`${auditLogs ?? 0} sensitive events recorded.`} />
      </section>

      <section className="card mt-8 overflow-hidden">
        <div className="border-b border-[var(--line)] p-5">
          <h2 className="text-2xl font-extrabold text-[var(--primary)]">Provider readiness</h2>
        </div>
        <div className="divide-y divide-[var(--line)]">
          {providerChecks.map((check) => {
            const ready = check.env.every((name) => Boolean(process.env[name]));

            return (
              <div key={check.label} className="grid gap-3 p-5 md:grid-cols-[1fr_140px]">
                <div>
                  <strong className="text-[var(--primary)]">{check.label}</strong>
                  <p className="mt-1 text-sm text-[var(--muted)]">{ready ? "Provider env vars are present." : check.fallback}</p>
                  <p className="mt-2 text-xs font-bold text-[var(--muted)]">{check.env.join(", ")}</p>
                </div>
                <StatusPill ready={ready} />
              </div>
            );
          })}
        </div>
      </section>

      <section className="card mt-8 overflow-hidden">
        <div className="border-b border-[var(--line)] p-5">
          <h2 className="text-2xl font-extrabold text-[var(--primary)]">Live provider tests</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Run these only when you are ready to contact the real provider. Results are saved into the launch checklist.</p>
        </div>
        <div className="grid gap-4 p-5 lg:grid-cols-2">
          <form action={startFlutterwaveLaunchTest} className="rounded-xl bg-[var(--surface-soft)] p-4">
            <h3 className="text-lg font-extrabold text-[var(--primary)]">Flutterwave checkout</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_140px]">
              <input className="input" name="email" type="email" placeholder="payer@email.com" required />
              <input className="input" name="amount" type="number" min="100" defaultValue="1000" />
            </div>
            <button className="button button-primary mt-3 w-full" type="submit">
              <Play size={16} /> Start live checkout
            </button>
          </form>

          <form action={runFlutterwaveWebhookSmokeTest} className="rounded-xl bg-[var(--surface-soft)] p-4">
            <h3 className="text-lg font-extrabold text-[var(--primary)]">Flutterwave webhook idempotency</h3>
            <p className="mt-2 text-sm text-[var(--muted)]">Creates a harmless failed webhook record twice with the same event ID to confirm duplicate handling.</p>
            <button className="button button-outline mt-4 w-full" type="submit">
              <Play size={16} /> Run webhook smoke test
            </button>
          </form>

          <form action={sendLaunchNotificationTest} className="rounded-xl bg-[var(--surface-soft)] p-4">
            <h3 className="text-lg font-extrabold text-[var(--primary)]">SMS/email delivery</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-[140px_1fr]">
              <select className="select" name="channel" defaultValue="email">
                <option value="email">Resend email</option>
                <option value="sms">Termii SMS</option>
              </select>
              <input className="input" name="destination" placeholder="email address or phone number" required />
            </div>
            <button className="button button-outline mt-3 w-full" type="submit">
              <Send size={16} /> Send live test
            </button>
          </form>
        </div>
      </section>

      <section className="card mt-8 overflow-hidden">
        <div className="border-b border-[var(--line)] p-5">
          <h2 className="text-2xl font-extrabold text-[var(--primary)]">Operational queues</h2>
        </div>
        <div className="grid gap-4 p-5 md:grid-cols-3">
          <QueueMetric label="Users" value={users ?? 0} />
          <QueueMetric label="Active auctions" value={activeAuctions ?? 0} />
          <QueueMetric label="Pending payments" value={pendingPayments ?? 0} href="/admin/payments" />
          <QueueMetric label="Pending payouts" value={pendingWithdrawals ?? 0} href="/admin/payouts" />
          <QueueMetric label="Active deliveries" value={activeDeliveries ?? 0} href="/admin/deliveries" />
          <QueueMetric label="Queued outbox" value={queuedOutbox ?? 0} href="/admin/notifications" />
          <QueueMetric label="Open reports" value={openReports ?? 0} href="/admin/reports" />
        </div>
      </section>

      <section className="card mt-8 overflow-hidden">
        <div className="border-b border-[var(--line)] p-5">
          <h2 className="text-2xl font-extrabold text-[var(--primary)]">Launch verification checklist</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Track live tests that cannot be proven by env vars alone.</p>
        </div>
        <div className="divide-y divide-[var(--line)]">
          {launchChecklist.map((item) => {
            const saved = checklistById.get(item.id);
            const status = saved?.status ?? "pending";

            return (
              <form key={item.id} action={updateLaunchChecklistItem} className="grid gap-4 p-5 lg:grid-cols-[1fr_180px_260px]">
                <input type="hidden" name="id" value={item.id} />
                <input type="hidden" name="label" value={item.label} />
                <input type="hidden" name="category" value={item.category} />
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-[var(--primary)]">{item.label}</strong>
                    <span className="badge badge-trust capitalize">{item.category}</span>
                    <span className={`badge capitalize ${status === "passed" ? "badge-trust" : status === "failed" ? "bg-red-50 text-red-700" : "badge-live"}`}>
                      {status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-[var(--muted)]">{item.detail}</p>
                  {saved?.checked_at ? <p className="mt-2 text-xs font-bold text-[var(--muted)]">Updated {formatDateTime(saved.checked_at)}</p> : null}
                </div>
                <select className="select" name="status" defaultValue={status}>
                  <option value="pending">Pending</option>
                  <option value="passed">Passed</option>
                  <option value="failed">Failed</option>
                  <option value="blocked">Blocked</option>
                </select>
                <div className="grid gap-2">
                  <input className="input" name="notes" defaultValue={saved?.notes ?? ""} placeholder="Notes or reference" />
                  <button className="button button-outline" type="submit">Update check</button>
                </div>
              </form>
            );
          })}
        </div>
      </section>
    </main>
  );
}

function HealthCard({ label, ready, detail }: { label: string; ready: boolean; detail: string }) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-extrabold text-[var(--primary)]">{label}</h2>
        {ready ? <CheckCircle2 className="text-green-700" /> : <AlertTriangle className="text-red-700" />}
      </div>
      <p className="mt-3 text-sm text-[var(--muted)]">{detail}</p>
    </div>
  );
}

function StatusPill({ ready }: { ready: boolean }) {
  return (
    <span className={`badge justify-self-start md:justify-self-end ${ready ? "badge-trust" : "badge-live"}`}>
      {ready ? "Ready" : "Internal mode"}
    </span>
  );
}

function QueueMetric({ label, value, href }: { label: string; value: number; href?: string }) {
  const content = (
    <div className="rounded-xl bg-[var(--surface-soft)] p-4">
      <p className="text-sm font-bold text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-2xl font-extrabold text-[var(--primary)]">{value}</p>
    </div>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}
