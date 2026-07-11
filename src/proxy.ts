import { NextResponse, type NextRequest } from "next/server";

const CANONICAL_HOST = "hazi.ng";
const REDIRECT_HOSTS = new Set(["hazi-ng.vercel.app"]);

export function proxy(request: NextRequest) {
  const host = request.headers.get("host")?.toLowerCase();

  if (host && REDIRECT_HOSTS.has(host)) {
    const url = request.nextUrl.clone();
    url.protocol = "https:";
    url.host = CANONICAL_HOST;

    return NextResponse.redirect(url, 308);
  }

  if (request.nextUrl.pathname === "/" && (request.nextUrl.searchParams.has("code") || request.nextUrl.searchParams.has("error"))) {
    const url = request.nextUrl.clone();
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error_description") ?? url.searchParams.get("error");
    const next = url.searchParams.get("next") ?? "/dashboard";

    url.pathname = code ? "/auth/callback" : "/auth";
    url.search = "";
    if (code) {
      url.searchParams.set("code", code);
    }
    if (error) {
      url.searchParams.set("error", error);
    }
    url.searchParams.set("next", next);

    return NextResponse.redirect(url, 307);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|favicon.png|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico)$).*)"]
};
