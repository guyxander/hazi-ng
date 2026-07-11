import { NextResponse } from "next/server";
import { suggestOpenRouterPrice } from "@/lib/openrouter-price-suggestion";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as {
    title?: string;
    description?: string;
    category?: string;
  } | null;

  const title = body?.title?.trim() ?? "";

  if (!title) {
    return NextResponse.json({ error: "Title is required." }, { status: 400 });
  }

  const suggestion = await suggestOpenRouterPrice({
    title,
    description: body?.description?.trim() ?? "",
    category: body?.category?.trim()
  });

  return NextResponse.json(suggestion);
}
