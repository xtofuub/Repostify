"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  X,
  Heart,
  MessageCircle,
  Share2,
  Play,
  ExternalLink,
} from "lucide-react";
import type { Repost } from "@/lib/tiktok";
import {
  formatCount,
  formatDuration,
  formatRelativeTime,
  isObservedRepost,
  msToRelative,
} from "@/lib/format";

function proxied(url: string): string {
  if (!url) return "";
  return "/api/img?u=" + encodeURIComponent(url);
}

function proxiedMedia(url: string, postUrl?: string): string {
  if (!url) return "";
  const params = new URLSearchParams({ u: url });
  if (postUrl) params.set("o", postUrl);
  return `/api/video?${params.toString()}`;
}

function formatEngagement(repost: Repost): string {
  if (repost.stats.plays <= 0) return "N/A";
  const interactions =
    repost.stats.likes + repost.stats.comments + repost.stats.shares;
  const percentage = (interactions / repost.stats.plays) * 100;
  return `${percentage >= 10 ? percentage.toFixed(0) : percentage.toFixed(1)}%`;
}

function formatPostedDate(unixSec: number): string {
  if (unixSec <= 0) return "N/A";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(unixSec * 1000));
}

// v5 clears the old forced-photo-mute state. TikTok's photo embed exposes its
// native controls but does not attach the post's music URL, so Repostify plays
// that URL invisibly and mirrors the native controls onto it.
const TIKTOK_VOLUME_KEY = "repostify:tiktok-volume-v5";
const DEFAULT_TIKTOK_VOLUME = 20;

type StoredTikTokVolume = {
  volume: number;
  muted: boolean;
};

