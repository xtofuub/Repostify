"use client";

import { useMemo, useState, type FormEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AlertCircle, ArrowRight, Loader2, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { RepostCard } from "@/components/repost-card";
import { RepostPlayer } from "@/components/repost-player";
import { PrimaryButton } from "@/components/brand";
import { Skeleton } from "@/components/ui/skeleton";
import type { Repost, ScrapeResult } from "@/lib/tiktok";
import { formatCount } from "@/lib/format";

const HANDLE_RE = /^[A-Za-z0-9._]{1,30}$/;

type SideResult = { kind: "ok"; data: ScrapeResult } | { kind: "error"; message: string };
type State =
  | { kind: "idle" }
  | { kind: "loading"; a: string; b: string }
  | { kind: "done"; a: string; b: string; sideA: SideResult; sideB: SideResult };

async function fetchOne(username: string, signal?: AbortSignal): Promise<SideResult> {
  try {
    const url = new URL("/api/reposts", window.location.origin);
    url.searchParams.set("username", username);
    url.searchParams.set("refresh", "1");
    const res = await fetch(url.toString(), { cache: "no-store", signal });
    const json = await res.json();
    if (!res.ok) return { kind: "error", message: json?.error ?? "Request failed" };
    return { kind: "ok", data: json as ScrapeResult };
  } catch (err) {
    return {
      kind: "error",
      message: err instanceof Error ? err.message : "Network error",
    };
  }
}

export function CompareSearch({
  initialA,
  initialB,
}: {
  initialA?: string;
  initialB?: string;
} = {}) {
  const [aInput, setAInput] = useState(initialA ?? "");
  const [bInput, setBInput] = useState(initialB ?? "");
  const [state, setState] = useState<State>({ kind: "idle" });
  const [playerIndex, setPlayerIndex] = useState<number | null>(null);

  async function run(rawA: string, rawB: string) {
    const a = rawA.replace(/^@/, "").trim();
    const b = rawB.replace(/^@/, "").trim();
    if (!a || !b) {
      toast.error("Enter both TikTok handles");
      return;
    }
    if (!HANDLE_RE.test(a) || !HANDLE_RE.test(b)) {
      toast.error("Invalid TikTok handle format");
      return;
    }
    if (a.toLowerCase() === b.toLowerCase()) {
      toast.error("Pick two different handles");
      return;
    }
    setState({ kind: "loading", a, b });
    const [sideA, sideB] = await Promise.all([fetchOne(a), fetchOne(b)]);
    setState({ kind: "done", a, b, sideA, sideB });
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    run(aInput, bInput);
  }

  const intersection = useMemo(() => {
    if (state.kind !== "done") return null;
    if (state.sideA.kind !== "ok" || state.sideB.kind !== "ok") return null;
    const aMap = new Map<string, Repost>();
    for (const r of state.sideA.data.reposts) aMap.set(r.id, r);
    const shared: Repost[] = [];
    for (const r of state.sideB.data.reposts) {
      if (aMap.has(r.id)) shared.push(r);
    }
    return {
      shared,
      aTotal: state.sideA.data.reposts.length,
      bTotal: state.sideB.data.reposts.length,
    };
  }, [state]);

  return (
    <div className="space-y-12">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <HandleInput
            value={aInput}
            onChange={setAInput}
            placeholder="first handle"
            label="Account A"
          />
          <HandleInput
            value={bInput}
            onChange={setBInput}
            placeholder="second handle"
            label="Account B"
          />
        </div>
        <div className="flex justify-center">
          <PrimaryButton
            type="submit"
            size="lg"
            disabled={state.kind === "loading"}
          >
            {state.kind === "loading" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Scraping both
              </>
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                Compare
              </>
            )}
          </PrimaryButton>
        </div>
      </form>

      <AnimatePresence mode="wait">
        {state.kind === "loading" && (
          <motion.div
            key="loading"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          >
            <LoadingState a={state.a} b={state.b} />
          </motion.div>
        )}

        {state.kind === "done" && intersection && (
          <motion.div
            key={`done-${state.a}-${state.b}`}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-10"
          >
            <CompareStats
              a={state.a}
              b={state.b}
              aTotal={intersection.aTotal}
              bTotal={intersection.bTotal}
              sharedCount={intersection.shared.length}
            />

            {intersection.shared.length > 0 ? (
              <section className="space-y-5">
                <h2 className="font-display text-[clamp(1.6rem,3vw,2.4rem)] tracking-[-0.015em]">
                  Reposted by both
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {intersection.shared.map((r, i) => (
                    <RepostCard
                      key={r.id}
                      repost={r}
                      onPlay={() => setPlayerIndex(i)}
                    />
                  ))}
                </div>
              </section>
            ) : (
              <EmptyOverlap a={state.a} b={state.b} />
            )}
          </motion.div>
        )}

        {state.kind === "done" && (state.sideA.kind === "error" || state.sideB.kind === "error") && (
          <motion.div
            key="err"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <SideErrors
              a={state.a}
              b={state.b}
              sideA={state.sideA}
              sideB={state.sideB}
              onRetry={() => run(state.a, state.b)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {playerIndex !== null && intersection && intersection.shared.length > 0 && (
        <RepostPlayer
          reposts={intersection.shared}
          index={playerIndex}
          onClose={() => setPlayerIndex(null)}
          onIndexChange={setPlayerIndex}
        />
      )}
    </div>
  );
}

function HandleInput({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string;
  onChange: (s: string) => void;
  placeholder: string;
  label: string;
}) {
  return (
    <label className="block">
      <span className="block text-[11px] uppercase tracking-[0.22em] text-white/45 mb-2">
        {label}
      </span>
      <div className="relative flex items-center h-12 rounded-full bg-white/[0.04] border border-white/12 focus-within:border-white/30 transition-colors">
        <span className="pl-4 pr-1 text-white/45 select-none">@</span>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/^@+/, ""))}
          placeholder={placeholder}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className="flex-1 bg-transparent outline-none text-[15px] pr-4 placeholder:text-white/30"
        />
      </div>
    </label>
  );
}

