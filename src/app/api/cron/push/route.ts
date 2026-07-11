import { NextRequest, NextResponse } from "next/server";
import { getAutomationServerSecret } from "@/lib/server-secret";
import { createSupabaseApiClient } from "@/lib/supabase/api";
import { isWebPushConfigured, sendBrowserPush, type PushDelivery } from "@/lib/web-push";

function authorized(request: NextRequest) {
  const expected = process.env.CRON_SECRET || process.env.WALLET_SERVER_SECRET;
  const header = request.headers.get("authorization");

  return Boolean(expected && header === `Bearer ${expected}`);
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isWebPushConfigured()) {
    return NextResponse.json({ ok: true, skipped: "VAPID keys are not configured." });
  }

  const supabase = createSupabaseApiClient();

  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
  }

  const secret = getAutomationServerSecret();
  const { data: queued, error } = await supabase.rpc("get_pending_push_notifications", {
    p_server_secret: secret,
    p_limit: 25
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const results = [];

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
      results.push({ id: delivery.delivery_id, status: "sent" });
    } catch (pushError) {
      await supabase.rpc("update_push_delivery_status", {
        p_server_secret: secret,
        p_delivery_id: delivery.delivery_id,
        p_subscription_id: delivery.subscription_id,
        p_status: "failed",
        p_provider_message_id: null,
        p_failure_reason: pushError instanceof Error ? pushError.message : "Browser push failed."
      });
      results.push({ id: delivery.delivery_id, status: "failed" });
    }
  }

  return NextResponse.json({ ok: true, processed: results });
}
