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
import { canonical, SITE_DESCRIPTION, SITE_NAME } from "@/lib/seo";

export const metadata: Metadata = {
  title: "About",
  description: `${SITE_NAME} is a small, read-only tool for viewing every repost on a public TikTok profile. ${SITE_DESCRIPTION}`,
  alternates: { canonical: canonical("/about") },
  openGraph: {
    title: `About · ${SITE_NAME}`,
    description:
      "Why Repostify exists, how it works under the hood, and what it does not do.",
    url: canonical("/about"),
  },
};

const BG =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260508_064122_c4750c0e-7476-4b44-94a2-a85a65c63bf2.mp4";

export default function AboutPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden">
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
          <SectionLabel>About</SectionLabel>
          <h1 className="mt-6 font-display text-[clamp(2.4rem,6vw,5rem)] leading-[0.95] tracking-[-0.02em]">
            A small tool for a{" "}
            <span className="italic text-[#25f4ee]">specific question.</span>
          </h1>

          <div className="mt-12 space-y-7 text-[15.5px] leading-[1.75] text-white/75 max-w-[68ch]">
            <p>
               Repostify is a one-page web utility that opens any public
              TikTok profile, walks its reposts tab, and lays every
              repost out as a clean grid you can play in the browser. It
              answers a narrow question: what does this account actually
              share with the audience it has built?
            </p>
            <p>
              The reposts feed exists on TikTok already. It is public on
              accounts that have not hidden it. But scrolling it by hand
              inside the app is slow, the videos auto-play one at a time,
              and there is no overview of who an account amplifies. This
              tool flattens the feed into a single grid, sums the engagement,
              ranks the most-amplified creators, and lets you click any cover
              to play it inline.
            </p>
            <h2 className="font-display text-[clamp(1.6rem,3vw,2.2rem)] leading-[1.05] tracking-[-0.015em] pt-6 text-white">
              How it works
            </h2>
            <p>
              A headless Chromium session loads the public profile page like
              any visitor, dismisses the cookie banner, clicks the reposts
              tab, and intercepts TikTok&apos;s own feed request as it goes
              over the wire. The data on screen here is the data the page
              would have shown a person scrolling. Public scans work without a
              TikTok account; the desktop app can optionally reuse a TikTok
              session for profiles that require login.
            </p>
            <p>
              Successful desktop scans are cached locally for 15 minutes so a
              repeat fetch is instant. The cache is plain JSON, not a native
              database, and can be cleared from Settings at any time.
            </p>
            <p>
              Images and thumbnails are hot-link protected on TikTok&apos;s
              CDN, so they are streamed through a server-side proxy that
              sets the right Referer header. Video playback uses TikTok&apos;s
              native embed first, with a direct local fallback when needed.
            </p>
            <h2 className="font-display text-[clamp(1.6rem,3vw,2.2rem)] leading-[1.05] tracking-[-0.015em] pt-6 text-white">
              What it does not do
            </h2>
            <p>
               Repostify captures the first batch of reposts that TikTok
              hands an anonymous visitor, which is roughly thirty items per
              profile per session. The moment TikTok throws a slider
              captcha, the tool stops. It does not solve captchas. It does
              not run a proxy farm. It does not log in with a fake account.
              If you need a continuous feed of every repost across millions
              of profiles, you need a paid service that pays a person to
              solve captchas all day, and that is a different product
              entirely.
            </p>
            <p>
              It also cannot read profiles whose reposts tab is set to
              private, which is the default on many accounts. That is a
              choice the creator made on TikTok itself, not a limitation of
              this tool.
            </p>
            <h2 className="font-display text-[clamp(1.6rem,3vw,2.2rem)] leading-[1.05] tracking-[-0.015em] pt-6 text-white">
              Who it is for
            </h2>
            <p>
              Anyone who watches what other people watch. Marketers checking
              what creators a brand-aligned account actually boosts.
              Researchers mapping taste graphs across handles. Independent
              creators studying what people they look up to keep returning
              to. Reposts are the rarest signal on the platform because
              they cost the most: when someone hits repost, they are
              telling their whole audience to watch this. That makes the
              repost feed a sharper read on a creator&apos;s taste than the
              follow graph or the like history.
            </p>
            <h2 className="font-display text-[clamp(1.6rem,3vw,2.2rem)] leading-[1.05] tracking-[-0.015em] pt-6 text-white">
              Affiliation
            </h2>
            <p>
               Repostify is an independent project. It is not affiliated
              with TikTok, ByteDance, or any of their products. It reads
              the same public page any visitor can reach.
            </p>
          </div>

          <div className="mt-14 pt-10 border-t border-white/10 flex flex-wrap items-center gap-4">
            <Link href="/">
              <PrimaryButton size="lg">
                Try the tool
                <ArrowUpRight className="ml-1 h-4 w-4" />
              </PrimaryButton>
            </Link>
            <Link
              href="/guide"
              className="text-[13px] uppercase tracking-[0.22em] text-white/55 hover:text-white transition-colors"
            >
              Read the guide
            </Link>
          </div>
        </main>
      </div>
    </div>
  );
}
