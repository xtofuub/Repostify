import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HOST_PATTERNS = [
  /(^|\.)tiktokcdn\.com$/i,
  /(^|\.)tiktokcdn-[a-z0-9-]+\.com$/i,
  /(^|\.)tiktok\.com$/i,
  /(^|\.)tiktokv\.com$/i,
  /(^|\.)tiktokv\.us$/i,
  /(^|\.)ibyteimg\.com$/i,
  /(^|\.)byteoversea\.com$/i,
  /(^|\.)muscdn\.com$/i,
  /(^|\.)bytecdn\.[a-z]+$/i,
];

function isAllowed(host: string): boolean {
  return HOST_PATTERNS.some((re) => re.test(host));
}

// Only fall back to oEmbed for genuine TikTok video URLs (SSRF guard).
const VIDEO_URL_RE =
  /^https:\/\/www\.tiktok\.com\/@[A-Za-z0-9._]+\/video\/\d+/;

const IMG_HEADERS: Record<string, string> = {
  Referer: "https://www.tiktok.com/",
  Origin: "https://www.tiktok.com",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
};

// In-memory byte cache keyed by a stable id (the video id). TikTok signs cover
// URLs with a short expiry, so a cached deep-feed cover 403s within hours. Once
// we successfully fetch an image we keep the bytes and serve them even after
// the source URL dies — and it spares TikTok the repeat hits that trigger the
// 403 storm in the first place. Bounded, LRU-ish (re-insert on read).
type Entry = { buf: ArrayBuffer; ct: string; exp: number };
const CACHE = new Map<string, Entry>();
const CACHE_MAX = 600;
const CACHE_TTL = 6 * 3_600_000;

function cacheGet(key: string): Entry | null {
  const e = CACHE.get(key);
  if (!e) return null;
  if (Date.now() > e.exp) {
    CACHE.delete(key);
    return null;
  }
  CACHE.delete(key);
  CACHE.set(key, e);
  return e;
}

function cacheSet(key: string, e: Entry): void {
  CACHE.set(key, e);
  if (CACHE.size > CACHE_MAX) {
    const oldest = CACHE.keys().next().value;
    if (oldest !== undefined) CACHE.delete(oldest);
  }
}

async function fetchImage(rawUrl: string): Promise<Entry | null> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (!isAllowed(url.hostname)) return null;
  try {
    const r = await fetch(url.toString(), { headers: IMG_HEADERS });
    if (!r.ok) return null;
    const buf = await r.arrayBuffer();
    return {
      buf,
      ct: r.headers.get("content-type") ?? "image/jpeg",
      exp: Date.now() + CACHE_TTL,
    };
  } catch {
    return null;
  }
}

// Resolve a fresh, currently-signed thumbnail for a video via TikTok's public
// oEmbed endpoint, then fetch it. Used when the cached cover URL has expired.
async function oembedThumb(videoUrl: string): Promise<Entry | null> {
  if (!VIDEO_URL_RE.test(videoUrl)) return null;
  try {
    const r = await fetch(
      "https://www.tiktok.com/oembed?url=" + encodeURIComponent(videoUrl),
      { headers: { "User-Agent": IMG_HEADERS["User-Agent"] } },
    );
    if (!r.ok) return null;
    const j = (await r.json()) as { thumbnail_url?: string };
    if (!j.thumbnail_url) return null;
    return fetchImage(j.thumbnail_url);
  } catch {
    return null;
  }
}

function imageResponse(e: Entry): Response {
  return new Response(e.buf, {
    headers: {
      "Content-Type": e.ct,
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const u = sp.get("u"); // primary image url (signed cover/avatar)
  const v = sp.get("v"); // stable cache key (video id) — optional
  const o = sp.get("o"); // oembed source (video web url) for fallback — optional

  if (!u && !o) return new Response("missing u", { status: 400 });

  if (v) {
    const hit = cacheGet(v);
    if (hit) return imageResponse(hit);
  }

  // Try the signed URL first; on expiry/failure fall back to a fresh oEmbed
  // thumbnail. Avatars (u only, no o) keep the old single-fetch behavior.
  let entry: Entry | null = null;
  if (u) entry = await fetchImage(u);
  if (!entry && o) entry = await oembedThumb(o);
  if (!entry) return new Response("unavailable", { status: 502 });

  if (v) cacheSet(v, entry);
  return imageResponse(entry);
}
