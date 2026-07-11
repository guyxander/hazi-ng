import Link from "next/link";
import { redirect } from "next/navigation";
import { Bookmark, Trash2 } from "lucide-react";
import { removeSavedAuction } from "@/app/actions";
import { formatNaira } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function WatchlistPage() {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return (
      <main className="container py-10">
        <div className="card p-6">Add Supabase environment variables to view saved auctions.</div>
      </main>
    );
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    redirect("/auth?next=/dashboard/watchlist");
  }

  const { data: savedAuctions } = await supabase
    .from("auction_watchlist")
    .select(`
      created_at,
      auctions(id,title,location,seller_price,current_bid,status,is_premium,auction_images(image_url,alt_text,position))
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <main className="container py-10">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="badge badge-trust"><Bookmark size={14} /> Watchlist</span>
          <h1 className="section-title mt-4">Saved auctions</h1>
          <p className="mt-2 max-w-2xl text-[var(--muted)]">Keep track of listings before you bid or negotiate with a seller.</p>
        </div>
        <Link href="/dashboard" className="button button-outline">Back to dashboard</Link>
      </div>

      <section className="card overflow-hidden">
        <div className="divide-y divide-[var(--line)]">
          {savedAuctions?.length ? savedAuctions.map((saved) => {
            const auction = Array.isArray(saved.auctions) ? saved.auctions[0] : saved.auctions;

            if (!auction) {
              return null;
            }

            return (
              <article key={auction.id} className="grid gap-4 p-5 lg:grid-cols-[1fr_160px_190px]">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/auctions/${auction.id}`} className="font-extrabold text-[var(--primary)] hover:underline">
                      {auction.title}
                    </Link>
                    {auction.is_premium ? <span className="badge badge-premium">Premium</span> : null}
                  </div>
                  <p className="mt-1 text-sm font-bold text-[var(--muted)]">{auction.location}</p>
                  <p className="mt-2 text-sm text-[var(--muted)]">Status: {auction.status}</p>
                </div>
                <div>
                  <p className="text-sm font-bold text-[var(--muted)]">Current bid</p>
                  <p className="font-extrabold text-[var(--primary)]">{formatNaira(Number(auction.current_bid ?? auction.seller_price))}</p>
                </div>
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <Link href={`/auctions/${auction.id}`} className="button button-primary">View</Link>
                  <form action={removeSavedAuction}>
                    <input type="hidden" name="auction_id" value={auction.id} />
                    <button className="button button-outline" type="submit"><Trash2 size={16} /> Remove</button>
                  </form>
                </div>
              </article>
            );
          }) : <p className="p-5 text-[var(--muted)]">No saved auctions yet.</p>}
        </div>
      </section>
    </main>
  );
}
