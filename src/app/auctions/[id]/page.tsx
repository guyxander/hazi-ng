import { notFound } from "next/navigation";
import Link from "next/link";
import { BadgeCheck, Bookmark, Clock, Flag, MapPin, MessageCircle, Send, ShieldCheck, Truck } from "lucide-react";
import { placeBid, relistAuction, removeSavedAuction, resolveBid, saveAuction } from "@/app/actions";
import { AuctionCountdown } from "@/components/auction-countdown";
import { AuctionImageGallery } from "@/components/auction-image-gallery";
import { AuctionRealtimeRefresh } from "@/components/auction-realtime-refresh";
import { SuccessAnimation } from "@/components/success-animation";
import { VerifiedName } from "@/components/verified-name";
import { getAiDeliveryEstimate } from "@/lib/ai-delivery-estimate";
import { getDeliveryEstimate, hasCoordinates } from "@/lib/delivery-estimate";
import { formatCondition, formatNaira } from "@/lib/format";
import { getAuction } from "@/lib/supabase/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AuctionDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ posted?: string; reported?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const [auction, supabase] = await Promise.all([getAuction(id), createSupabaseServerClient()]);

  if (!auction) {
    notFound();
  }

  const { data: userData } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  const { data: savedRow } = supabase && userData.user
    ? await supabase
        .from("auction_watchlist")
        .select("auction_id")
        .eq("user_id", userData.user.id)
        .eq("auction_id", auction.id)
        .maybeSingle()
    : { data: null };
  const { data: buyerProfile } = supabase && userData.user
    ? await supabase
        .from("profiles")
        .select("id,location,latitude,longitude")
        .eq("id", userData.user.id)
        .maybeSingle()
    : { data: null };
  const auctionTitle = auction.title || "Hazi auction";
  const auctionDescription = auction.description || "No description provided yet.";
  const auctionLocation = auction.location || auction.profiles?.location || "Nigeria";
  const sellerPrice = Number(auction.seller_price ?? 0);
  const currentBid = Number(auction.current_bid ?? 0);
  const bids = [...(auction.bids ?? [])].sort((first, second) => Number(second.amount ?? 0) - Number(first.amount ?? 0));
  const hasAcceptedBid = auction.status === "accepted";
  const { data: acceptedTransaction } = supabase && userData.user && hasAcceptedBid
    ? await supabase
        .from("transactions")
        .select("id,buyer_id,seller_id,status")
        .eq("auction_id", auction.id)
        .or(`buyer_id.eq.${userData.user.id},seller_id.eq.${userData.user.id}`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };
  const isSeller = userData.user?.id === auction.seller_id;
  const isAcceptedParticipant = Boolean(acceptedTransaction);
  const isSaved = Boolean(savedRow);
  const minBid = Math.max(1, Math.ceil(sellerPrice * 0.5));
  const auctionUrl = `https://hazi.ng/auctions/${auction.id}`;
  const whatsappShareUrl = `https://wa.me/?text=${encodeURIComponent(`${auctionTitle} on Hazi.ng - ${auctionUrl}`)}`;
  const sellerCoordinates = hasCoordinates(auction)
    ? { latitude: auction.latitude, longitude: auction.longitude }
    : hasCoordinates(auction.profiles)
      ? { latitude: auction.profiles.latitude, longitude: auction.profiles.longitude }
    : null;
  const buyerCoordinates = hasCoordinates(buyerProfile)
    ? { latitude: buyerProfile.latitude, longitude: buyerProfile.longitude }
    : null;
  const sellerHasCoordinates = Boolean(sellerCoordinates);
  const buyerHasCoordinates = Boolean(buyerCoordinates);
  const formulaDeliveryEstimate = auction.delivery_available && sellerCoordinates && buyerCoordinates
    ? getDeliveryEstimate(sellerCoordinates, buyerCoordinates)
    : null;
  const aiDeliveryEstimate = formulaDeliveryEstimate
    ? await getAiDeliveryEstimate({
        pickupLocation: auction.profiles?.location ?? auctionLocation,
        dropoffLocation: buyerProfile?.location ?? "Buyer saved location",
        distanceKm: formulaDeliveryEstimate.distanceKm,
        fallbackFee: formulaDeliveryEstimate.estimatedFee
      })
    : null;
  const deliveryEstimate = formulaDeliveryEstimate
    ? {
        ...formulaDeliveryEstimate,
        estimatedFee: aiDeliveryEstimate?.fee ?? formulaDeliveryEstimate.estimatedFee
      }
    : null;

  return (
    <main className="container py-10">
      <AuctionRealtimeRefresh auctionId={auction.id} />
      {query?.posted === "1" ? (
        <div className="mb-6">
          <SuccessAnimation title="Item posted" message="Your auction is live and ready for buyers." />
        </div>
      ) : null}
      {query?.reported === "1" ? (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
          Report sent. Hazi.ng moderation will review this listing.
        </div>
      ) : null}
      {isAcceptedParticipant && acceptedTransaction ? (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-extrabold">Bid accepted. Escrow chat is open.</p>
              <p className="mt-1 text-sm font-bold">Continue with payment, delivery coordination, and receipt confirmation in the protected escrow chat.</p>
            </div>
            <Link href={`/transactions/${acceptedTransaction.id}`} className="button button-primary">
              <MessageCircle size={16} /> Open escrow chat
            </Link>
          </div>
        </div>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-4">
          <AuctionImageGallery images={auction.auction_images ?? []} title={auctionTitle} />
          <div className="grid gap-4 md:grid-cols-3">
            <div className="card p-4">
              <Truck className="mb-3 text-[var(--primary)]" />
              <strong>Delivery</strong>
              <p className="text-sm text-[var(--muted)]">{auction.delivery_available ? "Buyer and seller coordinate delivery agent" : "Pickup only"}</p>
            </div>
            <div className="card p-4">
              <ShieldCheck className="mb-3 text-[#22577a]" />
              <strong>Trust</strong>
              <p className="text-sm text-[var(--muted)]">Seller verification: {auction.profiles?.verification_status ?? "pending"}</p>
            </div>
            <div className="card p-4">
              <MessageCircle className="mb-3 text-[var(--accent)]" />
              <strong>Escrow chat</strong>
              {isAcceptedParticipant && acceptedTransaction ? (
                <Link href={`/transactions/${acceptedTransaction.id}`} className="text-sm font-extrabold text-[var(--primary)] hover:underline">Open escrow chat</Link>
              ) : (
                <p className="text-sm text-[var(--muted)]">Open after accepted bid.</p>
              )}
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="card p-6">
            <div className="mb-4 flex flex-wrap gap-2">
              <span className={hasAcceptedBid ? "badge badge-premium" : "badge badge-live"}>
                {hasAcceptedBid ? null : <span className="pulse-dot" />}
                {hasAcceptedBid ? "ACCEPTED" : "LIVE"}
              </span>
              {auction.is_premium ? <span className="badge badge-premium">Premium listing</span> : null}
              <span className="badge badge-trust"><BadgeCheck size={14} /> Used item</span>
            </div>
            <h1 className="text-4xl font-extrabold leading-tight text-[var(--primary)]">{auctionTitle}</h1>
            <p className="mt-3 flex items-center gap-2 font-semibold text-[var(--muted)]"><MapPin size={17} /> {auctionLocation}</p>
            <AuctionCountdown endsAt={auction.ends_at} status={auction.status} />
            {isSeller && ["expired", "closed"].includes(auction.status) ? (
              <form action={relistAuction} className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--surface-soft)] p-4">
                <input type="hidden" name="auction_id" value={auction.id} />
                <label className="text-sm font-extrabold text-[var(--primary)]">Relist auction</label>
                <div className="mt-2 flex gap-2">
                  <select className="select" name="duration_hours" defaultValue="72">
                    <option value="24">24 hours</option>
                    <option value="72">3 days</option>
                    <option value="168">7 days</option>
                  </select>
                  <button className="button button-primary" type="submit">Relist</button>
                </div>
              </form>
            ) : null}
            <p className="mt-5 leading-7 text-[var(--muted)]">{auctionDescription}</p>
            <a href={whatsappShareUrl} target="_blank" rel="noreferrer" className="button button-outline mt-5 w-full">
              <Send size={16} /> Share to WhatsApp
            </a>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-[var(--surface-soft)] p-4">
                <p className="text-sm font-bold text-[var(--muted)]">Seller price</p>
                <p className="text-2xl font-extrabold text-[var(--primary)]">{formatNaira(sellerPrice)}</p>
              </div>
              <div className="rounded-xl bg-[var(--accent-soft)] p-4">
                <p className="text-sm font-bold text-[#693c00]">Current bid</p>
                <p className="text-2xl font-extrabold text-[#2c1600]">{formatNaira(currentBid)}</p>
              </div>
            </div>
            {!hasAcceptedBid ? (
              <>
                <DeliveryEstimatePanel
                  deliveryAvailable={auction.delivery_available}
                  isSignedIn={Boolean(userData.user)}
                  buyerHasCoordinates={buyerHasCoordinates}
                  sellerHasCoordinates={sellerHasCoordinates}
                  buyerLocation={buyerProfile?.location ?? null}
                  sellerLocation={auction.profiles?.location ?? auctionLocation}
                  estimate={deliveryEstimate}
                />
                <div className="mt-5 rounded-xl border border-[var(--line)] p-4">
                  <p className="flex items-center gap-2 text-sm font-extrabold text-[var(--primary)]"><Clock size={16} /> Minimum bid is {formatNaira(minBid)}</p>
                  {isSeller ? (
                    <p className="mt-2 text-sm font-bold text-[var(--muted)]">You cannot bid on your own listing.</p>
                  ) : (
                    <form action={placeBid} className="mt-3 flex gap-2">
                      <input type="hidden" name="auction_id" value={auction.id} />
                      <input className="input" name="amount" type="number" min={minBid} defaultValue={currentBid ? currentBid + 5000 : minBid} />
                      <button className="button button-accent" type="submit">Place Bid</button>
                    </form>
                  )}
                </div>
              </>
            ) : (
              <div className="mt-5 rounded-xl border border-[var(--line)] bg-[var(--surface-soft)] p-4">
                <p className="text-sm font-extrabold text-[var(--primary)]">This auction is closed. Escrow setup is ready for the accepted buyer and seller.</p>
                {isAcceptedParticipant && acceptedTransaction ? (
                  <Link href={`/transactions/${acceptedTransaction.id}`} className="button button-primary mt-3 w-full">
                    <MessageCircle size={16} /> Open escrow chat
                  </Link>
                ) : null}
              </div>
            )}

            {!isSeller ? (
              <form action={isSaved ? removeSavedAuction : saveAuction} className="mt-3">
                <input type="hidden" name="auction_id" value={auction.id} />
                <button className="button button-outline w-full" type="submit">
                  <Bookmark size={16} /> {isSaved ? "Remove from watchlist" : "Save to watchlist"}
                </button>
              </form>
            ) : null}
          </div>

          <div className="card p-6">
            <p className="text-sm font-bold text-[var(--muted)]">Seller</p>
            <h2 className="mt-1 text-2xl font-extrabold text-[var(--primary)]">
              <VerifiedName
                name={auction.profiles?.company_name || auction.profiles?.full_name || "Verified Hazi Seller"}
                verificationStatus={auction.profiles?.verification_status}
              />
            </h2>
            <p className="mt-2 text-sm text-[var(--muted)]">Condition: {formatCondition(auction.condition)} · Response rate: {auction.profiles?.response_rate ?? 90}%</p>
          </div>

          <div className="card p-6">
            <p className="flex items-center gap-2 text-sm font-bold text-[var(--muted)]"><Flag size={16} /> Report listing</p>
            <p className="mt-2 text-sm text-[var(--muted)]">
              If anything looks wrong with this listing,{" "}
              <Link href={`/auctions/${auction.id}/report`} className="font-extrabold text-[var(--primary)] hover:underline">
                report the item here
              </Link>
              .
            </p>
          </div>

          <div className="card overflow-hidden">
            <div className="border-b border-[var(--line)] p-5">
              <h2 className="text-2xl font-extrabold text-[var(--primary)]">Bid history</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">Bids are public. Sellers can accept or reject pending offers.</p>
            </div>
            <div className="divide-y divide-[var(--line)]">
              {bids.length ? bids.map((bid) => (
                <div key={bid.id} className="grid gap-3 p-5 md:grid-cols-[1fr_160px]">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="text-[var(--primary)]">{formatNaira(bid.amount)}</strong>
                      <span className={bid.status === "accepted" ? "badge badge-live" : bid.status === "rejected" ? "badge bg-red-50 text-red-700" : "badge badge-trust"}>
                        {bid.status}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      Bidder:{" "}
                      <VerifiedName
                        name={bid.profiles?.full_name ?? "Anonymous bidder"}
                        verificationStatus={bid.profiles?.verification_status}
                      />
                    </p>
                  </div>
                  {isSeller && bid.status === "pending" && !hasAcceptedBid ? (
                    <div className="flex gap-2 md:justify-end">
                      <form action={resolveBid}>
                        <input type="hidden" name="auction_id" value={auction.id} />
                        <input type="hidden" name="bid_id" value={bid.id} />
                        <input type="hidden" name="decision" value="accepted" />
                        <button className="button button-primary" type="submit">Accept</button>
                      </form>
                      <form action={resolveBid}>
                        <input type="hidden" name="auction_id" value={auction.id} />
                        <input type="hidden" name="bid_id" value={bid.id} />
                        <input type="hidden" name="decision" value="rejected" />
                        <button className="button button-outline" type="submit">Reject</button>
                      </form>
                    </div>
                  ) : null}
                </div>
              )) : (
                <p className="p-5 text-sm text-[var(--muted)]">No bids yet. Be the first to place one.</p>
              )}
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

function DeliveryEstimatePanel({
  deliveryAvailable,
  isSignedIn,
  buyerHasCoordinates,
  sellerHasCoordinates,
  buyerLocation,
  sellerLocation,
  estimate
}: {
  deliveryAvailable: boolean;
  isSignedIn: boolean;
  buyerHasCoordinates: boolean;
  sellerHasCoordinates: boolean;
  buyerLocation: string | null;
  sellerLocation: string | null;
  estimate: { distanceKm: number; estimatedFee: number } | null;
}) {
  if (!deliveryAvailable) {
    return (
      <div className="mt-5 rounded-xl border border-[var(--line)] bg-[var(--surface-soft)] p-4">
        <p className="flex items-center gap-2 text-sm font-extrabold text-[var(--primary)]"><Truck size={16} /> Pickup only</p>
        <p className="mt-1 text-sm text-[var(--muted)]">This seller has not enabled delivery for this listing.</p>
      </div>
    );
  }

  if (estimate) {
    return (
      <div className="mt-5 rounded-xl border border-[var(--line)] bg-[var(--surface-soft)] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-sm font-extrabold text-[var(--primary)]"><Truck size={16} /> Estimated delivery before bidding</p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {sellerLocation || "Seller location"} to {buyerLocation || "your saved location"} - {estimate.distanceKm} km
            </p>
          </div>
          <p className="text-2xl font-extrabold text-[var(--primary)]">{formatNaira(estimate.estimatedFee)}</p>
        </div>
        <p className="mt-3 text-xs font-bold text-[var(--muted)]">Final courier pricing may change after checkout, but this gives you the likely delivery fee before you bid.</p>
      </div>
    );
  }

  return (
    <div className="mt-5 rounded-xl border border-[var(--line)] bg-[var(--surface-soft)] p-4">
      <p className="flex items-center gap-2 text-sm font-extrabold text-[var(--primary)]"><Truck size={16} /> Delivery estimate unavailable</p>
      <p className="mt-1 text-sm text-[var(--muted)]">
        {!isSignedIn
          ? "Sign in and save your profile location to see the possible delivery fee before bidding."
          : !buyerHasCoordinates
            ? "Save your current location on your profile to see the possible delivery fee before bidding."
            : !sellerHasCoordinates
              ? "The seller needs saved coordinates before Hazi.ng can estimate delivery for this listing."
              : "Delivery coordinates are incomplete."}
      </p>
      {!isSignedIn ? (
        <Link href="/auth" className="button button-outline mt-3">Sign in</Link>
      ) : !buyerHasCoordinates ? (
        <Link href="/dashboard/profile" className="button button-outline mt-3">Update profile location</Link>
      ) : null}
    </div>
  );
}
