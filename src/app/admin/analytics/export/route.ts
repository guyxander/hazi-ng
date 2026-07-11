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
    return applyCookies(NextResponse.redirect(new URL("/auth?next=/admin/analytics", request.url)));
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();

  if (!isAdminRole(profile?.role)) {
    return applyCookies(NextResponse.redirect(new URL("/dashboard", request.url)));
  }

  const [{ count: users }, { count: auctions }, { count: bids }, { count: agents }] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("auctions").select("*", { count: "exact", head: true }),
    supabase.from("bids").select("*", { count: "exact", head: true }),
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "agent")
  ]);

  const rows = [
    { metric: "users", value: users ?? 0 },
    { metric: "auctions", value: auctions ?? 0 },
    { metric: "bids", value: bids ?? 0 },
    { metric: "agents", value: agents ?? 0 }
  ];

  return new NextResponse(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="hazi-platform-analytics.csv"`
    }
  });
}
