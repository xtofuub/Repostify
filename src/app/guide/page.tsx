import Link from "next/link";
import type { Metadata } from "next";
import { ArrowUpRight } from "lucide-react";
import {
  BackgroundVideo,
  GuideLines,
  LogoMark,
  PrimaryButton,
  SectionLabel,
} from "@/components/brand";
import { canonical, POPULAR_HANDLES, SITE_NAME } from "@/lib/seo";

export const metadata: Metadata = {
  title: "How to see TikTok reposts on any profile",
  description:
    "A practical guide to viewing every repost on a public TikTok profile. What the reposts tab is, why some are hidden, how to read the data, and the limits of anonymous scraping.",
  alternates: { canonical: canonical("/guide") },
  openGraph: {
    title: `How to see TikTok reposts · ${SITE_NAME}`,
    description:
      "Practical guide to viewing every repost on a public TikTok profile.",
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
    headline: "How to see TikTok reposts on any profile",
    description:
      "A practical guide to viewing every repost on a public TikTok profile.",
    author: { "@type": "Organization", name: SITE_NAME },
    publisher: { "@type": "Organization", name: SITE_NAME },
    mainEntityOfPage: canonical("/guide"),
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
            How to see TikTok reposts{" "}
            <span className="italic text-[#25f4ee]">on any profile.</span>
          </h1>
          <p className="mt-6 text-[15.5px] text-white/65 max-w-[60ch]">
            Updated for the 2026 TikTok web layout. Covers the reposts tab,
            the private-by-default switch, the captcha cap on anonymous
            scrolling, and how to read the engagement numbers on a repost
            feed.
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
              TikTok lets users hide their reposts tab from public view.
              The toggle lives under Privacy in the app settings. The
              default behavior has shifted over time, and a sizable
              fraction of creators have flipped the toggle to private
              after the analytics ecosystem started reading their tab. If
              you load a profile and the Reposts tab is missing, the
              account has hidden it. There is no way around that without
               a logged-in connection to the account, which Repostify
              does not use.
            </p>
            <p>
              In that case, try a different handle. Larger entertainment
              and culture accounts often keep their reposts public because
              the reposts themselves are part of the persona. Smaller
              private creators frequently hide it.
            </p>

            <h2 className="font-display text-[clamp(1.6rem,3vw,2.2rem)] leading-[1.05] tracking-[-0.015em] pt-6 text-white">
               How Repostify captures the feed
            </h2>
            <p>
               Repostify loads the public profile in a real, headless
              Chromium browser. It dismisses the cookie banner, locates
              the Reposts tab, clicks it, and listens to the network for
              the feed request TikTok itself fires when you switch tabs.
              That request returns a JSON payload with the video data the
              tab is about to render. The tool reads that payload directly
              instead of scraping the rendered HTML, which makes the
              extraction stable across UI updates.
            </p>
            <p>
              Every cover image and avatar then routes through a
              server-side image proxy that sets the right Referer header,
              because TikTok&apos;s CDN refuses requests that look like
              hot-linking. Videos play through TikTok&apos;s own public
              embed player, which means the engagement counters on the
              player itself stay live and click through to the original
              page.
            </p>

            <h2 className="font-display text-[clamp(1.6rem,3vw,2.2rem)] leading-[1.05] tracking-[-0.015em] pt-6 text-white">
              The thirty-item cap
            </h2>
            <p>
              The hardest limit you will hit is the captcha gate. The
              moment an anonymous session asks for a second page of
               reposts, TikTok throws a slider puzzle. Repostify reads
              the first batch, which TikTok hands over without a fight,
              and stops. That batch is typically twenty-eight to thirty-
              two items depending on the account. The result page tells
              you when this happened so the partial-batch state is never
              silent.
            </p>
            <p>
              For most use cases the first batch is enough. It is the
              freshest layer of the repost feed and shows the current
              direction of the account. If you need everything an account
              has ever reposted, you need a service that solves captchas,
              and that is a paid product class.
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
              numbers sum across every repost in the batch: total plays
              across reposts, total likes, total comments, total shares,
              and the count of unique creators referenced. The aggregate
              gives you the center of gravity of the batch in one glance.
              An account with five reposts that pull a hundred million
              plays each has a different profile than an account with
              thirty reposts averaging a few thousand plays.
            </p>
            <p>
               Then comes the most-amplified creators chart. Repostify
              counts how often each creator shows up across the repost
              batch and ranks them. This is usually the most revealing
              part of the page. A profile that reposts ten different
              videos from the same friend reads completely differently
              from one that distributes its reposts evenly across thirty
              unrelated creators. Click any handle in the ranking to
              open that creator on TikTok directly.
            </p>
            <p>
              The bottom of the page is the reel itself: every visible
              repost as a 9:16 thumbnail. Click any cover to open the
              video in the in-browser player. The player closes on ESC or
              on a click outside the frame.
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
              they have been licensed to track. For a read of any single
              public profile in seconds, the lightweight scraper is
              usually the faster path.
            </p>

            <h2 className="font-display text-[clamp(1.6rem,3vw,2.2rem)] leading-[1.05] tracking-[-0.015em] pt-6 text-white">
              Try it
            </h2>
            <p>
              Start with a handle whose reposts tab is publicly open. A
              few that consistently work:
            </p>
            <ul className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[14px]">
              {POPULAR_HANDLES.map((h) => (
                <li key={h}>
                  <Link
                    href={`/u/${h}`}
                    className="block rounded-lg border border-white/10 bg-white/[0.015] hover:bg-white/[0.04] hover:border-white/25 transition-colors px-3 py-2"
                  >
                    <span className="text-white/45">@</span>
                    {h}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-14 pt-10 border-t border-white/10 flex flex-wrap items-center gap-4">
            <Link href="/">
              <PrimaryButton size="lg">
                Open the analyzer
                <ArrowUpRight className="ml-1 h-4 w-4" />
              </PrimaryButton>
            </Link>
            <Link
              href="/about"
              className="text-[13px] uppercase tracking-[0.22em] text-white/55 hover:text-white transition-colors"
            >
              About the tool
            </Link>
          </div>
        </main>
      </div>
    </div>
  );
}
