import Link from "next/link";
import { redirect } from "next/navigation";
import { Gavel } from "lucide-react";
import { withdrawBid } from "@/app/actions";
import { formatNaira } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type BidsPageProps = {
  searchParams: Promise<{
    status?: string;
  }>;
};

export default async function BidsPage({ searchParams }: BidsPageProps) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return (
      <main className="container py-10">
        <div className="card p-6">Add Supabase environment variables to view your bids.</div>
      </main>
    );
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    redirect("/auth?next=/dashboard/bids");
  }

  const status = params.status ?? "";
  let query = supabase
    .from("bids")
    .select(`
      id,
      auction_id,
      amount,
      status,
      created_at,
      auctions(id,title,location,seller_id,seller_price,current_bid,status,is_premium)
    `)
    .eq("bidder_id", user.id)
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data: bids } = await query;
  const sellerIds = [...new Set((bids ?? []).flatMap((bid) => {
    const auction = Array.isArray(bid.auctions) ? bid.auctions[0] : bid.auctions;
    return auction?.seller_id ? [auction.seller_id] : [];
  }))];
  const { data: sellers } = sellerIds.length
    ? await supabase.from("public_profiles").select("id,full_name").in("id", sellerIds)
    : { data: [] };
  const sellerById = new Map((sellers ?? []).map((seller) => [seller.id, seller]));

  return (
    <main className="container py-10">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="badge badge-trust"><Gavel size={14} /> Buyer bids</span>
          <h1 className="section-title mt-4">Your bids</h1>
          <p className="mt-2 max-w-2xl text-[var(--muted)]">Track pending offers, accepted bids, and listings that need another move.</p>
        </div>
        <Link href="/dashboard" className="button button-outline">Back to dashboard</Link>
      </div>

      <form action="/dashboard/bids" className="card mb-8 grid gap-3 p-4 md:grid-cols-[1fr_160px]">
        <select className="select" name="status" defaultValue={status}>
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="accepted">Accepted</option>
          <option value="rejected">Rejected</option>
          <option value="withdrawn">Withdrawn</option>
        </select>
        <button className="button button-primary" type="submit">Filter</button>
      </form>

      <section className="card overflow-hidden">
        <div className="divide-y divide-[var(--line)]">
          {bids?.length ? bids.map((bid) => {
            const auction = Array.isArray(bid.auctions) ? bid.auctions[0] : bid.auctions;
            const seller = auction?.seller_id ? sellerById.get(auction.seller_id) : null;

            return (
              <article key={bid.id} className="grid gap-4 p-5 lg:grid-cols-[1fr_160px_160px_210px]">
                <div>
                  <Link href={`/auctions/${bid.auction_id}`} className="font-extrabold text-[var(--primary)] hover:underline">
                    {auction?.title ?? "Auction"}
                  </Link>
                  <p className="mt-1 text-sm font-bold text-[var(--muted)]">{auction?.location ?? "Location pending"}</p>
                  <p className="mt-2 text-sm text-[var(--muted)]">Seller: {seller?.full_name ?? "Hazi seller"}</p>
                </div>
                <div>
                  <p className="text-sm font-bold text-[var(--muted)]">Your bid</p>
                  <p className="font-extrabold text-[var(--primary)]">{formatNaira(Number(bid.amount))}</p>
                </div>
                <div>
                  <p className="text-sm font-bold text-[var(--muted)]">Status</p>
                  <span className={bid.status === "accepted" ? "badge badge-live" : bid.status === "rejected" ? "badge bg-red-50 text-red-700" : "badge badge-trust"}>{bid.status}</span>
                </div>
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <Link href={`/auctions/${bid.auction_id}`} className="button button-outline">View auction</Link>
                  {bid.status === "pending" ? (
                    <form action={withdrawBid}>
                      <input type="hidden" name="bid_id" value={bid.id} />
                      <input type="hidden" name="auction_id" value={bid.auction_id} />
                      <button className="button button-outline" type="submit">Withdraw</button>
                    </form>
                  ) : null}
                </div>
              </article>
            );
          }) : <p className="p-5 text-[var(--muted)]">No bids match this view.</p>}
        </div>
      </section>
    </main>
  );
}
