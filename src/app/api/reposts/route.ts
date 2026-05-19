import { NextRequest } from "next/server";
import { scrapeReposts } from "@/lib/tiktok";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams.get("username");
  if (!username) {
    return Response.json({ error: "username query param required" }, { status: 400 });
  }
  try {
    const result = await scrapeReposts(username, { maxScrolls: 4 });
    return Response.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
