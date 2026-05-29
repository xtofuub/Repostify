export function formatCount(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0";
  if (n >= 1e9) return (n / 1e9).toFixed(n >= 1e10 ? 0 : 1) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1) + "K";
  return String(n);
}

export function formatDuration(secs: number): string {
  if (!secs || secs < 0) return "0:00";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// TikTok does not report when an account reposted a video. We infer it from
// our own observation log: a repost that (a) first appeared in the feed well
// after we began watching and (b) currently sits at the head of the feed was
// reposted around firstSeenAt, bounded by how often we re-scrape. Items with a
// late firstSeenAt deeper in the feed are backfill *discovery* (we walked
// further than before), not new reposts — hence the feed-position gate.
export const OBSERVED_MIN_AGE_MS = 6 * 3_600_000; // appeared >6h after baseline
export const OBSERVED_HEAD_WINDOW = 36; // only the head of the feed is trusted

export function isObservedRepost(opts: {
  firstSeenAt?: number;
  trackingSince?: number;
  feedPosition?: number;
}): boolean {
  const { firstSeenAt, trackingSince, feedPosition } = opts;
  if (!firstSeenAt || !trackingSince) return false;
  if (feedPosition === undefined || feedPosition >= OBSERVED_HEAD_WINDOW) {
    return false;
  }
  return firstSeenAt - trackingSince > OBSERVED_MIN_AGE_MS;
}

// firstSeenAt/trackingSince are epoch ms; formatRelativeTime takes epoch sec.
export function msToRelative(ms: number): string {
  return formatRelativeTime(Math.floor(ms / 1000));
}

export function formatRelativeTime(unixSec: number): string {
  if (!unixSec) return "";
  const diff = Date.now() / 1000 - unixSec;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)}d ago`;
  if (diff < 86400 * 365) return `${Math.floor(diff / (86400 * 30))}mo ago`;
  return `${Math.floor(diff / (86400 * 365))}y ago`;
}
