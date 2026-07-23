import { NextRequest, NextResponse } from "next/server";
import { getAutomationServerSecret } from "@/lib/server-secret";
import { createSupabaseApiClient } from "@/lib/supabase/api";
import { isWebPushConfigured, sendBrowserPush, type PushDelivery } from "@/lib/web-push";
import { isFcmConfigured, sendFcmPush, type MobilePushDelivery } from "@/lib/fcm";

function authorized(request: NextRequest) {
  const expected = process.env.CRON_SECRET || process.env.WALLET_SERVER_SECRET;
  const header = request.headers.get("authorization");

  return Boolean(expected && header === `Bearer ${expected}`);
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseApiClient();

  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
  }

  const secret = getAutomationServerSecret();
  const results = [];
  if (isWebPushConfigured()) {
    const { data: queued, error } = await supabase.rpc("get_pending_push_notifications", { p_server_secret: secret, p_limit: 25 });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    for (const delivery of (queued ?? []) as PushDelivery[]) {
    try {
      const providerMessageId = await sendBrowserPush(delivery);
      await supabase.rpc("update_push_delivery_status", {
        p_server_secret: secret,
        p_delivery_id: delivery.delivery_id,
        p_subscription_id: delivery.subscription_id,
        p_status: "sent",
        p_provider_message_id: providerMessageId,
        p_failure_reason: null
      });
      results.push({ id: delivery.delivery_id, channel: "browser", status: "sent" });
    } catch (pushError) {
      await supabase.rpc("update_push_delivery_status", {
        p_server_secret: secret,
        p_delivery_id: delivery.delivery_id,
        p_subscription_id: delivery.subscription_id,
        p_status: "failed",
        p_provider_message_id: null,
        p_failure_reason: pushError instanceof Error ? pushError.message : "Browser push failed."
      });
      results.push({ id: delivery.delivery_id, channel: "browser", status: "failed" });
    }
  }
  }

  if (isFcmConfigured()) {
    const { data: queued, error } = await supabase.rpc("get_pending_mobile_push_notifications", { p_server_secret: secret, p_limit: 25 });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    for (const delivery of (queued ?? []) as MobilePushDelivery[]) {
      try {
        const providerMessageId = await sendFcmPush(delivery);
        await supabase.rpc("update_mobile_push_delivery_status", { p_server_secret: secret, p_delivery_id: delivery.delivery_id, p_token_id: delivery.token_id, p_status: "sent", p_provider_message_id: providerMessageId, p_failure_reason: null });
        results.push({ id: delivery.delivery_id, channel: "mobile", status: "sent" });
      } catch (pushError) {
        const failure = pushError instanceof Error ? pushError.message : "Mobile push failed.";
        await supabase.rpc("update_mobile_push_delivery_status", { p_server_secret: secret, p_delivery_id: delivery.delivery_id, p_token_id: delivery.token_id, p_status: "failed", p_provider_message_id: null, p_failure_reason: failure });
        results.push({ id: delivery.delivery_id, channel: "mobile", status: "failed" });
      }
    }
  }

  return NextResponse.json({ ok: true, configured: { browser: isWebPushConfigured(), mobile: isFcmConfigured() }, processed: results });
}
