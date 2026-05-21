import { launch } from "cloakbrowser";
import type { Browser } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export type Repost = {
  id: string;
  desc: string;
  createTime: number;
  cover: string;
  playUrl: string;
  duration: number;
  author: {
    uniqueId: string;
    nickname: string;
    avatar: string;
    verified: boolean;
  };
  stats: {
    plays: number;
    likes: number;
    comments: number;
    shares: number;
  };
  webUrl: string;
};

export type ScrapeResult = {
  username: string;
  profile: {
    nickname: string;
    avatar: string;
    verified: boolean;
    bio: string;
    followers: number;
    following: number;
    likes: number;
  } | null;
  reposts: Repost[];
  hasMore: boolean;
  captchaSuspected: boolean;
  fetchedAt: number;
  debug?: {
    finalUrl: string;
    title: string;
    repostXhrSeen: number;
    repostTabFound: boolean;
    rehydratedItems: number;
  };
};

type TikTokItem = {
  id: string;
  desc?: string;
  createTime?: number;
  video?: {
    cover?: string;
    originCover?: string;
    dynamicCover?: string;
    playAddr?: string;
    duration?: number;
  };
  author?: {
    uniqueId?: string;
    nickname?: string;
    avatarLarger?: string;
    avatarMedium?: string;
    avatarThumb?: string;
    verified?: boolean;
  };
  stats?: {
    playCount?: number;
    diggCount?: number;
    commentCount?: number;
    shareCount?: number;
  };
  statsV2?: {
    playCount?: string;
    diggCount?: string;
    commentCount?: string;
    shareCount?: string;
  };
};

const DEBUG = process.env.DEBUG_TIKTOK === "1";

function toNum(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function normalizeItem(item: TikTokItem): Repost | null {
  if (!item?.id || !item.author?.uniqueId) return null;
  const stats = item.stats ?? {};
  const statsV2 = item.statsV2 ?? {};
  return {
    id: item.id,
    desc: item.desc ?? "",
    createTime: item.createTime ?? 0,
    cover:
      item.video?.dynamicCover ||
      item.video?.cover ||
      item.video?.originCover ||
      "",
    playUrl: item.video?.playAddr ?? "",
    duration: item.video?.duration ?? 0,
    author: {
      uniqueId: item.author.uniqueId,
      nickname: item.author.nickname ?? item.author.uniqueId,
      avatar:
        item.author.avatarLarger ||
        item.author.avatarMedium ||
        item.author.avatarThumb ||
        "",
      verified: Boolean(item.author.verified),
    },
    stats: {
      plays: toNum(statsV2.playCount ?? stats.playCount),
      likes: toNum(statsV2.diggCount ?? stats.diggCount),
      comments: toNum(statsV2.commentCount ?? stats.commentCount),
      shares: toNum(statsV2.shareCount ?? stats.shareCount),
    },
    webUrl: `https://www.tiktok.com/@${item.author.uniqueId}/video/${item.id}`,
  };
}

let cachedBrowser: Browser | null = null;
let launching: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (cachedBrowser && cachedBrowser.isConnected()) return cachedBrowser;
  if (launching) return launching;
  launching = (async () => {
    // cloakbrowser: source-level stealth Chromium. C++ binary patches handle
    // canvas/WebGL/audio/fonts/GPU/screen/WebRTC/CDP fingerprints — undetectable
    // because it's a real browser, not a JS-injected wrapper. humanize=false:
    // wrapping page.mouse.wheel inflates per-scroll latency to ~1s.
    const b = (await launch({
      headless: true,
      humanize: false,
      timezone: "America/Los_Angeles",
      locale: "en-US",
      launchOptions: { args: ["--no-sandbox"] },
    })) as unknown as Browser;
    cachedBrowser = b;
    return b;
  })();
  try {
    return await launching;
  } finally {
    launching = null;
  }
}

// Pre-warm: fire browser launch when this module loads so first request
// doesn't pay ~2-4s cold-start cost.
getBrowser().catch(() => {});

