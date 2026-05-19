import Link from "next/link";
import type { Metadata } from "next";
import {
  BackgroundVideo,
  GuideLines,
  LogoMark,
  SectionLabel,
} from "@/components/brand";
import { canonical, SITE_NAME } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Privacy",
  description: `${SITE_NAME} does not log in to TikTok, does not store user data, and does not require an account. This page documents what the tool does and does not collect.`,
  alternates: { canonical: canonical("/privacy") },
};

const BG =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260508_064122_c4750c0e-7476-4b44-94a2-a85a65c63bf2.mp4";

export default function PrivacyPage() {
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

        <main className="max-w-[56rem] mx-auto px-6 pt-16 pb-24">
          <SectionLabel>Privacy</SectionLabel>
          <h1 className="mt-6 font-display text-[clamp(2rem,5vw,4rem)] leading-[0.95] tracking-[-0.02em]">
            What we collect.{" "}
            <span className="italic text-white/55">Almost nothing.</span>
          </h1>

          <div className="mt-12 space-y-6 text-[15px] leading-[1.7] text-white/75 max-w-[64ch]">
            <h2 className="font-display text-[clamp(1.4rem,2.6vw,2rem)] text-white">
              Accounts
            </h2>
            <p>
               Repostify has no user accounts. There is no sign-up, no
              login, no password. You use the tool by typing a TikTok
              handle into the search box on the home page.
            </p>

            <h2 className="font-display text-[clamp(1.4rem,2.6vw,2rem)] pt-4 text-white">
              What gets sent to our server
            </h2>
            <p>
              When you search a handle, your browser sends the handle to
              our server, which uses it to load the public TikTok profile
              in a headless browser and read the reposts feed. We do not
              link that handle to your IP address or any persistent
              identifier in any database. Standard web server logs may
              capture your request line and IP for short-term debugging
              and abuse prevention.
            </p>

            <h2 className="font-display text-[clamp(1.4rem,2.6vw,2rem)] pt-4 text-white">
              What gets stored
            </h2>
            <p>
              Nothing about you, the user. We do not store search history,
              we do not store the handles you have looked up, and we do
              not store the contents of any repost feed across sessions.
              Each search opens a fresh browser session against TikTok and
              the data lives only in the response that comes back to your
              browser.
            </p>

            <h2 className="font-display text-[clamp(1.4rem,2.6vw,2rem)] pt-4 text-white">
              Third parties
            </h2>
            <p>
              Video playback uses TikTok&apos;s own embed iframe, which
              loads from tiktok.com. That iframe runs TikTok&apos;s own
              tracking inside its own context, which is governed by their
              privacy policy. We have no access to anything inside the
              iframe.
            </p>

            <h2 className="font-display text-[clamp(1.4rem,2.6vw,2rem)] pt-4 text-white">
              Cookies
            </h2>
            <p>
               Repostify itself does not set any cookies. Your browser
              may receive cookies from third parties (the embedded TikTok
              player, the CDN serving fonts) when content from those
              parties loads.
            </p>

            <h2 className="font-display text-[clamp(1.4rem,2.6vw,2rem)] pt-4 text-white">
              Changes
            </h2>
            <p>
              If the privacy posture of the tool changes, this page will
              be updated. The site is small and the policy is small for
              the same reason: the surface area is intentionally narrow.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
