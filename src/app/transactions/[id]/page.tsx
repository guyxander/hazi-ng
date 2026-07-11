import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, Clock, CreditCard, FileCheck2, MapPin, MessageSquareText, PackageCheck, ShieldCheck, Truck } from "lucide-react";
import { bookDeliveryOrder, cancelDeliveryOrder, confirmBuyerReceipt, confirmSellerDelivery, payEscrowFromWallet, requestDeliveryQuote, sendTransactionMessage, startFlutterwavePayment, submitDisputeEvidence, submitPaymentProof, updateTransactionStatus } from "@/app/actions";
import { TransactionRealtimeRefresh } from "@/components/transaction-realtime-refresh";
import { VerifiedName } from "@/components/verified-name";
import { getDeliveryEstimate, hasCoordinates } from "@/lib/delivery-estimate";
import { formatNaira } from "@/lib/format";
import { isFlutterwaveConfigured } from "@/lib/flutterwave";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function TransactionPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ accepted?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return <MissingSupabase />;
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    redirect(`/auth?next=/transactions/${id}`);
  }

  const { data: transaction } = await supabase
    .from("transactions")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!transaction) {
    redirect("/dashboard");
  }

  if (user.id !== transaction.buyer_id && user.id !== transaction.seller_id) {
    redirect("/dashboard");
  }

  const [{ data: auction }, { data: messages }, { data: buyer }, { data: seller }, { data: deliveryQuotes }, { data: deliveryOrders }, { data: payments }, { data: wallet }, { data: evidence }] = await Promise.all([
    supabase
      .from("auctions")
      .select("id,title,location,latitude,longitude,status,delivery_available,pickup_available,auction_images(image_url,alt_text,position)")
      .eq("id", transaction.auction_id)
      .maybeSingle(),
    supabase
      .from("transaction_messages")
      .select("id,body,sender_id,created_at")
      .eq("transaction_id", transaction.id)
      .order("created_at", { ascending: true }),
    supabase.from("public_profiles").select("id,full_name,location,latitude,longitude,verification_status,response_rate").eq("id", transaction.buyer_id).maybeSingle(),
    supabase.from("public_profiles").select("id,full_name,location,latitude,longitude,verification_status,response_rate").eq("id", transaction.seller_id).maybeSingle(),
    supabase
      .from("delivery_quotes")
      .select("id,provider,pickup_location,dropoff_location,distance_km,estimated_fee,status,created_at")
      .eq("auction_id", transaction.auction_id)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("delivery_orders")
      .select("id,quote_id,provider,pickup_location,dropoff_location,distance_km,fee,status,tracking_code,courier_name,courier_phone,notes,created_at,updated_at")
      .eq("transaction_id", transaction.id)
      .order("created_at", { ascending: false })
      .limit(3),
    supabase
      .from("transaction_payments")
      .select("id,amount,method,reference,proof_url,proof_name,status,review_notes,created_at,reviewed_at")
      .eq("transaction_id", transaction.id)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("wallet_accounts")
      .select("available_balance,refund_balance,earnings_balance,escrow_balance")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("dispute_evidence")
      .select("id,submitted_by,evidence_type,file_name,notes,created_at")
      .eq("transaction_id", transaction.id)
      .order("created_at", { ascending: false })
      .limit(8)
  ]);

  const displayProfileIds = [...new Set([
    transaction.buyer_id,
    transaction.seller_id,
    ...(messages ?? []).map((message) => message.sender_id),
    ...(evidence ?? []).map((item) => item.submitted_by)
  ].filter(Boolean))];
  const { data: displayProfiles } = displayProfileIds.length
    ? await supabase.from("public_profiles").select("id,full_name,verification_status,response_rate").in("id", displayProfileIds)
    : { data: [] };
  const displayProfileRows = [...(displayProfiles ?? []), buyer, seller].filter((profile): profile is {
    id: string;
    full_name: string | null;
    verification_status: string | null;
    response_rate: number | null;
  } => Boolean(profile));
  const displayProfileById = new Map(displayProfileRows.map((profile) => [profile.id, profile]));

  const paymentsWithUrls = await Promise.all((payments ?? []).map(async (payment) => {
    if (!payment.proof_url) {
      return { ...payment, signedUrl: null };
    }

    const { data } = await supabase.storage
      .from("payment-proofs")
      .createSignedUrl(payment.proof_url, 60 * 10);

    return { ...payment, signedUrl: data?.signedUrl ?? null };
  }));

  const isBuyer = user.id === transaction.buyer_id;
  const isSeller = user.id === transaction.seller_id;
  const otherParty = isBuyer ? seller : buyer;
  const hasPendingOrVerifiedPayment = payments?.some((payment) => ["pending", "verified"].includes(payment.status)) ?? false;
  const transactionStatus = transaction.status || "escrow_pending";
  const transactionAmount = Number(transaction.amount ?? 0);
  const canSubmitPaymentProof = isBuyer && transactionStatus === "escrow_pending" && !hasPendingOrVerifiedPayment;
  const canPayWithFlutterwave = canSubmitPaymentProof && isFlutterwaveConfigured();
  const walletAvailable = Number(wallet?.available_balance ?? 0);
  const canPayWithWallet = canSubmitPaymentProof && walletAvailable >= transactionAmount;
  const canReleaseFunds = isBuyer && transactionStatus === "paid";
  const canMarkDeliveryStarted = isSeller && transactionStatus === "paid" && !transaction.seller_delivery_started_at;
  const canDispute = transactionStatus === "escrow_pending" || transactionStatus === "paid";
  const activeDeliveryOrder = deliveryOrders?.find((order) => order.status !== "cancelled") ?? null;
  const pickupCoordinates = hasCoordinates(auction)
    ? { latitude: auction.latitude, longitude: auction.longitude }
    : hasCoordinates(seller)
      ? { latitude: seller.latitude, longitude: seller.longitude }
      : null;
  const dropoffCoordinates = hasCoordinates(buyer)
    ? { latitude: buyer.latitude, longitude: buyer.longitude }
    : null;
  const suggestedDeliveryEstimate = pickupCoordinates && dropoffCoordinates
    ? getDeliveryEstimate(pickupCoordinates, dropoffCoordinates)
    : null;
  const pickupLocation = auction?.location || seller?.location || "Seller pickup location";
  const dropoffLocation = buyer?.location || "Buyer saved location";

  return (
    <main className="container py-10">
      <TransactionRealtimeRefresh transactionId={transaction.id} />
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="badge badge-trust"><ShieldCheck size={14} /> Escrow linked chat</span>
          <h1 className="section-title mt-4">{auction?.title ?? "Accepted auction"}</h1>
          <p className="mt-2 flex items-center gap-2 text-[var(--muted)]">
            <MapPin size={16} />
            {auction?.location ?? "Location pending"}
          </p>
        </div>
        <Link href={`/auctions/${transaction.auction_id}`} className="button button-outline">View auction</Link>
      </div>

      {query?.accepted === "1" || transactionStatus === "escrow_pending" ? (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900">
          <p className="flex items-center gap-2 font-extrabold">
            <CheckCircle2 size={18} /> Bid accepted. Escrow chat is open.
          </p>
          <p className="mt-2 text-sm font-bold">
            Use this chat to coordinate pickup or delivery and receipt confirmation. Funds stay protected in escrow until the buyer confirms receipt or a dispute is resolved.
          </p>
        </div>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="card overflow-hidden">
          <div className="border-b border-[var(--line)] p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-extrabold text-[var(--primary)]">Messages</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">Coordinate pickup, delivery, and receipt confirmation with {otherParty?.full_name ?? "the other party"}.</p>
              </div>
              <MessageSquareText className="text-[var(--primary)]" />
            </div>
          </div>

          <div className="min-h-[380px] space-y-4 bg-[var(--surface-soft)] p-5">
            {messages?.length ? messages.map((message) => {
              const mine = message.sender_id === user.id;
              const sender = displayProfileById.get(message.sender_id);

              return (
                <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[78%] rounded-2xl p-4 ${mine ? "bg-[var(--primary)] text-white" : "bg-white text-[var(--text)]"}`}>
                    <p className="text-sm font-bold opacity-75">
                      <VerifiedName name={sender?.full_name ?? "Hazi user"} verificationStatus={sender?.verification_status} />
                    </p>
                    <p className="mt-1 leading-6">{message.body}</p>
                  </div>
                </div>
              );
            }) : (
              <div className="grid min-h-[320px] place-items-center text-center">
                <div>
                  <MessageSquareText className="mx-auto mb-3 text-[var(--primary)]" />
                  <p className="font-extrabold text-[var(--primary)]">No messages yet</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">Start with pickup timing, delivery preference, or payment confirmation.</p>
                </div>
              </div>
            )}
          </div>

          <form action={sendTransactionMessage} className="border-t border-[var(--line)] p-5">
            <input type="hidden" name="transaction_id" value={transaction.id} />
            <div className="flex gap-3">
              <input className="input" name="body" required maxLength={2000} placeholder="Write a message..." />
              <button className="button button-primary" type="submit">Send</button>
            </div>
          </form>
        </div>

        <aside className="space-y-6">
          <div className="card p-5">
            <h2 className="text-2xl font-extrabold text-[var(--primary)]">Escrow summary</h2>
            <div className="mt-5 rounded-xl bg-[var(--accent-soft)] p-4">
              <p className="text-sm font-bold text-[#693c00]">Accepted amount</p>
              <p className="text-3xl font-extrabold text-[#2c1600]">{formatNaira(transactionAmount)}</p>
            </div>
            <div className="mt-4 grid gap-3 text-sm">
              <p className="flex items-center justify-between"><span className="font-bold text-[var(--muted)]">Status</span><span className="badge badge-live">{transactionStatus}</span></p>
              <p className="flex items-center justify-between gap-3"><span className="font-bold text-[var(--muted)]">Buyer</span><VerifiedName name={buyer?.full_name ?? "Buyer"} verificationStatus={buyer?.verification_status} /></p>
              <p className="flex items-center justify-between gap-3"><span className="font-bold text-[var(--muted)]">Seller</span><VerifiedName name={seller?.full_name ?? "Seller"} verificationStatus={seller?.verification_status} /></p>
            </div>

            <div className="mt-5 grid gap-2">
              {canReleaseFunds ? (
                <form action={confirmBuyerReceipt}>
                  <input type="hidden" name="transaction_id" value={transaction.id} />
                  <button className="button button-primary w-full" type="submit">Confirm receipt and release funds</button>
                </form>
              ) : null}
              {canMarkDeliveryStarted ? (
                <form action={confirmSellerDelivery}>
                  <input type="hidden" name="transaction_id" value={transaction.id} />
                  <button className="button button-outline w-full" type="submit">Mark item on the way</button>
                </form>
              ) : null}
              {isSeller && transaction.seller_delivery_started_at ? (
                <p className="rounded-xl bg-[var(--surface-soft)] p-3 text-sm font-bold text-[var(--muted)]">
                  Delivery started. Waiting for buyer receipt confirmation.
                </p>
              ) : null}
              {canDispute ? (
                <TransactionStatusButton transactionId={transaction.id} nextStatus="disputed" label="Open dispute" intent="outline" />
              ) : null}
            </div>
          </div>

          <div className="card p-5">
            <h2 className="text-2xl font-extrabold text-[var(--primary)]">Payment</h2>
            {isBuyer && transactionStatus === "escrow_pending" ? (
              <div className="mt-4 rounded-xl bg-[var(--surface-soft)] p-4">
                <p className="text-sm font-bold text-[var(--muted)]">Wallet available</p>
                <p className="text-2xl font-extrabold text-[var(--primary)]">{formatNaira(walletAvailable)}</p>
                <Link href="/dashboard/wallet" className="mt-2 inline-flex text-sm font-extrabold text-[var(--accent)] hover:underline">
                  Fund wallet
                </Link>
              </div>
            ) : null}
            {canPayWithWallet ? (
              <form action={payEscrowFromWallet} className="mt-4 rounded-xl bg-[#e8f7ee] p-4">
                <input type="hidden" name="transaction_id" value={transaction.id} />
                <p className="flex items-center gap-2 font-extrabold text-[var(--primary)]">
                  <ShieldCheck size={17} />
                  Pay from Hazi.ng wallet
                </p>
                <p className="mt-1 text-sm font-bold text-[var(--muted)]">Wallet funds move into escrow immediately and stay held until release or refund.</p>
                <button className="button button-primary mt-4 w-full" type="submit">Pay {formatNaira(transactionAmount)}</button>
              </form>
            ) : null}
            {canPayWithFlutterwave ? (
              <form action={startFlutterwavePayment} className="mt-4 rounded-xl bg-[var(--accent-soft)] p-4">
                <input type="hidden" name="transaction_id" value={transaction.id} />
                <p className="flex items-center gap-2 font-extrabold text-[#2c1600]">
                  <CreditCard size={17} />
                  Pay securely with Flutterwave
                </p>
                <p className="mt-1 text-sm font-bold text-[#693c00]">You will return here after Flutterwave verifies escrow payment.</p>
                <button className="button button-primary mt-4 w-full" type="submit">Pay {formatNaira(transactionAmount)}</button>
              </form>
            ) : null}
            {canSubmitPaymentProof ? (
              <form action={submitPaymentProof} encType="multipart/form-data" className="mt-4 space-y-3">
                <input type="hidden" name="transaction_id" value={transaction.id} />
                <input type="hidden" name="method" value="bank_transfer" />
                <input className="input" name="reference" placeholder="Bank transfer reference" />
                <input className="input" name="proof_file" type="file" required accept="image/jpeg,image/png,image/webp,application/pdf" />
                <p className="text-xs font-bold text-[var(--muted)]">Manual fallback: upload a bank receipt or transfer screenshot. Admin will verify before escrow moves to paid.</p>
                <button className="button button-outline w-full" type="submit">Submit manual proof</button>
              </form>
            ) : null}

            <div className="mt-5 space-y-3">
              {paymentsWithUrls.length ? paymentsWithUrls.map((payment) => (
                <div key={payment.id} className="rounded-xl bg-[var(--surface-soft)] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="flex items-center gap-2 font-extrabold text-[var(--primary)]"><FileCheck2 size={16} /> {(payment.method || "payment").replaceAll("_", " ")}</p>
                    <span className="badge badge-trust capitalize">{payment.status || "pending"}</span>
                  </div>
                  <p className="mt-2 text-sm font-bold text-[var(--muted)]">{formatNaira(Number(payment.amount))} {payment.reference ? `- ${payment.reference}` : ""}</p>
                  {payment.signedUrl ? (
                    <a href={payment.signedUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-sm font-extrabold text-[var(--accent)] hover:underline">
                      Open proof
                    </a>
                  ) : null}
                  {payment.review_notes ? <p className="mt-2 text-sm text-[var(--muted)]">{payment.review_notes}</p> : null}
                </div>
              )) : <p className="text-sm text-[var(--muted)]">No payment proof submitted yet.</p>}
            </div>
          </div>

          <div className="card p-5">
            <h2 className="text-2xl font-extrabold text-[var(--primary)]">Order tracking</h2>
            <div className="mt-5 space-y-4">
              <TimelineItem icon={CheckCircle2} label="Bid accepted" active />
              <TimelineItem icon={Clock} label="Escrow payment pending" active={transactionStatus === "escrow_pending"} />
              <TimelineItem icon={Truck} label={auction?.delivery_available ? "Delivery coordination" : "Pickup coordination"} active={transactionStatus === "paid"} />
              <TimelineItem icon={PackageCheck} label="Item received and funds released" active={transactionStatus === "released"} />
            </div>
          </div>

          {auction?.delivery_available ? (
            <div className="card p-5">
              <h2 className="text-2xl font-extrabold text-[var(--primary)]">Delivery quotes</h2>
              {suggestedDeliveryEstimate ? (
                <div className="mt-4 rounded-xl bg-[var(--surface-soft)] p-4">
                  <p className="text-sm font-bold text-[var(--muted)]">{pickupLocation} to {dropoffLocation} - {suggestedDeliveryEstimate.distanceKm} km</p>
                  <p className="mt-1 text-2xl font-extrabold text-[var(--primary)]">{formatNaira(suggestedDeliveryEstimate.estimatedFee)}</p>
                  <form action={requestDeliveryQuote} className="mt-3">
                    <input type="hidden" name="transaction_id" value={transaction.id} />
                    <input type="hidden" name="auction_id" value={transaction.auction_id} />
                    <input type="hidden" name="pickup_location" value={pickupLocation} />
                    <input type="hidden" name="dropoff_location" value={dropoffLocation} />
                    <input type="hidden" name="distance_km" value={suggestedDeliveryEstimate.distanceKm} />
                    <button className="button button-outline w-full" type="submit">Save suggested delivery quote</button>
                  </form>
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--surface-soft)] p-4">
                  <p className="text-sm font-extrabold text-[var(--primary)]">Delivery quote unavailable</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {dropoffCoordinates
                      ? "The seller needs saved pickup coordinates before Hazi.ng can suggest delivery."
                      : "The buyer needs a saved profile location before Hazi.ng can suggest delivery."}
                  </p>
                  {!dropoffCoordinates && isBuyer ? (
                    <Link href={`/dashboard/profile?next=/transactions/${transaction.id}`} className="button button-primary mt-3 w-full">
                      Add delivery address
                    </Link>
                  ) : null}
                </div>
              )}

              <div className="mt-5 space-y-3">
                {deliveryQuotes?.length ? deliveryQuotes.map((quote) => (
                  <div key={quote.id} className="rounded-xl bg-[var(--surface-soft)] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <strong>{quote.provider}</strong>
                      <span className="badge badge-trust">{quote.status}</span>
                    </div>
                    <p className="mt-2 text-sm text-[var(--muted)]">{quote.pickup_location} to {quote.dropoff_location}</p>
                    <p className="mt-1 font-extrabold text-[var(--primary)]">{formatNaira(Number(quote.estimated_fee ?? 0))}</p>
                    {transactionStatus === "paid" && !activeDeliveryOrder ? (
                      <form action={bookDeliveryOrder} className="mt-3">
                        <input type="hidden" name="transaction_id" value={transaction.id} />
                        <input type="hidden" name="quote_id" value={quote.id} />
                        <button className="button button-primary w-full" type="submit">Save delivery plan</button>
                      </form>
                    ) : null}
                  </div>
                )) : <p className="text-sm text-[var(--muted)]">No delivery quotes requested yet.</p>}
              </div>
            </div>
          ) : null}

          {activeDeliveryOrder ? (
            <div className="card p-5">
              <h2 className="text-2xl font-extrabold text-[var(--primary)]">Delivery tracking</h2>
              <div className="mt-5 rounded-xl bg-[var(--surface-soft)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <strong>{activeDeliveryOrder.provider}</strong>
                  <span className="badge badge-live capitalize">{(activeDeliveryOrder.status || "pending").replaceAll("_", " ")}</span>
                </div>
                <p className="mt-2 text-sm font-bold text-[var(--muted)]">{activeDeliveryOrder.tracking_code}</p>
                <p className="mt-2 text-sm text-[var(--muted)]">{activeDeliveryOrder.pickup_location} to {activeDeliveryOrder.dropoff_location}</p>
                <p className="mt-1 font-extrabold text-[var(--primary)]">{formatNaira(Number(activeDeliveryOrder.fee ?? 0))}</p>
                {activeDeliveryOrder.courier_name || activeDeliveryOrder.courier_phone ? (
                  <p className="mt-2 text-sm font-bold text-[var(--muted)]">
                    Courier: {activeDeliveryOrder.courier_name ?? "Assigned"} {activeDeliveryOrder.courier_phone ? `- ${activeDeliveryOrder.courier_phone}` : ""}
                  </p>
                ) : null}
                {activeDeliveryOrder.notes ? <p className="mt-2 text-sm text-[var(--muted)]">{activeDeliveryOrder.notes}</p> : null}
                {!["delivered", "cancelled"].includes(activeDeliveryOrder.status || "") ? (
                  <form action={cancelDeliveryOrder} className="mt-4 grid gap-2">
                    <input type="hidden" name="transaction_id" value={transaction.id} />
                    <input type="hidden" name="delivery_id" value={activeDeliveryOrder.id} />
                    <input className="input" name="cancellation_reason" placeholder="Reason for cancellation" />
                    <button className="button button-outline w-full" type="submit">Cancel delivery</button>
                  </form>
                ) : null}
              </div>
            </div>
          ) : null}

          {transactionStatus === "disputed" ? (
            <div className="card p-5">
              <h2 className="text-2xl font-extrabold text-[var(--primary)]">Dispute evidence</h2>
              <form action={submitDisputeEvidence} encType="multipart/form-data" className="mt-4 space-y-3">
                <input type="hidden" name="transaction_id" value={transaction.id} />
                <textarea className="textarea min-h-[100px]" name="notes" placeholder="Explain what happened or add evidence context." />
                <input className="input" name="evidence_file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" />
                <button className="button button-outline w-full" type="submit">Add evidence</button>
              </form>
              <div className="mt-5 space-y-3">
                {evidence?.length ? evidence.map((item) => {
                  const profile = displayProfileById.get(item.submitted_by);
                  return (
                    <div key={item.id} className="rounded-xl bg-[var(--surface-soft)] p-4">
                      <strong><VerifiedName name={profile?.full_name ?? "Hazi user"} verificationStatus={profile?.verification_status} /></strong>
                      <p className="mt-1 text-sm text-[var(--muted)]">{item.notes || item.file_name || item.evidence_type}</p>
                    </div>
                  );
                }) : <p className="text-sm text-[var(--muted)]">No evidence submitted yet.</p>}
              </div>
            </div>
          ) : null}
        </aside>
      </section>
    </main>
  );
}

function TransactionStatusButton({
  transactionId,
  nextStatus,
  label,
  intent
}: {
  transactionId: string;
  nextStatus: string;
  label: string;
  intent: "primary" | "outline";
}) {
  return (
    <form action={updateTransactionStatus}>
      <input type="hidden" name="transaction_id" value={transactionId} />
      <input type="hidden" name="next_status" value={nextStatus} />
      <button className={`button w-full ${intent === "primary" ? "button-primary" : "button-outline"}`} type="submit">
        {label}
      </button>
    </form>
  );
}

function TimelineItem({
  icon: Icon,
  label,
  active = false
}: {
  icon: typeof CheckCircle2;
  label: string;
  active?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className={`grid size-10 place-items-center rounded-xl ${active ? "bg-[var(--primary)] text-white" : "bg-[var(--surface-soft)] text-[var(--muted)]"}`}>
        <Icon size={18} />
      </div>
      <p className="font-bold text-[var(--muted)]">{label}</p>
    </div>
  );
}

function MissingSupabase() {
  return (
    <main className="container py-10">
      <div className="card p-6">
        <h1 className="text-3xl font-extrabold text-[var(--primary)]">Supabase env is missing</h1>
        <p className="mt-2 text-[var(--muted)]">Add Supabase env vars to use escrow chat.</p>
      </div>
    </main>
  );
}
