import Link from "next/link";
import { redirect } from "next/navigation";
import { Eye, Megaphone, Package, PauseCircle, Pencil, Plus, RotateCcw, XCircle } from "lucide-react";
import { boostAuction, relistAuction, updateAuctionStatus } from "@/app/actions";
import { formatNaira } from "@/lib/format";
import { isAgentRole } from "@/lib/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ListingsPageProps = {
  searchParams?: Promise<{ boost?: string }>;
};

export default async function ListingsPage({ searchParams }: ListingsPageProps) {
  const query = await searchParams;
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return <MissingEnvListings />;
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    redirect("/auth?next=/dashboard/listings");
  }

  const [{ data: listings }, { data: profile }] = await Promise.all([
    supabase
      .from("auctions")
      .select("id,title,status,current_bid,seller_price,is_premium,created_at,seller_id,listed_for_user_id")
      .or(`seller_id.eq.${user.id},listed_for_user_id.eq.${user.id}`)
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("role").eq("id", user.id).single()
  ]);

  const newAuctionHref = isAgentRole(profile?.role) ? "/sell/agent" : "/sell";

  return (
    <main className="container py-10">
      {query?.boost === "active" ? (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
          Listing boost is active.
        </div>
      ) : null}

      {query?.boost === "referral" ? (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
          Free referral boost applied.
        </div>
      ) : null}

      {query?.boost === "subscription-ready" ? (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
          Your premium subscription is active. Choose Boost on a listing to promote it.
        </div>
      ) : null}

      {query?.boost === "failed" ? (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          We could not boost this listing yet. Make sure the auction is active or paused, then try again.
        </div>
      ) : null}

      {query?.boost?.startsWith("limit-") ? (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">
          Your current premium plan has reached its active boost limit of {query.boost.replace("limit-", "")} listings.
        </div>
      ) : null}

      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="badge badge-trust"><Package size={14} /> Seller inventory</span>
          <h1 className="section-title mt-4">Your listings</h1>
          <p className="mt-2 max-w-2xl text-[var(--muted)]">Review status, boost visibility, pause auctions, or relist expired items.</p>
        </div>
        <Link href="/dashboard" className="button button-outline">Back to dashboard</Link>
      </div>

      <section className="card dashboard-listings-panel min-w-0 overflow-hidden">
        <div className="dashboard-listings-panel__header">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--muted)]">Inventory controls</p>
            <h2 className="mt-1 text-2xl font-extrabold text-[var(--primary)]">Manage auctions</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">Keep each auction tidy, visible, and ready for buyers.</p>
          </div>
          <Link href={newAuctionHref} className="button button-primary dashboard-listings-panel__new">
            <Plus size={17} /> New auction
          </Link>
        </div>
        <div className="dashboard-listings">
          {(listings?.length ? listings : []).map((listing) => (
            <article key={listing.id} className="dashboard-listing">
              <div className="dashboard-listing__content">
                <div className="dashboard-listing__main">
                  <div className="min-w-0">
                    <Link href={`/auctions/${listing.id}`} className="dashboard-listing__title hover:underline">
                      {listing.title}
                    </Link>
                    <div className="dashboard-listing__meta">
                      <span className="badge badge-trust capitalize">{listing.seller_id !== user.id ? "Agent listed" : listing.status}</span>
                      {listing.is_premium ? <span className="badge badge-premium">Boost active</span> : null}
                      {listing.seller_id !== user.id ? <span className="badge badge-trust">Client view</span> : null}
                    </div>
                  </div>
                  <div className="dashboard-listing__price-wrap">
                    <span>Current value</span>
                    <strong>{formatNaira(Number(listing.current_bid || listing.seller_price))}</strong>
                  </div>
                </div>

                <div className="dashboard-listing__actions">
                  <Link href={`/auctions/${listing.id}`} className="button button-outline">
                    <Eye size={16} /> View
                  </Link>

                  {listing.seller_id !== user.id ? (
                    <span className="dashboard-listing__managed">Managed by agent</span>
                  ) : listing.is_premium ? null : (
                    <form action={boostAuction} className="dashboard-listing__boost">
                      <input type="hidden" name="auction_id" value={listing.id} />
                      <select className="select min-h-[42px]" name="plan" defaultValue="listing_boost_7d" aria-label={`Boost duration for ${listing.title}`}>
                        <option value="listing_boost_7d">7 days</option>
                        <option value="listing_boost_14d">14 days</option>
                        <option value="listing_boost_30d">30 days</option>
                      </select>
                      <button className="button button-accent" type="submit"><Megaphone size={16} /> Boost</button>
                    </form>
                  )}

                  {listing.seller_id !== user.id ? null : listing.status === "active" || listing.status === "paused" ? (
                    <>
                      <Link href={`/dashboard/listings/${listing.id}/edit`} className="button button-outline"><Pencil size={16} /> Edit</Link>
                      <form action={updateAuctionStatus}>
                        <input type="hidden" name="auction_id" value={listing.id} />
                        <input type="hidden" name="status" value={listing.status === "active" ? "paused" : "active"} />
                        <button className="button button-outline w-full" type="submit"><PauseCircle size={16} /> {listing.status === "active" ? "Pause" : "Resume"}</button>
                      </form>
                      <form action={updateAuctionStatus}>
                        <input type="hidden" name="auction_id" value={listing.id} />
                        <input type="hidden" name="status" value="closed" />
                        <button className="button button-outline w-full" type="submit"><XCircle size={16} /> Close</button>
                      </form>
                    </>
                  ) : ["expired", "closed"].includes(listing.status) ? (
                    <>
                      <Link href={`/dashboard/listings/${listing.id}/edit`} className="button button-outline"><Pencil size={16} /> Edit</Link>
                      <form action={relistAuction} className="dashboard-listing__boost">
                        <input type="hidden" name="auction_id" value={listing.id} />
                        <select className="select min-h-[42px]" name="duration_hours" defaultValue="72" aria-label={`Relist duration for ${listing.title}`}>
                          <option value="24">24 hours</option>
                          <option value="72">3 days</option>
                          <option value="168">7 days</option>
                        </select>
                        <button className="button button-primary" type="submit"><RotateCcw size={16} /> Relist</button>
                      </form>
                    </>
                  ) : (
                    <span className="dashboard-listing__managed">No seller actions</span>
                  )}
                </div>
              </div>
            </article>
          ))}
          {!listings?.length ? (
            <div className="dashboard-listings__empty">
              <Package size={28} />
              <h3>No listings yet</h3>
              <p>Create your first auction and manage its bids, boosts, and status from here.</p>
              <Link href={newAuctionHref} className="button button-primary"><Plus size={17} /> Create auction</Link>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}

function MissingEnvListings() {
  return (
    <main className="container py-10">
      <div className="card max-w-2xl p-6">
        <h1 className="text-3xl font-extrabold text-[var(--primary)]">Supabase keys needed locally</h1>
        <p className="mt-3 text-[var(--muted)]">Add Supabase environment variables to manage listings.</p>
      </div>
    </main>
  );
}
