"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Heart,
  MessageCircle,
  Share2,
  Play,
  ExternalLink,
  ChevronUp,
  ChevronDown,
  Volume2,
  VolumeX,
} from "lucide-react";
import type { Repost } from "@/lib/tiktok";
import { formatCount, formatRelativeTime } from "@/lib/format";

function proxied(url: string): string {
  if (!url) return "";
  return "/api/img?u=" + encodeURIComponent(url);
}

export function RepostPlayer({
  reposts,
  index,
  onClose,
  onIndexChange,
}: {
  reposts: Repost[];
  index: number | null;
  onClose: () => void;
  onIndexChange: (next: number) => void;
}) {
  const open = index !== null && index >= 0 && index < reposts.length;
  const repost = open ? reposts[index] : null;
  const wheelLockRef = useRef(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [muted, setMuted] = useState(true);

  // TikTok iframe player exposes a postMessage API. Spec:
  // https://developers.tiktok.com/doc/embed-player. Posting {type:"unMute"}
  // works only after the player signals onPlayerReady.
  const postToPlayer = useCallback((type: string, value?: unknown) => {
    iframeRef.current?.contentWindow?.postMessage(
      { type, value, "x-tiktok-player": true },
      "*",
    );
  }, []);

  // Listen for ready signal from the iframe, then unmute.
  useEffect(() => {
    if (!repost) return;
    const onMsg = (e: MessageEvent) => {
      if (!e.origin.endsWith("tiktok.com")) return;
      const data = typeof e.data === "string"
        ? (() => { try { return JSON.parse(e.data); } catch { return null; } })()
        : e.data;
      if (!data || typeof data !== "object") return;
      const t = (data as { type?: string }).type;
      if (t === "onPlayerReady" || t === "onPlayerReadyForUnMute" || t === "playerReady") {
        postToPlayer("unMute");
        setMuted(false);
      }
      if (t === "onMute") setMuted(Boolean((data as { value?: boolean }).value));
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [repost, postToPlayer]);

  // Belt-and-suspenders: also try unmuting on a short delay after load, in
  // case the player never fires onPlayerReady but is still accepting messages.
  useEffect(() => {
    if (!repost) return;
    const ids: number[] = [];
    [400, 900, 1600, 2500].forEach((delay) => {
      ids.push(window.setTimeout(() => postToPlayer("unMute"), delay));
    });
    return () => ids.forEach(clearTimeout);
  }, [repost?.id, postToPlayer]);

  const toggleMute = useCallback(() => {
    postToPlayer(muted ? "unMute" : "mute");
    setMuted((m) => !m);
  }, [muted, postToPlayer]);

  // Prefetch the iframe URL of the previous + next reposts. Browser warms
  // DNS, TLS, and (when allowed) the player HTML, so scroll-nav is faster.
  useEffect(() => {
    if (index === null) return;
    const neighbors: number[] = [index - 1, index + 1].filter(
      (i) => i >= 0 && i < reposts.length && i !== index,
    );
    const links: HTMLLinkElement[] = [];
    for (const i of neighbors) {
      const id = reposts[i]?.id;
      if (!id) continue;
      const href = `https://www.tiktok.com/player/v1/${id}?autoplay=1&loop=1&mute=0&music_info=0&description=0&rel=0&native_context_menu=0&closed_caption=1`;
      const link = document.createElement("link");
      link.rel = "prefetch";
      link.as = "document";
      link.href = href;
      link.crossOrigin = "anonymous";
      document.head.appendChild(link);
      links.push(link);
    }
    return () => {
      for (const l of links) l.remove();
    };
  }, [index, reposts]);

  const goPrev = () => {
    if (index === null) return;
    if (index > 0) onIndexChange(index - 1);
  };
  const goNext = () => {
    if (index === null) return;
    if (index < reposts.length - 1) onIndexChange(index + 1);
  };

  useEffect(() => {
    if (!repost) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowDown" || e.key === "ArrowRight" || e.key === "j") {
        e.preventDefault();
        goNext();
      }
      if (e.key === "ArrowUp" || e.key === "ArrowLeft" || e.key === "k") {
        e.preventDefault();
        goPrev();
      }
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repost, index]);

  function onWheel(e: React.WheelEvent) {
    const now = Date.now();
    if (now - wheelLockRef.current < 350) return;
    if (Math.abs(e.deltaY) < 25) return;
    wheelLockRef.current = now;
    if (e.deltaY > 0) goNext();
    else goPrev();
  }

  return (
    <AnimatePresence>
      {repost && (
        <motion.div
          key="player-root"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8"
          onWheel={onWheel}
        >
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-xl"
          />

          {/* Prev / Next floating buttons */}
          {index !== null && index > 0 && (
            <button
              type="button"
              aria-label="Previous repost"
              onClick={goPrev}
              className="absolute left-3 sm:left-8 top-1/2 -translate-y-1/2 z-20 h-12 w-12 rounded-full bg-black/60 border border-white/15 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/10 transition-colors"
            >
              <ChevronUp className="h-6 w-6" />
            </button>
          )}
          {index !== null && index < reposts.length - 1 && (
            <button
              type="button"
              aria-label="Next repost"
              onClick={goNext}
              className="absolute right-3 sm:right-8 top-1/2 -translate-y-1/2 z-20 h-12 w-12 rounded-full bg-black/60 border border-white/15 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/10 transition-colors"
            >
              <ChevronDown className="h-6 w-6" />
            </button>
          )}

          <motion.div
            key={`player-frame-${repost.id}`}
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 grid grid-cols-1 md:grid-cols-[auto_22rem] gap-4 max-h-[88vh]"
          >
            <div className="relative bg-black rounded-2xl overflow-hidden flex items-center justify-center w-[min(48vh,calc(88vh*9/16))] aspect-[9/16] max-h-[88vh]">
              {repost.id ? (
                <>
                  <iframe
                    ref={iframeRef}
                    key={repost.id}
                    src={`https://www.tiktok.com/player/v1/${repost.id}?autoplay=1&loop=1&mute=0&music_info=0&description=0&rel=0&native_context_menu=0&closed_caption=1`}
                    title={`Repost ${repost.id}`}
                    allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                    allowFullScreen
                    referrerPolicy="strict-origin-when-cross-origin"
                    className="h-full w-full border-0"
                    loading="eager"
                  />
                  <button
                    type="button"
                    onClick={toggleMute}
                    aria-label={muted ? "Unmute" : "Mute"}
                    className="absolute bottom-3 right-3 h-8 w-8 rounded-full bg-black/60 border border-white/15 backdrop-blur-md text-white/85 hover:text-white hover:bg-black/80 transition-colors flex items-center justify-center"
                  >
                    {muted ? (
                      <VolumeX className="h-3.5 w-3.5" />
                    ) : (
                      <Volume2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                </>
              ) : (
                <div className="flex flex-col items-center text-white/55 gap-2">
                  <Play className="h-10 w-10" />
                  <p className="text-[12px] uppercase tracking-[0.22em]">
                    Video unavailable
                  </p>
                </div>
              )}
            </div>

            <aside className="relative bg-[#0f0f10] border border-white/10 rounded-2xl p-5 sm:p-6 flex flex-col gap-5 w-full md:w-[22rem] overflow-y-auto max-h-[88vh]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-[0.22em] text-white/45 tnum">
                  {(index ?? 0) + 1} / {reposts.length}
                </span>
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex items-center justify-center h-9 w-9 rounded-full border border-white/15 bg-white/[0.04] hover:bg-white/[0.1] transition-colors cursor-pointer"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex items-center gap-3">
                {repost.author.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={proxied(repost.author.avatar)}
                    alt={`@${repost.author.uniqueId}`}
                    className="h-11 w-11 rounded-full object-cover border border-white/15"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="h-11 w-11 rounded-full bg-white/[0.05] border border-white/15 flex items-center justify-center text-[11px] font-display">
                    {repost.author.uniqueId.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-[18px] leading-tight">
                    {repost.author.nickname || repost.author.uniqueId}
                    {repost.author.verified && (
                      <span className="ml-1 text-[#25f4ee]">✓</span>
                    )}
                  </p>
                  <p className="text-[12px] text-white/55">
                    <span className="text-white/35">@</span>
                    {repost.author.uniqueId} ·{" "}
                    {formatRelativeTime(repost.createTime)}
                  </p>
                </div>
              </div>

              <p className="text-[14px] leading-[1.6] text-white/80 break-words">
                {repost.desc || (
                  <span className="text-white/45">No caption.</span>
                )}
              </p>

              {/* Repost timing. TikTok's anonymous endpoint usually does not
                  expose the exact repost timestamp. When it does, show it.
                  Otherwise fall back to feed position. */}
              <div className="flex items-center gap-2 text-[11.5px] text-white/50">
                {repost.repostedAt > 0 ? (
                  <>
                    <span className="h-1.5 w-1.5 rounded-full bg-[#25f4ee]" />
                    <span>
                      Reposted{" "}
                      <span className="text-white">
                        {formatRelativeTime(repost.repostedAt)}
                      </span>
                    </span>
                  </>
                ) : (
                  <>
                    <span className="h-1.5 w-1.5 rounded-full bg-white/30" />
                    <span>
                      Position{" "}
                      <span className="text-white/80 tnum">
                        #{(index ?? 0) + 1}
                      </span>{" "}
                      in their reposts
                    </span>
                  </>
                )}
              </div>

              <ul className="grid grid-cols-2 gap-3 text-[13px] text-white/65">
                <li className="flex items-center gap-2">
                  <Play className="h-3.5 w-3.5 text-white/45" />
                  <span className="tnum text-white">
                    {formatCount(repost.stats.plays)}
                  </span>
                  <span className="text-white/45">plays</span>
                </li>
                <li className="flex items-center gap-2">
                  <Heart className="h-3.5 w-3.5 text-white/45" />
                  <span className="tnum text-white">
                    {formatCount(repost.stats.likes)}
                  </span>
                  <span className="text-white/45">likes</span>
                </li>
                <li className="flex items-center gap-2">
                  <MessageCircle className="h-3.5 w-3.5 text-white/45" />
                  <span className="tnum text-white">
                    {formatCount(repost.stats.comments)}
                  </span>
                  <span className="text-white/45">comments</span>
                </li>
                <li className="flex items-center gap-2">
                  <Share2 className="h-3.5 w-3.5 text-white/45" />
                  <span className="tnum text-white">
                    {formatCount(repost.stats.shares)}
                  </span>
                  <span className="text-white/45">shares</span>
                </li>
              </ul>

              <div className="mt-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={goPrev}
                  disabled={index === null || index <= 0}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 text-[12px] uppercase tracking-[0.18em] text-white/65 hover:text-white border border-white/15 rounded-full py-2.5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                  Prev
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  disabled={index === null || index >= reposts.length - 1}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 text-[12px] uppercase tracking-[0.18em] text-white/65 hover:text-white border border-white/15 rounded-full py-2.5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Next
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </div>

              <a
                href={repost.webUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-1.5 text-[12px] uppercase tracking-[0.18em] text-white/55 hover:text-white border border-white/15 rounded-full py-2.5 transition-colors"
              >
                Open on TikTok
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </aside>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
