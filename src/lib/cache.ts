import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Repost, ScrapeResult } from "@/lib/tiktok";

// Store the full Repost JSON (including cover + playUrl). TikTok signs media
// URLs with `x-expires` (~6-24h). Stale URLs render as broken images, which
// is acceptable — RepostCard fades them out via onError and the player iframe
// doesn't depend on cached URLs. Each background refresh overwrites the JSON,
// so URLs stay live within a few minutes of any user activity.
type StoredRepost = Repost;

type ProfileRow = NonNullable<ScrapeResult["profile"]>;
type AllScrapeRun = {
  itemCount: number;
  hasMore: boolean;
  fetchedAt: number;
};

const CACHE_DIR = join(process.cwd(), ".cache");
const DB_PATH = join(CACHE_DIR, "repostify.db");

let db: Database.Database | null = null;

function open(): Database.Database {
  if (db) return db;
  mkdirSync(CACHE_DIR, { recursive: true });
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS profiles (
      username    TEXT PRIMARY KEY,
      json        TEXT NOT NULL,
      fetched_at  INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS reposts (
      owner          TEXT NOT NULL,
      repost_id      TEXT NOT NULL,
      position       INTEGER NOT NULL,
      json           TEXT NOT NULL,
      first_seen_at  INTEGER NOT NULL,
      last_seen_at   INTEGER NOT NULL,
      PRIMARY KEY (owner, repost_id)
    );
    CREATE INDEX IF NOT EXISTS idx_reposts_owner_pos
      ON reposts(owner, position);
    CREATE TABLE IF NOT EXISTS scrape_runs (
      owner       TEXT NOT NULL,
      mode        TEXT NOT NULL,
      item_count  INTEGER NOT NULL,
      has_more    INTEGER NOT NULL,
      fetched_at  INTEGER NOT NULL,
      PRIMARY KEY (owner, mode)
    );
  `);
  return db;
}

function rehydrate(row: StoredRepost): Repost {
  return row;
}

export function getCachedProfile(username: string): {
  profile: ProfileRow | null;
  fetchedAt: number;
} | null {
  const row = open()
    .prepare<[string], { json: string; fetched_at: number }>(
      "SELECT json, fetched_at FROM profiles WHERE username = ?",
    )
    .get(username.toLowerCase());
  if (!row) return null;
  try {
    return {
      profile: JSON.parse(row.json) as ProfileRow,
      fetchedAt: row.fetched_at,
    };
  } catch {
    return null;
  }
}

export function putProfile(username: string, profile: ProfileRow): void {
  open()
    .prepare(
      `INSERT INTO profiles(username, json, fetched_at) VALUES (?, ?, ?)
       ON CONFLICT(username) DO UPDATE SET json = excluded.json, fetched_at = excluded.fetched_at`,
    )
    .run(username.toLowerCase(), JSON.stringify(profile), Date.now());
}

export function getCachedReposts(username: string, limit?: number): Repost[] {
  const stmt = open().prepare<
    [string],
    { json: string }
  >(
    `SELECT json FROM reposts WHERE owner = ? ORDER BY position ASC${
      limit ? " LIMIT " + Math.max(1, Math.floor(limit)) : ""
    }`,
  );
  const rows = stmt.all(username.toLowerCase());
  const out: Repost[] = [];
  for (const r of rows) {
    try {
      out.push(rehydrate(JSON.parse(r.json) as StoredRepost));
    } catch {
      // skip malformed row
    }
  }
  return out;
}

export function getCachedIdSet(username: string): Set<string> {
  const rows = open()
    .prepare<[string], { repost_id: string }>(
      "SELECT repost_id FROM reposts WHERE owner = ?",
    )
    .all(username.toLowerCase());
  return new Set(rows.map((r) => r.repost_id));
}

// Records that a full "all" walk completed for this user, so later "all"
// requests can serve the cache instead of re-walking every TikTok page.
export function getCachedAllScrapeRun(username: string): AllScrapeRun | null {
  const row = open()
    .prepare<
      [string],
      { item_count: number; has_more: number; fetched_at: number }
    >(
      `SELECT item_count, has_more, fetched_at
       FROM scrape_runs WHERE owner = ? AND mode = 'all'`,
    )
    .get(username.toLowerCase());
  if (!row) return null;
  return {
    itemCount: row.item_count,
    hasMore: row.has_more === 1,
    fetchedAt: row.fetched_at,
  };
}

export function putCachedAllScrapeRun(
  username: string,
  itemCount: number,
  hasMore: boolean,
): void {
  open()
    .prepare(
      `INSERT INTO scrape_runs(owner, mode, item_count, has_more, fetched_at)
       VALUES (?, 'all', ?, ?, ?)
       ON CONFLICT(owner, mode) DO UPDATE SET
         item_count = excluded.item_count,
         has_more = excluded.has_more,
         fetched_at = excluded.fetched_at`,
    )
    .run(username.toLowerCase(), itemCount, hasMore ? 1 : 0, Date.now());
}

// Persist the authoritative newest-first ordering from a scrape. `ordered`
// must already be in TikTok feed order (index 0 = newest repost). Position is
// set to the array index so getCachedReposts returns the exact same order.
//
// This replaces the older "prepend new items with negative positions" scheme,
// which assigned position by *discovery* order — a deep backfill that reached
// older reposts on later pages would prepend them as if they were new, pushing
// genuinely-old reposts to the top. Ordering by the caller's merged list (the
// real feed order) fixes that.
//
// first_seen_at is preserved for existing rows; rows absent from `ordered`
// (e.g. un-reposted, or below an incremental refresh's window) are left in
// place but pushed below the ordered block so they never outrank fresh data.
export function saveRepostsOrdered(
  username: string,
  ordered: Repost[],
): { written: number } {
  if (ordered.length === 0) return { written: 0 };
  const owner = username.toLowerCase();
  const dbi = open();
  const now = Date.now();

  const seenFirst = dbi.prepare<[string, string], { first_seen_at: number }>(
    "SELECT first_seen_at FROM reposts WHERE owner = ? AND repost_id = ?",
  );
  const upsert = dbi.prepare(
    `INSERT INTO reposts(owner, repost_id, position, json, first_seen_at, last_seen_at)
     VALUES (@owner, @id, @pos, @json, @first, @now)
     ON CONFLICT(owner, repost_id) DO UPDATE SET
       position = excluded.position,
       json = excluded.json,
       last_seen_at = excluded.last_seen_at`,
  );
  // Any cached rows not in `ordered` get shoved below the ordered block,
  // keeping their relative order, so a partial refresh never reorders them
  // above fresh items.
  const pushBelow = dbi.prepare(
    `UPDATE reposts SET position = position + @offset
     WHERE owner = @owner AND position >= 0 AND repost_id NOT IN (${ordered
       .map(() => "?")
       .join(",")})`,
  );

  const ids = new Set(ordered.map((r) => r.id));

  const tx = dbi.transaction(() => {
    // First, lift any pre-existing non-negative positions out of the way.
    if (ids.size > 0) {
      pushBelow.run(
        { owner, offset: ordered.length },
        ...ordered.map((r) => r.id),
      );
    }
    for (let i = 0; i < ordered.length; i++) {
      const item = ordered[i];
      const prior = seenFirst.get(owner, item.id);
      upsert.run({
        owner,
        id: item.id,
        pos: i,
        json: JSON.stringify(item satisfies StoredRepost),
        first: prior?.first_seen_at ?? now,
        now,
      });
    }
  });
  tx();
  return { written: ordered.length };
}

export function clearCache(username?: string): void {
  const dbi = open();
  if (username) {
    dbi.prepare("DELETE FROM reposts WHERE owner = ?").run(username.toLowerCase());
    dbi.prepare("DELETE FROM profiles WHERE username = ?").run(username.toLowerCase());
    dbi.prepare("DELETE FROM scrape_runs WHERE owner = ?").run(username.toLowerCase());
  } else {
    dbi.exec("DELETE FROM reposts; DELETE FROM profiles; DELETE FROM scrape_runs;");
  }
}

export function cacheStats(): { accounts: number; reposts: number; bytes: number } {
  const dbi = open();
  const a = dbi.prepare<[], { c: number }>("SELECT COUNT(*) AS c FROM profiles").get();
  const r = dbi.prepare<[], { c: number }>("SELECT COUNT(*) AS c FROM reposts").get();
  const b = dbi
    .prepare<[], { b: number }>(
      "SELECT SUM(LENGTH(json)) AS b FROM reposts",
    )
    .get();
  return {
    accounts: a?.c ?? 0,
    reposts: r?.c ?? 0,
    bytes: b?.b ?? 0,
  };
}
