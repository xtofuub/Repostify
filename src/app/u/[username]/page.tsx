import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  BackgroundVideo,
  GuideLines,
  LogoMark,
  SectionLabel,
} from "@/components/brand";
import { RepostSearch } from "@/components/repost-search";
import { canonical, POPULAR_HANDLES, SITE_NAME } from "@/lib/seo";

const BG =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260508_064122_c4750c0e-7476-4b44-94a2-a85a65c63bf2.mp4";

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
  if (!HANDLE_RE.test(username)) {
    return { title: "Invalid handle", robots: { index: false } };
  }
  const title = `See @${username}'s TikTok reposts`;
  const description = `View every public repost on @${username}'s TikTok profile. Free TikTok repost viewer — no login, no signup. Plays each video inline with stats per repost and top amplified creators.`;
  return {
    title,
    description,
    keywords: [
      `${username} tiktok reposts`,
      `${username} repost tab`,
      `see ${username} reposts`,
      `${username} tiktok analyzer`,
      "tiktok repost viewer",
      "see tiktok reposts",
      "tiktok reposts list",
    ],
    alternates: { canonical: canonical(`/u/${username}`) },
    openGraph: {
      title: `${title} · ${SITE_NAME}`,
      description,
      url: canonical(`/u/${username}`),
      type: "profile",
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} · ${SITE_NAME}`,
      description,
    },
  };
}

function HandleJsonLd({ username }: { username: string }) {
  const data = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: canonical("/"),
      },
      {
        "@type": "ListItem",
        position: 2,
        name: `@${username}`,
        item: canonical(`/u/${username}`),
      },
    ],
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export default async function HandlePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username: raw } = await params;
  const username = normalize(raw);
  if (!HANDLE_RE.test(username)) notFound();

  return (
    <div className="relative min-h-screen overflow-x-hidden flex flex-col">
      <HandleJsonLd username={username} />
      <BackgroundVideo src={BG} />
      <GuideLines />

      <div className="relative z-10 flex-1 flex flex-col">
        <nav className="max-w-[78rem] mx-auto w-full px-6 pt-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <LogoMark className="w-7 h-7" />
            <span className="text-[17px] tracking-tight font-semibold">
              Repostify
            </span>
          </Link>
          <Link
            href="/"
            className="text-[12px] uppercase tracking-[0.22em] text-white/55 hover:text-white transition-colors"
          >
            New search
          </Link>
        </nav>

        <main className="flex-1">
          <header className="relative pt-10 pb-10 md:pt-14 md:pb-12">
            <div className="aurora absolute inset-x-0 top-0 h-[520px] -z-[1]" />
            <div className="max-w-[72rem] mx-auto px-6 text-center">
              <SectionLabel>TikTok profile</SectionLabel>
              <h1 className="mt-5 font-display text-[clamp(2.2rem,5.5vw,4.5rem)] leading-[0.95] tracking-[-0.02em]">
                Reposts by{" "}
                <span className="italic text-[#25f4ee]">@{username}</span>
              </h1>
              <p className="mt-5 max-w-[44ch] mx-auto text-[14px] leading-[1.65] text-white/60">
                Loading the public profile, opening the reposts tab, and
                returning every visible repost as a playable grid.
              </p>
            </div>
            <div className="max-w-[72rem] mx-auto px-6 mt-8">
              <RepostSearch initialUsername={username} />
            </div>
          </header>

          <section className="py-12 md:py-16 border-t border-white/8">
            <div className="max-w-[60rem] mx-auto px-6 text-[14px] leading-[1.7] text-white/65 space-y-4">
              <h2 className="font-display text-[clamp(1.4rem,2.8vw,2rem)] text-white tracking-[-0.015em]">
                See @{username}&apos;s TikTok reposts
              </h2>
              <p>
                This page shows every public repost on{" "}
                <span className="text-white">
                  @{username}&apos;s
                </span>{" "}
                TikTok profile that an anonymous visitor can see in a single
                session. The reposts feed is a curated playlist: videos the
                account chose to amplify to its followers, rather than its own
                uploads. The list above is sorted by recency.
              </p>
              <p>
                Each repost card shows the original creator&apos;s handle,
                caption, duration, view count, likes, comments, and shares.
                Click any cover to play the video in an embedded TikTok
                player, then use the arrow keys, scroll wheel, or buttons to
                jump to the next or previous repost.
              </p>
              <h3 className="font-display text-[clamp(1.1rem,2vw,1.4rem)] text-white pt-4">
                Why is @{username}&apos;s reposts tab empty?
              </h3>
              <p>
                If the grid above is empty, one of three things is happening.
                Either the account hasn&apos;t reposted anything yet, or
                they&apos;ve flipped their reposts tab to private (a TikTok
                privacy setting hidden three menus deep), or TikTok served a
                generic &quot;Something went wrong&quot; panel for the tab.
                Switching accounts or trying again later usually clears the
                last case.
              </p>
              <h3 className="font-display text-[clamp(1.1rem,2vw,1.4rem)] text-white pt-4">
                How is this different from logging into TikTok?
              </h3>
              <p>
                Nothing on this page requires a TikTok account. We open the
                public profile, click the Reposts tab, and read the data that
                TikTok already shows to anonymous visitors. No login, no API
                key, no cookies stored. Read the{" "}
                <Link
                  href="/guide"
                  className="underline underline-offset-4 hover:text-white"
                >
                  full guide
                </Link>{" "}
                for the technical detail.
              </p>
            </div>
          </section>

          <section className="py-10 md:py-14 border-t border-white/8">
            <div className="max-w-[78rem] mx-auto px-6">
              <h2 className="font-display text-[clamp(1.4rem,2.8vw,2rem)] text-white tracking-[-0.015em]">
                More TikTok profiles to explore
              </h2>
              <p className="mt-3 text-[14px] text-white/55 max-w-[60ch]">
                Popular creators whose reposts tab is public. Each link runs a
                fresh scrape on that handle.
              </p>
              <ul className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                {POPULAR_HANDLES.filter((h) => h !== username)
                  .slice(0, 20)
                  .map((h) => (
                    <li key={h}>
                      <Link
                        href={`/u/${h}`}
                        className="block text-[13px] text-white/70 hover:text-white px-3 py-2 rounded-lg bg-white/[0.03] border border-white/8 hover:bg-white/[0.07] hover:border-white/15 transition-colors truncate"
                      >
                        <span className="text-white/40">@</span>
                        {h}
                      </Link>
                    </li>
                  ))}
              </ul>
              <p className="mt-6 text-[12px] text-white/45">
                Searching for someone else?{" "}
                <Link
                  href="/"
                  className="underline underline-offset-4 hover:text-white"
                >
                  Enter any TikTok handle on the home page
                </Link>
                .
              </p>
            </div>
          </section>
        </main>

        <footer className="border-t border-white/8 py-6">
          <div className="max-w-[78rem] mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-white/40">
            <p>© {new Date().getFullYear()} Repostify</p>
            <div className="flex gap-5">
              <Link
                href="/about"
                className="hover:text-white transition-colors"
              >
                About
              </Link>
              <Link
                href="/guide"
                className="hover:text-white transition-colors"
              >
                Guide
              </Link>
              <Link
                href="/privacy"
                className="hover:text-white transition-colors"
              >
                Privacy
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
