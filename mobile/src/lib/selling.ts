import type { ImagePickerAsset } from "expo-image-picker";
import type { MobileAccount } from "./auth";
import { supabase } from "./marketplace";

export type SellCategory = { id: string; name: string };
export type AgentListingJob = { id: string; label: string; status: string; location: string | null };
export type AuctionDraft = { title: string; description: string; categoryId: string; condition: string; location: string; latitude: number; longitude: number; sellerPrice: number; durationHours: number; pickupAvailable: boolean; deliveryAvailable: boolean; agentJobId: string | null };
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function loadSellingOptions(account: MobileAccount) {
  if (!supabase) throw new Error("Hazi mobile is not connected to Supabase.");
  const { data: categories, error: categoryError } = await supabase.from("categories").select("id,name").order("name");
  if (categoryError) throw categoryError;
  let jobs: AgentListingJob[] = [];
  if (account.role === "agent") {
    const { data, error } = await supabase.from("agent_jobs").select("id,status,location,agent_leads(item_summary,full_name)").eq("agent_id", account.user.id).neq("status", "cancelled").order("created_at", { ascending: false });
    if (error) throw error;
    jobs = (data ?? []).map((job) => { const lead = Array.isArray(job.agent_leads) ? job.agent_leads[0] : job.agent_leads; return { id: job.id, label: lead?.item_summary || lead?.full_name || "Assigned client", status: job.status, location: job.location }; });
  }
  return { categories: (categories ?? []) as SellCategory[], jobs };
}

export async function saveAuction(draft: AuctionDraft, images: ImagePickerAsset[], account: MobileAccount, publish: boolean) {
  if (!supabase) throw new Error("Hazi mobile is not connected to Supabase.");
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw new Error("Sign in again to continue.");
  if (!draft.title.trim() || !draft.description.trim() || draft.sellerPrice < 1) throw new Error("Complete the title, description, and seller price.");
  if (!Number.isFinite(draft.latitude) || !Number.isFinite(draft.longitude)) throw new Error("Confirm the pickup location.");
  if (draft.latitude < 4 || draft.latitude > 14.5 || draft.longitude < 2.5 || draft.longitude > 15) throw new Error("Pickup coordinates must be within Nigeria.");
  if (account.role === "agent" && !draft.agentJobId) throw new Error("Choose an assigned client job.");
  const invalid = images.find((image) => !image.mimeType || !allowedTypes.has(image.mimeType) || (image.fileSize ?? 0) > 5 * 1024 * 1024);
  if (invalid || images.length > 6) throw new Error("Use up to six JPEG, PNG, WebP, or GIF photos, maximum 5MB each.");

  let agentJob: { id: string; requester_id: string | null } | null = null;
  if (draft.agentJobId) {
    const result = await supabase.from("agent_jobs").select("id,requester_id").eq("id", draft.agentJobId).eq("agent_id", auth.user.id).neq("status", "cancelled").maybeSingle();
    if (result.error || !result.data) throw new Error("Choose a valid assigned agent job.");
    agentJob = result.data;
  }
  const { data: auction, error } = await supabase.from("auctions").insert({
    seller_id: auth.user.id, agent_job_id: agentJob?.id ?? null, listed_for_user_id: agentJob?.requester_id ?? null, category_id: draft.categoryId || null,
    title: draft.title.trim(), description: draft.description.trim(), condition: draft.condition, location: draft.location.trim() || "Lagos", latitude: draft.latitude, longitude: draft.longitude,
    seller_price: draft.sellerPrice, reserve_price: null, current_bid: Math.round(draft.sellerPrice * 0.5), status: publish ? "active" : "draft",
    pickup_available: draft.pickupAvailable, delivery_available: draft.deliveryAvailable, ends_at: new Date(Date.now() + draft.durationHours * 3600000).toISOString()
  }).select("id").single();
  if (error || !auction) throw new Error(error?.message || "Could not save this auction.");

  const rows = [];
  for (const [position, image] of images.entries()) {
    const blob = await (await fetch(image.uri)).blob();
    const extension = image.fileName?.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${auth.user.id}/${auction.id}/${Date.now()}-${position}.${extension}`;
    const upload = await supabase.storage.from("auction-images").upload(path, blob, { contentType: image.mimeType!, cacheControl: "3600", upsert: false });
    if (upload.error) throw new Error(`Auction saved, but photo ${position + 1} failed: ${upload.error.message}`);
    rows.push({ auction_id: auction.id, image_url: supabase.storage.from("auction-images").getPublicUrl(path).data.publicUrl, alt_text: draft.title.trim(), position });
  }
  if (rows.length) { const result = await supabase.from("auction_images").insert(rows); if (result.error) throw new Error(`Auction saved, but photos could not be attached: ${result.error.message}`); }
  return auction.id;
}
