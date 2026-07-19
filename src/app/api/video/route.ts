import { NextRequest } from "next/server";
import { fetchTikTokMediaWithBrowser } from "@/lib/tiktok";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

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

type MediaCacheEntry = {
  body: Buffer;
  contentType: string;
  expiresAt: number;
};

declare global {
  var __repostifyMediaCache: Map<string, MediaCacheEntry> | undefined;
}

const mediaCache = (globalThis.__repostifyMediaCache ??= new Map());
const MEDIA_CACHE_MS = 5 * 60 * 1000;
const MAX_CACHED_FILE_BYTES = 64 * 1024 * 1024;
const MAX_CACHE_BYTES = 96 * 1024 * 1024;

function getCachedMedia(key: string): MediaCacheEntry | null {
  const entry = mediaCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    mediaCache.delete(key);
    return null;
  }
  return entry;
}

function cacheMedia(key: string, entry: Omit<MediaCacheEntry, "expiresAt">) {
  if (entry.body.length > MAX_CACHED_FILE_BYTES) return;
  const now = Date.now();
  for (const [cachedKey, cachedEntry] of mediaCache) {
    if (cachedEntry.expiresAt <= now) mediaCache.delete(cachedKey);
  }
  mediaCache.delete(key);
  let total = [...mediaCache.values()].reduce(
    (sum, item) => sum + item.body.length,
    0,
  );
  while (mediaCache.size && total + entry.body.length > MAX_CACHE_BYTES) {
    const oldestKey = mediaCache.keys().next().value as string | undefined;
    if (!oldestKey) break;
    total -= mediaCache.get(oldestKey)?.body.length ?? 0;
    mediaCache.delete(oldestKey);
  }
  mediaCache.set(key, { ...entry, expiresAt: Date.now() + MEDIA_CACHE_MS });
}

function parseRange(
  value: string | null,
  size: number,
): { start: number; end: number } | null | "invalid" {
  if (!value) return null;
  const match = /^bytes=(\d*)-(\d*)$/i.exec(value.trim());
  if (!match || (!match[1] && !match[2])) return "invalid";

  let start: number;
  let end: number;
  if (!match[1]) {
    const suffix = Number(match[2]);
    if (!Number.isFinite(suffix) || suffix <= 0) return "invalid";
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Number(match[2]) : size - 1;
  }
  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    end < start ||
    start >= size
  ) {
    return "invalid";
  }
  return { start, end: Math.min(end, size - 1) };
}

function bufferedMediaResponse(entry: MediaCacheEntry, rangeValue: string | null) {
  const range = parseRange(rangeValue, entry.body.length);
  if (range === "invalid") {
    return new Response(null, {
      status: 416,
      headers: { "Content-Range": `bytes */${entry.body.length}` },
    });
  }

  const start = range?.start ?? 0;
  const end = range?.end ?? entry.body.length - 1;
  const body = entry.body.subarray(start, end + 1);
  const headers = new Headers({
    "Content-Type": entry.contentType,
    "Content-Length": String(body.length),
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=300",
  });
  if (range) headers.set("Content-Range", `bytes ${start}-${end}/${entry.body.length}`);
  return new Response(new Uint8Array(body), {
    status: range ? 206 : 200,
    headers,
  });
}

export async function GET(req: NextRequest) {
  const target = req.nextUrl.searchParams.get("u");
  const postUrl = req.nextUrl.searchParams.get("o");
  if (!target) return new Response("missing u", { status: 400 });

  let url: URL;
  try {
    url = new URL(target);
  } catch {
    return new Response("invalid url", { status: 400 });
  }

  if (!isAllowed(url.hostname)) {
    return new Response(`host not allowed: ${url.hostname}`, { status: 403 });
  }

  const range = req.headers.get("range") ?? undefined;
  const cached = getCachedMedia(target);
  if (cached) return bufferedMediaResponse(cached, range ?? null);

  let upstreamFailure = "fetch failed";
  try {
    const upstream = await fetch(url.toString(), {
      signal: AbortSignal.timeout(8_000),
      headers: {
        Referer: "https://www.tiktok.com/",
        Origin: "https://www.tiktok.com",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
        Accept:
          "audio/mpeg,audio/mp4,audio/*;q=0.9,video/mp4,video/*;q=0.8,*/*;q=0.5",
        ...(range ? { Range: range } : {}),
      },
    });

    if (!upstream.ok && upstream.status !== 206) {
      upstreamFailure = `upstream ${upstream.status}`;
      await upstream.body?.cancel().catch(() => {});
    } else if (!upstream.body) {
      upstreamFailure = "empty body";
    } else {
      const headers = new Headers();
      headers.set(
        "Content-Type",
        upstream.headers.get("content-type") ?? "video/mp4",
      );
      const len = upstream.headers.get("content-length");
      if (len) headers.set("Content-Length", len);
      const cr = upstream.headers.get("content-range");
      if (cr) headers.set("Content-Range", cr);
      const ar = upstream.headers.get("accept-ranges");
      headers.set("Accept-Ranges", ar ?? "bytes");
      headers.set("Cache-Control", "private, max-age=300");

      return new Response(upstream.body, {
        status: upstream.status,
        headers,
      });
    }
  } catch (err) {
    upstreamFailure = err instanceof Error ? err.message : "fetch failed";
  }

  if (postUrl) {
    try {
      const media = await fetchTikTokMediaWithBrowser(target, postUrl);
      cacheMedia(target, media);
      return bufferedMediaResponse(
        { ...media, expiresAt: Date.now() + MEDIA_CACHE_MS },
        range ?? null,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "browser fallback failed";
      return new Response(`${upstreamFailure}; ${message}`, { status: 502 });
    }
  }

  return new Response(upstreamFailure, { status: 502 });
}
