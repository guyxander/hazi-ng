export type Category = {
  id: string;
  name: string;
  slug: string;
  icon: string;
};

export type Profile = {
  id: string;
  email?: string | null;
  full_name: string;
  company_name: string | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  avatar_url: string | null;
  role: "buyer" | "seller" | "agent" | "business" | "admin" | "superadmin";
  verification_status: "unverified" | "pending" | "verified" | "rejected";
  response_rate: number;
  rating: number;
};

export type AuctionImage = {
  image_url: string;
  alt_text: string;
  position: number;
};

export type Bid = {
  id: string;
  auction_id: string;
  bidder_id: string;
  amount: number;
  status: "pending" | "accepted" | "rejected" | "withdrawn";
  created_at: string;
  profiles?: Pick<Profile, "id" | "full_name" | "verification_status"> | null;
};

export type Auction = {
  id: string;
  seller_id: string;
  agent_job_id?: string | null;
  category_id: string | null;
  title: string;
  description: string;
  condition: "new" | "like_new" | "good" | "fair" | "needs_repair";
  location: string;
  latitude: number | null;
  longitude: number | null;
  seller_price: number;
  reserve_price: number | null;
  current_bid: number | null;
  status: "draft" | "active" | "paused" | "accepted" | "closed" | "expired" | "disputed";
  pickup_available: boolean;
  delivery_available: boolean;
  is_premium: boolean;
  ends_at: string | null;
  created_at: string;
  categories?: Category | null;
  profiles?: Profile | null;
  auction_images?: AuctionImage[];
  bids?: Bid[];
};
