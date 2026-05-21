import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { scrapeReposts, type ScrapeResult } from "@/lib/tiktok";
import { canonical, SITE_NAME } from "@/lib/seo";
import { LogoMark } from "@/components/brand";

const HANDLE_RE = /^[A-Za-z0-9._]{1,30}$/;

function normalize(raw: string): string {
  return decodeURIComponent(raw).replace(/^@/, "").trim().toLowerCase();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ a: string; b: string }>;
}): Promise<Metadata> {
  const { a: ra, b: rb } = await params;
  const a = normalize(ra);
  const b = normalize(rb);
  return {
    title: `@${a} vs @${b}: repost twin score`,
    description: `Compare TikTok repost taste between @${a} and @${b}. See shared amplified creators and overlap score.`,
    alternates: { canonical: canonical(`/twin/${a}/${b}`) },
    robots: { index: false, follow: false },
  };
}

type Stats = {
  videoOverlap: number;
  creatorOverlap: number;
  sharedCreators: { handle: string; aCount: number; bCount: number }[];
  jaccardVideos: number;
  jaccardCreators: number;
  score: number;
  totalA: number;
  totalB: number;
};

function compare(a: ScrapeResult, b: ScrapeResult): Stats {
  const idsA = new Set(a.reposts.map((r) => r.id));
  const idsB = new Set(b.reposts.map((r) => r.id));
  let videoOverlap = 0;
  for (const id of idsA) if (idsB.has(id)) videoOverlap++;
  const creatorCount = (
    list: ScrapeResult["reposts"],
  ): Map<string, number> => {
    const m = new Map<string, number>();
    for (const r of list) {
      m.set(r.author.uniqueId, (m.get(r.author.uniqueId) ?? 0) + 1);
    }
    return m;
  };
  const cA = creatorCount(a.reposts);
  const cB = creatorCount(b.reposts);
  const sharedCreators: Stats["sharedCreators"] = [];
  for (const [h, ac] of cA) {
    const bc = cB.get(h);
    if (bc) sharedCreators.push({ handle: h, aCount: ac, bCount: bc });
  }
  sharedCreators.sort((x, y) => y.aCount + y.bCount - (x.aCount + x.bCount));
  const unionVideos = idsA.size + idsB.size - videoOverlap || 1;
  const unionCreators = new Set([...cA.keys(), ...cB.keys()]).size || 1;
  const jaccardVideos = videoOverlap / unionVideos;
  const jaccardCreators = sharedCreators.length / unionCreators;
  // Score: weighted blend, scaled to 0-100. Video overlap is the strongest
  // signal (same exact repost = direct shared taste). Creator overlap is
  // softer (same source, different videos).
  const score = Math.round(
    Math.min(
      100,
      jaccardVideos * 70 * 2 + jaccardCreators * 30 * 2,
    ),
  );
  return {
    videoOverlap,
    creatorOverlap: sharedCreators.length,
    sharedCreators,
    jaccardVideos,
    jaccardCreators,
    score,
    totalA: a.reposts.length,
    totalB: b.reposts.length,
  };
}

