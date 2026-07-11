import Link from "next/link";
import { CheckCircle2, Landmark, XCircle } from "lucide-react";
import { executeFlutterwaveWithdrawal, reviewWalletWithdrawal } from "@/app/actions";
import { formatDateTime, formatNaira } from "@/lib/format";
import { requireAdmin } from "@/lib/supabase/admin";

export default async function AdminPayoutsPage({
  searchParams
}: {
  searchParams?: Promise<{ payout?: string; payout_error?: string }>;
}) {
  const query = await searchParams;
  const supabase = await requireAdmin("/admin/payouts");

  if (!supabase) {
    return null;
  }

  const { data: withdrawals } = await supabase
    .from("withdrawal_requests")
    .select("id,user_id,amount,currency,source_bucket,bank_name,bank_code,account_number,account_name,status,provider,provider_reference,admin_notes,created_at,reviewed_at")
    .order("created_at", { ascending: false })
    .limit(80);

  const userIds = [...new Set((withdrawals ?? []).map((item) => item.user_id).filter(Boolean))];
  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select("id,full_name,phone,verification_status").in("id", userIds)
    : { data: [] };
  const profilesById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const pendingCount = withdrawals?.filter((item) => item.status === "pending").length ?? 0;

  return (
    <main className="container py-10">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="badge badge-premium"><Landmark size={14} /> Payouts</span>
          <h1 className="section-title mt-4">Admin payout approval</h1>
          <p className="mt-2 text-[var(--muted)]">Review wallet withdrawal requests before money leaves Hazi.ng.</p>
        </div>
        <Link href="/admin" className="button button-outline">Back to admin</Link>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="card p-5">
          <p className="text-sm font-bold text-[var(--muted)]">Pending payout requests</p>
          <p className="mt-2 text-3xl font-extrabold text-[var(--primary)]">{pendingCount}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm font-bold text-[var(--muted)]">Total pending amount</p>
          <p className="mt-2 text-3xl font-extrabold text-[var(--primary)]">
            {formatNaira((withdrawals ?? []).filter((item) => item.status === "pending").reduce((sum, item) => sum + Number(item.amount ?? 0), 0))}
          </p>
        </div>
        <div className="card p-5">
          <p className="text-sm font-bold text-[var(--muted)]">Ledger control</p>
          <p className="mt-2 text-sm text-[var(--muted)]">Approvals and rejections run through backend wallet functions only.</p>
        </div>
      </section>

      {query?.payout ? (
        <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-bold text-green-800">
          Payout action completed: {query.payout.replaceAll("_", " ")}.
        </div>
      ) : null}

      {query?.payout_error ? (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">
          Payout action failed: {decodeURIComponent(query.payout_error).replaceAll("_", " ")}.
        </div>
      ) : null}

      <section className="card mt-8 overflow-hidden">
        <div className="border-b border-[var(--line)] p-5">
          <h2 className="text-2xl font-extrabold text-[var(--primary)]">Withdrawal queue</h2>
        </div>
        <div className="divide-y divide-[var(--line)]">
          {withdrawals?.length ? withdrawals.map((item) => {
            const profile = profilesById.get(item.user_id);

            return (
              <article key={item.id} className="grid gap-5 p-5 xl:grid-cols-[1fr_180px_360px]">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-[var(--primary)]">{profile?.full_name ?? "Hazi user"}</strong>
                    <span className={`badge ${item.status === "pending" ? "badge-live" : "badge-trust"} capitalize`}>{item.status}</span>
                    <span className="badge badge-trust capitalize">{item.source_bucket}</span>
                  </div>
                  <p className="mt-2 text-sm text-[var(--muted)]">{profile?.phone ?? "Phone not saved"} - {profile?.verification_status ?? "verification pending"}</p>
                  <p className="mt-3 font-bold text-[var(--primary)]">{item.bank_name} - {item.account_name} - {item.account_number}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">Bank code: {item.bank_code ?? "Missing"}</p>
                  {item.provider ? <p className="mt-1 text-sm text-[var(--muted)]">Provider: {item.provider}</p> : null}
                  {item.provider_reference ? <p className="mt-1 text-sm text-[var(--muted)]">Reference: {item.provider_reference}</p> : null}
                  {item.admin_notes ? <p className="mt-1 text-sm text-[var(--muted)]">Note: {item.admin_notes}</p> : null}
                </div>

                <div>
                  <p className="text-sm font-bold text-[var(--muted)]">Amount</p>
                  <p className="mt-1 text-2xl font-extrabold text-[var(--primary)]">{formatNaira(Number(item.amount))}</p>
                  <p className="mt-2 text-xs font-bold text-[var(--muted)]">{formatDateTime(item.created_at)}</p>
                </div>

                {item.status === "pending" ? (
                  <div className="grid gap-3">
                    <form action={executeFlutterwaveWithdrawal} className="grid gap-2 rounded-xl bg-emerald-50 p-3">
                      <input type="hidden" name="withdrawal_id" value={item.id} />
                      <button className="button button-primary" type="submit" disabled={!item.bank_code}>
                        <CheckCircle2 size={17} /> Pay with Flutterwave
                      </button>
                      {!item.bank_code ? <p className="text-xs font-bold text-red-700">Bank code is required for Flutterwave transfer.</p> : null}
                    </form>
                    <form action={reviewWalletWithdrawal} className="grid gap-2 rounded-xl bg-[var(--surface-soft)] p-3">
                      <input type="hidden" name="withdrawal_id" value={item.id} />
                      <input type="hidden" name="decision" value="approved" />
                      <input className="input" name="provider_reference" placeholder="Bank transfer reference" required />
                      <input className="input" name="admin_notes" placeholder="Admin note, optional" />
                      <button className="button button-primary" type="submit"><CheckCircle2 size={17} /> Approve payout</button>
                    </form>
                    <form action={reviewWalletWithdrawal} className="grid gap-2 rounded-xl bg-red-50 p-3">
                      <input type="hidden" name="withdrawal_id" value={item.id} />
                      <input type="hidden" name="decision" value="rejected" />
                      <input className="input" name="admin_notes" placeholder="Reason for rejection" required />
                      <button className="button button-outline" type="submit"><XCircle size={17} /> Reject</button>
                    </form>
                  </div>
                ) : (
                  <div className="rounded-xl bg-[var(--surface-soft)] p-4 text-sm font-bold text-[var(--muted)]">
                    Reviewed {item.reviewed_at ? formatDateTime(item.reviewed_at) : "by admin"}
                  </div>
                )}
              </article>
            );
          }) : <p className="p-5 text-[var(--muted)]">No withdrawal requests yet.</p>}
        </div>
      </section>
    </main>
  );
}
