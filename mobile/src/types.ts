export type UserRole = "buyer" | "seller" | "agent" | "business" | "admin" | "superadmin";

export type AuctionStatus = "draft" | "active" | "paused" | "accepted" | "closed" | "expired" | "disputed";

export type MobileAuction = {
  id: string;
  seller_id: string;
  title: string;
  location: string;
  seller_price: number;
  current_bid: number | null;
  reserve_price: number | null;
  status: AuctionStatus;
  ends_at: string | null;
  is_premium: boolean;
  image_url: string | null;
  seller_name: string | null;
  seller_verified: boolean;
};
