import { NextRequest, NextResponse } from "next/server";
import { verifyFlutterwavePayment, verifyFlutterwaveWebhookSignature } from "@/lib/flutterwave";
import { getAutomationServerSecret } from "@/lib/server-secret";
import { createSupabaseApiClient } from "@/lib/supabase/api";

export async function POST(request: NextRequest) {
  if (!verifyFlutterwaveWebhookSignature(request.headers.get("verif-hash"))) {
    return NextResponse.json({ error: "Invalid Flutterwave webhook signature." }, { status: 401 });
  }

  const supabase = createSupabaseApiClient();

  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
  }

  const payload = await request.json();
  const eventId = String(payload?.id ?? payload?.event_id ?? payload?.data?.id ?? "");
  const transactionId = String(payload?.data?.id ?? payload?.transaction_id ?? "");
  const txRef = String(payload?.data?.tx_ref ?? payload?.tx_ref ?? "");

  if (!transactionId || !txRef) {
    return NextResponse.json({ ok: true, skipped: "missing_transaction" });
  }

  const verified = await verifyFlutterwavePayment(transactionId);
  const { data, error } = await supabase.rpc("complete_provider_payment_reference", {
    p_provider: "flutterwave",
    p_reference: verified.tx_ref,
    p_provider_transaction_id: String(verified.id),
    p_verified_amount: Number(verified.amount),
    p_currency: verified.currency,
    p_provider_status: verified.status,
    p_event_id: eventId,
    p_payload: { ...payload, verified },
    p_server_secret: getAutomationServerSecret()
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, result: data });
}
