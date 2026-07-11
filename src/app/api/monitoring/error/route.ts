import { NextResponse } from "next/server";
import { createSupabaseApiClient } from "@/lib/supabase/api";

type ErrorPayload = {
  source?: unknown;
  message?: unknown;
  digest?: unknown;
  path?: unknown;
  stack?: unknown;
  metadata?: unknown;
};

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

export async function POST(request: Request) {
  let payload: ErrorPayload;

  try {
    payload = (await request.json()) as ErrorPayload;
  } catch {
    return NextResponse.json({ error: "Invalid error payload." }, { status: 400 });
  }

  const supabase = createSupabaseApiClient();

  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
  }

  const metadata = payload.metadata && typeof payload.metadata === "object" && !Array.isArray(payload.metadata)
    ? payload.metadata
    : {};

  const { data, error } = await supabase.rpc("log_app_error_event", {
    p_source: asString(payload.source, "client"),
    p_message: asString(payload.message, "Unknown application error"),
    p_digest: asString(payload.digest) || null,
    p_path: asString(payload.path) || new URL(request.url).pathname,
    p_user_agent: request.headers.get("user-agent"),
    p_stack: asString(payload.stack) || null,
    p_metadata: metadata
  });

  if (error) {
    console.error(JSON.stringify({
      level: "error",
      message: "monitoring_error_insert_failed",
      error: error.message
    }));

    return NextResponse.json({ error: "Could not record error event." }, { status: 400 });
  }

  return NextResponse.json({ id: data });
}
