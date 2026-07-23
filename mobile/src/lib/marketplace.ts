import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { AppState, Platform } from "react-native";
import { demoAuctions } from "../data/demo";
import type { MobileAuction } from "../types";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const AUCTION_CACHE_KEY = "hazi:active-auctions:v1";

export const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false
      }
    })
  : null;

const mobileSupabase = supabase;
if (mobileSupabase && Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") mobileSupabase.auth.startAutoRefresh();
    else mobileSupabase.auth.stopAutoRefresh();
  });
}

export async function getActiveAuctions(): Promise<MobileAuction[]> {
  if (!supabase) return demoAuctions;
  try {
  const { data: auctions, error } = await supabase
    .from("auctions")
    .select("id,seller_id,title,location,seller_price,current_bid,reserve_price,status,ends_at,is_premium")
    .eq("status", "active")
    .order("is_premium", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw error;
  if (!auctions?.length) { await AsyncStorage.setItem(AUCTION_CACHE_KEY, "[]"); return []; }

  const auctionIds = auctions.map((auction) => auction.id);
  const sellerIds = [...new Set(auctions.map((auction) => auction.seller_id))];
  const [{ data: images }, { data: sellers }] = await Promise.all([
    supabase.from("auction_images").select("auction_id,image_url,position").in("auction_id", auctionIds).order("position"),
    supabase.from("public_profiles").select("id,full_name,company_name,verification_status").in("id", sellerIds)
  ]);

  const result = auctions.map((auction) => {
    const seller = sellers?.find((profile) => profile.id === auction.seller_id);
    const image = images?.find((candidate) => candidate.auction_id === auction.id);
    return {
      ...auction,
      image_url: image?.image_url ?? null,
      seller_name: seller?.company_name || seller?.full_name || null,
      seller_verified: seller?.verification_status === "verified"
    } as MobileAuction;
  });
  await AsyncStorage.setItem(AUCTION_CACHE_KEY, JSON.stringify(result));
  return result;
  } catch (caught) {
    const cached = await AsyncStorage.getItem(AUCTION_CACHE_KEY);
    if (cached) return JSON.parse(cached) as MobileAuction[];
    throw caught;
  }
}