function LoadingState({ a, b }: { a: string; b: string }) {
  return (
    <div className="space-y-6">
      <div className="text-center text-white/65 text-[13px]">
        Scraping <span className="text-white">@{a}</span>
        <ArrowRight className="inline-block mx-2 h-3 w-3 text-white/40" />
        <span className="text-white">@{b}</span> in parallel. One to three minutes for large feeds.
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="aspect-[9/16] w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}

function CompareStats({
  a,
  b,
  aTotal,
  bTotal,
  sharedCount,
}: {
  a: string;
  b: string;
  aTotal: number;
  bTotal: number;
  sharedCount: number;
}) {
  const denom = Math.min(aTotal, bTotal);
  const pct = denom > 0 ? Math.round((sharedCount / denom) * 100) : 0;
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <StatTile label={`@${a} reposts`} value={formatCount(aTotal)} />
      <StatTile label={`@${b} reposts`} value={formatCount(bTotal)} />
      <StatTile
        label="Reposted by both"
        value={formatCount(sharedCount)}
        accent
      />
      <StatTile
        label="Overlap"
        value={`${pct}%`}
        sub={`of smaller feed (${formatCount(denom)})`}
      />
    </div>
  );
}

function StatTile({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border px-5 py-5 ${
        accent
          ? "border-[#25f4ee]/35 bg-[#25f4ee]/[0.06]"
          : "border-white/10 bg-white/[0.02]"
      }`}
    >
      <p className="text-[11px] uppercase tracking-[0.22em] text-white/50 truncate">
        {label}
      </p>
      <p
        className={`mt-2 font-display text-[clamp(1.6rem,2.6vw,2.2rem)] tracking-[-0.015em] tnum ${
          accent ? "text-[#25f4ee]" : "text-white"
        }`}
      >
        {value}
      </p>
      {sub && <p className="mt-1 text-[11px] text-white/45">{sub}</p>}
    </div>
  );
}

function EmptyOverlap({ a, b }: { a: string; b: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-10 max-w-2xl mx-auto text-center">
      <Users className="mx-auto h-8 w-8 text-white/45" />
      <h2 className="mt-4 font-display text-3xl tracking-tight">No shared reposts</h2>
      <p className="mt-3 text-[14px] text-white/65 leading-[1.65] max-w-md mx-auto">
        @{a} and @{b} did not repost any of the same videos within the visible
        feeds. Try comparing creators in the same niche.
      </p>
    </div>
  );
}

function SideErrors({
  a,
  b,
  sideA,
  sideB,
  onRetry,
}: {
  a: string;
  b: string;
  sideA: SideResult;
  sideB: SideResult;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-8 max-w-2xl mx-auto text-center space-y-4">
      <AlertCircle className="mx-auto h-8 w-8 text-white/55" />
      <div className="space-y-1 text-[14px]">
        {sideA.kind === "error" && (
          <p>
            <span className="text-white">@{a}</span>: {sideA.message}
          </p>
        )}
        {sideB.kind === "error" && (
          <p>
            <span className="text-white">@{b}</span>: {sideB.message}
          </p>
        )}
      </div>
      <PrimaryButton size="sm" onClick={onRetry}>
        Retry both
      </PrimaryButton>
    </div>
  );
}
