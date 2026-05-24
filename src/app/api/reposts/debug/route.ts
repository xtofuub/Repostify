import { NextRequest } from "next/server";
import { scrapeReposts } from "@/lib/tiktok";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Dev-only inspection endpoint. Scrapes one page of reposts with the live
// auth state, then returns the FIRST raw repost dictionary plus all top-level
// keys. Use to discover what field TikTok exposes for repost timestamps when
// logged in: keys like `repost_time`, `addedAt`, etc.
//
// GET /api/reposts/debug?username=xtofuub
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return Response.json({ error: "debug endpoint disabled in production" }, { status: 404 });
  }
  const username = req.nextUrl.searchParams.get("username");
  if (!username) {
    return Response.json({ error: "username query param required" }, { status: 400 });
  }
  try {
    const result = await scrapeReposts(username, {
      maxScrolls: 1,
      maxItems: 1,
      bypassCache: true,
    });
    const first = result.reposts[0] ?? null;
    return Response.json({
      loggedIn: result.loggedIn,
      audienceRestricted: result.audienceRestricted,
      captchaSuspected: result.captchaSuspected,
      hasReposts: result.reposts.length > 0,
      firstNormalized: first,
      // The raw item is not retained — set DEBUG_TIKTOK=1 to dump full XHR
      // JSON to .debug/xhr-*.json on the next request.
      note: "Re-run with env DEBUG_TIKTOK=1 to dump raw XHR responses to .debug/",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
