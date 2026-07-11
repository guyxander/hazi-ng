import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/route";
import { getRequestOrigin } from "@/lib/site-url";

function safeNextPath(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

function getAppOrigin(request: NextRequest) {
  return getRequestOrigin(request.nextUrl.origin);
}

export async function GET(request: NextRequest) {
  const { supabase, applyCookies } = createSupabaseRouteClient(request);
  const requestUrl = new URL(request.url);
  const next = safeNextPath(requestUrl.searchParams.get("next"));

  if (!supabase) {
    return NextResponse.redirect(new URL(`/auth?error=${encodeURIComponent("Supabase env vars are missing.")}&next=${encodeURIComponent(next)}`, requestUrl.origin));
  }

  const callbackUrl = new URL("/auth/callback", getAppOrigin(request));
  callbackUrl.searchParams.set("next", next);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: callbackUrl.toString()
    }
  });

  if (error || !data.url) {
    return NextResponse.redirect(new URL(`/auth?error=${encodeURIComponent(error?.message ?? "Could not start Google sign in.")}&next=${encodeURIComponent(next)}`, requestUrl.origin));
  }

  return applyCookies(NextResponse.redirect(data.url));
}
