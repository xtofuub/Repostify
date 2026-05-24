import { launch } from "cloakbrowser";
import type { Browser, BrowserContextOptions } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { randomInt } from "node:crypto";

export type Repost = {
  id: string;
  desc: string;
  createTime: number;
  // When the account reposted this video. 0 if TikTok did not expose it.
  repostedAt: number;
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
  // Set when TikTok shows the "creator turned on audience controls" panel.
  // Means the profile is restricted to logged-in viewers (often
  // followers-only). Anonymous scrape cannot bypass it.
  audienceRestricted: boolean;
  // True when the scraper used a saved TikTok session (storageState from
  // .tiktok-session.json). False = anonymous scrape.
  loggedIn: boolean;
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
  // Speculative — TikTok's anonymous XHR sometimes includes one of these.
  // Field names vary across endpoints. We sniff and fall back to createTime
  // if none surface. None of these are documented; treat as best-effort.
  repost_time?: number;
  reposted_at?: number;
  addedAt?: number;
  repostTime?: number;
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

  // Verified 2026-05-24 against logged-in /api/repost/item_list: the endpoint
  // does NOT expose a per-item repost timestamp. Only `createTime` (video
  // upload time) is present. Order comes from the server (newest-reposted
  // first) and `cursor` is a sequential index, not a timestamp. We keep the
  // candidate scan in case TikTok adds the field later or another endpoint
  // surfaces it.
  const MIN_TS = 1_262_300_400; // 2010-01-01
  const MAX_TS = Math.floor(Date.now() / 1000) + 86_400; // tomorrow
  const isTs = (v: unknown): v is number =>
    typeof v === "number" && v > MIN_TS && v < MAX_TS;

  let repostedAt = 0;
  const fixed: Array<number | undefined> = [
    item.repost_time,
    item.reposted_at,
    item.addedAt,
    item.repostTime,
  ];
  for (const c of fixed) {
    if (isTs(c)) {
      repostedAt = c;
      break;
    }
  }
  if (!repostedAt) {
    for (const [k, v] of Object.entries(item as Record<string, unknown>)) {
      if (k === "createTime") continue;
      if (!/repost|added|saved|share_time|recommend_time|bookmark/i.test(k)) continue;
      if (isTs(v)) {
        repostedAt = v;
        break;
      }
    }
  }

  return {
    id: item.id,
    desc: item.desc ?? "",
    createTime: item.createTime ?? 0,
    repostedAt,
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
    // Random fingerprint per process boot — defeats fingerprint-based
    // identification by sites that have flagged a prior session.
    const fpSeed = randomInt(1, 2_147_483_647);
    const b = (await launch({
      headless: true,
      humanize: false,
      timezone: "America/Los_Angeles",
      locale: "en-US",
      args: [`--fingerprint=${fpSeed}`],
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

const SESSION_PATH = join(process.cwd(), ".tiktok-session.json");
type StorageState = NonNullable<BrowserContextOptions["storageState"]>;

// Re-read session file when its mtime changes so re-login via
// `npm run tiktok:login` takes effect without a server restart.
let cachedStorage: { state: StorageState; mtimeMs: number } | null = null;
function loadStorageState(): StorageState | undefined {
  if (!existsSync(SESSION_PATH)) {
    cachedStorage = null;
    return undefined;
  }
  try {
    const { mtimeMs } = statSync(SESSION_PATH);
    if (cachedStorage && cachedStorage.mtimeMs === mtimeMs) {
      return cachedStorage.state;
    }
    const state = JSON.parse(readFileSync(SESSION_PATH, "utf8")) as StorageState;
    cachedStorage = { state, mtimeMs };
    return state;
  } catch {
    return undefined;
  }
}

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

  // Probe storageState first — cache must partition on auth state, otherwise
  // an anonymous result poisons the cache for a later logged-in request.
  const storageState = loadStorageState();
  const loggedIn = storageState !== undefined;

  const cacheKey = `${loggedIn ? "auth" : "anon"}:${username.toLowerCase()}:${Number.isFinite(maxItems) ? maxItems : "all"}`;
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
    ...(storageState ? { storageState } : {}),
  });
  const page = await context.newPage();

  const reposts: Repost[] = [];
  const seen = new Set<string>();
  let hasMore = false;
  let repostXhrSeen = 0;

  let serverBlocked = false;
  // Capture first XHR URL — we use it as a template for direct cursor-based
  // pagination via page.evaluate(fetch), which bypasses scroll wait entirely.
  let firstXhrUrl: string | null = null;
  let nextCursor: string | number | null = null;

  function ingest(json: {
    itemList?: TikTokItem[];
    hasMore?: boolean;
    statusCode?: number;
    cursor?: string | number;
    maxCursor?: string | number;
  }): { newCount: number } {
    if (json.statusCode && json.statusCode !== 0) {
      serverBlocked = true;
    }
    let added = 0;
    if (Array.isArray(json.itemList)) {
      for (const raw of json.itemList) {
        const norm = normalizeItem(raw);
        if (norm && !seen.has(norm.id)) {
          seen.add(norm.id);
          reposts.push(norm);
          added++;
        }
      }
    }
    if (typeof json.hasMore === "boolean") hasMore = json.hasMore;
    const c = json.maxCursor ?? json.cursor;
    if (c !== undefined && c !== null) nextCursor = c;
    return { newCount: added };
  }

  page.on("response", async (res) => {
    const url = res.url();
    if (!/\/api\/repost\/item_list/i.test(url)) return;
    repostXhrSeen++;
    if (!firstXhrUrl) firstXhrUrl = url;
    if (res.status() >= 400) {
      serverBlocked = true;
      return;
    }
    try {
      const json = await res.json();
      // Dump first XHR response when DEBUG is on so we can inspect what
      // timestamp fields TikTok actually exposes per item.
      if (DEBUG && repostXhrSeen === 1) {
        const dir = join(process.cwd(), ".debug");
        await mkdir(dir, { recursive: true }).catch(() => {});
        await writeFile(
          join(dir, `xhr-${username}-${Date.now()}.json`),
          JSON.stringify(json, null, 2),
        ).catch(() => {});
      }
      ingest(json);
    } catch {}
  });

  let profile: ScrapeResult["profile"] = null;
  let finalUrl = "";
  let title = "";
  let captchaSuspected = false;
  let audienceRestricted = false;
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

    // Early check: TikTok sometimes renders the audience-controls panel on
    // initial profile load, hiding the reposts tab entirely.
    audienceRestricted = await page
      .evaluate(() => /audience controls/i.test(document.body?.innerText ?? ""))
      .catch(() => false);

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
      const tabState = await page
        .evaluate(() => {
          const body = document.body?.innerText ?? "";
          // "Audience controls" = creator restricted profile to logged-in
          // (often followers-only) viewers. Anonymous scrape cannot see it.
          const audience = /audience controls/i.test(body);
          const el = document.querySelector('[data-e2e="user-post-empty-state"], [class*="DivErrorContainer"]');
          const error = !!(el && /something went wrong/i.test(el.textContent ?? ""));
          return { audience, error };
        })
        .catch(() => ({ audience: false, error: false }));
      if (tabState.audience) audienceRestricted = true;
      if ((tabState.error || tabState.audience) && repostXhrSeen === 0) {
        // No XHR + restriction UI = private/blocked tab. No point scrolling.
        clickedTab = false;
      }

      // Wait for the first XHR captured by response handler (which also
      // records firstXhrUrl). We don't scroll — the tab click is enough to
      // trigger the first server call. If we didn't capture, bail.
      if (!firstXhrUrl) {
        // Give the response handler a brief grace window.
        for (let i = 0; i < 8; i++) {
          if (firstXhrUrl) break;
          await page.waitForTimeout(250);
        }
      }

      // Direct cursor pagination: avoids scroll, IntersectionObserver,
      // mouse-wheel pacing. Each iteration is one HTTP roundtrip to TikTok.
      // The first XHR's URL already carries msToken / X-Bogus / _signature
      // computed by TikTok's webmssdk; we just swap the cursor param. The
      // page's fetch interceptor refreshes signatures naturally.
      let stagnant = 0;
      for (let i = 0; i < maxScrolls; i++) {
        if (serverBlocked) {
          captchaSuspected = true;
          break;
        }
        if (reposts.length >= maxItems) break;
        if (!hasMore) break;
        if (!firstXhrUrl) break;
        if (nextCursor === null || nextCursor === undefined) break;

        // Build next URL with updated cursor. Keep msToken stale-but-valid
        // (TikTok generally accepts within session lifetime).
        let nextUrl: string;
        try {
          const u = new URL(firstXhrUrl);
          u.searchParams.set("cursor", String(nextCursor));
          // Some TikTok endpoints use maxCursor; set both to be safe.
          if (u.searchParams.has("maxCursor")) {
            u.searchParams.set("maxCursor", String(nextCursor));
          }
          nextUrl = u.toString();
        } catch {
          break;
        }

        const before = reposts.length;
        // Fire fetch from inside page context so TikTok's fetch interceptor
        // (signing layer) augments the request automatically.
        const result = await page
          .evaluate(async (url: string) => {
            try {
              const r = await fetch(url, { credentials: "include" });
              const body = await r.json();
              return { status: r.status, body } as const;
            } catch (e) {
              return {
                status: -1,
                body: null,
                err: (e as Error)?.message ?? "fetch error",
              } as const;
            }
          }, nextUrl)
          .catch(() => null);

        if (!result) break;
        repostXhrSeen++;
        if (result.status >= 400) {
          serverBlocked = true;
          captchaSuspected = true;
          break;
        }
        if (result.body && typeof result.body === "object") {
          ingest(result.body as Parameters<typeof ingest>[0]);
        }

        if (reposts.length === before) {
          stagnant++;
          if (stagnant >= 2) break;
        } else {
          stagnant = 0;
        }
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

  // Preserve TikTok's native order — the repost feed returns newest-reposted
  // first. Sorting by createTime would bury fresh reposts of older videos.
  // Only re-sort when TikTok exposed an explicit repostedAt on every item.
  if (reposts.length > 0 && reposts.every((r) => r.repostedAt > 0)) {
    reposts.sort((a, b) => b.repostedAt - a.repostedAt);
  }
  if (reposts.length > maxItems) reposts.length = maxItems;

  const result: ScrapeResult = {
    username,
    profile,
    reposts,
    hasMore,
    captchaSuspected,
    audienceRestricted,
    loggedIn,
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
