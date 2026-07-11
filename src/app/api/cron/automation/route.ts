import { NextRequest, NextResponse } from "next/server";
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
  const [closed, premium, abandoned, released] = await Promise.all([
    supabase.rpc("close_due_auctions", { p_server_secret: secret }),
    supabase.rpc("expire_premium_and_boosts", { p_server_secret: secret }),
    supabase.rpc("mark_abandoned_provider_payments", { p_server_secret: secret }),
    supabase.rpc("auto_release_due_escrows", { p_server_secret: secret })
  ]);

  const firstError = [closed, premium, abandoned, released].find((result) => result.error)?.error;

  if (firstError) {
    return NextResponse.json({ error: firstError.message }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    closed_auctions: closed.data,
    expired_premium: premium.data,
    abandoned_payments: abandoned.data,
    released_escrows: released.data
  });
}
