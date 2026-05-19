import { ExternalLink, Heart, MessageCircle, Play, Share2 } from "lucide-react";
import type { Repost } from "@/lib/tiktok";
import { formatCount, formatDuration, formatRelativeTime } from "@/lib/format";

function proxied(url: string): string {
  if (!url) return "";
  return "/api/img?u=" + encodeURIComponent(url);
}

export function RepostCard({
  repost,
  onPlay,
}: {
  repost: Repost;
  onPlay: (repost: Repost) => void;
}) {
  return (
    <div className="group relative rounded-xl overflow-hidden border border-white/10 bg-white/[0.015] transition-[transform,border-color] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 hover:border-white/25">
      <button
        type="button"
        onClick={() => onPlay(repost)}
        className="relative block w-full text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#25f4ee]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0b]"
        aria-label={`Play repost by @${repost.author.uniqueId}`}
      >
        <div className="relative aspect-[9/16] overflow-hidden bg-black/40">
          {repost.cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={proxied(repost.cover)}
              alt={repost.desc.slice(0, 80) || `Repost ${repost.id}`}
              loading="lazy"
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04]"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.opacity = "0";
              }}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-white/45">
              <Play className="h-10 w-10" />
            </div>
          )}

          <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

          <div className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 text-[10px] tnum text-white uppercase tracking-wider">
            <Play className="h-2.5 w-2.5 fill-white text-white" />
            <span>{formatCount(repost.stats.plays)}</span>
          </div>
          {repost.duration > 0 && (
            <div className="absolute right-2.5 top-2.5 text-[10px] tnum text-white uppercase tracking-wider">
              {formatDuration(repost.duration)}
            </div>
          )}

          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="h-14 w-14 rounded-full bg-white/95 text-[#0a0a0b] inline-flex items-center justify-center shadow-[0_8px_24px_-6px_rgba(0,0,0,0.6)]">
              <Play className="h-6 w-6 fill-current ml-0.5" />
            </div>
          </div>

          <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center gap-2 text-white">
            <div className="relative h-7 w-7 flex-none">
              {repost.author.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={proxied(repost.author.avatar)}
                  alt={`@${repost.author.uniqueId}`}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  className="h-7 w-7 rounded-full object-cover bg-white/[0.05] border border-white/15"
                />
              ) : (
                <div className="h-7 w-7 rounded-full bg-white/[0.05] border border-white/15 flex items-center justify-center text-[10px] font-display">
                  {repost.author.uniqueId.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium leading-tight">
                <span className="text-white/55">@</span>
                {repost.author.uniqueId}
                {repost.author.verified && (
                  <span className="ml-1 text-[#25f4ee]">✓</span>
                )}
              </p>
              <p className="truncate text-[10px] uppercase tracking-wider text-white/55">
                {formatRelativeTime(repost.createTime)}
              </p>
            </div>
          </div>
        </div>

        <div className="px-3 py-3 space-y-2.5 border-t border-white/8">
          <p className="line-clamp-2 text-[13px] leading-[1.5] text-white/75 min-h-[2.6em]">
            {repost.desc || (
              <span className="text-white/40">No caption.</span>
            )}
          </p>
          <div className="flex items-center justify-between text-[11px] text-white/55 tnum">
            <span className="inline-flex items-center gap-1">
              <Heart className="h-3 w-3" />
              {formatCount(repost.stats.likes)}
            </span>
            <span className="inline-flex items-center gap-1">
              <MessageCircle className="h-3 w-3" />
              {formatCount(repost.stats.comments)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Share2 className="h-3 w-3" />
              {formatCount(repost.stats.shares)}
            </span>
          </div>
        </div>
      </button>

      <a
        href={repost.webUrl}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="absolute top-2.5 right-10 inline-flex items-center justify-center h-7 w-7 rounded-full bg-black/55 backdrop-blur-md text-white/80 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label="Open on TikTok"
      >
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}
