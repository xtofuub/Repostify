import { launch } from "cloakbrowser";
import type { Browser, BrowserContextOptions } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { randomInt } from "node:crypto";
import {
  getCachedAllScrapeRun,
  getCachedIdSet,
  getCachedProfile,
  getCachedReposts,
  getSeenTimestamps,
  getTrackingSince,
  putCachedAllScrapeRun,
  putProfile,
  saveRepostsOrdered,
} from "@/lib/cache";

export type Repost = {
  id: string;
  desc: string;
  createTime: number;
  // When the account reposted this video. 0 if TikTok did not expose it.
  repostedAt: number;
  // Observation timing, recorded by us — not reported by TikTok. firstSeenAt
  // is the first time this repost appeared in the account's feed during one of
  // our scrapes; lastSeenAt is the most recent. Epoch ms. Absent on a brand-new
  // scrape that never touched the cache. For an account tracked across multiple
  // scrapes, firstSeenAt on a *head-of-feed* item ≈ when it was reposted
  // (bounded by scrape cadence); deep-feed items with a late firstSeenAt are
  // backfill discovery, not new reposts — the UI gates on feed position.
  firstSeenAt?: number;
  lastSeenAt?: number;
  // Transient render-time index = this repost's position in the canonical feed
  // order (0 = newest reposted). Set client-side so it survives sorting and
  // filtering; never persisted.
  feedPosition?: number;
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
  // True when profile loaded fine AND a repost XHR fired AND zero items came
  // back. Signals TikTok soft-blocked the scrape (IP / fingerprint rate limit)
  // rather than the profile genuinely having no reposts. Distinguishes the
  // "private tab" UX from the "we got throttled, retry later" UX.
  rateLimited: boolean;
  // True when TikTok rendered its "Something went wrong" panel inside the
  // Reposts tab and our retry-click on the Refresh button didn't recover.
  // Different from rateLimited: this is a TikTok-side render error, often
  // transient per profile. Tell the user to retry rather than wait it out.
  tabError: boolean;
  // True when the scraper used a saved TikTok session (storageState from
  // .tiktok-session.json). False = anonymous scrape.
  loggedIn: boolean;
  fetchedAt: number;
  // Epoch ms of the earliest repost observation for this account = when we
  // started watching. Null/absent until at least one repost is cached. The UI
  // uses it to label observed repost timing and to set expectations ("tracking
  // since X — re-scan to sharpen timing").
  trackingSince?: number;
  // Total reposts recorded by the last completed "All" walk for this account,
  // if one exists. Lets a limited view (e.g. first 60) tell the user how many
  // reposts the account actually has and offer to load them all.
  knownTotal?: number;
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

    // Optional proxy. Set TIKTOK_PROXY to a full URL (http/https/socks5,
    // with creds if needed) when the local IP gets rate-limited by TikTok.
    // Examples: TIKTOK_PROXY=http://user:pass@proxy.example.com:8080
    //           TIKTOK_PROXY=socks5://user:pass@proxy.example.com:1080
    // `geoip: true` makes cloakbrowser auto-derive timezone/locale from the
    // proxy IP — keeps fingerprint coherent. Requires mmdb-lib (already a
    // transitive dep of cloakbrowser when geoip is used).
    const proxy = process.env.TIKTOK_PROXY?.trim() || undefined;

    const b = (await launch({
      headless: true,
      humanize: false,
      timezone: proxy ? undefined : "America/Los_Angeles",
      locale: proxy ? undefined : "en-US",
      ...(proxy ? { proxy, geoip: true } : {}),
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

// Dedupe concurrent background refreshes per (auth-mode, username).
const inFlightRefresh = new Map<string, Promise<void>>();
function refreshKey(username: string, loggedIn: boolean): string {
  return `${loggedIn ? "auth" : "anon"}:${username.toLowerCase()}`;
}
function scheduleBackgroundRefresh(
  username: string,
  loggedIn: boolean,
  opts: { deep?: boolean } = {},
): void {
  const key = `${refreshKey(username, loggedIn)}:${opts.deep ? "deep" : "top"}`;
  if (inFlightRefresh.has(key)) return;
  const p = (async () => {
    try {
      // bypassCache=true forces real scrape. Top-only refresh walks ~3 pages
      // to catch new reposts at the head of the feed; deep refresh re-walks
      // the whole feed so an "all" view stays complete + URLs stay live.
      await scrapeReposts(username, {
        bypassCache: true,
        maxScrolls: opts.deep ? 400 : 3,
        maxItems: opts.deep ? undefined : 90,
        // Deep refresh runs off the request path, so give it a much larger
        // time budget to keep extending the cache toward completeness.
        walkBudgetMs: opts.deep ? 240_000 : 30_000,
      });
    } catch {
      // Background failure stays silent; next user request retries.
    } finally {
      inFlightRefresh.delete(key);
    }
  })();
  inFlightRefresh.set(key, p);
}

function buildResultFromCache(
  username: string,
  reposts: Repost[],
  loggedIn: boolean,
  fetchedAt: number,
  hasMore = false,
): ScrapeResult {
  const profile = getCachedProfile(username)?.profile ?? null;
  return {
    username,
    profile,
    reposts,
    hasMore,
    captchaSuspected: false,
    audienceRestricted: false,
    rateLimited: false,
    tabError: false,
    loggedIn,
    fetchedAt,
    trackingSince: getTrackingSince(username) ?? undefined,
    knownTotal: getCachedAllScrapeRun(username)?.itemCount,
  };
}

export async function scrapeReposts(
  rawUsername: string,
  opts: {
    maxScrolls?: number;
    timeoutMs?: number;
    maxItems?: number;
    bypassCache?: boolean;
    walkBudgetMs?: number;
  } = {},
): Promise<ScrapeResult> {
  const username = rawUsername.replace(/^@/, "").trim();
  if (!username) throw new Error("Username required");
  if (!/^[A-Za-z0-9._]{1,30}$/.test(username)) {
    throw new Error("Invalid TikTok username");
  }

  const maxScrolls = opts.maxScrolls ?? 25;
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const maxItems = opts.maxItems ?? Infinity;
  const finiteMaxItems = Number.isFinite(maxItems) ? maxItems : null;
  // Wall-clock cap on the pagination walk. A page budget alone can't bound
  // latency (TikTok pages run ~2s each), so a deep "all" walk could exceed
  // the request timeout. When the budget is hit we stop with hasMore=true so
  // a later deep background refresh extends the cache further.
  const walkBudgetMs = opts.walkBudgetMs ?? 90_000;

  const storageState = loadStorageState();
  const loggedIn = storageState !== undefined;

  // Stale-while-revalidate (finite request): when the DB already holds enough
  // reposts to satisfy the limit, return instantly + refresh the head in the
  // background.
  if (!opts.bypassCache && finiteMaxItems !== null) {
    const cached = getCachedReposts(username, finiteMaxItems);
    if (cached.length >= finiteMaxItems) {
      const cachedProfileRow = getCachedProfile(username);
      scheduleBackgroundRefresh(username, loggedIn);
      return buildResultFromCache(
        username,
        cached,
        loggedIn,
        cachedProfileRow?.fetchedAt ?? Date.now(),
      );
    }
  }

  // SWR for "all": only safe to serve from cache once a full "all" walk has
  // been recorded (scrape_runs). Without that marker the cache may be a
  // partial head from finite requests, so we must walk TikTok. When a run
  // exists, serve everything instantly and deep-refresh in the background.
  if (!opts.bypassCache && finiteMaxItems === null) {
    const run = getCachedAllScrapeRun(username);
    if (run) {
      const cached = getCachedReposts(username);
      if (cached.length > 0) {
        scheduleBackgroundRefresh(username, loggedIn, { deep: true });
        return buildResultFromCache(
          username,
          cached,
          loggedIn,
          run.fetchedAt,
          run.hasMore,
        );
      }
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

  // Load persisted cache up-front. Incremental scrape stops walking pages
  // once we've seen N consecutive items already in a cache large enough for
  // the finite request. For "All" or backfills larger than cache, keep going.
  const cachedIds = getCachedIdSet(username);
  const hasCache = cachedIds.size > 0;
  const canStopAtKnownCache =
    finiteMaxItems !== null && cachedIds.size >= finiteMaxItems;
  const INCREMENTAL_STOP_THRESHOLD = 12;

  const reposts: Repost[] = [];
  const seen = new Set<string>();
  let hasMore = false;
  let repostXhrSeen = 0;
  let consecutiveKnown = 0;
  let incrementalDone = false;

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
        if (!norm) continue;
        if (canStopAtKnownCache) {
          if (cachedIds.has(norm.id)) {
            consecutiveKnown++;
          } else {
            consecutiveKnown = 0;
          }
        }
        if (!seen.has(norm.id)) {
          seen.add(norm.id);
          reposts.push(norm);
          added++;
        }
      }
    }
    if (typeof json.hasMore === "boolean") hasMore = json.hasMore;
    const c = json.maxCursor ?? json.cursor;
    if (c !== undefined && c !== null) nextCursor = c;
    if (canStopAtKnownCache && consecutiveKnown >= INCREMENTAL_STOP_THRESHOLD) {
      incrementalDone = true;
    }
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
  let tabError = false;
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

    // Profile-level "Something went wrong" render — TikTok shows this when
    // soft-blocking us (after rapid repeated requests, often with a session
    // it's flagged). No tabs render in this state. Try the in-page Refresh
    // button once to recover before later detection logic gives up.
    {
      const errorSeen = await page
        .evaluate(() =>
          /something went wrong/i.test(document.body?.innerText ?? ""),
        )
        .catch(() => false);
      if (errorSeen) {
        await page
          .evaluate(() => {
            const btn = Array.from(
              document.querySelectorAll<HTMLButtonElement>("button"),
            ).find(
              (b) =>
                /refresh/i.test(b.textContent ?? "") && b.offsetParent !== null,
            );
            btn?.click();
          })
          .catch(() => {});
        await page.waitForTimeout(2_500);
      }
    }

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

      // Detect tab-level "Something went wrong" panel + audience-controls
      // restriction. Audience controls = creator hid profile from logged-out
      // viewers. The error panel is often transient: TikTok renders it on
      // first tab click but the in-tab "Refresh" button usually succeeds.
      const tabState = await page
        .evaluate(() => {
          const body = document.body?.innerText ?? "";
          const audience = /audience controls/i.test(body);
          const el = document.querySelector('[data-e2e="user-post-empty-state"], [class*="DivErrorContainer"]');
          const error = !!(el && /something went wrong/i.test(el.textContent ?? ""));
          return { audience, error };
        })
        .catch(() => ({ audience: false, error: false }));
      if (tabState.audience) audienceRestricted = true;

      // Retry path: if the tab rendered TikTok's generic "Something went
      // wrong" panel AND no XHR has fired yet, look for the in-panel
      // "Refresh" button and click it. Usually clears on the second attempt.
      if (tabState.error && repostXhrSeen === 0 && !tabState.audience) {
        const refreshed = await page
          .evaluate(() => {
            const buttons = Array.from(
              document.querySelectorAll<HTMLButtonElement>("button"),
            );
            const btn = buttons.find(
              (b) => /refresh/i.test(b.textContent ?? "") && b.offsetParent !== null,
            );
            if (btn) {
              btn.click();
              return true;
            }
            return false;
          })
          .catch(() => false);
        if (refreshed) {
          await page
            .waitForResponse(
              (r) => /\/api\/repost\/item_list/i.test(r.url()),
              { timeout: 8_000 },
            )
            .catch(() => {});
        }
      }

      // Re-check tab state after the retry attempt — only bail if the panel
      // is still rendered AND no XHR ever fired.
      if ((tabState.error || tabState.audience) && repostXhrSeen === 0) {
        if (tabState.error && !tabState.audience) tabError = true;
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
      const walkDeadline = Date.now() + walkBudgetMs;
      for (let i = 0; i < maxScrolls; i++) {
        if (serverBlocked) {
          captchaSuspected = true;
          break;
        }
        if (incrementalDone) break;
        if (reposts.length >= maxItems) break;
        if (!hasMore) break;
        if (!firstXhrUrl) break;
        if (nextCursor === null || nextCursor === undefined) break;
        // Time budget hit: stop but leave hasMore as-is so a later deep
        // background refresh continues paginating from where we left off.
        if (Date.now() > walkDeadline) break;

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

    // Late check: if we never captured a repost XHR AND no items came back,
    // poll once more for the "Something went wrong" text. It often renders
    // after the page has settled, missing the early detector. We can't rely
    // on the DivErrorContainer class alone — TikTok uses the same class for
    // unrelated panels (notifications, etc.) — so test body text directly.
    if (!tabError && !audienceRestricted && repostXhrSeen === 0 && reposts.length === 0) {
      const lateError = await page
        .evaluate(() =>
          /something went wrong/i.test(document.body?.innerText ?? ""),
        )
        .catch(() => false);
      if (lateError) tabError = true;
    }

    if (DEBUG) {
      const html = await page.content().catch(() => "");
      const png = await page.screenshot({ fullPage: false }).catch(() => Buffer.alloc(0));
      await dumpDebug(`${username}-${Date.now()}`, html, png);
    }
  } finally {
    await context.close().catch(() => {});
  }

  // Merge fresh scrape with everything previously cached, fresh first. This
  // walk started at the top of TikTok's feed, so `reposts` is newest-first;
  // leftover cached items (older, or below this walk's window) follow in their
  // existing order. The merged list IS the authoritative display order.
  let merged: Repost[] = reposts;
  if (hasCache) {
    const cachedAll = getCachedReposts(username);
    const ids = new Set(reposts.map((r) => r.id));
    merged = [...reposts];
    for (const c of cachedAll) {
      if (!ids.has(c.id)) merged.push(c);
    }
  }

  // Persist the merged order so the DB's position column matches the feed.
  // Only write when the scrape wasn't blocked, else we'd flush good cache
  // with an empty/garbage result.
  if (!captchaSuspected && merged.length > 0) {
    try {
      saveRepostsOrdered(username, merged);
    } catch {
      // Cache write failure shouldn't break the response
    }
  }
  if (!captchaSuspected && profile) {
    try {
      putProfile(username, profile);
    } catch {}
  }

  // Preserve TikTok's native order — the repost feed returns newest-reposted
  // first. Sorting by createTime would bury fresh reposts of older videos.
  // Only re-sort when TikTok exposed an explicit repostedAt on every item.
  if (merged.length > 0 && merged.every((r) => r.repostedAt > 0)) {
    merged.sort((a, b) => b.repostedAt - a.repostedAt);
  }
  if (merged.length > maxItems) merged.length = maxItems;

  // Record completeness of an "all" walk so later "all" requests can serve
  // from cache. finiteMaxItems === null means this was an unbounded request.
  // We store hasMore too: if TikTok still had more pages when we hit the
  // page budget, a later deep refresh keeps extending the cache.
  if (!captchaSuspected && finiteMaxItems === null && merged.length > 0) {
    try {
      putCachedAllScrapeRun(username, merged.length, hasMore);
    } catch {}
  }

  // Fall back to cached profile if this scrape didn't get one (e.g. early
  // captcha) but cache holds a known-good copy.
  let outProfile = profile;
  if (!outProfile) {
    const cp = getCachedProfile(username);
    if (cp) outProfile = cp.profile;
  }

  // Rate-limit signature: profile loaded, an XHR did fire, but zero items
  // came back AND nothing claimed the tab was private or captcha-locked.
  // TikTok's quiet way of soft-blocking the request.
  const rateLimited =
    !captchaSuspected &&
    !audienceRestricted &&
    profile !== null &&
    repostXhrSeen > 0 &&
    reposts.length === 0;

  // Overlay observation timing onto the items we're about to return. We just
  // persisted `merged` via saveRepostsOrdered, so every id now has a row;
  // reading the timestamps back keeps the live response consistent with the
  // cache-served path (firstSeenAt preserved for known items, = now for new).
  let trackingSince: number | undefined;
  if (merged.length > 0) {
    try {
      const seenTs = getSeenTimestamps(username);
      for (const r of merged) {
        const ts = seenTs.get(r.id);
        if (ts) {
          r.firstSeenAt = ts.firstSeenAt;
          r.lastSeenAt = ts.lastSeenAt;
        }
      }
      trackingSince = getTrackingSince(username) ?? undefined;
    } catch {
      // Timing overlay is best-effort; never fail the scrape over it.
    }
  }

  const result: ScrapeResult = {
    username,
    profile: outProfile,
    reposts: merged,
    hasMore,
    captchaSuspected,
    audienceRestricted,
    rateLimited,
    tabError,
    loggedIn,
    fetchedAt: Date.now(),
    trackingSince,
    // Prefer this walk's own total when it was a *complete* unbounded ("All")
    // walk; otherwise fall back to the last recorded All run so a limited view
    // still knows the real count. A captcha-truncated walk is partial, so don't
    // pass its length off as the total.
    knownTotal:
      finiteMaxItems === null && merged.length > 0 && !captchaSuspected
        ? merged.length
        : getCachedAllScrapeRun(username)?.itemCount,
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

  return result;
}
