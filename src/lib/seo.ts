export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://repostify.app";

export const SITE_NAME = "Repostify";

export const SITE_TAGLINE = "Every TikTok repost, in one place.";

export const SITE_DESCRIPTION =
  "Repostify opens any public TikTok profile, walks the reposts tab, and lays every repost out as a playable grid with stats, top creators, and a recency-sorted reel. No login, no API key.";

export function canonical(path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${clean === "/" ? "" : clean}`;
}

export const POPULAR_HANDLES = [
  "khaby.lame",
  "mrbeast",
  "charlidamelio",
  "zachking",
  "bellapoarch",
  "addisonre",
  "willsmith",
  "tiktok",
];
