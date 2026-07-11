import { demoAuctions, demoCategories } from "@/lib/demo-data";
import type { Auction, Category } from "@/lib/types";
import { createSupabaseServerClient } from "./server";

type AuctionFilters = {
  q?: string;
  categoryId?: string;
  location?: string;
  sort?: string;
};

export async function getCategories(): Promise<Category[]> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return demoCategories;
  }

  const { data, error } = await supabase
    .from("categories")
    .select("id,name,slug,icon")
    .order("name");

  if (error || !data?.length) {
    return demoCategories;
  }

  return data;
}

export async function getAuctions(filters: AuctionFilters = {}): Promise<Auction[]> {
  const supabase = await createSupabaseServerClient();
  const search = filters.q?.trim().toLowerCase();
  const location = filters.location?.trim().toLowerCase();

  if (!supabase) {
    return demoAuctions.filter((auction) => {
      const matchesSearch = !search || [auction.title, auction.description, auction.location]
        .some((value) => value.toLowerCase().includes(search));
      const matchesCategory = !filters.categoryId || auction.category_id === filters.categoryId;
      const matchesLocation = !location || auction.location.toLowerCase().includes(location);

      return matchesSearch && matchesCategory && matchesLocation;
    });
  }

  let query = supabase
    .from("auctions")
    .select("*")
    .eq("status", "active");

  if (filters.categoryId) {
    query = query.eq("category_id", filters.categoryId);
  }

  if (search) {
    query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%,location.ilike.%${search}%`);
  }

  if (location) {
    query = query.ilike("location", `%${location}%`);
  }

  query = query.order("is_premium", { ascending: false });

  if (filters.sort === "price_low") {
    query = query.order("seller_price", { ascending: true });
  } else if (filters.sort === "price_high") {
    query = query.order("seller_price", { ascending: false });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  const { data, error } = await query;

  if (error || !data?.length) {
    return [];
  }

  const auctions = data as Auction[];
  const auctionIds = auctions.map((auction) => auction.id);
  const categoryIds = [...new Set(auctions.map((auction) => auction.category_id).filter(Boolean))] as string[];
  const sellerIds = [...new Set(auctions.map((auction) => auction.seller_id).filter(Boolean))];

  const [
    { data: categories },
    { data: profiles },
    { data: images }
  ] = await Promise.all([
    categoryIds.length
      ? supabase.from("categories").select("id,name,slug,icon").in("id", categoryIds)
      : Promise.resolve({ data: [] }),
    sellerIds.length
      ? supabase
          .from("public_profiles")
          .select("id,full_name,company_name,location,latitude,longitude,avatar_url,role,verification_status,response_rate,rating")
          .in("id", sellerIds)
      : Promise.resolve({ data: [] }),
    auctionIds.length
      ? supabase
          .from("auction_images")
          .select("auction_id,image_url,alt_text,position")
          .in("auction_id", auctionIds)
          .order("position", { ascending: true })
      : Promise.resolve({ data: [] })
  ]);

  const categoryById = new Map((categories ?? []).map((category) => [category.id, category]));
  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const imagesByAuctionId = new Map<string, Auction["auction_images"]>();

  for (const image of images ?? []) {
    const existing = imagesByAuctionId.get(image.auction_id) ?? [];
    existing.push({
      image_url: image.image_url,
      alt_text: image.alt_text,
      position: image.position
    });
    imagesByAuctionId.set(image.auction_id, existing);
  }

  return auctions.map((auction) => ({
    ...auction,
    categories: auction.category_id ? categoryById.get(auction.category_id) ?? null : null,
    profiles: profileById.get(auction.seller_id) ?? null,
    auction_images: imagesByAuctionId.get(auction.id) ?? [],
    bids: []
  }));
}

export async function getAuction(id: string): Promise<Auction | null> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return demoAuctions.find((auction) => auction.id === id) ?? demoAuctions[0];
  }

  const { data, error } = await supabase
    .from("auctions")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const auction = data as Auction;

  const [
    { data: category },
    { data: profile },
    { data: images },
    { data: bids }
  ] = await Promise.all([
    auction.category_id
      ? supabase.from("categories").select("id,name,slug,icon").eq("id", auction.category_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("public_profiles")
      .select("id,full_name,company_name,location,latitude,longitude,avatar_url,role,verification_status,response_rate,rating")
      .eq("id", auction.seller_id)
      .maybeSingle(),
    supabase
      .from("auction_images")
      .select("image_url,alt_text,position")
      .eq("auction_id", auction.id)
      .order("position", { ascending: true }),
    supabase
      .from("bids")
      .select("id,auction_id,bidder_id,amount,status,created_at")
      .eq("auction_id", auction.id)
      .order("amount", { ascending: false })
  ]);

  const bidderIds = [...new Set((bids ?? []).map((bid) => bid.bidder_id).filter(Boolean))];
  const { data: bidderProfiles } = bidderIds.length
    ? await supabase
        .from("public_profiles")
        .select("id,full_name,verification_status")
        .in("id", bidderIds)
    : { data: [] };
  const bidderProfileById = new Map((bidderProfiles ?? []).map((bidderProfile) => [bidderProfile.id, bidderProfile]));

  return {
    ...auction,
    categories: category ?? null,
    profiles: profile ?? null,
    auction_images: images ?? [],
    bids: (bids ?? []).map((bid) => ({
      ...bid,
      profiles: bidderProfileById.get(bid.bidder_id) ?? null
    }))
  } as Auction;
}
