import { NextRequest, NextResponse } from "next/server";
import { sendExternalNotification } from "@/lib/notifications";
import { getAutomationServerSecret } from "@/lib/server-secret";
import { createSupabaseApiClient } from "@/lib/supabase/api";

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
  const { data: queued, error } = await supabase.rpc("get_queued_external_notifications", {
    p_server_secret: secret,
    p_limit: 15
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const results = [];

  for (const notification of queued ?? []) {
    try {
      const sent = await sendExternalNotification(notification);
      await supabase.rpc("update_external_notification_delivery", {
        p_server_secret: secret,
        p_notification_id: notification.id,
        p_status: "sent",
        p_provider: sent.provider,
        p_provider_message_id: sent.providerMessageId,
        p_failure_reason: null
      });
      results.push({ id: notification.id, status: "sent" });
    } catch (sendError) {
      await supabase.rpc("update_external_notification_delivery", {
        p_server_secret: secret,
        p_notification_id: notification.id,
        p_status: "failed",
        p_provider: notification.channel === "email" ? "resend" : "termii",
        p_provider_message_id: null,
        p_failure_reason: sendError instanceof Error ? sendError.message : "Notification failed."
      });
      results.push({ id: notification.id, status: "failed" });
    }
  }

  return NextResponse.json({ ok: true, processed: results });
}
