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
} from "lucide-react";
import type { Repost } from "@/lib/tiktok";
import {
  formatCount,
  formatRelativeTime,
  isObservedRepost,
  msToRelative,
} from "@/lib/format";

function proxied(url: string): string {
  if (!url) return "";
  return "/api/img?u=" + encodeURIComponent(url);
}

function proxiedMedia(url: string): string {
  if (!url) return "";
  return "/api/video?u=" + encodeURIComponent(url);
}

export function RepostPlayer({
  reposts,
  index,
  trackingSince,
  onClose,
  onIndexChange,
}: {
  reposts: Repost[];
  index: number | null;
  trackingSince?: number;
  onClose: () => void;
  onIndexChange: (next: number) => void;
}) {
  const open = index !== null && index >= 0 && index < reposts.length;
  const repost = open ? reposts[index] : null;
  const repostId = repost?.id ?? null;
  const observed = repost
    ? isObservedRepost({
        firstSeenAt: repost.firstSeenAt,
        trackingSince,
        feedPosition: repost.feedPosition,
      })
    : false;
  const wheelLockRef = useRef(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const photoAudioRef = useRef<HTMLAudioElement>(null);
  const [photoState, setPhotoState] = useState({ repostId: "", index: 0 });
  const imageUrls = repost?.imageUrls ?? [];
  const isPhoto = imageUrls.length > 0;
  const photoIndex = photoState.repostId === repostId ? photoState.index : 0;
  const photoMusicUrl =
    isPhoto && repost?.musicUrl ? repost.musicUrl : "";

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
    if (!repostId) return;
    const onMsg = (e: MessageEvent) => {
      if (!e.origin.endsWith("tiktok.com")) return;
      const data = typeof e.data === "string"
        ? (() => { try { return JSON.parse(e.data); } catch { return null; } })()
        : e.data;
      if (!data || typeof data !== "object") return;
      const t = (data as { type?: string }).type;
      if (t === "onPlayerReady" || t === "onPlayerReadyForUnMute" || t === "playerReady") {
        postToPlayer("unMute");
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [repostId, postToPlayer]);

  // TikTok's iframe renders photo slideshows but does not reliably start the
  // attached track. Play the exact music URL returned with the post. Opening
  // this modal is a user gesture, so Electron permits audible autoplay.
  useEffect(() => {
    const audio = photoAudioRef.current;
    if (!audio || !photoMusicUrl) return;
    audio.muted = false;
    audio.volume = 1;
    void audio.play().catch(() => {});
    return () => {
      audio.pause();
      audio.currentTime = 0;
    };
  }, [photoMusicUrl, repostId]);

  useEffect(() => {
    if (!isPhoto || imageUrls.length < 2) return;
    const id = window.setInterval(
      () =>
        setPhotoState((current) => ({
          repostId: repostId ?? "",
          index:
            ((current.repostId === repostId ? current.index : 0) + 1) %
            imageUrls.length,
        })),
      4_500,
    );
    return () => window.clearInterval(id);
  }, [imageUrls.length, isPhoto, repostId]);

  // Belt-and-suspenders: also try unmuting on a short delay after load, in
  // case the player never fires onPlayerReady but is still accepting messages.
  useEffect(() => {
    if (!repostId) return;
    const ids: number[] = [];
    [400, 900, 1600, 2500].forEach((delay) => {
      ids.push(window.setTimeout(() => postToPlayer("unMute"), delay));
    });
    return () => ids.forEach(clearTimeout);
  }, [repostId, postToPlayer]);

  const goPrev = useCallback(() => {
    if (index === null) return;
    if (index > 0) onIndexChange(index - 1);
  }, [index, onIndexChange]);
  const goNext = useCallback(() => {
    if (index === null) return;
    if (index < reposts.length - 1) onIndexChange(index + 1);
  }, [index, onIndexChange, reposts.length]);

  useEffect(() => {
    if (!repostId) return;
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
  }, [goNext, goPrev, onClose, repostId]);

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

          <motion.div
            key={`player-frame-${repost.id}`}
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 grid grid-cols-1 md:grid-cols-[auto_22rem] gap-4 max-h-[88vh]"
          >
            <div className="relative bg-black rounded-2xl overflow-hidden flex items-center justify-center w-[min(48vh,calc(88vh*9/16))] aspect-[9/16] max-h-[88vh]">
              {isPhoto ? (
                <button
                  type="button"
                  className="relative h-full w-full cursor-pointer overflow-hidden bg-black"
                  onClick={() =>
                    setPhotoState((current) => ({
                      repostId: repostId ?? "",
                      index:
                        imageUrls.length > 1
                          ? ((current.repostId === repostId
                              ? current.index
                              : 0) +
                              1) %
                            imageUrls.length
                          : 0,
                    }))
                  }
                  aria-label={
                    imageUrls.length > 1 ? "Show next photo" : "Photo post"
                  }
                >
                  <motion.img
                    key={`${repost.id}-photo-${photoIndex}`}
                    src={proxied(imageUrls[photoIndex] ?? imageUrls[0])}
                    alt={repost.desc || `Photo post by @${repost.author.uniqueId}`}
                    initial={{ opacity: 0.35, scale: 1.015 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className="h-full w-full object-contain"
                    referrerPolicy="no-referrer"
                  />
                  {imageUrls.length > 1 && (
                    <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-white/15 bg-black/60 px-2.5 py-1 text-[10px] tracking-[0.16em] text-white/75 backdrop-blur-md tnum">
                      {photoIndex + 1} / {imageUrls.length}
                    </span>
                  )}
                  {photoMusicUrl && (
                    <audio
                      ref={photoAudioRef}
                      key={`photo-music-${repost.id}`}
                      src={proxiedMedia(photoMusicUrl)}
                      autoPlay
                      loop
                      preload="auto"
                    />
                  )}
                </button>
              ) : repost.id ? (
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

              {/* Repost timing. TikTok never reports the repost timestamp on
                  the anonymous endpoint, so we degrade gracefully:
                  1. TikTok-reported repostedAt (rare) — exact.
                  2. Observed: first appeared at the head of the feed after we
                     began watching ≈ reposted then (bounded by scrape cadence).
                  3. Feed position — pure rank, no time. */}
              <div className="flex flex-col gap-1 text-[11.5px] text-white/50">
                {repost.repostedAt > 0 ? (
                  <span className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#25f4ee]" />
                    <span>
                      Reposted{" "}
                      <span className="text-white">
                        {formatRelativeTime(repost.repostedAt)}
                      </span>
                    </span>
                  </span>
                ) : observed ? (
                  <>
                    <span className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#25f4ee]" />
                      <span>
                        Reposted{" "}
                        <span className="text-white">
                          ~{msToRelative(repost.firstSeenAt!)}
                        </span>
                      </span>
                    </span>
                    <span className="pl-3.5 text-[10.5px] text-white/35">
                      first seen at the top of their feed — we don&apos;t get
                      TikTok&apos;s exact repost time
                    </span>
                  </>
                ) : (
                  <span className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-white/30" />
                    <span>
                      Position{" "}
                      <span className="text-white/80 tnum">
                        #{(repost.feedPosition ?? index ?? 0) + 1}
                      </span>{" "}
                      in their reposts
                    </span>
                  </span>
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