export default async function TwinPage({
  params,
}: {
  params: Promise<{ a: string; b: string }>;
}) {
  const { a: ra, b: rb } = await params;
  const aHandle = normalize(ra);
  const bHandle = normalize(rb);
  if (!HANDLE_RE.test(aHandle) || !HANDLE_RE.test(bHandle)) notFound();
  if (aHandle === bHandle) {
    return (
      <Centered>
        <p className="font-display text-2xl">Pick two different handles.</p>
        <Link
          href={`/u/${aHandle}`}
          className="mt-4 text-[13px] text-white/55 hover:text-white"
        >
          Back to @{aHandle}
        </Link>
      </Centered>
    );
  }

  let a: ScrapeResult | null = null;
  let b: ScrapeResult | null = null;
  let aErr: string | null = null;
  let bErr: string | null = null;
  // Scrape in parallel — both go through cloakbrowser's persistent context.
  await Promise.all([
    scrapeReposts(aHandle, { maxItems: 120 })
      .then((r) => (a = r))
      .catch((e) => (aErr = e?.message ?? "scrape failed")),
    scrapeReposts(bHandle, { maxItems: 120 })
      .then((r) => (b = r))
      .catch((e) => (bErr = e?.message ?? "scrape failed")),
  ]);

  if (!a || !b) {
    return (
      <Centered>
        <p className="font-display text-2xl">Couldn&apos;t compare.</p>
        <p className="mt-2 text-[13px] text-white/55 max-w-md">
          {aErr && <>@{aHandle}: {aErr}<br /></>}
          {bErr && <>@{bHandle}: {bErr}</>}
        </p>
        <Link
          href="/"
          className="mt-5 text-[13px] uppercase tracking-[0.18em] text-white/55 hover:text-white"
        >
          New search
        </Link>
      </Centered>
    );
  }

  const stats = compare(a, b);
  const verdict =
    stats.score >= 70
      ? "Same person, different account"
      : stats.score >= 45
        ? "Very aligned"
        : stats.score >= 25
          ? "Some overlap"
          : stats.score >= 10
            ? "Different orbits"
            : "Strangers";
  const scoreColor =
    stats.score >= 45
      ? "text-[#25f4ee]"
      : stats.score >= 20
        ? "text-white"
        : "text-white/60";

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white py-12 px-6">
      <div className="max-w-[64rem] mx-auto">
        <nav className="flex items-center justify-between mb-12">
          <Link href="/" className="flex items-center gap-2.5">
            <LogoMark className="w-7 h-7" />
            <span className="text-[17px] tracking-tight font-semibold">
              {SITE_NAME}
            </span>
          </Link>
          <Link
            href={`/u/${aHandle}`}
            className="text-[12px] uppercase tracking-[0.22em] text-white/55 hover:text-white transition-colors"
          >
            Back to @{aHandle}
          </Link>
        </nav>

        <header className="text-center mb-12">
          <p className="text-[11px] uppercase tracking-[0.22em] text-white/45">
            Repost twin
          </p>
          <h1 className="mt-5 font-display text-[clamp(2rem,5vw,4rem)] leading-[1] tracking-[-0.02em]">
            @{aHandle}{" "}
            <span className="italic text-white/40">vs</span>{" "}
            @{bHandle}
          </h1>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-6 items-stretch mb-10">
          <ProfileTile data={a} />
          <div className="flex md:flex-col items-center justify-center md:px-6">
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-[0.22em] text-white/40">
                Twin score
              </p>
              <p
                className={`font-display text-[clamp(4rem,9vw,7rem)] leading-[0.9] tracking-[-0.03em] ${scoreColor}`}
              >
                {stats.score}
              </p>
              <p className="text-[13px] text-white/70 max-w-[10rem]">
                {verdict}
              </p>
            </div>
          </div>
          <ProfileTile data={b} />
        </div>

        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
          <Stat label="Shared reposts" value={stats.videoOverlap.toString()} />
          <Stat
            label="Shared creators"
            value={stats.creatorOverlap.toString()}
          />
          <Stat
            label="Video Jaccard"
            value={`${(stats.jaccardVideos * 100).toFixed(1)}%`}
          />
          <Stat
            label="Creator Jaccard"
            value={`${(stats.jaccardCreators * 100).toFixed(1)}%`}
          />
        </section>

        {stats.sharedCreators.length > 0 ? (
          <section>
            <p className="text-[11px] uppercase tracking-[0.22em] text-white/55 mb-4">
              Creators they both amplify
            </p>
            <ul className="rounded-3xl border border-white/10 bg-white/[0.015] divide-y divide-white/8">
              {stats.sharedCreators.slice(0, 20).map((c) => (
                <li
                  key={c.handle}
                  className="flex items-center gap-4 px-5 sm:px-6 py-3.5"
                >
                  <span className="font-display text-[18px] flex-1 truncate">
                    <span className="text-white/40">@</span>
                    {c.handle}
                  </span>
                  <span className="text-[11px] uppercase tracking-[0.18em] text-white/45">
                    @{aHandle.slice(0, 8)}
                  </span>
                  <span className="font-display text-[18px] tnum w-8 text-right">
                    {c.aCount}
                  </span>
                  <span aria-hidden className="text-white/20">·</span>
                  <span className="text-[11px] uppercase tracking-[0.18em] text-white/45">
                    @{bHandle.slice(0, 8)}
                  </span>
                  <span className="font-display text-[18px] tnum w-8 text-right">
                    {c.bCount}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <p className="text-center text-[14px] text-white/55">
            No creators in common between these two feeds.
          </p>
        )}
      </div>
    </div>
  );
}

function ProfileTile({ data }: { data: ScrapeResult }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 text-center">
      {data.profile && (
        <p className="font-display text-[clamp(1.2rem,2.4vw,1.8rem)] tracking-tight truncate">
          {data.profile.nickname || `@${data.username}`}
        </p>
      )}
      <p className="text-[12px] text-white/45 mt-0.5">@{data.username}</p>
      <p className="mt-3 font-display text-[2.5rem] leading-none tnum">
        {data.reposts.length}
      </p>
      <p className="text-[11px] uppercase tracking-[0.22em] text-white/40 mt-1">
        reposts
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
      <p className="text-[10px] uppercase tracking-[0.22em] text-white/45">
        {label}
      </p>
      <p className="mt-1 font-display text-[1.8rem] leading-none tnum">
        {value}
      </p>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white flex items-center justify-center p-6">
      <div className="text-center">{children}</div>
    </div>
  );
}
