import type { Auction, Category } from "./types";

export const demoCategories: Category[] = [
  { id: "electronics", name: "Electronics", slug: "electronics", icon: "smartphone" },
  { id: "furniture", name: "Furniture", slug: "furniture", icon: "sofa" },
  { id: "appliances", name: "Home Appliances", slug: "home-appliances", icon: "washing-machine" },
  { id: "fashion", name: "Fashion", slug: "fashion", icon: "shirt" },
  { id: "fitness", name: "Fitness", slug: "fitness", icon: "dumbbell" },
  { id: "collectibles", name: "Collectibles", slug: "collectibles", icon: "badge" }
];

const imageBase = "https://lh3.googleusercontent.com/aida-public";

export const demoAuctions: Auction[] = [
  {
    id: "demo-headphones",
    seller_id: "demo-seller",
    category_id: "electronics",
    title: "Matte Black Audiophile Headphones",
    description: "Like-new premium wireless headphones with active noise cancellation, leather case, and verified seller delivery from Lekki.",
    condition: "like_new",
    location: "Lekki Phase 1, Lagos",
    latitude: 6.4474,
    longitude: 3.4723,
    seller_price: 185000,
    reserve_price: null,
    current_bid: 142000,
    status: "active",
    pickup_available: true,
    delivery_available: true,
    is_premium: true,
    ends_at: new Date(Date.now() + 1000 * 60 * 60 * 8).toISOString(),
    created_at: new Date().toISOString(),
    categories: demoCategories[0],
    profiles: {
      id: "demo-seller",
      full_name: "Tunde Adeyemi",
      company_name: "Tunde Tech Finds",
      location: "Lagos",
      latitude: 6.4474,
      longitude: 3.4723,
      avatar_url: null,
      role: "seller",
      verification_status: "verified",
      response_rate: 98,
      rating: 4.8
    },
    auction_images: [
      {
        image_url: `${imageBase}/AB6AXuBnonUKPr_v8SXXudQozjKSQx-9gqaLLkLJkUYWh9WUGqsSHhsQUlQlD_O7GpJn76vAZHxasc8llVGP7dHgRZmrgUmMpsfHbOoNSl67olU0dVwpzT6VXdafNNou0FIYU3N6qe8XT8fZn0e8ivDkXoIgcUXhE-cbDRRroaylkfkF3WIf8ZovtvwYjr5NSs852iPLRAb5QCdt7nlnPMmfSRfSKlnaW64kdbtetvYcs6f-6Gg82j4x7HN3`,
        alt_text: "Premium matte black headphones",
        position: 0
      }
    ]
  },
  {
    id: "demo-chair",
    seller_id: "demo-agent",
    category_id: "furniture",
    title: "Charcoal Ergonomic Office Chair",
    description: "Clean, comfortable work chair from a verified declutter agent. Inspected and ready for pickup or delivery.",
    condition: "good",
    location: "Yaba, Lagos",
    latitude: 6.5165,
    longitude: 3.3792,
    seller_price: 95000,
    reserve_price: null,
    current_bid: 68500,
    status: "active",
    pickup_available: true,
    delivery_available: true,
    is_premium: false,
    ends_at: new Date(Date.now() + 1000 * 60 * 60 * 22).toISOString(),
    created_at: new Date().toISOString(),
    categories: demoCategories[1],
    profiles: {
      id: "demo-agent",
      full_name: "Amaka Okorie",
      company_name: "Space Reset Agents",
      location: "Lagos",
      latitude: 6.5165,
      longitude: 3.3792,
      avatar_url: null,
      role: "agent",
      verification_status: "verified",
      response_rate: 96,
      rating: 4.9
    },
    auction_images: [
      {
        image_url: `${imageBase}/AB6AXuCB_akwRZFDgmCaetKpCNzqzpBO5eFK-C9wMeenH_QvFd-7x8x5bLCt8V7ic_02i2ID9Zh9YlPDS75xxWIBdZ7Bb4AXA5YVBHz4AwgXZUHJ7Xj2eznPb4PIoyz-5rgoZYpD74xoVnYhGrdpX4zuK9PIkRQWq5F_79cuDxBnQZaDNpFDYn8_kDfQqME_VrwQphWKW9RmHERKt6mAJ4Nq2TWumr0YKNuzDXAny8ntYlgASaomT`,
        alt_text: "Modern ergonomic office chair",
        position: 0
      }
    ]
  },
  {
    id: "demo-camera",
    seller_id: "demo-seller",
    category_id: "collectibles",
    title: "Vintage Silver Film Camera",
    description: "Collector-grade film camera with original lens cap and tested mechanics.",
    condition: "good",
    location: "Ikeja GRA, Lagos",
    latitude: 6.6018,
    longitude: 3.3515,
    seller_price: 120000,
    reserve_price: null,
    current_bid: 81000,
    status: "active",
    pickup_available: true,
    delivery_available: false,
    is_premium: true,
    ends_at: new Date(Date.now() + 1000 * 60 * 35).toISOString(),
    created_at: new Date().toISOString(),
    categories: demoCategories[5],
    profiles: {
      id: "demo-seller",
      full_name: "Tunde Adeyemi",
      company_name: "Tunde Tech Finds",
      location: "Lagos",
      latitude: 6.6018,
      longitude: 3.3515,
      avatar_url: null,
      role: "seller",
      verification_status: "verified",
      response_rate: 98,
      rating: 4.8
    },
    auction_images: [
      {
        image_url: `${imageBase}/AB6AXuCxPTIvRPebeRMqeCmeTW1wel_yKoJTOZyk2ZLpgtDKmnZgA1qwiofeOVwOnJPPeRdkMgIdxLcd7vs05hVxbIIRZewKCXPk49Xpy0TTTy6nU0E-trrTGNNlHaGCZ8RJruq4MkrCWZH3xfB_RrUfBJ9mQoj1t6NNaGHwgCa1EUOJURRQEIR6y_cdG6nkXczFfwCMw33RhPw6_VEnnccp-xPD0dYOnlrtX8JHPacP-6GDYqFHspX2zNFh`,
        alt_text: "Vintage film camera",
        position: 0
      }
    ]
  }
];
