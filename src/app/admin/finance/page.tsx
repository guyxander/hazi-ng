import Link from "next/link";
import { Landmark } from "lucide-react";
import { formatNaira } from "@/lib/format";
import { requireAdmin } from "@/lib/supabase/admin";

export default async function AdminFinancePage() {
  const supabase = await requireAdmin("/admin/finance");

  if (!supabase) {
    return null;
  }

  const [{ data: settlements }, { data: ledger }, { data: withdrawals }] = await Promise.all([
    supabase.from("finance_settlements").select("*").order("created_at", { ascending: false }).limit(80),
    supabase.from("wallet_ledger_entries").select("id,user_id,direction,balance_bucket,amount,entry_type,provider,provider_reference,created_at").order("created_at", { ascending: false }).limit(80),
    supabase.from("withdrawal_requests").select("id,amount,status,provider_reference,created_at").order("created_at", { ascending: false }).limit(40)
  ]);

  const gross = settlements?.reduce((sum, item) => sum + Number(item.gross_amount ?? 0), 0) ?? 0;
  const net = settlements?.reduce((sum, item) => sum + Number(item.net_amount ?? 0), 0) ?? 0;

  return (
    <main className="container py-10">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="badge badge-premium"><Landmark size={14} /> Finance</span>
          <h1 className="section-title mt-4">Financial settlements</h1>
          <p className="mt-2 text-[var(--muted)]">Provider reconciliation, wallet ledger movement, payout requests, and settlement history.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/finance/export" className="button button-primary">Export CSV</Link>
          <Link href="/admin" className="button button-outline">Back to admin</Link>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="card p-5"><p className="text-sm font-bold text-[var(--muted)]">Gross reconciled</p><p className="mt-2 text-3xl font-extrabold text-[var(--primary)]">{formatNaira(gross)}</p></div>
        <div className="card p-5"><p className="text-sm font-bold text-[var(--muted)]">Net recorded</p><p className="mt-2 text-3xl font-extrabold text-[var(--primary)]">{formatNaira(net)}</p></div>
        <div className="card p-5"><p className="text-sm font-bold text-[var(--muted)]">Withdrawals tracked</p><p className="mt-2 text-3xl font-extrabold text-[var(--primary)]">{withdrawals?.length ?? 0}</p></div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <Panel title="Settlement history">
          {settlements?.length ? settlements.map((item) => (
            <div key={item.id} className="grid gap-2 p-4 md:grid-cols-[1fr_140px]">
              <div><strong>{item.settlement_type}</strong><p className="text-sm text-[var(--muted)]">{item.provider} - {item.provider_reference ?? "no reference"}</p></div>
              <p className="font-extrabold text-[var(--primary)] md:text-right">{formatNaira(Number(item.net_amount))}</p>
            </div>
          )) : <p className="p-5 text-[var(--muted)]">No settlements recorded yet.</p>}
        </Panel>
        <Panel title="Wallet ledger export view">
          {ledger?.length ? ledger.map((item) => (
            <div key={item.id} className="grid gap-2 p-4 md:grid-cols-[1fr_140px]">
              <div><strong>{item.entry_type}</strong><p className="text-sm text-[var(--muted)]">{item.direction} - {item.balance_bucket}</p></div>
              <p className="font-extrabold text-[var(--primary)] md:text-right">{formatNaira(Number(item.amount))}</p>
            </div>
          )) : <p className="p-5 text-[var(--muted)]">No ledger entries yet.</p>}
        </Panel>
      </section>
    </main>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="card overflow-hidden"><div className="border-b border-[var(--line)] p-5"><h2 className="text-2xl font-extrabold text-[var(--primary)]">{title}</h2></div><div className="divide-y divide-[var(--line)]">{children}</div></section>;
}
