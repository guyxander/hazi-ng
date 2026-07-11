import { NextRequest, NextResponse } from "next/server";
import { toCsv } from "@/lib/csv";
import { isAdminRole } from "@/lib/roles";
import { createSupabaseRouteClient } from "@/lib/supabase/route";

export async function GET(request: NextRequest) {
  const { supabase, applyCookies } = createSupabaseRouteClient(request);

  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    return applyCookies(NextResponse.redirect(new URL("/auth?next=/admin/finance", request.url)));
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();

  if (!isAdminRole(profile?.role)) {
    return applyCookies(NextResponse.redirect(new URL("/dashboard", request.url)));
  }

  const { data: settlements, error } = await supabase
    .from("finance_settlements")
    .select("settlement_type,provider,provider_reference,gross_amount,fee_amount,net_amount,currency,status,created_at,settled_at")
    .order("created_at", { ascending: false })
    .limit(2000);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return new NextResponse(toCsv((settlements ?? []) as Array<Record<string, unknown>>), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="hazi-finance-settlements.csv"`
    }
  });
}
