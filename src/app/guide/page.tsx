import Link from "next/link";
import type { Metadata } from "next";
import { Info, Search } from "lucide-react";
import {
  BackgroundVideo,
  GuideLines,
  LogoMark,
  SectionLabel,
} from "@/components/brand";
import { canonical, SITE_NAME } from "@/lib/seo";

export const metadata: Metadata = {
  title: "How to view TikTok reposts",
  description:
    "A practical guide to scanning visible TikTok reposts, using a connected session, choosing a fetch limit, and reading the result page.",
  alternates: { canonical: canonical("/guide") },
  openGraph: {
    title: `How to view TikTok reposts | ${SITE_NAME}`,
    description:
      "Scan visible TikTok reposts and understand the results.",
    url: canonical("/guide"),
    type: "article",
  },
};

const BG =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260508_064122_c4750c0e-7476-4b44-94a2-a85a65c63bf2.mp4";

function ArticleJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "How to view TikTok reposts",
    description:
      "A practical guide to scanning visible TikTok reposts and reading the results.",
    author: { "@type": "Organization", name: SITE_NAME },
    publisher: { "@type": "Organization", name: SITE_NAME },
    mainEntityOfPage: canonical("/guide"),
    datePublished: "2026-01-01",
    dateModified: new Date().toISOString().slice(0, 10),
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

function HowToJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "How to see someone's TikTok reposts",
    description:
      "Scan the reposts TikTok Web exposes for a profile, with an optional connected TikTok session in the desktop app.",
    totalTime: "PT1M",
    supply: [{ "@type": "HowToSupply", name: "A TikTok username" }],
    tool: [{ "@type": "HowToTool", name: "Repostify" }],
    step: [
      {
        "@type": "HowToStep",
        position: 1,
        name: "Open Repostify",
        text: "Open Repostify. Public profiles usually work without connecting TikTok.",
        url: canonical("/"),
      },
      {
        "@type": "HowToStep",
        position: 2,
        name: "Paste the TikTok username",
        text: "Type or paste the handle of the profile you want to view (without the @ symbol).",
      },
      {
        "@type": "HowToStep",
        position: 3,
        name: "Pick a fetch limit",
        text: "Choose 30, 60, 120, 250, or All. Repostify follows the feed until it reaches that limit or TikTok stops returning items.",
      },
      {
        "@type": "HowToStep",
        position: 4,
        name: "Hit Analyze",
        text: "The scraper opens the profile, clicks the Reposts tab, and returns every visible repost as a playable grid.",
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

export default function GuidePage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <ArticleJsonLd />
      <HowToJsonLd />
      <BackgroundVideo src={BG} />
      <GuideLines />
      <div className="relative z-10">
        <nav className="max-w-[78rem] mx-auto px-6 pt-6 flex items-center justify-between">
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
            Home
          </Link>
        </nav>

        <main className="max-w-[60rem] mx-auto px-6 pt-16 pb-24">
          <SectionLabel>Guide</SectionLabel>
          <h1 className="mt-6 font-display text-[clamp(2.4rem,6vw,5rem)] leading-[0.95] tracking-[-0.02em]">
            How to view TikTok{" "}
            <span className="inline-block pb-1 italic leading-[1.1] text-[#25f4ee]">
              reposts.
            </span>
          </h1>
          <p className="mt-6 text-[15.5px] text-white/65 max-w-[60ch]">
            Learn what Repostify can access, how fetch limits work, and what
            each part of the result page means.
          </p>

          <div className="mt-12 space-y-7 text-[15.5px] leading-[1.75] text-white/75 max-w-[68ch]">
            <h2 className="font-display text-[clamp(1.6rem,3vw,2.2rem)] leading-[1.05] tracking-[-0.015em] text-white">
              What is a TikTok repost?
            </h2>
            <p>
              A repost on TikTok is the same idea as a retweet on the older
              Twitter or a share on Instagram Stories. When a user hits the
              share button under a video and picks Repost, that video gets
              broadcast to their followers&apos; For You feed with a small
              ribbon attached saying who shared it. The video itself stays
              on the original creator&apos;s account. The repost is a
              pointer, not a copy.
            </p>
            <p>
              Reposts collect on the account that made them. Most public
              profiles have a Reposts tab visible alongside Videos, Liked,
              and Favorites. The tab shows every video that account has
              hit repost on, newest first. On the desktop web the tab sits
              under the bio. On the mobile app it sits in the same row of
              tabs once you scroll past the header.
            </p>

            <h2 className="font-display text-[clamp(1.6rem,3vw,2.2rem)] leading-[1.05] tracking-[-0.015em] pt-6 text-white">
              Why reposts matter more than likes
            </h2>
            <p>
              Likes on TikTok are a swipe-cost gesture. A user double-taps
              and keeps scrolling. The cost of a wrong like is zero, which
              is why typical like counts run an order of magnitude higher
              than repost counts. A repost is the opposite. When someone
              reposts a video, they are committing their feed real estate
              to it. Their entire follower base will see that video at the
              top of their For You queue with the reposter&apos;s handle
              attached.
            </p>
            <p>
              The signal you get from a reposts feed is therefore
              qualitatively different from a likes feed. Likes show you
              everything an account half-enjoyed on the way past. Reposts
              show you what an account actively wants to associate with
              its identity. For brand teams trying to understand who an
              influencer actually backs, or for researchers trying to map
              taste networks, the repost feed is the higher-density
              signal.
            </p>

            <h2 className="font-display text-[clamp(1.6rem,3vw,2.2rem)] leading-[1.05] tracking-[-0.015em] pt-6 text-white">
              Why some profiles have no reposts tab
            </h2>
            <p>
              TikTok lets users hide their reposts tab or restrict the whole
              profile with audience controls. Public scans cannot read a tab
              TikTok Web does not render.
            </p>
            <p>
              The desktop app can connect your TikTok account and reuse that
              session. This can unlock profiles the signed-in account is
              allowed to view, but only when TikTok Web exposes the feed.
              Some profiles remain available only in TikTok&apos;s mobile app.
            </p>

            <h2 className="font-display text-[clamp(1.6rem,3vw,2.2rem)] leading-[1.05] tracking-[-0.015em] pt-6 text-white">
              How Repostify captures the feed
            </h2>
            <p>
              Repostify loads the profile in CloakBrowser, opens the Reposts
              tab, and listens for the feed request TikTok Web makes. It then
              follows the returned cursor until your chosen limit is reached
              or TikTok reports that the feed is complete. No third-party
              repost API is involved.
            </p>
            <p>
              Covers and avatars pass through a local image proxy because
              TikTok&apos;s CDN blocks ordinary hot-linking. Videos use TikTok&apos;s
              native player first, with a direct fallback when the embed is
              unavailable.
            </p>

            <h2 className="font-display text-[clamp(1.6rem,3vw,2.2rem)] leading-[1.05] tracking-[-0.015em] pt-6 text-white">
              Fetch limits and partial scans
            </h2>
            <p>
              Choose 30, 60, 120, 250, or All before scanning. The All option
              keeps requesting pages until TikTok says there are no more
              reposts.
            </p>
            <p>
              TikTok can still interrupt a large scan with a captcha, an
              empty response, a rate limit, or a temporary error. Repostify
              keeps the items already captured and labels the result as
              partial instead of pretending the feed is complete.
            </p>

            <h2 className="font-display text-[clamp(1.6rem,3vw,2.2rem)] leading-[1.05] tracking-[-0.015em] pt-6 text-white">
              How to read the result page
            </h2>
            <p>
              At the top sits a profile snapshot with the avatar, nickname,
              verification badge, bio, follower count, following count,
              and total heart count. This is just the public header,
              repeated here so you can confirm you have the right account.
            </p>
            <p>
              Below the profile is a row of aggregate counters. The
              numbers sum across every repost returned by the scan: total plays
              across reposts, total likes, total comments, total shares,
              and the count of unique creators referenced. The aggregate
              gives you the center of gravity of the feed in one glance.
              An account with five reposts that pull a hundred million
              plays each has a different profile than an account with
              many reposts averaging a few thousand plays.
            </p>
            <p>
              Then comes the most-amplified creators chart. Repostify
              counts how often each creator shows up across the repost
              scan and ranks them. This is usually the most revealing
              part of the page. A profile that reposts ten different
              videos from the same friend reads completely differently
              from one that distributes its reposts across many unrelated
              creators. Click any handle in the ranking to
              open that creator on TikTok directly.
            </p>
            <p>
              The bottom of the page is the reel itself. Click a cover to
              open the player, view the original publish date and engagement,
              or move through the feed with Previous and Next.
            </p>

            <h2 className="font-display text-[clamp(1.6rem,3vw,2.2rem)] leading-[1.05] tracking-[-0.015em] pt-6 text-white">
              Other ways to see a TikTok repost
            </h2>
            <p>
              The native option is to open the TikTok app or the web
              client, navigate to the profile, and tap the Reposts tab.
              That is the source of truth. The tradeoff is that the
              native client is paginated, the video plays one at a time,
              there is no aggregate view, and there is no overview of
              creators most amplified. That is the workflow problem
              Repostify flattens.
            </p>
            <p>
              Third-party analytics platforms sometimes surface repost
              data, but they generally require a logged-in seat and a
              paid subscription, and they typically only include accounts
              they have been licensed to track. For a focused overview of one
              visible profile, Repostify is usually the faster path.
            </p>
          </div>

          <div className="mt-14 pt-10 border-t border-white/10 flex flex-wrap items-center gap-4">
            <Link
              href="/"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-white/80 bg-white px-5 text-[13px] font-semibold text-[#0a0a0b] transition-colors hover:bg-white/90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0b]"
            >
              <Search className="h-4 w-4" />
              Search a profile
            </Link>
            <Link
              href="/about"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/10 px-3 text-[12px] font-medium text-white/60 transition-colors hover:border-white/20 hover:bg-white/[0.04] hover:text-white"
            >
              <Info className="h-3.5 w-3.5" />
              About
            </Link>
          </div>
        </main>
      </div>
    </div>
  );
}
