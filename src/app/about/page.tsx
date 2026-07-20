import Link from "next/link";
import type { Metadata } from "next";
import { BookOpen, Search } from "lucide-react";
import {
  BackgroundVideo,
  GuideLines,
  LogoMark,
  SectionLabel,
} from "@/components/brand";
import { canonical, SITE_DESCRIPTION, SITE_NAME } from "@/lib/seo";

export const metadata: Metadata = {
  title: "About",
  description: `${SITE_NAME} is a local-first, read-only tool for scanning the reposts TikTok Web exposes for a profile. ${SITE_DESCRIPTION}`,
  alternates: { canonical: canonical("/about") },
  openGraph: {
    title: `About | ${SITE_NAME}`,
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
            <span className="inline-block pb-1 italic leading-[1.1] text-[#25f4ee]">
              specific question.
            </span>
          </h1>

          <div className="mt-12 space-y-7 text-[15.5px] leading-[1.75] text-white/75 max-w-[68ch]">
            <p>
              Repostify is a local-first Windows app that opens a TikTok
              profile, scans the reposts TikTok Web exposes, and lays them
              out in a searchable grid. It answers a narrow question: what
              does this account choose to share?
            </p>
            <p>
              TikTok already has a reposts tab, but it is built for browsing
              one post at a time. Repostify turns that feed into an overview
              with filters, aggregate engagement, top amplified creators,
              exact original publish dates, and in-app playback.
            </p>
            <h2 className="font-display text-[clamp(1.6rem,3vw,2.2rem)] leading-[1.05] tracking-[-0.015em] pt-6 text-white">
              How it works
            </h2>
            <p>
              CloakBrowser loads the profile page, opens the Reposts tab, and
              captures TikTok Web&apos;s own feed response. Repostify follows the
              returned cursor until the selected limit is reached or TikTok
              reports that the feed is complete. No third-party repost API is
              involved.
            </p>
            <p>
              Public profiles usually work anonymously. The desktop app can
              optionally reuse a connected TikTok session for profiles the
              signed-in account is allowed to view. That session stays on the
              device.
            </p>
            <p>
              Successful scans are cached locally as JSON for 15 minutes, so
              repeating the same request is instant. The cache can be cleared
              from Settings at any time.
            </p>
            <h2 className="font-display text-[clamp(1.6rem,3vw,2.2rem)] leading-[1.05] tracking-[-0.015em] pt-6 text-white">
              What it does not do
            </h2>
            <p>
              Repostify does not bypass TikTok&apos;s access controls. A connected
              session helps only when TikTok Web exposes the profile to that
              account. Some private or audience-controlled profiles remain
              available only in TikTok&apos;s mobile app.
            </p>
            <p>
              TikTok may also interrupt a scan with a captcha, an empty feed,
              or a temporary rate limit. Repostify keeps any items already
              captured and reports a partial result. It does not solve
              captchas, use fake accounts, or run a proxy farm.
            </p>
            <h2 className="font-display text-[clamp(1.6rem,3vw,2.2rem)] leading-[1.05] tracking-[-0.015em] pt-6 text-white">
              Who it is for
            </h2>
            <p>
              Repostify is useful for people studying what an account chooses
              to amplify: creators reviewing their niche, researchers mapping
              public sharing patterns, and marketers checking which voices a
              public account repeatedly boosts.
            </p>
            <h2 className="font-display text-[clamp(1.6rem,3vw,2.2rem)] leading-[1.05] tracking-[-0.015em] pt-6 text-white">
              Affiliation
            </h2>
            <p>
              Repostify is an independent project. It is not affiliated
              with TikTok, ByteDance, or any of their products. It only reads
              what TikTok Web returns to the active browser session.
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
              href="/guide"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/10 px-3 text-[12px] font-medium text-white/60 transition-colors hover:border-white/20 hover:bg-white/[0.04] hover:text-white"
            >
              <BookOpen className="h-3.5 w-3.5" />
              Guide
            </Link>
          </div>
        </main>
      </div>
    </div>
  );
}
