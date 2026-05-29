"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  AlertCircle,
  ArrowDownWideNarrow,
  ArrowUpRight,
  BadgeCheck,
  CalendarRange,
  Check,
  Clock,
  Eye,
  Filter,
  Heart,
  Loader2,
  MessageCircle,
  Search,
  Share2,
  SlidersHorizontal,
  TriangleAlert,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { RepostCard } from "@/components/repost-card";
import { RepostPlayer } from "@/components/repost-player";
import { PrimaryButton } from "@/components/brand";
import type { Repost, ScrapeResult } from "@/lib/tiktok";
import { formatCount, isObservedRepost } from "@/lib/format";

type State =
  | { kind: "idle" }
  | { kind: "loading"; username: string }
  | { kind: "error"; message: string; username: string }
  | { kind: "ok"; data: ScrapeResult };

type Aggregates = {
  total: number;
  plays: number;
  likes: number;
  comments: number;
  shares: number;
  uniqueCreators: number;
  topCreators: [string, number][];
};

const LIMIT_OPTIONS = [30, 60, 120, 250, 0] as const;

type SortKey =
  | "feed"
  | "oldest_repost"
  | "views"
  | "likes"
  | "comments"
  | "shares"
  | "duration"
  | "newest"
  | "oldest";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "feed", label: "Newest reposted" },
  { key: "oldest_repost", label: "Oldest reposted" },
  { key: "views", label: "Most viewed" },
  { key: "likes", label: "Most liked" },
  { key: "comments", label: "Most discussed" },
  { key: "shares", label: "Most shared" },
  { key: "duration", label: "Longest" },
  { key: "newest", label: "Newest upload" },
  { key: "oldest", label: "Oldest upload" },
];

const SORT_LABEL: Record<SortKey, string> = Object.fromEntries(
  SORT_OPTIONS.map((o) => [o.key, o.label]),
) as Record<SortKey, string>;

// Sort a copy of the canonical feed list. "feed" returns the input untouched
// (newest-reposted-first, TikTok's native order). "oldest_repost" reverses it
// — feed position is the exact repost order, so this is the user's oldest
// repost first (within the loaded set; load "All" for their true first ever).
// This is distinct from "oldest/newest upload" (createTime, the video's post
// date). All sorts are stable, so ties fall back to feed order. We omit a
// firstSeenAt-based "recently spotted" sort: it's only trustworthy at the head
// of the feed (deep items get a late first-seen from backfill discovery).
function sortReposts(list: Repost[], key: SortKey): Repost[] {
  if (key === "feed") return list;
  const arr = [...list];
  const desc = (f: (r: Repost) => number) => arr.sort((a, b) => f(b) - f(a));
  switch (key) {
    case "oldest_repost":
      // Highest feed position = reposted longest ago.
      return desc((r) => r.feedPosition ?? 0);
    case "views":
      return desc((r) => r.stats.plays);
    case "likes":
      return desc((r) => r.stats.likes);
    case "comments":
      return desc((r) => r.stats.comments);
    case "shares":
      return desc((r) => r.stats.shares);
    case "duration":
      return desc((r) => r.duration);
    case "newest":
      return desc((r) => r.createTime);
    case "oldest":
      return arr.sort((a, b) => a.createTime - b.createTime);
    default:
      return arr;
  }
}

