import type { MobileAuction } from "../types";

export const demoAuctions: MobileAuction[] = [
  {
    id: "demo-chair",
    seller_id: "demo-seller",
    title: "Walnut lounge chair",
    location: "Lekki Phase 1, Lagos",
    seller_price: 185000,
    current_bid: 122000,
    reserve_price: 92500,
    status: "active",
    ends_at: new Date(Date.now() + 3 * 86400000 + 4 * 3600000).toISOString(),
    is_premium: true,
    image_url: "https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=900",
    seller_name: "Amina Bello",
    seller_verified: true
  },
  {
    id: "demo-camera",
    seller_id: "demo-business",
    title: "Sony mirrorless camera",
    location: "Yaba, Lagos",
    seller_price: 540000,
    current_bid: 390000,
    reserve_price: 270000,
    status: "active",
    ends_at: new Date(Date.now() + 86400000 + 8 * 3600000).toISOString(),
    is_premium: false,
    image_url: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=900",
    seller_name: "Frame House",
    seller_verified: true
  },
  {
    id: "demo-table",
    seller_id: "demo-seller-two",
    title: "Compact dining table",
    location: "Gwarinpa, Abuja",
    seller_price: 210000,
    current_bid: null,
    reserve_price: 105000,
    status: "active",
    ends_at: new Date(Date.now() + 6 * 86400000).toISOString(),
    is_premium: false,
    image_url: "https://images.unsplash.com/photo-1615066390971-03e4e1c36ddf?w=900",
    seller_name: "Tomi Adeyemi",
    seller_verified: false
  }
];
