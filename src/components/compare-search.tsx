"use client";

import { useMemo, useState, type FormEvent } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import {
  AlertCircle,
  ArrowRight,
  Check,
  Loader2,
  Search,
  Users,
} from "lucide-react";
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
  const reduceMotion = useReducedMotion();

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
    <div className="space-y-10">
      <form
        onSubmit={onSubmit}
        className="overflow-hidden rounded-2xl border border-white/[0.09] bg-[#0d0d10] shadow-[0_24px_80px_rgba(0,0,0,0.24)]"
      >
        <div className="border-b border-white/[0.07] px-4 py-4 sm:px-5">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-white">
            Choose two accounts
          </h2>
          <p className="mt-1 text-[13px] leading-5 text-white/45">
            Enter the TikTok handles you want to compare.
          </p>
        </div>
        <div className="p-4 sm:p-5">
          <div className="grid items-end gap-3 md:grid-cols-[minmax(0,1fr)_2rem_minmax(0,1fr)]">
            <HandleInput
              value={aInput}
              onChange={setAInput}
              placeholder="first handle"
              label="First account"
            />
            <div className="hidden h-12 items-center justify-center pb-px text-[11px] font-semibold uppercase tracking-[0.12em] text-white/30 md:flex">
              vs
            </div>
            <HandleInput
              value={bInput}
              onChange={setBInput}
              placeholder="second handle"
              label="Second account"
            />
          </div>
          <div className="mt-4 flex flex-col gap-3 border-t border-white/[0.07] pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[12px] leading-5 text-white/40">
              Only reposts visible to your connected TikTok session can be matched.
            </p>
            <PrimaryButton
              type="submit"
              size="lg"
              className="w-full shrink-0 sm:w-auto"
              disabled={
                state.kind === "loading" || !aInput.trim() || !bInput.trim()
              }
            >
              {state.kind === "loading" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Scanning both
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Compare reposts
                </>
              )}
            </PrimaryButton>
          </div>
        </div>
      </form>

      {state.kind === "idle" && <CompareNotes />}

      <AnimatePresence mode="wait">
        {state.kind === "loading" && (
          <motion.div
            key="loading"
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -12 }}
            transition={{ duration: reduceMotion ? 0 : 0.35, ease: [0.16, 1, 0.3, 1] }}
          >
            <LoadingState a={state.a} b={state.b} />
          </motion.div>
        )}

        {state.kind === "done" && intersection && (
          <motion.div
            key={`done-${state.a}-${state.b}`}
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.4, ease: [0.16, 1, 0.3, 1] }}
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
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <h2 className="text-[22px] font-semibold tracking-[-0.025em] text-white">
                      Shared reposts
                    </h2>
                    <p className="mt-1 text-[13px] text-white/45">
                      Videos found in both visible feeds.
                    </p>
                  </div>
                  <p className="text-[12px] font-medium text-white/45">
                    {formatCount(intersection.shared.length)} found
                  </p>
                </div>
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
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.3 }}
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
      <span className="mb-2 block text-[13px] font-medium text-white/65">
        {label}
      </span>
      <div className="flex h-12 overflow-hidden rounded-xl border border-white/10 bg-[#09090b] transition-colors focus-within:border-[#25f4ee]/50 focus-within:ring-2 focus-within:ring-[#25f4ee]/10">
        <span
          aria-hidden="true"
          className="grid h-full w-11 shrink-0 place-items-center border-r border-white/[0.07] pt-px text-[15px] font-medium leading-none text-white/40 select-none"
        >
          @
        </span>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/^@+/, ""))}
          placeholder={placeholder}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          aria-label={label}
          className="h-full min-w-0 flex-1 bg-transparent px-3 pb-0 pt-px text-[15px] leading-normal text-white outline-none placeholder:text-white/25"
        />
      </div>
    </label>
  );
}

function CompareNotes() {
  const notes = [
    "Both feeds scan at the same time",
    "Videos match by their TikTok ID",
    "Shared posts open in the normal viewer",
  ];

  return (
    <div className="grid gap-3 border-t border-white/[0.07] pt-5 sm:grid-cols-3">
      {notes.map((note) => (
        <div key={note} className="flex items-start gap-2.5 text-[12px] leading-5 text-white/45">
          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#25f4ee]" strokeWidth={2} />
          <span>{note}</span>
        </div>
      ))}
    </div>
  );
}

function LoadingState({ a, b }: { a: string; b: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.09] bg-[#0d0d10]">
      <div className="flex flex-col gap-3 border-b border-white/[0.07] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[14px] font-medium text-white">Scanning both feeds</p>
          <div className="mt-1 flex items-center text-[12px] text-white/45">
            <span>@{a}</span>
            <ArrowRight className="mx-2 h-3 w-3" strokeWidth={1.8} />
            <span>@{b}</span>
          </div>
        </div>
        <p className="text-[12px] text-white/35">Large feeds can take a few minutes.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 sm:p-5 md:grid-cols-5">
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
    <div className="grid overflow-hidden rounded-2xl border border-white/[0.09] bg-[#0d0d10] md:grid-cols-[1.1fr_1.9fr]">
      <div className="border-b border-white/[0.07] bg-[#25f4ee]/[0.045] p-5 md:border-b-0 md:border-r">
        <p className="text-[12px] font-medium text-[#25f4ee]/80">Shared reposts</p>
        <p className="mt-2 text-[38px] font-semibold leading-none tracking-[-0.04em] text-white tnum">
          {formatCount(sharedCount)}
        </p>
        <p className="mt-3 text-[12px] leading-5 text-white/40">
          Exact video matches across both scans.
        </p>
      </div>
      <div className="grid grid-cols-3 divide-x divide-white/[0.07]">
        <StatTile label={`@${a}`} value={formatCount(aTotal)} sub="visible reposts" />
        <StatTile label={`@${b}`} value={formatCount(bTotal)} sub="visible reposts" />
        <StatTile label="Overlap" value={`${pct}%`} sub={`of ${formatCount(denom)}`} />
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="min-w-0 px-3 py-5 sm:px-5">
      <p className="truncate text-[11px] font-medium text-white/45">
        {label}
      </p>
      <p className="mt-2 text-[22px] font-semibold tracking-[-0.025em] text-white tnum sm:text-[26px]">
        {value}
      </p>
      {sub && <p className="mt-1 truncate text-[10px] text-white/35 sm:text-[11px]">{sub}</p>}
    </div>
  );
}

function EmptyOverlap({ a, b }: { a: string; b: string }) {
  return (
    <div className="mx-auto max-w-2xl rounded-2xl border border-white/[0.09] bg-[#0d0d10] p-8 text-center sm:p-10">
      <div className="mx-auto grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.035]">
        <Users className="h-4.5 w-4.5 text-white/50" strokeWidth={1.8} />
      </div>
      <h2 className="mt-4 text-[22px] font-semibold tracking-[-0.025em]">No shared reposts</h2>
      <p className="mx-auto mt-3 max-w-md text-[14px] leading-6 text-white/50">
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
    <div className="mx-auto max-w-2xl space-y-4 rounded-2xl border border-white/[0.09] bg-[#0d0d10] p-8 text-center">
      <div className="mx-auto grid h-10 w-10 place-items-center rounded-xl border border-red-400/15 bg-red-400/[0.05]">
        <AlertCircle className="h-4.5 w-4.5 text-red-300/70" strokeWidth={1.8} />
      </div>
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
