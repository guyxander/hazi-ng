import Link from "next/link";
import { redirect } from "next/navigation";
import { Banknote, Clock, CreditCard, Landmark, WalletCards } from "lucide-react";
import { requestWalletWithdrawal, startWalletFunding } from "@/app/actions";
import { StatCard } from "@/components/stat-card";
import { formatNaira } from "@/lib/format";
import { isFlutterwaveConfigured } from "@/lib/flutterwave";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type WalletSearchParams = {
  error?: string;
  withdrawal?: string;
  withdrawal_error?: string;
};

const bucketLabels: Record<string, string> = {
  available: "Available",
  escrow: "Escrow hold",
  earnings: "Seller earnings",
  refund: "Buyer refunds",
  pending_withdrawal: "Pending withdrawal"
};

export default async function WalletPage({
  searchParams
}: {
  searchParams?: Promise<WalletSearchParams>;
}) {
  const query = await searchParams;
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return <MissingWalletEnv />;
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    redirect("/auth?next=/dashboard/wallet");
  }

  const [{ data: wallet }, { data: ledger }, { data: funding }, { data: withdrawals }] = await Promise.all([
    supabase
      .from("wallet_accounts")
      .select("available_balance,escrow_balance,earnings_balance,refund_balance,pending_withdrawal_balance,currency,updated_at")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("wallet_ledger_entries")
      .select("id,direction,balance_bucket,amount,entry_type,status,provider,provider_reference,description,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("wallet_funding_intents")
      .select("id,amount,status,provider,tx_ref,provider_reference,created_at,verified_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("withdrawal_requests")
      .select("id,amount,source_bucket,bank_name,account_number,account_name,status,provider_reference,admin_notes,created_at,reviewed_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10)
  ]);

  const available = Number(wallet?.available_balance ?? 0);
  const escrow = Number(wallet?.escrow_balance ?? 0);
  const earnings = Number(wallet?.earnings_balance ?? 0);
  const refunds = Number(wallet?.refund_balance ?? 0);
  const pendingWithdrawal = Number(wallet?.pending_withdrawal_balance ?? 0);
  const flutterwaveReady = isFlutterwaveConfigured();

  return (
    <main className="container py-10">
      {query?.withdrawal === "requested" ? (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
          Withdrawal request submitted for admin approval.
        </div>
      ) : null}
      {query?.error ? (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          {query.error === "flutterwave" ? "Flutterwave is not configured yet." : "Enter an amount of at least NGN 100."}
        </div>
      ) : null}
      {query?.withdrawal_error ? (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          {query.withdrawal_error}
        </div>
      ) : null}

      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="badge badge-trust"><WalletCards size={14} /> Wallet</span>
          <h1 className="section-title mt-4">Hazi.ng wallet</h1>
          <p className="mt-2 text-[var(--muted)]">Fund your wallet, track escrow holds, receive seller earnings, and request withdrawals.</p>
        </div>
        <Link href="/dashboard" className="button button-outline">Back to dashboard</Link>
      </div>

      <section className="grid gap-4 md:grid-cols-5">
        <StatCard icon={WalletCards} label="Available" value={formatNaira(available)} hint="Flutterwave-funded wallet balance." />
        <StatCard icon={Clock} label="Escrow hold" value={formatNaira(escrow)} hint="Buyer funds currently held." />
        <StatCard icon={Banknote} label="Seller earnings" value={formatNaira(earnings)} hint="Released funds from sales." />
        <StatCard icon={CreditCard} label="Buyer refunds" value={formatNaira(refunds)} hint="Refunded escrow funds." />
        <StatCard icon={Landmark} label="Pending payout" value={formatNaira(pendingWithdrawal)} hint="Withdrawal requests under review." />
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="card p-5">
          <h2 className="text-2xl font-extrabold text-[var(--primary)]">Fund wallet</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Wallet funding is processed through Flutterwave only.</p>
          <form action={startWalletFunding} className="mt-5 space-y-3">
            <input className="input" name="amount" type="number" min="100" step="100" placeholder="Amount, e.g. 10000" required />
            <button className="button button-primary w-full" type="submit" disabled={!flutterwaveReady}>
              {flutterwaveReady ? "Fund with Flutterwave" : "Flutterwave unavailable"}
            </button>
          </form>
        </div>

        <div className="card p-5">
          <h2 className="text-2xl font-extrabold text-[var(--primary)]">Request withdrawal</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Admin reviews payouts before funds leave Hazi.ng.</p>
          <form action={requestWalletWithdrawal} className="mt-5 grid gap-3">
            <div className="grid gap-3 md:grid-cols-[1fr_160px]">
              <input className="input" name="amount" type="number" min="100" step="100" placeholder="Amount" required />
              <select className="select" name="source_bucket" defaultValue="earnings">
                <option value="earnings">Earnings</option>
                <option value="refund">Refunds</option>
                <option value="available">Available</option>
              </select>
            </div>
            <input className="input" name="bank_name" placeholder="Bank name" required />
            <div className="grid gap-3 md:grid-cols-3">
              <input className="input" name="account_number" placeholder="Account number" required />
              <input className="input" name="bank_code" placeholder="Bank code" required />
              <input className="input" name="account_name" placeholder="Account name" required />
            </div>
            <button className="button button-outline w-full" type="submit">Submit withdrawal request</button>
          </form>
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_1fr]">
        <HistoryPanel title="Wallet transaction history">
          {ledger?.length ? ledger.map((entry) => (
            <div key={entry.id} className="grid gap-3 p-4 md:grid-cols-[1fr_140px]">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="text-[var(--primary)]">{entry.description || entry.entry_type.replaceAll("_", " ")}</strong>
                  <span className={`badge ${entry.direction === "credit" ? "badge-trust" : "badge-live"}`}>{entry.direction}</span>
                </div>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {bucketLabels[entry.balance_bucket] ?? entry.balance_bucket} {entry.provider_reference ? `- ${entry.provider_reference}` : ""}
                </p>
              </div>
              <p className={`font-extrabold ${entry.direction === "credit" ? "text-emerald-700" : "text-[var(--primary)]"} md:text-right`}>
                {entry.direction === "credit" ? "+" : "-"}{formatNaira(Number(entry.amount))}
              </p>
            </div>
          )) : <p className="p-5 text-[var(--muted)]">No wallet ledger entries yet.</p>}
        </HistoryPanel>

        <div className="grid gap-6">
          <HistoryPanel title="Funding reconciliation">
            {funding?.length ? funding.map((item) => (
              <div key={item.id} className="grid gap-3 p-4 md:grid-cols-[1fr_120px]">
                <div>
                  <strong className="text-[var(--primary)]">{item.provider}</strong>
                  <p className="mt-1 text-sm text-[var(--muted)]">{item.tx_ref}</p>
                </div>
                <div className="md:text-right">
                  <p className="font-extrabold text-[var(--primary)]">{formatNaira(Number(item.amount))}</p>
                  <span className="badge badge-trust capitalize">{item.status}</span>
                </div>
              </div>
            )) : <p className="p-5 text-[var(--muted)]">No wallet funding attempts yet.</p>}
          </HistoryPanel>

          <HistoryPanel title="Withdrawal requests">
            {withdrawals?.length ? withdrawals.map((item) => (
              <div key={item.id} className="grid gap-3 p-4 md:grid-cols-[1fr_120px]">
                <div>
                  <strong className="text-[var(--primary)]">{item.bank_name}</strong>
                  <p className="mt-1 text-sm text-[var(--muted)]">{item.account_name} - {item.account_number}</p>
                  {item.admin_notes ? <p className="mt-1 text-sm text-[var(--muted)]">{item.admin_notes}</p> : null}
                </div>
                <div className="md:text-right">
                  <p className="font-extrabold text-[var(--primary)]">{formatNaira(Number(item.amount))}</p>
                  <span className="badge badge-live capitalize">{item.status}</span>
                </div>
              </div>
            )) : <p className="p-5 text-[var(--muted)]">No withdrawal requests yet.</p>}
          </HistoryPanel>
        </div>
      </section>
    </main>
  );
}

function HistoryPanel({
  title,
  children
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card overflow-hidden">
      <div className="border-b border-[var(--line)] p-5">
        <h2 className="text-2xl font-extrabold text-[var(--primary)]">{title}</h2>
      </div>
      <div className="divide-y divide-[var(--line)]">{children}</div>
    </section>
  );
}

function MissingWalletEnv() {
  return (
    <main className="container py-10">
      <div className="card p-6">
        <h1 className="text-3xl font-extrabold text-[var(--primary)]">Supabase env is missing</h1>
        <p className="mt-2 text-[var(--muted)]">Add Supabase env vars to use wallet features.</p>
      </div>
    </main>
  );
}
