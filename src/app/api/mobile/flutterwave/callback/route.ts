import { NextResponse } from "next/server";
import { verifyFlutterwavePayment } from "@/lib/flutterwave";
import { getAutomationServerSecret } from "@/lib/server-secret";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const status = params.get("status"); const txRef = params.get("tx_ref") || ""; const transactionId = params.get("transaction_id") || "";
  const appUrl = new URL("hazi://wallet");
  if (status !== "successful" || !txRef || !transactionId) { appUrl.searchParams.set("status", "cancelled"); return NextResponse.redirect(appUrl); }
  try {
    const verified = await verifyFlutterwavePayment(transactionId);
    if (verified.status !== "successful" || verified.tx_ref !== txRef || verified.currency !== "NGN") throw new Error("Payment details did not match.");
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) throw new Error("Payment service unavailable.");
    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const { error } = await supabase.rpc("complete_provider_payment_reference", { p_provider: "flutterwave", p_reference: txRef, p_provider_transaction_id: transactionId, p_verified_amount: Number(verified.amount), p_currency: verified.currency, p_provider_status: verified.status, p_event_id: `mobile-callback:${transactionId}`, p_payload: { verified, purpose: params.get("purpose") || "wallet" }, p_server_secret: getAutomationServerSecret() });
    if (error) throw error;
    appUrl.searchParams.set("status", "success");
  } catch (caught) { appUrl.searchParams.set("status", "error"); appUrl.searchParams.set("message", caught instanceof Error ? caught.message : "Verification failed."); }
  return NextResponse.redirect(appUrl);
}
