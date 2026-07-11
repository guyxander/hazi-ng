import Link from "next/link";
import { Eye } from "lucide-react";
import { adminDeleteAuction, adminUpdateAuctionStatus } from "@/app/actions";
import { AdminOperationsNav } from "@/components/admin-operations-nav";
import { formatDateTime, formatNaira } from "@/lib/format";
import { requireAdmin } from "@/lib/supabase/admin";

export default async function AdminAuctionsPage() {
  const supabase = await requireAdmin("/admin/auctions");

  if (!supabase) {
    return <main className="container py-10"><div className="card p-6">Supabase env is missing.</div></main>;
  }

  const { data: latest } = await supabase
    .from("auctions")
    .select("id,title,status,location,created_at,seller_price,current_bid")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <main className="container py-10">
      <div className="mb-8">
        <span className="badge badge-premium"><Eye size={14} /> Auction operations</span>
        <h1 className="section-title mt-4">Latest auctions</h1>
        <p className="mt-2 text-[var(--muted)]">Pause, resume, inspect, or delete recent marketplace listings.</p>
      </div>

      <section className="admin-operations-shell">
        <AdminOperationsNav />

        <div className="admin-operations-content">
          <section className="card overflow-hidden">
            <div className="border-b border-[var(--line)] p-5">
              <h2 className="text-2xl font-extrabold text-[var(--primary)]">Recent auction listings</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">Showing the 50 most recently created auctions.</p>
            </div>
            <div className="divide-y divide-[var(--line)]">
              {latest?.length ? latest.map((item) => (
                <article key={item.id} className="grid gap-3 p-5 lg:grid-cols-[minmax(0,1fr)_120px_150px_150px_260px] lg:items-center">
                  <div className="min-w-0">
                    <Link href={`/auctions/${item.id}`} className="font-extrabold text-[var(--primary)] hover:underline">
                      {item.title}
                    </Link>
                    <p className="mt-1 text-xs font-bold text-[var(--muted)]">{formatDateTime(item.created_at)}</p>
                  </div>
                  <span className="font-bold capitalize text-[var(--muted)]">{item.status}</span>
                  <span className="font-bold text-[var(--muted)]">{item.location || "Location pending"}</span>
                  <span className="font-extrabold text-[var(--primary)]">{formatNaira(Number(item.current_bid ?? item.seller_price ?? 0))}</span>
                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <form action={adminUpdateAuctionStatus}>
                      <input type="hidden" name="auction_id" value={item.id} />
                      <input type="hidden" name="status" value={item.status === "paused" ? "active" : "paused"} />
                      <button className="button button-outline" type="submit">{item.status === "paused" ? "Resume" : "Pause"}</button>
                    </form>
                    <form action={adminDeleteAuction}>
                      <input type="hidden" name="auction_id" value={item.id} />
                      <button className="button button-outline text-red-700" type="submit">Delete</button>
                    </form>
                  </div>
                </article>
              )) : <p className="p-5 text-[var(--muted)]">No live Supabase auctions yet.</p>}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
