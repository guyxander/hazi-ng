import { NextResponse } from "next/server";
import { getAiDeliveryEstimate } from "@/lib/ai-delivery-estimate";
import { getDeliveryEstimate, hasCoordinates } from "@/lib/delivery-estimate";
import { createMobileRequestClient } from "@/lib/supabase/mobile";

type DeliveryRequest = { action?: "quote" | "book" | "cancel"; transactionId?: string; quoteId?: string; deliveryId?: string; cancellationReason?: string };

export async function POST(request: Request) {
  const supabase = createMobileRequestClient(request);
  if (!supabase) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const body = await request.json().catch(() => null) as DeliveryRequest | null;
  if (!body?.action || !body.transactionId) return NextResponse.json({ error: "A delivery action and transaction are required." }, { status: 400 });
  const { data: profile } = await supabase.from("profiles").select("account_status,suspension_reason").eq("id", auth.user.id).maybeSingle();
  if (profile?.account_status === "suspended") return NextResponse.json({ error: profile.suspension_reason || "This account is suspended." }, { status: 403 });
  const { data: transaction, error: transactionError } = await supabase.from("transactions").select("id,auction_id,buyer_id,seller_id,status").eq("id", body.transactionId).maybeSingle();
  if (transactionError || !transaction) return NextResponse.json({ error: transactionError?.message || "Transaction not found." }, { status: 404 });
  if (![transaction.buyer_id, transaction.seller_id].includes(auth.user.id)) return NextResponse.json({ error: "Only transaction participants can manage delivery." }, { status: 403 });

  if (body.action === "quote") {
    const [{ data: auction }, { data: buyer }, { data: seller }] = await Promise.all([
      supabase.from("auctions").select("location,latitude,longitude").eq("id", transaction.auction_id).single(),
      supabase.from("public_profiles").select("location,latitude,longitude").eq("id", transaction.buyer_id).single(),
      supabase.from("public_profiles").select("location,latitude,longitude").eq("id", transaction.seller_id).single()
    ]);
    const pickupLocation = auction?.location || seller?.location || ""; const dropoffLocation = buyer?.location || "";
    const sellerCoordinates = hasCoordinates(auction) ? auction : hasCoordinates(seller) ? seller : null; const buyerCoordinates = hasCoordinates(buyer) ? buyer : null;
    const estimate = sellerCoordinates && buyerCoordinates ? getDeliveryEstimate(sellerCoordinates, buyerCoordinates) : null;
    if (!pickupLocation || !dropoffLocation || !estimate) return NextResponse.json({ error: "Buyer and seller saved locations with confirmed coordinates are required before Hazi can suggest delivery." }, { status: 400 });
    const ai = await getAiDeliveryEstimate({ pickupLocation, dropoffLocation, distanceKm: estimate.distanceKm, fallbackFee: estimate.estimatedFee });
    const inserted = await supabase.from("delivery_quotes").insert({ auction_id: transaction.auction_id, requester_id: auth.user.id, provider: "Independent delivery", provider_quote_id: null, pickup_location: pickupLocation, dropoff_location: dropoffLocation, distance_km: estimate.distanceKm, estimated_fee: ai.fee, currency: "NGN", raw_response: ai.raw, status: ai.source === "openrouter" ? "ai_estimate" : "fallback_quote" }).select("id").single();
    if (inserted.error) return NextResponse.json({ error: inserted.error.message }, { status: 400 });
    return NextResponse.json({ id: inserted.data.id });
  }

  if (body.action === "book") {
    if (transaction.status !== "paid") return NextResponse.json({ error: "Delivery can only be booked after payment is verified." }, { status: 400 });
    if (!body.quoteId) return NextResponse.json({ error: "Choose a delivery quote." }, { status: 400 });
    const existing = await supabase.from("delivery_orders").select("id").eq("transaction_id", transaction.id).neq("status", "cancelled").maybeSingle();
    if (existing.data) return NextResponse.json({ error: "Delivery is already booked for this transaction." }, { status: 409 });
    const quote = await supabase.from("delivery_quotes").select("id,auction_id,provider,pickup_location,dropoff_location,distance_km,estimated_fee").eq("id", body.quoteId).eq("auction_id", transaction.auction_id).maybeSingle();
    if (quote.error || !quote.data) return NextResponse.json({ error: quote.error?.message || "Delivery quote not found." }, { status: 404 });
    const inserted = await supabase.from("delivery_orders").insert({ transaction_id: transaction.id, quote_id: quote.data.id, auction_id: quote.data.auction_id, requester_id: auth.user.id, provider: quote.data.provider, provider_shipment_id: null, provider_tracking_url: null, raw_response: { mode: "independent_delivery", instruction: "Buyer and seller arrange a delivery agent independently." }, pickup_location: quote.data.pickup_location, dropoff_location: quote.data.dropoff_location, distance_km: quote.data.distance_km, fee: quote.data.estimated_fee, status: "assigned", tracking_code: `HAZI-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, courier_name: null }).select("id").single();
    if (inserted.error) return NextResponse.json({ error: inserted.error.message }, { status: 400 });
    return NextResponse.json({ id: inserted.data.id });
  }

  if (!body.deliveryId) return NextResponse.json({ error: "Choose a delivery order." }, { status: 400 });
  const delivery = await supabase.from("delivery_orders").select("id,status").eq("id", body.deliveryId).eq("transaction_id", transaction.id).maybeSingle();
  if (delivery.error || !delivery.data) return NextResponse.json({ error: delivery.error?.message || "Delivery order not found." }, { status: 404 });
  if (["delivered", "cancelled"].includes(delivery.data.status)) return NextResponse.json({ error: "This delivery can no longer be cancelled." }, { status: 400 });
  const cancelled = await supabase.from("delivery_orders").update({ status: "cancelled", cancellation_reason: body.cancellationReason?.trim() || "Cancelled by transaction party.", cancelled_at: new Date().toISOString() }).eq("id", delivery.data.id).select("id").single();
  if (cancelled.error) return NextResponse.json({ error: cancelled.error.message }, { status: 400 });
  return NextResponse.json({ id: cancelled.data.id });
}
