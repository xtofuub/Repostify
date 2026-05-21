import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { scrapeReposts } from "@/lib/tiktok";
import { canonical, SITE_NAME } from "@/lib/seo";
import { PrintButton } from "./print-button";

const HANDLE_RE = /^[A-Za-z0-9._]{1,30}$/;

function normalize(raw: string): string {
  return decodeURIComponent(raw).replace(/^@/, "").trim().toLowerCase();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username: raw } = await params;
  const username = normalize(raw);
  return {
    title: `Receipt: @${username}'s reposts`,
    description: `A thermal-receipt printout of @${username}'s TikTok reposts.`,
    alternates: { canonical: canonical(`/u/${username}/receipt`) },
    robots: { index: false, follow: false },
  };
}

function pad(n: number, w: number): string {
  return String(n).padStart(w, "0");
}

function formatReceiptDate(d: Date): string {
  return (
    pad(d.getUTCFullYear(), 4) +
    "-" +
    pad(d.getUTCMonth() + 1, 2) +
    "-" +
    pad(d.getUTCDate(), 2) +
    "  " +
    pad(d.getUTCHours(), 2) +
    ":" +
    pad(d.getUTCMinutes(), 2) +
    ":" +
    pad(d.getUTCSeconds(), 2) +
    "Z"
  );
}

function txId(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) | 0;
  }
  return pad(Math.abs(h) % 999999, 6);
}

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username: raw } = await params;
  const username = normalize(raw);
  if (!HANDLE_RE.test(username)) notFound();

  let data: Awaited<ReturnType<typeof scrapeReposts>> | null = null;
  try {
    data = await scrapeReposts(username, { maxItems: 60 });
  } catch {
    /* fall through to no-data state below */
  }

  const reposts = data?.reposts ?? [];
  const profile = data?.profile ?? null;
  const issuedAt = new Date(data?.fetchedAt ?? Date.now());

  return (
    <div className="min-h-screen bg-[#0a0a0b] py-10 px-4 print:bg-white print:py-0">
      <div className="mx-auto w-full max-w-[28rem] print:max-w-none">
        {/* Header: nav back, print button. Hidden when printing. */}
        <div className="flex items-center justify-between mb-5 text-[12px] text-white/55 print:hidden">
          <Link
            href={`/u/${username}`}
            className="hover:text-white transition-colors"
          >
            ← Back to @{username}
          </Link>
          <PrintButton />
        </div>

        <article className="receipt-paper">
          <header className="text-center">
            <p className="font-mono text-[11px] tracking-[0.28em]">
              {SITE_NAME.toUpperCase()}
            </p>
            <p className="font-mono text-[10px] mt-1 opacity-70">
              repost ledger · public profile
            </p>
            <div className="my-3 dotted-rule" aria-hidden />
            <h1 className="font-mono text-[14px] tracking-tight">
              @{username}
            </h1>
            {profile && (
              <p className="font-mono text-[10px] mt-1 opacity-70">
                {profile.followers.toLocaleString()} followers ·{" "}
                {profile.following.toLocaleString()} following
              </p>
            )}
          </header>

          <div className="my-3 dotted-rule" aria-hidden />

          <p className="font-mono text-[10px] flex justify-between opacity-80">
            <span>ISSUED</span>
            <span>{formatReceiptDate(issuedAt)}</span>
          </p>
          <p className="font-mono text-[10px] flex justify-between opacity-80">
            <span>TX</span>
            <span>#{txId(`${username}-${issuedAt.toISOString().slice(0, 10)}`)}</span>
          </p>
          <p className="font-mono text-[10px] flex justify-between opacity-80">
            <span>ITEMS</span>
            <span>{reposts.length.toString().padStart(3, "0")}</span>
          </p>

          <div className="my-3 dotted-rule" aria-hidden />

          {reposts.length === 0 ? (
            <p className="font-mono text-[11px] text-center my-6 opacity-70">
              *** no public reposts ***
            </p>
          ) : (
            <ol className="space-y-3 font-mono text-[11px] leading-[1.4]">
              {reposts.map((r, i) => {
                const date = new Date((r.createTime || 0) * 1000);
                const dateStr = r.createTime
                  ? pad(date.getUTCFullYear() % 100, 2) +
                    pad(date.getUTCMonth() + 1, 2) +
                    pad(date.getUTCDate(), 2)
                  : "------";
                const cap = (r.desc || "").trim().replace(/\s+/g, " ");
                return (
                  <li key={r.id} className="flex flex-col">
                    <div className="flex justify-between gap-2">
                      <span>
                        <span className="opacity-60">{pad(i + 1, 2)}.</span>{" "}
                        @{r.author.uniqueId}
                      </span>
                      <span className="opacity-60 tabular-nums">
                        {dateStr}
                      </span>
                    </div>
                    {cap && (
                      <p className="pl-6 opacity-75 truncate-2">
                        {cap.length > 80 ? cap.slice(0, 78) + "…" : cap}
                      </p>
                    )}
                    <div className="pl-6 flex justify-between opacity-60 mt-0.5 text-[10px]">
                      <span>{r.stats.plays.toLocaleString()} plays</span>
                      <span>{r.stats.likes.toLocaleString()} likes</span>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}

          <div className="my-3 dotted-rule" aria-hidden />

          <footer className="text-center font-mono text-[10px] opacity-70 space-y-1">
            <p>thank you for stalking responsibly</p>
            <p>not affiliated with tiktok</p>
            <p className="opacity-60">{canonical(`/u/${username}`)}</p>
          </footer>
        </article>
      </div>

      <style>{`
        .receipt-paper {
          background: #f7f3ec;
          color: #1a1a1a;
          padding: 1.5rem 1.25rem;
          box-shadow:
            0 1px 0 rgba(255,255,255,0.04) inset,
            0 30px 80px rgba(0,0,0,0.45);
          border-radius: 4px;
          background-image:
            repeating-linear-gradient(
              0deg,
              rgba(0,0,0,0.025) 0,
              rgba(0,0,0,0.025) 1px,
              transparent 1px,
              transparent 3px
            );
        }
        .receipt-paper::before,
        .receipt-paper::after {
          content: "";
          display: block;
          height: 8px;
          background: radial-gradient(circle at 4px 4px, #0a0a0b 2px, transparent 2.5px);
          background-size: 8px 8px;
          background-position: 0 0;
          margin: -1.5rem -1.25rem 1rem;
        }
        .receipt-paper::after { margin: 1rem -1.25rem -1.5rem; }
        .dotted-rule {
          border-top: 1px dashed rgba(0,0,0,0.35);
        }
        .truncate-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        @media print {
          .receipt-paper {
            box-shadow: none;
            background: white;
          }
          .receipt-paper::before,
          .receipt-paper::after { display: none; }
        }
      `}</style>
    </div>
  );
}

