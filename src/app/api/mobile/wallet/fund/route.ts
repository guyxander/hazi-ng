import { NextResponse } from "next/server";
import { initializeFlutterwavePayment, isFlutterwaveConfigured } from "@/lib/flutterwave";
import { createMobileRequestClient } from "@/lib/supabase/mobile";

export async function POST(request: Request) {
  const supabase = createMobileRequestClient(request);
  if (!supabase) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!isFlutterwaveConfigured()) return NextResponse.json({ error: "Flutterwave is not configured." }, { status: 503 });
  const body = await request.json().catch(() => null) as { amount?: number } | null;
  const amount = Number(body?.amount ?? 0);
  if (!Number.isFinite(amount) || amount < 100) return NextResponse.json({ error: "Enter an amount of at least NGN 100." }, { status: 400 });
  const { data: profile } = await supabase.from("profiles").select("account_status,suspension_reason").eq("id", auth.user.id).maybeSingle();
  if (profile?.account_status === "suspended") return NextResponse.json({ error: profile.suspension_reason || "This account is suspended." }, { status: 403 });
  const txRef = `hazi-wallet-${crypto.randomUUID()}`;
  const { data: intentId, error } = await supabase.rpc("create_wallet_funding_intent", { p_amount: amount, p_tx_ref: txRef });
  if (error || !intentId) return NextResponse.json({ error: error?.message || "Could not create wallet funding request." }, { status: 400 });
  const origin = new URL(request.url).origin;
  const checkoutUrl = await initializeFlutterwavePayment({ txRef, amount, redirectUrl: `${origin}/api/mobile/flutterwave/callback?purpose=wallet&wallet_intent_id=${intentId}`, customer: { email: auth.user.email || "wallet@hazi.ng", name: auth.user.email?.split("@")[0] || "Hazi wallet" }, title: "Hazi.ng wallet funding" });
  return NextResponse.json({ checkoutUrl });
}
