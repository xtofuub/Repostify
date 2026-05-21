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
  ArrowUpRight,
  BadgeCheck,
  Eye,
  Heart,
  Loader2,
  MessageCircle,
  Search,
  Share2,
  TriangleAlert,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { RepostCard } from "@/components/repost-card";
import { RepostPlayer } from "@/components/repost-player";
import { PrimaryButton } from "@/components/brand";
import type { Repost, ScrapeResult } from "@/lib/tiktok";
import { formatCount } from "@/lib/format";

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

const EXAMPLES = ["khaby.lame", "mrbeast", "charlidamelio", "zachking"];
const LIMIT_OPTIONS = [30, 60, 120, 250, 0] as const;

export function RepostSearch({
  initialUsername,
}: {
  initialUsername?: string;
} = {}) {
  const [input, setInput] = useState(initialUsername ?? "");
  const [limit, setLimit] = useState<number>(60);
  const [state, setState] = useState<State>({ kind: "idle" });
  const autoRanRef = useRef(false);

  async function run(rawUsername: string) {
    const username = rawUsername.replace(/^@/, "").trim();
    if (!username) {
      toast.error("Enter a TikTok username");
      return;
    }
    setState({ kind: "loading", username });
    try {
      const url = new URL("/api/reposts", window.location.origin);
      url.searchParams.set("username", username);
      if (limit > 0) url.searchParams.set("limit", String(limit));
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
        run={run}
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
            <Results data={state.data} aggregates={aggregates} />
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
  run,
  limit,
  setLimit,
}: {
  input: string;
  setInput: (s: string) => void;
  onSubmit: (e: FormEvent) => void;
  loading: boolean;
  run: (u: string) => void;
  limit: number;
  setLimit: (n: number) => void;
}) {
  return (
    <div className="glass-strong rounded-3xl p-3 sm:p-4 max-w-[42rem] mx-auto">
      <form
        onSubmit={onSubmit}
        className="flex items-center gap-2 rounded-2xl bg-black/30 border border-white/10 px-3 sm:px-4 h-14 sm:h-16"
      >
        <Search className="h-4 w-4 text-white/45 flex-none" />
        <span className="text-white/40 select-none">@</span>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="paste a tiktok handle"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          disabled={loading}
          className="flex-1 bg-transparent text-[15px] sm:text-base text-white placeholder:text-white/35 outline-none disabled:opacity-60"
        />
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
      <div className="px-4 sm:px-5 pt-5 pb-3 space-y-4">
        {/* Limit chips — distinct pills, generous gap, active gets a thin
            cyan underline (accent stays ≤10% surface per brand). */}
        <div className="flex items-center gap-4 flex-wrap">
          <span className="text-[10px] uppercase tracking-[0.22em] text-white/45 flex-none">
            Limit
          </span>
          <div
            role="radiogroup"
            aria-label="Reposts fetch limit"
            className="flex items-center gap-2 flex-wrap"
          >
            {LIMIT_OPTIONS.map((n) => {
              const active = n === limit;
              return (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={loading}
                  onClick={() => setLimit(n)}
                  className={`relative tnum font-medium text-[13px] h-8 px-3.5 rounded-lg transition-colors duration-150 disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-[#25f4ee]/50 ${
                    active
                      ? "bg-white/[0.08] text-white border border-white/20"
                      : "bg-white/[0.02] border border-white/8 text-white/60 hover:text-white hover:bg-white/[0.05] hover:border-white/15"
                  }`}
                >
                  {n === 0 ? "All" : n}
                  {active && (
                    <span className="absolute left-3 right-3 -bottom-[3px] h-[2px] bg-[#25f4ee] rounded-full" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Try chips — quieter than limit, but still tappable pills. */}
        <div className="flex items-center gap-4 flex-wrap">
          <span className="text-[10px] uppercase tracking-[0.22em] text-white/45 flex-none">
            Try
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            {EXAMPLES.map((u) => (
              <button
                key={u}
                type="button"
                disabled={loading}
                onClick={() => {
                  setInput(u);
                  run(u);
                }}
                className="group inline-flex items-center text-[13px] h-8 px-3 rounded-lg bg-white/[0.02] border border-white/8 text-white/70 hover:text-white hover:bg-white/[0.05] hover:border-white/15 transition-colors disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-[#25f4ee]/50"
              >
                <span className="text-white/35 group-hover:text-[#25f4ee] transition-colors mr-0.5">
                  @
                </span>
                {u}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Results({
  data,
  aggregates,
}: {
  data: ScrapeResult;
  aggregates: Aggregates | null;
}) {
  const { profile, reposts, username } = data;

  if (reposts.length === 0) {
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

  return (
    <div className="space-y-10">
      {profile && <ProfileCard profile={profile} username={username} />}

      {aggregates && <StatRow agg={aggregates} />}

      {data.hasMore && <PartialBanner count={reposts.length} />}

      {aggregates && aggregates.topCreators.length > 0 && (
        <TopCreators
          creators={aggregates.topCreators}
          total={aggregates.total}
        />
      )}

      <RepostGrid reposts={reposts} />
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

function RepostGrid({ reposts }: { reposts: Repost[] }) {
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  return (
    <div>
      <div className="flex items-baseline justify-between mb-4">
        <p className="text-[11px] uppercase tracking-[0.22em] text-white/55">
          Reel · {reposts.length} item{reposts.length === 1 ? "" : "s"}
        </p>
        <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">
          By recency · click to play · scroll / arrows to navigate
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {reposts.map((r, i) => (
          <motion.div
            key={r.id}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.55,
              delay: Math.min(i * 0.025, 0.5),
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            <RepostCard repost={r} onPlay={() => setPlayingIndex(i)} />
          </motion.div>
        ))}
      </div>
      <RepostPlayer
        reposts={reposts}
        index={playingIndex}
        onClose={() => setPlayingIndex(null)}
        onIndexChange={setPlayingIndex}
      />
    </div>
  );
}

function PartialBanner({ count }: { count: number }) {
  return (
    <div className="rounded-2xl border border-[#ff2d8a]/30 bg-[#ff2d8a]/[0.06] px-5 py-4 flex items-start gap-3">
      <TriangleAlert className="h-4 w-4 mt-0.5 flex-none text-[#ff2d8a]" />
      <div className="text-[13.5px] text-white/70 leading-[1.6]">
        <span className="text-white font-medium">Cut at the gate.</span>{" "}
        TikTok showed a captcha after the first batch of {count} items. Going
        further would need a paid captcha solver, a different product entirely.
      </div>
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
