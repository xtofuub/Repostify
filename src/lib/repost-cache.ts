import "server-only";

import { createHash, randomUUID } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { DATA_DIR } from "@/lib/data-dir";
import type { ScrapeResult } from "@/lib/tiktok";

const CACHE_SCHEMA = 1;
export const REPOST_CACHE_TTL_MS = 15 * 60_000;

type CacheEntry = {
  schema: typeof CACHE_SCHEMA;
  username: string;
  limit: number | null;
  storedAt: number;
  result: ScrapeResult;
};

export type RepostCacheStats = {
  entries: number;
  handles: number;
  reposts: number;
  bytes: number;
  newestAt: number | null;
  oldestAt: number | null;
  ttlMs: number;
};

function normalizeUsername(username: string): string {
  return username.replace(/^@/, "").trim().toLowerCase();
}

function cacheRoot(): string {
  return resolve(DATA_DIR, "repost-cache");
}

function cacheFile(username: string, limit?: number): string {
  const key = `${normalizeUsername(username)}:${limit ?? "all"}`;
  const digest = createHash("sha256").update(key).digest("hex");
  return resolve(cacheRoot(), `${digest}.json`);
}

function validEntry(value: unknown): value is CacheEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<CacheEntry>;
  if (
    entry.schema !== CACHE_SCHEMA ||
    typeof entry.username !== "string" ||
    typeof entry.storedAt !== "number" ||
    !entry.result ||
    typeof entry.result !== "object" ||
    !Array.isArray(entry.result.reposts)
  ) {
    return false;
  }
  return true;
}

export function shouldCacheResult(result: ScrapeResult): boolean {
  return (
    result.reposts.length > 0 &&
    !result.captchaSuspected &&
    !result.audienceRestricted &&
    !result.rateLimited &&
    !result.tabError &&
    !result.privateWebBlocked &&
    !result.blockedByAuthor
  );
}

export async function readRepostCache(
  username: string,
  limit?: number,
): Promise<ScrapeResult | null> {
  try {
    const entry = JSON.parse(
      await readFile(cacheFile(username, limit), "utf8"),
    ) as unknown;
    if (!validEntry(entry)) return null;
    if (
      entry.username !== normalizeUsername(username) ||
      entry.limit !== (limit ?? null)
    ) {
      return null;
    }
    const ageMs = Math.max(0, Date.now() - entry.storedAt);
    if (ageMs > REPOST_CACHE_TTL_MS) {
      await rm(cacheFile(username, limit), { force: true }).catch(() => {});
      return null;
    }
    return {
      ...entry.result,
      cache: {
        hit: true,
        stored: true,
        storedAt: entry.storedAt,
        ageMs,
        maxAgeMs: REPOST_CACHE_TTL_MS,
      },
    };
  } catch {
    return null;
  }
}

export async function writeRepostCache(
  username: string,
  limit: number | undefined,
  result: ScrapeResult,
): Promise<number | null> {
  if (!shouldCacheResult(result)) return null;
  const root = cacheRoot();
  const target = cacheFile(username, limit);
  const temp = resolve(root, `.${randomUUID()}.tmp`);
  if (dirname(target) !== root || dirname(temp) !== root) {
    throw new Error("Unsafe cache path.");
  }
  const storedAt = Date.now();
  const cleanResult = { ...result, cache: undefined };
  const entry: CacheEntry = {
    schema: CACHE_SCHEMA,
    username: normalizeUsername(username),
    limit: limit ?? null,
    storedAt,
    result: cleanResult,
  };
  await mkdir(root, { recursive: true });
  try {
    await writeFile(temp, `${JSON.stringify(entry)}\n`, {
      encoding: "utf8",
      flag: "wx",
    });
    await rename(temp, target);
    return storedAt;
  } finally {
    await rm(temp, { force: true }).catch(() => {});
  }
}

export async function getRepostCacheStats(): Promise<RepostCacheStats> {
  const empty: RepostCacheStats = {
    entries: 0,
    handles: 0,
    reposts: 0,
    bytes: 0,
    newestAt: null,
    oldestAt: null,
    ttlMs: REPOST_CACHE_TTL_MS,
  };
  const root = cacheRoot();
  try {
    const files = (await readdir(root)).filter((name) => name.endsWith(".json"));
    const handles = new Set<string>();
    for (const name of files) {
      const file = resolve(root, name);
      if (dirname(file) !== root) continue;
      try {
        const [raw, info] = await Promise.all([
          readFile(file, "utf8"),
          stat(file),
        ]);
        const entry = JSON.parse(raw) as unknown;
        if (!validEntry(entry)) continue;
        if (Date.now() - entry.storedAt > REPOST_CACHE_TTL_MS) {
          await rm(file, { force: true }).catch(() => {});
          continue;
        }
        empty.entries++;
        empty.bytes += info.size;
        empty.reposts += entry.result.reposts.length;
        empty.newestAt = Math.max(empty.newestAt ?? 0, entry.storedAt);
        empty.oldestAt = Math.min(empty.oldestAt ?? entry.storedAt, entry.storedAt);
        handles.add(entry.username);
      } catch {
        // Ignore incomplete or manually edited entries.
      }
    }
    empty.handles = handles.size;
    return empty;
  } catch {
    return empty;
  }
}

export async function clearRepostCache(): Promise<RepostCacheStats> {
  const root = cacheRoot();
  const dataRoot = resolve(DATA_DIR);
  if (root === dataRoot || dirname(root) !== dataRoot) {
    throw new Error("Unsafe cache directory.");
  }
  const before = await getRepostCacheStats();
  await rm(root, { recursive: true, force: true });
  return before;
}