function readTikTokVolume(): StoredTikTokVolume {
  if (typeof window === "undefined") {
    return { volume: DEFAULT_TIKTOK_VOLUME, muted: false };
  }
  try {
    const stored = JSON.parse(
      window.localStorage.getItem(TIKTOK_VOLUME_KEY) ?? "null",
    ) as Partial<StoredTikTokVolume> | null;
    const volume = Math.max(
      0,
      Math.min(100, Number(stored?.volume ?? DEFAULT_TIKTOK_VOLUME)),
    );
    return {
      volume: Number.isFinite(volume) ? volume : DEFAULT_TIKTOK_VOLUME,
      muted: Boolean(stored?.muted),
    };
  } catch {
    return { volume: DEFAULT_TIKTOK_VOLUME, muted: false };
  }
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
  const wheelGestureRef = useRef(false);
  const wheelResetRef = useRef<number | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const photoAudioRef = useRef<HTMLAudioElement>(null);
  const tiktokVolumeRef = useRef<StoredTikTokVolume>(readTikTokVolume());
  const restoringTikTokVolumeRef = useRef(true);
  const tiktokRestoreTimersRef = useRef<number[]>([]);
  const [photoState, setPhotoState] = useState({ repostId: "", index: 0 });
  const [customPlayerId, setCustomPlayerId] = useState<string | null>(null);
  const [tiktokStatus, setTikTokStatus] = useState({
    repostId: "",
    attempt: 0,
    ready: false,
  });
  const imageUrls = repost?.imageUrls ?? [];
  const isPhoto = imageUrls.length > 0;
  const photoIndex = photoState.repostId === repostId ? photoState.index : 0;
  const tiktokAttempt =
    tiktokStatus.repostId === repostId ? tiktokStatus.attempt : 0;
  const tiktokReady =
    tiktokStatus.repostId === repostId && tiktokStatus.ready;
  const photoMusicUrl = isPhoto && repost?.musicUrl ? repost.musicUrl : "";
  const closePlayer = useCallback(() => {
    setCustomPlayerId(null);
    onClose();
  }, [onClose]);

  const syncPhotoAudio = useCallback((next: StoredTikTokVolume) => {
    const audio = photoAudioRef.current;
    if (!audio) return;
    audio.volume = Math.max(0, Math.min(1, next.volume / 100));
    audio.muted = next.muted || next.volume <= 0;
  }, []);

  const persistTikTokVolume = useCallback((next: StoredTikTokVolume) => {
    tiktokVolumeRef.current = next;
    syncPhotoAudio(next);
    try {
      window.localStorage.setItem(TIKTOK_VOLUME_KEY, JSON.stringify(next));
    } catch {}
  }, [syncPhotoAudio]);

  const restoreTikTokPlayer = useCallback((target: Window | null) => {
    tiktokRestoreTimersRef.current.forEach(window.clearTimeout);
    tiktokRestoreTimersRef.current = [];
    restoringTikTokVolumeRef.current = true;
    [100, 500, 1_500].forEach((delay) => {
      tiktokRestoreTimersRef.current.push(
        window.setTimeout(() => {
          const saved = tiktokVolumeRef.current;
          target?.postMessage(
            { type: "setVolume", value: saved.volume, "x-tiktok-player": true },
            "*",
          );
          target?.postMessage(
            {
              type: saved.muted ? "mute" : "unMute",
              value: undefined,
              "x-tiktok-player": true,
            },
            "*",
          );
          restoringTikTokVolumeRef.current = false;
          target?.postMessage(
            { type: "play", value: undefined, "x-tiktok-player": true },
            "*",
          );
        }, delay),
      );
    });
  }, []);

  useEffect(
    () => () => {
      tiktokRestoreTimersRef.current.forEach(window.clearTimeout);
    },
    [],
  );

  useEffect(() => {
    const audio = photoAudioRef.current;
    if (!audio || !photoMusicUrl) return;

    syncPhotoAudio(tiktokVolumeRef.current);
    void audio.play().catch(() => {});

    const resume = () => {
      syncPhotoAudio(tiktokVolumeRef.current);
      void audio.play().catch(() => {});
    };
    audio.addEventListener("canplay", resume);
    return () => {
      audio.removeEventListener("canplay", resume);
      audio.pause();
      audio.currentTime = 0;
    };
  }, [photoMusicUrl, repostId, syncPhotoAudio]);

  useEffect(() => {
    if (!repostId || customPlayerId === repostId) return;
    restoringTikTokVolumeRef.current = true;

    const onMessage = (event: MessageEvent) => {
      if (!event.origin.endsWith("tiktok.com")) return;
      const data =
        typeof event.data === "string"
          ? (() => {
              try {
                return JSON.parse(event.data) as { type?: string; value?: unknown };
              } catch {
                return null;
              }
            })()
          : (event.data as { type?: string; value?: unknown } | null);
      if (!data || typeof data !== "object") return;

      if (data.type === "onPlayerReady") {
        setTikTokStatus((current) =>
          current.repostId === repostId
            ? { ...current, ready: true }
            : { repostId, attempt: 0, ready: true },
        );
        restoreTikTokPlayer(iframeRef.current?.contentWindow ?? null);
        return;
      }

      if (data.type === "onVolumeChange") {
        if (restoringTikTokVolumeRef.current) return;
        const raw = Number(data.value);
        if (!Number.isFinite(raw)) return;
        const volume = Math.max(0, Math.min(100, raw));
        persistTikTokVolume({
          volume,
          muted: volume <= 0 || tiktokVolumeRef.current.muted,
        });
        return;
      }

      if (data.type === "onMute" && typeof data.value === "boolean") {
        if (restoringTikTokVolumeRef.current) return;
        persistTikTokVolume({
          ...tiktokVolumeRef.current,
          muted: data.value,
        });
      }
    };

    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
    };
  }, [
    customPlayerId,
    persistTikTokVolume,
    repostId,
    restoreTikTokPlayer,
  ]);

  useEffect(() => {
    if (!repostId || customPlayerId === repostId || tiktokReady) return;
    const timer = window.setTimeout(() => {
      if (tiktokAttempt === 0) {
        setTikTokStatus({ repostId, attempt: 1, ready: false });
      } else {
        setCustomPlayerId(repostId);
      }
    }, 7_000);
    return () => window.clearTimeout(timer);
  }, [customPlayerId, repostId, tiktokAttempt, tiktokReady]);

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

  const changePhoto = useCallback(
    (direction: -1 | 1) => {
      if (!repostId || imageUrls.length < 2) return;
      setPhotoState((current) => {
        const currentIndex = current.repostId === repostId ? current.index : 0;
        return {
          repostId,
          index:
            (currentIndex + direction + imageUrls.length) % imageUrls.length,
        };
      });
    },
    [imageUrls.length, repostId],
  );

  const goPrev = useCallback(() => {
    if (index === null) return;
    if (index > 0) {
      setCustomPlayerId(null);
      onIndexChange(index - 1);
    }
  }, [index, onIndexChange]);
  const goNext = useCallback(() => {
    if (index === null) return;
    if (index < reposts.length - 1) {
      setCustomPlayerId(null);
      onIndexChange(index + 1);
    }
  }, [index, onIndexChange, reposts.length]);

  const navigateWheel = useCallback(
    (deltaY: number) => {
      if (wheelResetRef.current !== null) {
        window.clearTimeout(wheelResetRef.current);
      }
      wheelResetRef.current = window.setTimeout(() => {
        wheelGestureRef.current = false;
        wheelResetRef.current = null;
      }, 180);
      if (wheelGestureRef.current || deltaY === 0) return;
      wheelGestureRef.current = true;
      if (deltaY > 0) goNext();
      else goPrev();
    },
    [goNext, goPrev],
  );

  useEffect(() => {
    if (!repostId) return;
    const onMessage = (event: MessageEvent) => {
      if (!event.origin.endsWith("tiktok.com")) return;
      const data = event.data as { type?: string; deltaY?: unknown } | null;
      if (data?.type === "repostify:player-wheel") {
        const deltaY = Number(data.deltaY);
        if (Number.isFinite(deltaY)) navigateWheel(deltaY);
        return;
      }
      if (data?.type === "repostify:player-denied") {
        if (tiktokAttempt === 0) {
          setTikTokStatus({ repostId, attempt: 1, ready: false });
        } else {
          setCustomPlayerId(repostId);
        }
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [navigateWheel, repostId, tiktokAttempt]);

  useEffect(() => {
    if (!repostId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePlayer();
      if (e.key === "ArrowRight") {
        e.preventDefault();
        if (isPhoto && imageUrls.length > 1) changePhoto(1);
        else goNext();
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (isPhoto && imageUrls.length > 1) changePhoto(-1);
        else goPrev();
        return;
      }
      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        goNext();
      }
      if (e.key === "ArrowUp" || e.key === "k") {
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
      if (wheelResetRef.current !== null) {
        window.clearTimeout(wheelResetRef.current);
      }
      wheelGestureRef.current = false;
      wheelResetRef.current = null;
    };
  }, [changePhoto, closePlayer, goNext, goPrev, imageUrls.length, isPhoto, repostId]);

  function onWheel(e: React.WheelEvent) {
    navigateWheel(e.deltaY);
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
            onClick={closePlayer}
            className="absolute inset-0 bg-black/80 backdrop-blur-xl"
          />

          <div
            className="relative z-10 grid max-h-[88vh] grid-cols-1 gap-4 md:grid-cols-[auto_22rem]"
          >
            <div className="relative flex aspect-[9/16] max-h-[88vh] w-[min(48vh,calc(88vh*9/16))] items-center justify-center overflow-hidden rounded-2xl bg-black">
              {repost.id && customPlayerId !== repost.id ? (
                <iframe
                  ref={iframeRef}
                  key={`tiktok-${repost.id}-${tiktokAttempt}`}
                  src={`https://www.tiktok.com/player/v1/${repost.id}?autoplay=1&loop=1&muted=0&controls=1&music_info=0&description=0&rel=0&native_context_menu=0&closed_caption=0&repostify_retry=${tiktokAttempt}`}
                  title={`TikTok player for repost ${repost.id}`}
                  allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                  className="h-full w-full border-0"
                  loading="eager"
                  onLoad={(event) =>
                    restoreTikTokPlayer(event.currentTarget.contentWindow)
                  }
                />
              ) : isPhoto ? (
                <div
                  className="relative h-full w-full overflow-hidden bg-black"
                  role="group"
                  aria-label={`Photo post by @${repost.author.uniqueId}`}
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
                    <>
                      <button
                        type="button"
                        onClick={() => changePhoto(-1)}
                        aria-label="Previous photo"
                        className="absolute left-3 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/65 text-white/85 transition-[background-color,transform] hover:bg-black/85 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                      >
                        <ArrowLeft className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => changePhoto(1)}
                        aria-label="Next photo"
                        className="absolute right-3 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/65 text-white/85 transition-[background-color,transform] hover:bg-black/85 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                      >
                        <ArrowRight className="h-4 w-4" />
                      </button>
                      <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-white/15 bg-black/60 px-2.5 py-1 text-[10px] tracking-[0.16em] text-white/75 backdrop-blur-md tnum">
                        {photoIndex + 1} / {imageUrls.length}
                      </span>
                    </>
                  )}
                </div>
              ) : repost.playUrl ? (
                <>
                  <video
                    key={`direct-${repost.id}`}
                    src={proxiedMedia(repost.playUrl, repost.webUrl)}
                    poster={repost.cover ? proxied(repost.cover) : undefined}
                    autoPlay
                    loop
                    playsInline
                    controls
                    preload="metadata"
                    onError={() => setCustomPlayerId(null)}
                    className="h-full w-full bg-black object-contain"
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
              {photoMusicUrl && (
                <audio
                  ref={photoAudioRef}
                  key={`photo-music-${repost.id}`}
                  src={proxiedMedia(photoMusicUrl, repost.webUrl)}
                  autoPlay
                  loop
                  playsInline
                  preload="auto"
                />
              )}
            </div>

            <aside className="relative flex max-h-[88vh] w-full flex-col gap-5 overflow-y-auto rounded-2xl border border-white/10 bg-[#0f0f10] p-5 sm:p-6 md:w-[22rem]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-[0.22em] text-white/45 tnum">
                  {(index ?? 0) + 1} / {reposts.length}
                </span>
                <button
                  type="button"
                  onClick={closePlayer}
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

              <dl className="grid grid-cols-3 divide-x divide-white/10 rounded-xl border border-white/10 bg-white/[0.025] py-3">
                <div className="px-3">
                  <dt className="text-[9px] uppercase tracking-[0.16em] text-white/35">
                    Length
                  </dt>
                  <dd className="mt-1 text-[12px] font-medium text-white tnum">
                    {isPhoto
                      ? `${imageUrls.length} photo${imageUrls.length === 1 ? "" : "s"}`
                      : repost.duration > 0
                        ? formatDuration(repost.duration)
                        : "N/A"}
                  </dd>
                </div>
                <div className="px-3">
                  <dt className="text-[9px] uppercase tracking-[0.16em] text-white/35">
                    Posted
                  </dt>
                  <dd className="mt-1 whitespace-nowrap text-[12px] font-medium text-white tnum">
                    {formatPostedDate(repost.createTime)}
                  </dd>
                </div>
                <div className="px-3">
                  <dt className="text-[9px] uppercase tracking-[0.16em] text-white/35">
                    Engagement
                  </dt>
                  <dd className="mt-1 text-[12px] font-medium text-white tnum">
                    {formatEngagement(repost)}
                  </dd>
                </div>
              </dl>

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

              <a
                href={repost.webUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-1.5 text-[12px] uppercase tracking-[0.18em] text-white/55 hover:text-white border border-white/15 rounded-full py-2.5 transition-colors"
              >
                Open on TikTok
                <ExternalLink className="h-3.5 w-3.5" />
              </a>

              {(isPhoto || repost.playUrl) && (
                <button
                  type="button"
                  onClick={() =>
                    setCustomPlayerId((current) =>
                      current === repost.id ? null : repost.id,
                    )
                  }
                  className="text-[11px] text-white/45 transition-colors hover:text-white"
                >
                  {customPlayerId === repost.id
                    ? "Use TikTok player"
                    : "Playback issue? Use fallback player"}
                </button>
              )}

              <div className="mt-auto grid grid-cols-2 overflow-hidden rounded-full border border-white/15 bg-white/[0.035]">
                <button
                  type="button"
                  onClick={goPrev}
                  disabled={index === null || index <= 0}
                  className="inline-flex h-11 items-center justify-center gap-2 px-3 text-[11px] font-medium uppercase tracking-[0.12em] text-white transition-[background-color,opacity] hover:bg-white/[0.08] active:bg-white/[0.12] disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Previous
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  disabled={index === null || index >= reposts.length - 1}
                  className="inline-flex h-11 items-center justify-center gap-2 border-l border-white/15 px-3 text-[11px] font-medium uppercase tracking-[0.12em] text-white transition-[background-color,opacity] hover:bg-white/[0.08] active:bg-white/[0.12] disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  Next
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </aside>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
