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
  const limitRaw = req.nextUrl.searchParams.get("limit");
  const parsed = limitRaw ? parseInt(limitRaw, 10) : NaN;
  const limit = Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 2000) : undefined;
  const refresh = req.nextUrl.searchParams.get("refresh") === "1";
  try {
    const result = await scrapeReposts(username, {
      maxScrolls: 60,
      maxItems: limit,
      bypassCache: refresh,
    });
    return Response.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