export function RepostSearch({
  initialUsername,
}: {
  initialUsername?: string;
} = {}) {
  const [input, setInput] = useState(initialUsername ?? "");
  const [limit, setLimit] = useState<number>(60);
  const [state, setState] = useState<State>({ kind: "idle" });
  const autoRanRef = useRef(false);

  async function run(rawUsername: string, limitOverride?: number) {
    const username = rawUsername.replace(/^@/, "").trim();
    if (!username) {
      toast.error("Enter a TikTok username");
      return;
    }
    const effLimit = limitOverride ?? limit;
    setState({ kind: "loading", username });
    try {
      const url = new URL("/api/reposts", window.location.origin);
      url.searchParams.set("username", username);
      if (effLimit > 0) url.searchParams.set("limit", String(effLimit));
      const res = await fetch(url.toString(), { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) {
        setState({
          kind: "error",
          username,
          message: json?.error ?? "Request failed",
        });
        return;
      }
      setState({ kind: "ok", data: json as ScrapeResult });
    } catch (err) {
      setState({
        kind: "error",
        username,
        message: err instanceof Error ? err.message : "Network error",
      });
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    run(input);
  }

  useEffect(() => {
    if (autoRanRef.current) return;
    if (!initialUsername) return;
    autoRanRef.current = true;
    run(initialUsername);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialUsername]);

  const aggregates = useMemo<Aggregates | null>(() => {
    if (state.kind !== "ok") return null;
    const r = state.data.reposts;
    if (r.length === 0) return null;
    const sum = (k: "plays" | "likes" | "comments" | "shares") =>
      r.reduce((acc, x) => acc + (x.stats[k] || 0), 0);
    const creators = new Map<string, number>();
    for (const x of r) {
      creators.set(
        x.author.uniqueId,
        (creators.get(x.author.uniqueId) ?? 0) + 1,
      );
    }
    const topCreators = [...creators.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
    return {
      total: r.length,
      plays: sum("plays"),
      likes: sum("likes"),
      comments: sum("comments"),
      shares: sum("shares"),
      uniqueCreators: creators.size,
      topCreators,
    };
  }, [state]);

  return (
    <div className="space-y-12">
      <SearchPanel
        input={input}
        setInput={setInput}
        onSubmit={onSubmit}
        loading={state.kind === "loading"}
        limit={limit}
        setLimit={setLimit}
      />

      <AnimatePresence mode="wait">
        {state.kind === "loading" && (
          <motion.div
            key="loading"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          >
            <LoadingState username={state.username} />
          </motion.div>
        )}
        {state.kind === "error" && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
          >
            <ErrorState
              message={state.message}
              username={state.username}
              onRetry={() => run(state.username)}
            />
          </motion.div>
        )}
        {state.kind === "ok" && (
          <motion.div
            key={`ok-${state.data.username}`}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <Results
              data={state.data}
              aggregates={aggregates}
              // One-off unbounded fetch. Don't mutate `limit` — that would make
              // every subsequent search default to a full deep scrape.
              onLoadAll={() => run(state.data.username, 0)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SearchPanel({
  input,
  setInput,
  onSubmit,
  loading,
  limit,
  setLimit,
}: {
  input: string;
  setInput: (s: string) => void;
  onSubmit: (e: FormEvent) => void;
  loading: boolean;
  limit: number;
  setLimit: (n: number) => void;
}) {
  return (
    <div className="glass-strong rounded-3xl p-3 sm:p-4 max-w-[42rem] mx-auto">
      <form
        onSubmit={onSubmit}
        className="flex items-center gap-3 rounded-2xl bg-black/30 border border-white/10 px-4 sm:px-5 h-14 sm:h-16 focus-within:border-white/25 transition-colors"
      >
        <Search className="h-4 w-4 text-white/35 flex-none" />
        <label
          className={`relative flex-1 flex items-center text-[15px] sm:text-base leading-none ${
            loading ? "opacity-60" : ""
          }`}
        >
          {/* @ sits flush against the input so caret-side starts right after.
              Same size, same baseline, single-unit feel. */}
          <span aria-hidden className="text-white/40 select-none tabular-nums">
            @
          </span>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value.replace(/^@+/, ""))}
            placeholder="username"
            aria-label="TikTok username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            disabled={loading}
            className="flex-1 ml-0.5 bg-transparent outline-none placeholder:text-white/30"
            style={{
              color: "#ffffff",
              WebkitTextFillColor: "#ffffff",
              colorScheme: "dark",
              caretColor: "#25f4ee",
            }}
          />
        </label>
        <LimitMenu value={limit} onChange={setLimit} disabled={loading} />
        <PrimaryButton
          type="submit"
          size="md"
          disabled={loading}
          className="rounded-xl"
        >
          {loading ? (
            <>
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              Scraping
            </>
          ) : (
            <>
              Analyze
              <ArrowUpRight className="ml-1 h-4 w-4" />
            </>
          )}
        </PrimaryButton>
      </form>
    </div>
  );
}

function LimitMenu({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (n: number) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    // Use the `click` phase, not `mousedown`. Mousedown fires before React
    // syncs button click handlers; using click instead avoids racing with
    // the trigger's own onClick.
    const onDocClick = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const label = value === 0 ? "All" : String(value);

  return (
    <div ref={wrapperRef} className="relative flex-none z-20">
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Fetch limit: ${label === "All" ? "every repost" : `${label} reposts`}`}
        className="h-9 inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] hover:border-white/20 px-2.5 text-white/75 hover:text-white transition-colors disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-[#25f4ee]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0b] cursor-pointer"
      >
        <SlidersHorizontal className="h-3.5 w-3.5 text-white/60" />
        <span className="text-[12.5px] font-medium tnum tracking-tight">
          {label}
        </span>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Fetch limit"
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-[11rem] rounded-xl border border-white/10 bg-[#101012] shadow-[0_24px_60px_rgba(0,0,0,0.6)] overflow-hidden py-1"
        >
          <p className="px-3 pt-2.5 pb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-white/55 whitespace-nowrap">
            Fetch limit
          </p>
          {LIMIT_OPTIONS.map((m) => {
            const active = m === value;
            return (
              <button
                key={m}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(m);
                  setOpen(false);
                }}
                className={`w-full px-3 h-9 flex items-center justify-between gap-4 text-left transition-colors outline-none focus-visible:bg-white/[0.05] cursor-pointer ${
                  active
                    ? "bg-white/[0.04] text-white"
                    : "text-white/70 hover:bg-white/[0.03] hover:text-white"
                }`}
              >
                <span className="text-[13.5px] font-medium tnum">
                  {m === 0 ? "All" : m}
                </span>
                {active && (
                  <Check className="h-3.5 w-3.5 text-[#25f4ee] flex-none" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SortMenu({
  value,
  onChange,
}: {
  value: SortKey;
  onChange: (k: SortKey) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapperRef} className="relative flex-none z-20">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Sort: ${SORT_LABEL[value]}`}
        className="h-9 inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] hover:border-white/20 px-2.5 text-white/75 hover:text-white transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#25f4ee]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0b] cursor-pointer"
      >
        <ArrowDownWideNarrow className="h-3.5 w-3.5 text-white/60" />
        <span className="text-[12.5px] font-medium tracking-tight">
          {SORT_LABEL[value]}
        </span>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Sort reposts"
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-[12rem] rounded-xl border border-white/10 bg-[#101012] shadow-[0_24px_60px_rgba(0,0,0,0.6)] overflow-hidden py-1"
        >
          <p className="px-3 pt-2.5 pb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-white/55 whitespace-nowrap">
            Sort by
          </p>
          {SORT_OPTIONS.map((o) => {
            const active = o.key === value;
            return (
              <button
                key={o.key}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(o.key);
                  setOpen(false);
                }}
                className={`w-full px-3 h-9 flex items-center justify-between gap-4 text-left transition-colors outline-none focus-visible:bg-white/[0.05] cursor-pointer ${
                  active
                    ? "bg-white/[0.04] text-white"
                    : "text-white/70 hover:bg-white/[0.03] hover:text-white"
                }`}
              >
                <span className="text-[13.5px] font-medium">{o.label}</span>
                {active && (
                  <Check className="h-3.5 w-3.5 text-[#25f4ee] flex-none" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Results({
  data,
  aggregates,
  onLoadAll,
}: {
  data: ScrapeResult;
  aggregates: Aggregates | null;
  onLoadAll: () => void;
}) {
  const { profile, username } = data;
  const [keywords, setKeywords] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [exact, setExact] = useState(false);

  // Stamp each repost with its canonical feed index (0 = newest reposted) so
  // observed-timing and position survive client-side sorting and filtering.
  const reposts = useMemo(
    () => data.reposts.map((r, i) => ({ ...r, feedPosition: i })),
    [data.reposts],
  );

  // How many reposts we can date from observation (head-of-feed items first
  // seen after we began watching). Drives the tracking note's copy.
  const observedCount = useMemo(
    () =>
      reposts.filter((r) =>
        isObservedRepost({
          firstSeenAt: r.firstSeenAt,
          trackingSince: data.trackingSince,
          feedPosition: r.feedPosition,
        }),
      ).length,
    [reposts, data.trackingSince],
  );

  // Client-side sort. The mask + grid + player all run over this sorted view,
  // so their index mapping stays consistent. feedPosition rides along on each
  // item, so observed-timing labels stay correct in any order.
  const [sort, setSort] = useState<SortKey>("feed");
  const sorted = useMemo(() => sortReposts(reposts, sort), [reposts, sort]);

  // Visibility mask: which reposts pass the filter. We render ALL cards
  // always and toggle visibility via CSS, so changing the filter doesn't
  // unmount cards (preserves image cache + animation state).
  const { mask, matchedCount } = useMemo(() => {
    const liveDraft = draft.trim().toLowerCase();
    const lc = keywords.map((k) => k.toLowerCase());
    const all = liveDraft ? [...lc, liveDraft] : lc;
    if (all.length === 0) {
      return { mask: sorted.map(() => true), matchedCount: sorted.length };
    }
    // Pre-build regex when exact mode is on; word boundary on either side.
    const matchers = exact
      ? all.map(
          (k) =>
            new RegExp(
              `\\b${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
              "i",
            ),
        )
      : null;
    let count = 0;
    const m = sorted.map((r) => {
      const desc = (r.desc ?? "").toLowerCase();
      const hit = exact
        ? matchers!.some((rx) => rx.test(desc))
        : all.some((k) => desc.includes(k));
      if (hit) count++;
      return hit;
    });
    return { mask: m, matchedCount: count };
  }, [sorted, keywords, draft, exact]);

  if (reposts.length === 0) {
    if (data.audienceRestricted) {
      return (
        <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-10 max-w-2xl mx-auto text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-white/45" />
          <h2 className="mt-4 font-display text-3xl tracking-tight">
            @{username} restricted their audience
          </h2>
          <p className="mt-3 text-[14px] text-white/65 leading-[1.65] max-w-md mx-auto">
            This creator turned on TikTok audience controls — their profile is
            only visible to logged-in viewers they allow (often followers
            only). Anonymous scraping cannot bypass this.
          </p>
        </div>
      );
    }
    if (data.rateLimited) {
      return (
        <div className="rounded-3xl border border-amber-400/25 bg-amber-400/[0.05] p-10 max-w-2xl mx-auto text-center">
          <TriangleAlert className="mx-auto h-8 w-8 text-amber-300/80" />
          <h2 className="mt-4 font-display text-3xl tracking-tight">
            TikTok soft-blocked this scrape
          </h2>
          <p className="mt-3 text-[14px] text-white/70 leading-[1.65] max-w-md mx-auto">
            @{username}&apos;s profile loaded, but TikTok returned an empty
            repost list — a quiet rate-limit signal. Wait a few minutes and
            retry, or try a different handle in the meantime. This is
            <span className="text-white"> not </span>
            the same as a private reposts tab.
          </p>
        </div>
      );
    }
    if (data.tabError) {
      return (
        <div className="rounded-3xl border border-amber-400/25 bg-amber-400/[0.05] p-10 max-w-2xl mx-auto text-center">
          <TriangleAlert className="mx-auto h-8 w-8 text-amber-300/80" />
          <h2 className="mt-4 font-display text-3xl tracking-tight">
            TikTok errored on the reposts tab
          </h2>
          <p className="mt-3 text-[14px] text-white/70 leading-[1.65] max-w-md mx-auto">
            TikTok rendered its &quot;Something went wrong&quot; panel for
            @{username}&apos;s reposts tab and our auto-refresh didn&apos;t
            recover it. Usually transient — search the handle again in 30s.
          </p>
        </div>
      );
    }
    return (
      <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-10 max-w-2xl mx-auto text-center">
        <AlertCircle className="mx-auto h-8 w-8 text-white/45" />
        <h2 className="mt-4 font-display text-3xl tracking-tight">
          Nothing public on @{username}
        </h2>
        <p className="mt-3 text-[14px] text-white/65 leading-[1.65] max-w-md mx-auto">
          The reposts tab is hidden by default on most TikTok profiles. Try a
          creator with it visibly enabled, like @khaby.lame, @mrbeast or
          @zachking.
        </p>
      </div>
    );
  }

  // The account has a known All-total larger than what's loaded → the grid
  // header shows a count-aware "Load all" button, so suppress the banner's.
  const moreAvailable =
    data.knownTotal != null && data.knownTotal > reposts.length;

  return (
    <div className="space-y-10">
      {profile && <ProfileCard profile={profile} username={username} />}

      {aggregates && <StatRow agg={aggregates} />}

      {data.trackingSince && (
        <TrackingNote
          since={data.trackingSince}
          observed={observedCount}
          username={username}
        />
      )}

      {data.hasMore && !moreAvailable && (
        <PartialBanner
          count={reposts.length}
          captcha={data.captchaSuspected}
          onLoadAll={onLoadAll}
        />
      )}

      {aggregates && aggregates.topCreators.length > 0 && (
        <TopCreators
          creators={aggregates.topCreators}
          total={aggregates.total}
        />
      )}

      <UploadTimeline reposts={reposts} />

      <FilterBar
        reposts={reposts}
        keywords={keywords}
        setKeywords={setKeywords}
        draft={draft}
        setDraft={setDraft}
        exact={exact}
        setExact={setExact}
        matchedCount={matchedCount}
      />

      <RepostGrid
        reposts={sorted}
        visibilityMask={mask}
        matchedCount={matchedCount}
        trackingSince={data.trackingSince}
        sort={sort}
        onSortChange={setSort}
        knownTotal={data.knownTotal}
        onLoadAll={onLoadAll}
      />
    </div>
  );
}

function TrackingNote({
  since,
  observed,
  username,
}: {
  since: number;
  observed: number;
  username: string;
}) {
  const date = new Date(since).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-white/8 bg-white/[0.015] px-5 py-3.5 text-[12.5px] text-white/55">
      <Clock className="h-3.5 w-3.5 mt-0.5 flex-none text-white/40" />
      <p className="leading-[1.6]">
        TikTok doesn&apos;t report repost times. We log when each repost first
        appears in <span className="text-white/80">@{username}</span>&apos;s
        feed — tracking since <span className="text-white/80">{date}</span>.{" "}
        {observed > 0 ? (
          <>
            <span className="text-[#25f4ee] tnum">{observed}</span> dated from
            what we&apos;ve seen so far.
          </>
        ) : (
          <>Re-scan over time to date new reposts as they surface.</>
        )}
      </p>
    </div>
  );
}

function FilterBar({
  reposts,
  keywords,
  setKeywords,
  draft,
  setDraft,
  exact,
  setExact,
  matchedCount,
}: {
  reposts: Repost[];
  keywords: string[];
  setKeywords: (k: string[]) => void;
  draft: string;
  setDraft: (s: string) => void;
  exact: boolean;
  setExact: (b: boolean) => void;
  matchedCount: number;
}) {

  // Extract hashtags from captions, rank by frequency. Skip ones already on
  // the active filter list.
  const suggestions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of reposts) {
      const desc = (r.desc ?? "").toLowerCase();
      const tags = desc.match(/#[a-z0-9_]{2,24}/g) ?? [];
      for (const t of tags) {
        const k = t.slice(1);
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([t, n]) => ({ kw: t, count: n }));
  }, [reposts]);

  function add(raw: string) {
    const k = raw.replace(/^#/, "").trim().toLowerCase();
    if (!k) return;
    if (keywords.includes(k)) return;
    setKeywords([...keywords, k]);
    setDraft("");
  }

  function remove(k: string) {
    setKeywords(keywords.filter((x) => x !== k));
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5">
      <div className="flex items-center justify-between gap-4 flex-wrap mb-3">
        <div className="flex items-center gap-3 text-white/55">
          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5" />
            <span className="text-[11px] font-medium uppercase tracking-[0.18em]">
              Filter captions
            </span>
          </div>
          {/* Exact / Fuzzy toggle. Fuzzy = substring match (default).
              Exact = word-boundary regex, so "ex" stops matching "complex". */}
          <button
            type="button"
            role="switch"
            aria-checked={exact}
            onClick={() => setExact(!exact)}
            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition-colors text-[11px] tracking-tight"
            title="Toggle whole-word matching"
          >
            <span
              aria-hidden
              className={`h-1.5 w-1.5 rounded-full transition-colors ${
                exact ? "bg-[#25f4ee]" : "bg-white/25"
              }`}
            />
            <span className={exact ? "text-white" : "text-white/55"}>
              {exact ? "Exact word" : "Fuzzy"}
            </span>
          </button>
        </div>
        {(keywords.length > 0 || draft.trim()) && (
          <div className="flex items-center gap-3 text-[11.5px] text-white/45">
            <span>
              <span className="text-white tnum">{matchedCount}</span>{" "}
              <span className="text-white/40">of</span>{" "}
              <span className="tnum text-white/75">{reposts.length}</span>{" "}
              match
            </span>
            {keywords.length > 0 && (
              <>
                <span aria-hidden className="text-white/15">
                  ·
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setKeywords([]);
                    setDraft("");
                  }}
                  className="text-[11px] uppercase tracking-[0.18em] text-white/45 hover:text-white transition-colors"
                >
                  Clear
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          add(draft);
        }}
        className="flex items-center gap-2 flex-wrap rounded-xl bg-black/30 border border-white/10 focus-within:border-white/25 px-3 py-2 transition-colors"
      >
        <Search className="h-3.5 w-3.5 text-white/35 flex-none" />
        {keywords.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => remove(k)}
            aria-label={`Remove filter ${k}`}
            className="group inline-flex items-center gap-1 text-[12.5px] font-medium tnum bg-[#25f4ee] text-[#0a0a0b] rounded-full pl-2 pr-1 py-0.5 transition-colors hover:bg-[#25f4ee]/90"
          >
            <span className="text-black/45">#</span>
            {k}
            <X className="h-3 w-3 ml-0.5 opacity-70 group-hover:opacity-100" />
          </button>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={keywords.length === 0 ? "search captions" : ""}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          style={{
            color: "#ffffff",
            WebkitTextFillColor: "#ffffff",
            colorScheme: "dark",
            caretColor: "#25f4ee",
          }}
          className="flex-1 min-w-[6rem] bg-transparent text-[14px] outline-none"
        />
      </form>

      {suggestions.length > 0 && (
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <span className="text-[10px] uppercase tracking-[0.18em] text-white/35 mr-1">
            Top tags
          </span>
          {suggestions
            .filter((s) => !keywords.includes(s.kw))
            .slice(0, 8)
            .map((s) => (
              <button
                key={s.kw}
                type="button"
                onClick={() => add(s.kw)}
                className="group inline-flex items-center gap-1.5 text-[12px] text-white/65 hover:text-white px-2.5 py-1 rounded-full bg-white/[0.025] border border-white/10 hover:border-white/25 hover:bg-white/[0.05] transition-colors"
              >
                <span className="text-white/40 group-hover:text-[#25f4ee] transition-colors">
                  #
                </span>
                <span>{s.kw}</span>
                <span aria-hidden className="text-white/15">
                  ·
                </span>
                <span className="text-[10.5px] tnum text-white/40">
                  {s.count}
                </span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

function ProfileCard({
  profile,
  username,
}: {
  profile: NonNullable<ScrapeResult["profile"]>;
  username: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center gap-6">
      <div className="relative flex-none">
        <div className="absolute -inset-2 rounded-full bg-gradient-to-tr from-[#ff2d8a] to-[#25f4ee] opacity-40 blur-xl" />
        <div className="relative h-24 w-24 sm:h-28 sm:w-28 rounded-full overflow-hidden border border-white/15 bg-white/[0.04]">
          {profile.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/img?u=${encodeURIComponent(profile.avatar)}`}
              alt={`@${username}`}
              className="h-full w-full object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center font-display text-3xl text-white/55">
              {username.slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="font-display text-[clamp(1.8rem,4vw,3rem)] leading-[1] tracking-[-0.015em]">
            {profile.nickname || `@${username}`}
          </h2>
          {profile.verified && (
            <BadgeCheck className="h-6 w-6 text-[#25f4ee] flex-none" />
          )}
        </div>
        <p className="mt-1 text-[13px] text-white/45">@{username}</p>
        {profile.bio && (
          <p className="mt-3 max-w-[60ch] text-[14px] text-white/65 leading-[1.6]">
            {profile.bio}
          </p>
        )}
        <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 items-baseline">
          <Stat n={profile.followers} k="followers" />
          <Stat n={profile.following} k="following" />
          <Stat n={profile.likes} k="hearts" />
          <a
            href={`https://www.tiktok.com/@${username}`}
            target="_blank"
            rel="noreferrer"
            className="ml-auto inline-flex items-center gap-1.5 text-[12px] text-white/50 hover:text-white transition-colors uppercase tracking-[0.18em]"
          >
            On TikTok
            <ArrowUpRight className="h-3 w-3" />
          </a>
        </div>
      </div>
    </div>
  );
}

function Stat({ n, k }: { n: number; k: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="font-display text-2xl tnum">{formatCount(n)}</span>
      <span className="text-[11px] text-white/45 uppercase tracking-[0.18em]">
        {k}
      </span>
    </span>
  );
}

function StatRow({ agg }: { agg: Aggregates }) {
  const items = [
    { icon: ArrowUpRight, label: "Reposts", value: agg.total },
    { icon: Eye, label: "Plays", value: formatCount(agg.plays) },
    { icon: Heart, label: "Likes", value: formatCount(agg.likes) },
    { icon: MessageCircle, label: "Comments", value: formatCount(agg.comments) },
    { icon: Share2, label: "Shares", value: formatCount(agg.shares) },
    { icon: Users, label: "Creators", value: agg.uniqueCreators },
  ];
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.015] grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-y sm:divide-y-0 divide-white/8">
      {items.map((it) => (
        <StatBlock key={it.label} {...it} />
      ))}
    </div>
  );
}

function StatBlock({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Eye;
  label: string;
  value: string | number;
}) {
  return (
    <div className="px-5 py-5">
      <div className="flex items-center gap-2 text-white/55">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[10px] uppercase tracking-[0.22em]">{label}</span>
      </div>
      <p className="mt-2 font-display text-[clamp(1.6rem,3vw,2.6rem)] leading-[1] tracking-[-0.01em] tnum">
        {value}
      </p>
    </div>
  );
}

function TopCreators({
  creators,
  total,
}: {
  creators: [string, number][];
  total: number;
}) {
  const max = Math.max(...creators.map(([, c]) => c));
  return (
    <div>
      <div className="flex items-baseline justify-between mb-4">
        <p className="text-[11px] uppercase tracking-[0.22em] text-white/55">
          Top creators · most amplified
        </p>
        <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">
          {creators.length} of {total}
        </p>
      </div>
      <div className="rounded-3xl border border-white/10 bg-white/[0.015] divide-y divide-white/8">
        {creators.map(([handle, count], i) => {
          const pct = (count / max) * 100;
          return (
            <a
              key={handle}
              href={`https://www.tiktok.com/@${handle}`}
              target="_blank"
              rel="noreferrer"
              className="relative flex items-center gap-4 px-5 sm:px-6 py-4 hover:bg-white/[0.03] transition-colors group"
            >
              <span className="text-[11px] text-white/40 w-7 tnum">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="font-display text-[18px] sm:text-[20px] flex-none min-w-0 truncate">
                <span className="text-white/40">@</span>
                {handle}
              </span>
              <div className="flex-1 mx-2 hidden sm:block">
                <div className="relative w-full h-[3px] bg-white/8 overflow-hidden rounded-full">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#ff2d8a] to-[#25f4ee]"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
              <span className="font-display text-[20px] tnum w-10 text-right">
                {count}
              </span>
              <ArrowUpRight className="h-4 w-4 text-white/45 opacity-0 group-hover:opacity-100 transition-opacity" />
            </a>
          );
        })}
      </div>
    </div>
  );
}

// Distribution of the *upload* dates (createTime) of the reposted videos.
// This is real, always-present data — unlike repost time, which TikTok hides.
// It answers "what era of content does this account amplify?". Granularity
// adapts to the span so the strip never becomes hundreds of hairline bars.
function UploadTimeline({ reposts }: { reposts: Repost[] }) {
  const { buckets, granularity, peak } = useMemo(() => {
    const times = reposts.map((r) => r.createTime).filter((t) => t > 0);
    if (times.length === 0) {
      return { buckets: [], granularity: "month" as const, peak: null };
    }
    const min = Math.min(...times);
    const max = Math.max(...times);
    const monthIndex = (d: Date) => d.getFullYear() * 12 + d.getMonth();
    const span = monthIndex(new Date(max * 1000)) - monthIndex(new Date(min * 1000));
    const granularity: "month" | "quarter" | "year" =
      span <= 23 ? "month" : span <= 95 ? "quarter" : "year";

    const keyOf = (d: Date) => {
      const y = d.getFullYear();
      if (granularity === "year") return `${y}`;
      if (granularity === "quarter") return `${y}-Q${Math.floor(d.getMonth() / 3) + 1}`;
      return `${y}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    };
    const labelOf = (d: Date) => {
      const y = `${d.getFullYear()}`.slice(2);
      if (granularity === "year") return `${d.getFullYear()}`;
      if (granularity === "quarter") return `Q${Math.floor(d.getMonth() / 3) + 1} '${y}`;
      return `${d.toLocaleString(undefined, { month: "short" })} '${y}`;
    };

    // Walk continuous periods from first to last so empty gaps render as gaps.
    const cur = new Date(min * 1000);
    cur.setDate(1);
    if (granularity === "quarter") cur.setMonth(Math.floor(cur.getMonth() / 3) * 3);
    if (granularity === "year") cur.setMonth(0);
    const end = new Date(max * 1000);
    const step = granularity === "year" ? 12 : granularity === "quarter" ? 3 : 1;

    const periods: { key: string; label: string }[] = [];
    const seen = new Set<string>();
    while (cur <= end) {
      const k = keyOf(cur);
      if (!seen.has(k)) {
        seen.add(k);
        periods.push({ key: k, label: labelOf(cur) });
      }
      cur.setMonth(cur.getMonth() + step);
    }

    const counts = new Map<string, number>();
    for (const t of times) {
      const k = keyOf(new Date(t * 1000));
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const buckets = periods.map((p) => ({ ...p, count: counts.get(p.key) ?? 0 }));
    const peak = buckets.reduce(
      (best, b) => (b.count > best.count ? b : best),
      buckets[0] ?? { label: "", count: 0 },
    );
    return { buckets, granularity, peak };
  }, [reposts]);

  const [hover, setHover] = useState<number | null>(null);

  // Not worth a chart for a single period or no dated videos.
  if (buckets.length < 2) return null;
  const max = Math.max(...buckets.map((b) => b.count), 1);
  const granLabel =
    granularity === "year"
      ? "by year"
      : granularity === "quarter"
        ? "by quarter"
        : "by month";
  const active = hover != null ? buckets[hover] : peak;
  // Few enough bars to print the count atop each without clutter.
  const showLabels = buckets.length <= 14;
  // Leave headroom for the count label so the tallest bar doesn't clip.
  const heightScale = showLabels ? 0.82 : 1;
  // With few buckets, cap + center the plot so bars sit together instead of
  // floating across the full width. Many buckets fill the container.
  const plotMaxWidth =
    buckets.length < 12 ? `${buckets.length * 88}px` : undefined;

  return (
    <div>
      <div className="flex items-baseline justify-between mb-4 gap-4 flex-wrap">
        <p className="text-[11px] uppercase tracking-[0.22em] text-white/55 inline-flex items-center gap-2">
          <CalendarRange className="h-3.5 w-3.5" />
          Upload timeline
          <span className="hidden sm:inline text-white/35">
            · when the reposted videos were made
          </span>
        </p>
        {active && active.count > 0 && (
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/40 tnum">
            {hover == null && <span className="text-white/35">peak </span>}
            <span className="text-white">{active.label}</span>
            <span className="text-white/35"> · </span>
            <span className="text-white">{active.count}</span>
            <span className="text-white/35">
              {" "}
              {active.count === 1 ? "repost" : "reposts"}
            </span>
          </p>
        )}
      </div>
      <div className="rounded-3xl border border-white/10 bg-[#0b0b0d]/90 backdrop-blur-xl px-5 sm:px-6 pt-5 pb-4">
        <div className="mx-auto" style={{ maxWidth: plotMaxWidth }}>
          <div
            className="flex items-end gap-2 sm:gap-3 h-36 border-b border-white/10"
            onMouseLeave={() => setHover(null)}
          >
            {buckets.map((b, i) => {
              const isActive = hover === i || (hover == null && b === peak);
              const h =
                b.count > 0
                  ? Math.max(6, (b.count / max) * 100 * heightScale)
                  : 0;
              return (
                <div
                  key={b.key}
                  title={`${b.label}: ${b.count} repost${b.count === 1 ? "" : "s"}`}
                  onMouseEnter={() => setHover(i)}
                  className="group relative flex-1 h-full flex flex-col items-center justify-end gap-1.5"
                >
                  {showLabels && b.count > 0 && (
                    <span
                      className={`text-[10px] tnum leading-none transition-colors ${
                        isActive ? "text-white" : "text-white/40"
                      }`}
                    >
                      {b.count}
                    </span>
                  )}
                  {b.count > 0 ? (
                    <div
                      className={`w-full max-w-[72px] rounded-t-[4px] transition-[height,background-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                        isActive
                          ? "bg-[#25f4ee] shadow-[0_0_20px_-4px_rgba(37,244,238,0.5)]"
                          : "bg-[#25f4ee]/25 group-hover:bg-[#25f4ee]/55"
                      }`}
                      style={{ height: `${h}%` }}
                    />
                  ) : (
                    // empty period — faint baseline tick so gaps read as gaps
                    <div className="w-full max-w-[72px] h-[2px] rounded-full bg-white/10" />
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex items-center justify-between text-[10.5px] uppercase tracking-[0.2em] text-white/35">
            <span>{buckets[0].label}</span>
            <span className="text-white/25 normal-case tracking-normal">
              {granLabel}
            </span>
            <span>{buckets[buckets.length - 1].label}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function RepostGrid({
  reposts,
  visibilityMask,
  matchedCount,
  trackingSince,
  sort,
  onSortChange,
  knownTotal,
  onLoadAll,
}: {
  reposts: Repost[];
  visibilityMask?: boolean[];
  matchedCount?: number;
  trackingSince?: number;
  sort: SortKey;
  onSortChange: (k: SortKey) => void;
  knownTotal?: number;
  onLoadAll?: () => void;
}) {
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const total = reposts.length;
  const showing = matchedCount ?? total;
  const filtered = visibilityMask && showing < total;
  // The account has more reposts than we've loaded into this view.
  const moreAvailable = knownTotal != null && knownTotal > total;

  // Visible-only list passed to the player so prev/next skip hidden cards.
  const visibleList = useMemo(() => {
    if (!visibilityMask) return reposts;
    return reposts.filter((_, i) => visibilityMask[i]);
  }, [reposts, visibilityMask]);

  // Map: original index → visible index (for clicks on the masked grid).
  const visibleIndexFromOriginal = useMemo(() => {
    if (!visibilityMask) return null;
    const map = new Map<number, number>();
    let v = 0;
    for (let i = 0; i < reposts.length; i++) {
      if (visibilityMask[i]) {
        map.set(i, v);
        v++;
      }
    }
    return map;
  }, [reposts, visibilityMask]);

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
        <p className="text-[11px] uppercase tracking-[0.22em] text-white/55">
          Reel ·{" "}
          {moreAvailable
            ? filtered
              ? `${showing} match · ${formatCount(total)} of ${formatCount(knownTotal!)} loaded`
              : `${formatCount(total)} of ${formatCount(knownTotal!)} reposts`
            : filtered
              ? `${showing} of ${total} items`
              : `${showing} item${showing === 1 ? "" : "s"}`}
        </p>
        <div className="flex items-center gap-3">
          <p className="hidden lg:block text-[11px] uppercase tracking-[0.18em] text-white/40">
            click to play · arrows to navigate
          </p>
          {moreAvailable && onLoadAll && (
            <button
              type="button"
              onClick={onLoadAll}
              className="inline-flex items-center gap-1.5 h-9 rounded-lg border border-[#25f4ee]/30 bg-[#25f4ee]/10 hover:bg-[#25f4ee]/20 px-3 text-[12px] font-medium text-[#25f4ee] transition-colors cursor-pointer"
            >
              Load all {formatCount(knownTotal!)}
            </button>
          )}
          <SortMenu value={sort} onChange={onSortChange} />
        </div>
      </div>

      {showing === 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-10 text-center">
          <p className="text-[14px] text-white/65">
            No reposts match your filter. Clear it to see them all.
          </p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {reposts.map((r, i) => {
          const visible = visibilityMask ? visibilityMask[i] : true;
          return (
            <motion.div
              key={r.id}
              // Keep DOM mounted: just collapse to zero size when filtered out.
              // Preserves image cache + player nav indices.
              className={visible ? "" : "hidden"}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.55,
                delay: Math.min(i * 0.025, 0.5),
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              <RepostCard
                repost={r}
                trackingSince={trackingSince}
                onPlay={() => {
                  const v = visibleIndexFromOriginal
                    ? visibleIndexFromOriginal.get(i) ?? null
                    : i;
                  setPlayingIndex(v);
                }}
              />
            </motion.div>
          );
        })}
      </div>
      <RepostPlayer
        reposts={visibleList}
        index={playingIndex}
        trackingSince={trackingSince}
        onClose={() => setPlayingIndex(null)}
        onIndexChange={setPlayingIndex}
      />
    </div>
  );
}

function PartialBanner({
  count,
  captcha,
  onLoadAll,
}: {
  count: number;
  captcha?: boolean;
  onLoadAll?: () => void;
}) {
  // Captcha is a hard stop — nothing the user can do without a solver.
  if (captcha) {
    return (
      <div className="rounded-2xl border border-[#ff2d8a]/30 bg-[#ff2d8a]/[0.06] px-5 py-4 flex items-start gap-3">
        <TriangleAlert className="h-4 w-4 mt-0.5 flex-none text-[#ff2d8a]" />
        <div className="text-[13.5px] text-white/70 leading-[1.6]">
          <span className="text-white font-medium">Cut at the gate.</span>{" "}
          TikTok showed a captcha after the first batch of {count} items. Going
          further would need a paid captcha solver, a different product
          entirely.
        </div>
      </div>
    );
  }
  // Otherwise the walk just stopped short of the end — more is loadable.
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-5 py-4 flex items-center gap-3 flex-wrap">
      <TriangleAlert className="h-4 w-4 flex-none text-white/45" />
      <div className="flex-1 min-w-[12rem] text-[13.5px] text-white/70 leading-[1.6]">
        <span className="text-white font-medium">More to load.</span> Showing the
        first {count}. This account has reposted more than what&apos;s on screen.
      </div>
      {onLoadAll && (
        <button
          type="button"
          onClick={onLoadAll}
          className="inline-flex items-center gap-1.5 h-9 rounded-lg border border-[#25f4ee]/30 bg-[#25f4ee]/10 hover:bg-[#25f4ee]/20 px-3 text-[12px] font-medium text-[#25f4ee] transition-colors cursor-pointer"
        >
          Load all
        </button>
      )}
    </div>
  );
}

function LoadingState({ username }: { username: string }) {
  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-white/10 bg-white/[0.02] flex items-center gap-6 p-6 sm:p-8">
        <Skeleton className="h-24 w-24 rounded-full bg-white/[0.05]" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-6 w-56 bg-white/[0.05]" />
          <Skeleton className="h-4 w-32 bg-white/[0.05]" />
          <Skeleton className="h-4 w-64 bg-white/[0.05]" />
        </div>
      </div>
      <div className="rounded-3xl border border-white/10 bg-white/[0.015] grid grid-cols-3 sm:grid-cols-6 divide-x divide-white/8">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="p-5 space-y-2">
            <Skeleton className="h-3 w-12 bg-white/[0.05]" />
            <Skeleton className="h-8 w-16 bg-white/[0.05]" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton
            key={i}
            className="aspect-[9/16] w-full rounded-xl bg-white/[0.05]"
          />
        ))}
      </div>
      <p className="text-center text-[11px] uppercase tracking-[0.22em] text-white/45">
        Opening @{username} · clicking the reposts tab · decoding XHR
      </p>
    </div>
  );
}

function ErrorState({
  message,
  username,
  onRetry,
}: {
  message: string;
  username: string;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-3xl border border-[#ff2d8a]/25 bg-white/[0.02] p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 text-[#ff2d8a]">
        <AlertCircle className="h-5 w-5" />
        <h2 className="font-display text-2xl tracking-tight">
          Couldn&apos;t scrape @{username}
        </h2>
      </div>
      <p className="mt-3 text-[14px] text-white/70">{message}</p>
      <p className="mt-2 text-[12px] text-white/50 leading-[1.6]">
        TikTok throttles aggressively. Common causes: the handle doesn&apos;t
        exist, the profile is private, the reposts tab is hidden, or TikTok
        showed a captcha on the first request. Retry in a few seconds.
      </p>
      <button
        onClick={onRetry}
        className="mt-5 text-[11px] uppercase tracking-[0.22em] text-white border border-white/15 px-4 py-2 rounded-full hover:bg-white/[0.05] transition-colors"
      >
        Retry
      </button>
    </div>
  );
}
