import Link from "next/link";
import { Banknote, CheckCircle2, XCircle } from "lucide-react";
import { reviewPaymentProof } from "@/app/actions";
import { formatNaira } from "@/lib/format";
import { requireAdmin } from "@/lib/supabase/admin";

export default async function AdminPaymentsPage() {
  const supabase = await requireAdmin("/admin/payments");

  if (!supabase) {
    return null;
  }

  const { data: payments } = await supabase
    .from("transaction_payments")
    .select(`
      id,
      transaction_id,
      payer_id,
      amount,
      method,
      reference,
      proof_url,
      proof_name,
      status,
      review_notes,
      created_at,
      transactions(id,auction_id,status,buyer_id,seller_id,auctions(id,title,location)),
      payer:profiles!transaction_payments_payer_id_fkey(id,full_name,verification_status)
    `)
    .in("status", ["pending", "rejected"])
    .order("created_at", { ascending: false })
    .limit(60);

  const paymentsWithUrls = await Promise.all((payments ?? []).map(async (payment) => {
    if (!payment.proof_url) {
      return { ...payment, signedUrl: null };
    }

    const { data } = await supabase.storage
      .from("payment-proofs")
      .createSignedUrl(payment.proof_url, 60 * 10);

    return { ...payment, signedUrl: data?.signedUrl ?? null };
  }));

  return (
    <main className="container py-10">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="badge badge-premium"><Banknote size={14} /> Payment operations</span>
          <h1 className="section-title mt-4">Payment proof queue</h1>
          <p className="mt-2 text-[var(--muted)]">Review buyer receipts and verify escrow payments before order fulfillment starts.</p>
        </div>
        <Link href="/admin" className="button button-outline">Back to admin</Link>
      </div>

      <section className="card overflow-hidden">
        <div className="divide-y divide-[var(--line)]">
          {paymentsWithUrls.length ? paymentsWithUrls.map((payment) => {
            const transaction = Array.isArray(payment.transactions) ? payment.transactions[0] : payment.transactions;
            const auction = Array.isArray(transaction?.auctions) ? transaction?.auctions[0] : transaction?.auctions;
            const payer = Array.isArray(payment.payer) ? payment.payer[0] : payment.payer;

            return (
              <article key={payment.id} className="grid gap-4 p-5 lg:grid-cols-[1fr_220px_320px]">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/transactions/${payment.transaction_id}`} className="text-lg font-extrabold text-[var(--primary)] hover:underline">
                      {auction?.title ?? "Transaction payment"}
                    </Link>
                    <span className="badge badge-trust capitalize">{payment.status}</span>
                  </div>
                  <p className="mt-2 text-sm font-bold text-[var(--muted)]">{auction?.location ?? "Location pending"}</p>
                  {payment.signedUrl ? (
                    <a href={payment.signedUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-sm font-extrabold text-[var(--accent)] hover:underline">
                      Open payment proof
                    </a>
                  ) : (
                    <p className="mt-3 text-sm font-bold text-[var(--muted)]">Provider payment, no uploaded receipt.</p>
                  )}
                  {payment.review_notes ? <p className="mt-2 text-sm text-[var(--muted)]">{payment.review_notes}</p> : null}
                </div>

                <div className="space-y-2 text-sm">
                  <p className="font-extrabold text-[var(--primary)]">{formatNaira(Number(payment.amount))}</p>
                  <p><span className="font-bold text-[var(--muted)]">Payer:</span> {payer?.full_name ?? "Buyer"}</p>
                  <p><span className="font-bold text-[var(--muted)]">Method:</span> {payment.method.replaceAll("_", " ")}</p>
                  <p><span className="font-bold text-[var(--muted)]">Reference:</span> {payment.reference || "Not provided"}</p>
                  <p><span className="font-bold text-[var(--muted)]">Transaction:</span> {transaction?.status ?? "pending"}</p>
                </div>

                <div className="space-y-3">
                  <form action={reviewPaymentProof}>
                    <input type="hidden" name="payment_id" value={payment.id} />
                    <input type="hidden" name="decision" value="verified" />
                    <input type="hidden" name="review_notes" value="Payment proof verified by admin." />
                    <button className="button button-primary w-full" type="submit"><CheckCircle2 size={16} /> Verify payment</button>
                  </form>
                  <form action={reviewPaymentProof} className="space-y-2">
                    <input type="hidden" name="payment_id" value={payment.id} />
                    <input type="hidden" name="decision" value="rejected" />
                    <textarea className="textarea min-h-[88px]" name="review_notes" placeholder="Reason for rejection" />
                    <button className="button button-outline w-full" type="submit"><XCircle size={16} /> Reject proof</button>
                  </form>
                </div>
              </article>
            );
          }) : <p className="p-5 text-[var(--muted)]">No payment proofs waiting for review.</p>}
        </div>
      </section>
    </main>
  );
}
