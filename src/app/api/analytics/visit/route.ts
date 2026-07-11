import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { isAdminRole } from "@/lib/roles";
import { getAutomationServerSecret } from "@/lib/server-secret";
import { getSafeUser } from "@/lib/supabase/auth";
import { createSupabaseApiClient } from "@/lib/supabase/api";
import { createSupabaseRouteClient } from "@/lib/supabase/route";

type VisitPayload = {
  path?: unknown;
  referrer?: unknown;
  visitorKey?: unknown;
  deviceType?: unknown;
  viewport?: unknown;
};

const ALLOWED_DEVICE_TYPES = new Set(["mobile", "tablet", "desktop"]);

function asString(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

function hashValue(value: string | null) {
  if (!value) {
    return null;
  }

  const salt = process.env.ANALYTICS_HASH_SALT || process.env.SUPABASE_SERVICE_ROLE_KEY || "hazi-analytics";
  return createHash("sha256").update(`${salt}:${value}`).digest("hex");
}

function getClientIp(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || null;
  }

  return request.headers.get("x-real-ip");
}

export async function POST(request: NextRequest) {
  let payload: VisitPayload;

  try {
    payload = (await request.json()) as VisitPayload;
  } catch {
    return NextResponse.json({ error: "Invalid visit payload." }, { status: 400 });
  }

  const path = asString(payload.path, 500);

  if (!path || path.startsWith("/api") || path.startsWith("/_next")) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const apiSupabase = createSupabaseApiClient();

  if (!apiSupabase) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
  }

  const { supabase: routeSupabase } = createSupabaseRouteClient(request);
  const user = await getSafeUser(routeSupabase);

  if (user && routeSupabase) {
    const { data: profile } = await routeSupabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (isAdminRole(profile?.role)) {
      return NextResponse.json({ ok: true, skipped: true, reason: "admin_visit" });
    }
  }

  const requestedDeviceType = asString(payload.deviceType, 20);
  const deviceType = requestedDeviceType && ALLOWED_DEVICE_TYPES.has(requestedDeviceType)
    ? requestedDeviceType
    : "desktop";

  const { error } = await apiSupabase.rpc("record_site_visit_event", {
    p_server_secret: getAutomationServerSecret(),
    p_path: path,
    p_referrer: asString(payload.referrer, 500),
    p_user_id: user?.id ?? null,
    p_visitor_key: asString(payload.visitorKey, 100),
    p_ip_hash: hashValue(getClientIp(request)),
    p_user_agent: request.headers.get("user-agent")?.slice(0, 500) ?? null,
    p_device_type: deviceType,
    p_metadata: {
      viewport: payload.viewport && typeof payload.viewport === "object" && !Array.isArray(payload.viewport)
        ? payload.viewport
        : null
    }
  });

  if (error) {
    console.error(JSON.stringify({
      level: "error",
      message: "site_visit_insert_failed",
      error: error.message
    }));

    return NextResponse.json({ error: "Could not record visit." }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
