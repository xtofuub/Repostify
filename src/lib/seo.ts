export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://repostify.app";

export const SITE_NAME = "Repostify";

export const SITE_TAGLINE = "See every TikTok repost on any public profile";

export const SITE_DESCRIPTION =
  "Free TikTok repost viewer and analyzer. See every video someone reposted on TikTok, sorted by recency, with play counts, likes, and top amplified creators. No login, no signup, no API key — paste any handle.";

// Primary keyword targets, in order of search volume:
// "tiktok repost viewer", "see tiktok reposts", "tiktok reposts list",
// "tiktok repost analyzer", "view someone's reposts on tiktok",
// "how to see reposts on tiktok", "tiktok analytics free",
// "tiktok profile analyzer", "tiktok repost tracker",
// "see what someone reposted tiktok"
export const SITE_KEYWORDS = [
  "tiktok repost viewer",
  "see tiktok reposts",
  "tiktok reposts list",
  "tiktok repost analyzer",
  "view tiktok reposts",
  "how to see reposts on tiktok",
  "see someones reposts on tiktok",
  "tiktok repost tracker",
  "tiktok profile analyzer",
  "free tiktok analytics",
  "tiktok repost checker",
  "what does someone repost on tiktok",
  "tiktok reposted videos",
  "view tiktok repost tab",
  "tiktok repost feed",
];

export function canonical(path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${clean === "/" ? "" : clean}`;
}

// Curated list of public TikTok profiles whose reposts tab is open. These
// drive both the homepage suggestions and per-handle SEO landing pages.
export const POPULAR_HANDLES = [
  // Mega creators
  "khaby.lame",
  "mrbeast",
  "charlidamelio",
  "zachking",
  "bellapoarch",
  "addisonre",
  "willsmith",
  "tiktok",
  "kimberly.loaiza",
  "dixiedamelio",
  "babyariel",
  "lorengray",
  "spencerx",
  "riyaz.14",
  "michael.le",
  "jamescharles",
  "kyliejenner",
  "selenagomez",
  "therock",
  "kingbachtok",
  // Sports / athletes
  "stephencurry30",
  "f1",
  "nba",
  "nfl",
  // Music
  "billieeilish",
  "doja.cat",
  "lilnasx",
  // Brands
  "duolingo",
  "ryanair",
  "netflix",
  "spotify",
  "redbull",
  // Comedy / creators
  "nikocadoavocado",
  "khaleesibum",
  "brittany_broski",
  "tinx",
  // Beauty / lifestyle
  "huda",
  "sephora",
  "mikaylanogueira",
];
