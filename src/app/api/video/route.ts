import { NextRequest } from "next/server";

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

export async function GET(req: NextRequest) {
  const target = req.nextUrl.searchParams.get("u");
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

  try {
    const upstream = await fetch(url.toString(), {
      headers: {
        Referer: "https://www.tiktok.com/",
        Origin: "https://www.tiktok.com",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
        Accept: "video/mp4,video/*;q=0.9,*/*;q=0.8",
        ...(range ? { Range: range } : {}),
      },
    });

    if (!upstream.ok && upstream.status !== 206) {
      return new Response(`upstream ${upstream.status}`, { status: 502 });
    }
    if (!upstream.body) {
      return new Response("empty body", { status: 502 });
    }

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
  } catch (err) {
    const msg = err instanceof Error ? err.message : "fetch failed";
    return new Response(msg, { status: 502 });
  }
}