async function dumpDebug(name: string, html: string, png: Buffer) {
  if (!DEBUG) return;
  const dir = join(process.cwd(), ".debug");
  await mkdir(dir, { recursive: true }).catch(() => {});
  await writeFile(join(dir, `${name}.html`), html).catch(() => {});
  await writeFile(join(dir, `${name}.png`), png).catch(() => {});
}

type CacheEntry = { at: number; result: ScrapeResult };
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 min

export async function scrapeReposts(
  rawUsername: string,
  opts: { maxScrolls?: number; timeoutMs?: number; maxItems?: number; bypassCache?: boolean } = {},
): Promise<ScrapeResult> {
  const username = rawUsername.replace(/^@/, "").trim();
  if (!username) throw new Error("Username required");
  if (!/^[A-Za-z0-9._]{1,30}$/.test(username)) {
    throw new Error("Invalid TikTok username");
  }

  const maxScrolls = opts.maxScrolls ?? 25;
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const maxItems = opts.maxItems ?? Infinity;

  const cacheKey = `${username.toLowerCase()}:${Number.isFinite(maxItems) ? maxItems : "all"}`;
  if (!opts.bypassCache) {
    const hit = cache.get(cacheKey);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
      return hit.result;
    }
  }

  const browser = await getBrowser();
  const context = await browser.newContext({
    viewport: { width: 1366, height: 900 },
    deviceScaleFactor: 1,
    extraHTTPHeaders: { "Accept-Language": "en-US,en;q=0.9" },
  });
  const page = await context.newPage();

  const reposts: Repost[] = [];
  const seen = new Set<string>();
  let hasMore = false;
  let repostXhrSeen = 0;

  let serverBlocked = false;
  page.on("response", async (res) => {
    const url = res.url();
    if (!/\/api\/repost\/item_list/i.test(url)) return;
    repostXhrSeen++;
    // Soft-block: TikTok returns non-2xx (often 403/418/451) for sessions it
    // distrusts. Bail out — no point spinning.
    if (res.status() >= 400) {
      serverBlocked = true;
      return;
    }
    try {
      const json = (await res.json()) as {
        itemList?: TikTokItem[];
        hasMore?: boolean;
        statusCode?: number;
      };
      // statusCode != 0 in body also signals server-side rejection
      if (json.statusCode && json.statusCode !== 0) {
        serverBlocked = true;
      }
      if (Array.isArray(json.itemList)) {
        for (const raw of json.itemList) {
          const norm = normalizeItem(raw);
          if (norm && !seen.has(norm.id)) {
            seen.add(norm.id);
            reposts.push(norm);
          }
        }
      }
      if (typeof json.hasMore === "boolean") hasMore = json.hasMore;
    } catch {}
  });

  let profile: ScrapeResult["profile"] = null;
  let finalUrl = "";
  let title = "";
  let captchaSuspected = false;
  let repostTabFound = false;
  let rehydratedItems = 0;

  try {
    await page.goto(`https://www.tiktok.com/@${username}`, {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs,
    });

    finalUrl = page.url();
    title = await page.title().catch(() => "");
    captchaSuspected =
      /captcha|verify|security/i.test(title) ||
      /captcha|tiktok-verify/i.test(finalUrl);

    await page
      .waitForSelector(
        'script#__UNIVERSAL_DATA_FOR_REHYDRATION__, [data-e2e="user-title"], [data-e2e="user-page"]',
        { timeout: 8_000 },
      )
      .catch(() => {});

    // Dismiss cookie banner if present — it blocks pointer events on the
    // viewport which prevents TikTok's lazy-loader from observing scroll.
    await page
      .evaluate(() => {
        const banner = document.querySelector('tiktok-cookie-banner');
        if (banner?.shadowRoot) {
          const allow = banner.shadowRoot.querySelector<HTMLButtonElement>(
            'button.button-wrapper.tiktok-cookie-banner button, button[class*="DeclineOptional"], button',
          );
          // Click "Decline optional" if visible — avoids accepting tracking
          const buttons = banner.shadowRoot.querySelectorAll<HTMLButtonElement>(
            "button",
          );
          for (const b of buttons) {
            if (/decline/i.test(b.textContent ?? "")) {
              b.click();
              return;
            }
          }
          // Fallback to any button
          allow?.click();
        }
      })
      .catch(() => {});
    await page.mouse.move(683, 400).catch(() => {});
    await page.evaluate(() => window.scrollBy(0, 100)).catch(() => {});
    await page
      .waitForFunction(
        () => document.querySelectorAll('[role="tab"]').length >= 2,
        { timeout: 3_500 },
      )
      .catch(() => {});

    const rehydrated = await page
      .evaluate(() => {
        const el = document.querySelector(
          'script#__UNIVERSAL_DATA_FOR_REHYDRATION__',
        );
        if (!el || !el.textContent) return null;
        try {
          return JSON.parse(el.textContent);
        } catch {
          return null;
        }
      })
      .catch(() => null);

    if (rehydrated && typeof rehydrated === "object") {
      const scopes = (rehydrated as { __DEFAULT_SCOPE__?: Record<string, unknown> }).__DEFAULT_SCOPE__ ?? {};
      const userDetail = (scopes["webapp.user-detail"] ?? {}) as {
        userInfo?: {
          user?: {
            uniqueId?: string;
            nickname?: string;
            avatarLarger?: string;
            avatarMedium?: string;
            avatarThumb?: string;
            verified?: boolean;
            signature?: string;
          };
          stats?: {
            followerCount?: number;
            followingCount?: number;
            heartCount?: number;
            heart?: number;
          };
        };
      };
      const u = userDetail.userInfo?.user;
      const s = userDetail.userInfo?.stats;
      if (u) {
        profile = {
          nickname: u.nickname ?? u.uniqueId ?? "",
          avatar: u.avatarLarger ?? u.avatarMedium ?? u.avatarThumb ?? "",
          verified: Boolean(u.verified),
          bio: u.signature ?? "",
          followers: toNum(s?.followerCount),
          following: toNum(s?.followingCount),
          likes: toNum(s?.heartCount ?? s?.heart),
        };
      }

      const repostList = (scopes["webapp.repost-list"] ?? {}) as {
        itemList?: TikTokItem[];
      };
      if (Array.isArray(repostList.itemList)) {
        rehydratedItems = repostList.itemList.length;
        for (const raw of repostList.itemList) {
          const norm = normalizeItem(raw);
          if (norm && !seen.has(norm.id)) {
            seen.add(norm.id);
            reposts.push(norm);
          }
        }
      }
    }

    if (!profile) {
      profile = await page
        .evaluate(() => {
          const txt = (sel: string) =>
            document.querySelector(sel)?.textContent?.trim() ?? "";
          const num = (sel: string) => {
            const t = txt(sel);
            if (!t) return 0;
            const m = t.match(/([\d.]+)\s*([KMB]?)/i);
            if (!m) return 0;
            const base = parseFloat(m[1]);
            const mult =
              m[2]?.toUpperCase() === "K"
                ? 1e3
                : m[2]?.toUpperCase() === "M"
                  ? 1e6
                  : m[2]?.toUpperCase() === "B"
                    ? 1e9
                    : 1;
            return Math.round(base * mult);
          };
          const img = document.querySelector<HTMLImageElement>(
            '[data-e2e="user-avatar"] img',
          );
          const nickname = txt('[data-e2e="user-title"]') || txt("h1");
          if (!nickname) return null;
          return {
            nickname,
            avatar: img?.src ?? "",
            verified: Boolean(
              document.querySelector('[data-e2e="user-verified"]'),
            ),
            bio: txt('[data-e2e="user-bio"]'),
            followers: num('[data-e2e="followers-count"]'),
            following: num('[data-e2e="following-count"]'),
            likes: num('[data-e2e="likes-count"]'),
          };
        })
        .catch(() => null);
    }

    const tabHandle = await page
      .evaluateHandle(() => {
        const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
        return (
          tabs.find((el) =>
            /reposts?/i.test(el.textContent ?? ""),
          ) ?? null
        );
      })
      .catch(() => null);

    let clickedTab = false;
    const tabEl = tabHandle ? tabHandle.asElement() : null;
    if (tabEl) {
      repostTabFound = true;
      await tabEl.scrollIntoViewIfNeeded({ timeout: 3_000 }).catch(() => {});
      await tabEl.click({ timeout: 5_000 }).catch(() => {});
      clickedTab = true;
    } else {
      // Fallback selectors
      for (const sel of [
        '[data-e2e="reposts-tab"]',
        '[data-e2e="user-post-item-list-repost"]',
      ]) {
        const loc = page.locator(sel).first();
        if (await loc.isVisible().catch(() => false)) {
          repostTabFound = true;
          await loc.click({ timeout: 5_000 }).catch(() => {});
          clickedTab = true;
          break;
        }
      }
    }

    if (clickedTab) {
      await page
        .waitForResponse(
          (r) => /\/api\/repost\/item_list/i.test(r.url()),
          { timeout: 6_000 },
        )
        .catch(() => {});
      if (serverBlocked) {
        captchaSuspected = true;
      }

      // Detect tab-level "Something went wrong" panel that TikTok renders
      // when reposts are private or restricted. Skip the scroll loop entirely.
      const tabError = await page
        .evaluate(() => {
          const el = document.querySelector('[data-e2e="user-post-empty-state"], [class*="DivErrorContainer"]');
          if (el && /something went wrong/i.test(el.textContent ?? "")) return true;
          return false;
        })
        .catch(() => false);
      if (tabError && repostXhrSeen === 0) {
        // No XHR + error UI = private/blocked tab. No point scrolling.
        clickedTab = false;
      }

      let stagnant = 0;
      for (let i = 0; i < maxScrolls; i++) {
        if (serverBlocked) {
          captchaSuspected = true;
          break;
        }
        if (reposts.length >= maxItems) break;
        // If no XHR fired after first scroll attempt, the tab is empty/
        // broken — don't spin.
        if (i >= 1 && repostXhrSeen === 0) {
          break;
        }
        const captchaNow = await page
          .evaluate(() => {
            return Boolean(
              document.querySelector(
                '#captcha-verify-container, .captcha_verify_container, [class*="captcha-verify"]',
              ),
            );
          })
          .catch(() => false);
        if (captchaNow) {
          captchaSuspected = true;
          break;
        }

        const before = reposts.length;
        // Wheel kicks (4 small steps) + scrollIntoView. Empirically TikTok
        // needs multiple scroll events spread over ~600ms; one big jump makes
        // its server cut off pagination early.
        for (let step = 0; step < 4; step++) {
          await page.mouse.wheel(0, 600).catch(() => {});
          await page.waitForTimeout(120);
        }
        await page
          .evaluate(() => {
            const items = document.querySelectorAll<HTMLElement>(
              'div[data-e2e="user-post-item"]',
            );
            const last = items[items.length - 1];
            if (last) last.scrollIntoView({ block: "end" });
          })
          .catch(() => {});

        await page
          .waitForResponse(
            (r) => /\/api\/repost\/item_list/i.test(r.url()),
            { timeout: 5_000 },
          )
          .catch(() => null);
        // 250ms is enough for the response handler (registered above) to
        // drain itemList into reposts[] before we measure progress.
        await page.waitForTimeout(250);

        if (reposts.length === before) {
          stagnant++;
          if (stagnant >= 4) break;
        } else {
          stagnant = 0;
        }
        if (!hasMore) break;
      }
    }

    if (DEBUG) {
      const html = await page.content().catch(() => "");
      const png = await page.screenshot({ fullPage: false }).catch(() => Buffer.alloc(0));
      await dumpDebug(`${username}-${Date.now()}`, html, png);
    }
  } finally {
    await context.close().catch(() => {});
  }

  reposts.sort((a, b) => b.createTime - a.createTime);
  if (reposts.length > maxItems) reposts.length = maxItems;

  const result: ScrapeResult = {
    username,
    profile,
    reposts,
    hasMore,
    captchaSuspected,
    fetchedAt: Date.now(),
  };

  if (DEBUG) {
    result.debug = {
      finalUrl,
      title,
      repostXhrSeen,
      repostTabFound,
      rehydratedItems,
    };
  }

  // Cache only non-blocked results to avoid sticky failure state.
  if (!captchaSuspected && reposts.length > 0) {
    cache.set(cacheKey, { at: Date.now(), result });
  }

  return result;
}
