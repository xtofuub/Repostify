import { NextRequest } from "next/server";
import { scrapeReposts } from "@/lib/tiktok";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Deep "all" scrapes of large repost feeds can run several minutes (TikTok
// paginates ~25 items/page at ~2s/page). 300s is the Vercel Pro ceiling.
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams.get("username");
  if (!username) {
    return Response.json({ error: "username query param required" }, { status: 400 });
  }
  const limitRaw = req.nextUrl.searchParams.get("limit");
  const parsed = limitRaw ? parseInt(limitRaw, 10) : NaN;
  const limit = Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 5000) : undefined;
  const refresh = req.nextUrl.searchParams.get("refresh") === "1";
  const isAll = limit === undefined;
  try {
    const result = await scrapeReposts(username, {
      // Scale page budget to the request. "All" walks deep (TikTok pages are
      // ~25 items each); finite requests only need enough pages to cover the
      // limit plus a little slack for short pages.
      maxScrolls: isAll ? 400 : Math.min(120, Math.ceil(limit / 10) + 6),
      maxItems: limit,
      bypassCache: refresh,
    });
    return Response.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
