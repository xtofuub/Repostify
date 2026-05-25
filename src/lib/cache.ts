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

// Merge fresh items into cache. New items get prepended (negative positions
// preserve insertion order without renumbering existing rows). Existing items
// have last_seen_at bumped + stats refreshed.
export function upsertReposts(
  username: string,
  freshOrdered: Repost[],
): { added: number; updated: number } {
  if (freshOrdered.length === 0) return { added: 0, updated: 0 };
  const owner = username.toLowerCase();
  const dbi = open();

  const existing = getCachedIdSet(owner);
  // Min position currently in DB — new items go below that.
  const minRow = dbi
    .prepare<[string], { m: number | null }>(
      "SELECT MIN(position) AS m FROM reposts WHERE owner = ?",
    )
    .get(owner);
  let nextPos = (minRow?.m ?? 0) - 1;

  const now = Date.now();
  const insert = dbi.prepare(
    `INSERT INTO reposts(owner, repost_id, position, json, first_seen_at, last_seen_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  const update = dbi.prepare(
    `UPDATE reposts SET json = ?, last_seen_at = ? WHERE owner = ? AND repost_id = ?`,
  );

  let added = 0;
  let updated = 0;
  const tx = dbi.transaction((items: Repost[]) => {
    // Walk in reverse so newest fresh item ends up at lowest position number
    // (= top of result when ORDER BY position ASC).
    for (let i = items.length - 1; i >= 0; i--) {
      const item = items[i];
      const stored = JSON.stringify(item satisfies StoredRepost);
      if (existing.has(item.id)) {
        update.run(stored, now, owner, item.id);
        updated++;
      } else {
        insert.run(owner, item.id, nextPos--, stored, now, now);
        added++;
      }
    }
  });
  tx(freshOrdered);
  return { added, updated };
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
