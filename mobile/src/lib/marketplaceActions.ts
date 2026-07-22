import { supabase } from "./marketplace";

export type MobileBid = { id: string; amount: number; status: string; bidderId: string; bidderName: string; createdAt: string; isMine: boolean };
export type AuctionInteraction = { bids: MobileBid[]; watched: boolean; currentBid: number | null };

async function requireActiveUser() {
  if (!supabase) throw new Error("Hazi mobile is not connected to Supabase.");
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Sign in again to continue.");
  const { data: profile, error: profileError } = await supabase.from("profiles").select("account_status,suspension_reason").eq("id", data.user.id).maybeSingle();
  if (profileError) throw profileError;
  if (profile?.account_status === "suspended") throw new Error(profile.suspension_reason || "This account is suspended. Contact Hazi support.");
  return data.user;
}

export async function loadAuctionInteraction(auctionId: string): Promise<AuctionInteraction> {
  if (!supabase) return { bids: [], watched: false, currentBid: null };
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  const [{ data: bids, error: bidsError }, { data: auction, error: auctionError }] = await Promise.all([
    supabase.from("bids").select("id,amount,status,bidder_id,created_at").eq("auction_id", auctionId).order("amount", { ascending: false }),
    supabase.from("auctions").select("current_bid").eq("id", auctionId).maybeSingle()
  ]);
  if (bidsError) throw bidsError;
  if (auctionError) throw auctionError;
  const bidderIds = [...new Set((bids ?? []).map((bid) => bid.bidder_id))];
  const { data: bidders, error: biddersError } = bidderIds.length
    ? await supabase.from("public_profiles").select("id,full_name").in("id", bidderIds)
    : { data: [], error: null };
  if (biddersError) throw biddersError;
  const bidderNames = new Map((bidders ?? []).map((bidder) => [bidder.id, bidder.full_name]));
  let watched = false;
  if (userId) {
    const { data: saved, error: savedError } = await supabase.from("auction_watchlist").select("auction_id").eq("user_id", userId).eq("auction_id", auctionId).maybeSingle();
    if (savedError) throw savedError;
    watched = Boolean(saved);
  }
  return {
    watched,
    currentBid: auction?.current_bid ?? null,
    bids: (bids ?? []).map((bid) => ({ id: bid.id, amount: Number(bid.amount), status: bid.status, bidderId: bid.bidder_id, bidderName: bidderNames.get(bid.bidder_id) || "Hazi buyer", createdAt: bid.created_at, isMine: bid.bidder_id === userId }))
  };
}

export async function placeAuctionBid(auctionId: string, amount: number) {
  const user = await requireActiveUser();
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Enter a valid bid amount.");
  const { data: auction, error: auctionError } = await supabase!.from("auctions").select("seller_id,status,ends_at").eq("id", auctionId).maybeSingle();
  if (auctionError || !auction) throw new Error(auctionError?.message || "Auction not found.");
  if (auction.seller_id === user.id) throw new Error("You cannot bid on your own listing.");
  if (auction.status !== "active") throw new Error("Only active auctions can receive bids.");
  if (auction.ends_at && new Date(auction.ends_at).getTime() <= Date.now()) throw new Error("This auction has ended.");
  const { error } = await supabase!.rpc("place_bid_secure", { p_auction_id: auctionId, p_amount: amount });
  if (error) throw new Error(error.message);
  return loadAuctionInteraction(auctionId);
}

export async function setAuctionWatched(auctionId: string, watched: boolean) {
  const user = await requireActiveUser();
  const query = watched
    ? supabase!.from("auction_watchlist").upsert({ user_id: user.id, auction_id: auctionId })
    : supabase!.from("auction_watchlist").delete().eq("user_id", user.id).eq("auction_id", auctionId);
  const { error } = await query;
  if (error) throw new Error(error.message);
}

export async function withdrawAuctionBid(bidId: string, auctionId: string) {
  const user = await requireActiveUser();
  const { data, error } = await supabase!.from("bids").update({ status: "withdrawn" }).eq("id", bidId).eq("bidder_id", user.id).eq("status", "pending").select("id").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Only your pending bid can be withdrawn.");
  return loadAuctionInteraction(auctionId);
}
