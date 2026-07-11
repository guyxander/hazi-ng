import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { resolveDispute } from "@/app/actions";
import { formatNaira } from "@/lib/format";
import { requireAdmin } from "@/lib/supabase/admin";

export default async function AdminDisputeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await requireAdmin(`/admin/disputes/${id}`);

  if (!supabase) {
    return null;
  }

  const [{ data: transaction }, { data: evidence }, { data: messages }] = await Promise.all([
    supabase.from("transactions").select("*,auctions(id,title,location)").eq("id", id).single(),
    supabase.from("dispute_evidence").select("id,submitted_by,evidence_type,file_url,file_name,notes,created_at,profiles(id,full_name)").eq("transaction_id", id).order("created_at", { ascending: false }),
    supabase.from("transaction_messages").select("id,sender_id,body,created_at,profiles(id,full_name)").eq("transaction_id", id).order("created_at", { ascending: true })
  ]);

  if (!transaction) {
    return <main className="container py-10"><div className="card p-6">Dispute not found.</div></main>;
  }

  const auction = Array.isArray(transaction.auctions) ? transaction.auctions[0] : transaction.auctions;

  return (
    <main className="container py-10">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="badge badge-live"><ShieldAlert size={14} /> Dispute</span>
          <h1 className="section-title mt-4">{auction?.title ?? "Disputed transaction"}</h1>
          <p className="mt-2 text-[var(--muted)]">{auction?.location ?? "Location pending"} - {formatNaira(Number(transaction.amount))}</p>
        </div>
        <Link href="/admin" className="button button-outline">Back to admin</Link>
      </div>

      <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="grid gap-6">
          <Panel title="Evidence">
            {evidence?.length ? evidence.map((item) => {
              const profile = Array.isArray(item.profiles) ? item.profiles[0] : item.profiles;
              return <div key={item.id} className="p-4"><strong>{profile?.full_name ?? "Hazi user"}</strong><p className="mt-1 text-sm text-[var(--muted)]">{item.notes ?? item.file_name ?? item.evidence_type}</p></div>;
            }) : <p className="p-5 text-[var(--muted)]">No evidence uploaded yet.</p>}
          </Panel>
          <Panel title="Escrow chat">
            {messages?.length ? messages.map((item) => {
              const profile = Array.isArray(item.profiles) ? item.profiles[0] : item.profiles;
              return <div key={item.id} className="p-4"><strong>{profile?.full_name ?? "Hazi user"}</strong><p className="mt-1 text-sm text-[var(--muted)]">{item.body}</p></div>;
            }) : <p className="p-5 text-[var(--muted)]">No messages yet.</p>}
          </Panel>
        </div>

        <aside className="card p-5">
          <h2 className="text-2xl font-extrabold text-[var(--primary)]">Admin resolution</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">Release pays seller earnings. Refund returns buyer funds.</p>
          <div className="mt-5 grid gap-3">
            <form action={resolveDispute}>
              <input type="hidden" name="transaction_id" value={transaction.id} />
              <input type="hidden" name="resolution" value="release" />
              <button className="button button-primary w-full" type="submit">Release funds</button>
            </form>
            <form action={resolveDispute}>
              <input type="hidden" name="transaction_id" value={transaction.id} />
              <input type="hidden" name="resolution" value="refund" />
              <button className="button button-outline w-full" type="submit">Refund buyer</button>
            </form>
          </div>
        </aside>
      </section>
    </main>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="card overflow-hidden"><div className="border-b border-[var(--line)] p-5"><h2 className="text-2xl font-extrabold text-[var(--primary)]">{title}</h2></div><div className="divide-y divide-[var(--line)]">{children}</div></section>;
}
