import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/route";

function safeNextPath(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = safeNextPath(requestUrl.searchParams.get("next"));
  const error = requestUrl.searchParams.get("error_description") ?? requestUrl.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(new URL(`/auth?error=${encodeURIComponent(error)}&next=${encodeURIComponent(next)}`, requestUrl.origin));
  }

  if (!code) {
    return NextResponse.redirect(new URL(`/auth?error=${encodeURIComponent("Google did not return a sign-in code.")}&next=${encodeURIComponent(next)}`, requestUrl.origin));
  }

  const { supabase, applyCookies } = createSupabaseRouteClient(request);

  if (!supabase) {
    return NextResponse.redirect(new URL(`/auth?error=${encodeURIComponent("Supabase env vars are missing.")}&next=${encodeURIComponent(next)}`, requestUrl.origin));
  }

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    console.warn("Google OAuth code exchange failed", exchangeError.message);
    return NextResponse.redirect(new URL(`/auth?error=${encodeURIComponent(exchangeError.message)}&next=${encodeURIComponent(next)}`, requestUrl.origin));
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (user) {
    const fullName = user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email?.split("@")[0] ?? "Hazi User";
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (existingProfile) {
      await supabase
        .from("profiles")
        .update({ email: user.email?.toLowerCase() ?? null, full_name: fullName })
        .eq("id", user.id);
    } else {
      await supabase.from("profiles").insert({
        id: user.id,
        email: user.email?.toLowerCase() ?? null,
        full_name: fullName,
        role: "buyer"
      });
    }
  }

  return applyCookies(NextResponse.redirect(new URL(next, requestUrl.origin)));
}
