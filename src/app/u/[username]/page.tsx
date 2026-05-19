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
import { canonical, SITE_NAME } from "@/lib/seo";

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
  const title = `@${username} TikTok reposts`;
  const description = `View every public repost on @${username}'s TikTok profile. Plays inline, stats per video, top creators amplified.`;
  return {
    title,
    description,
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
            <div className="max-w-[60rem] mx-auto px-6 text-[14px] leading-[1.7] text-white/65">
              <h2 className="font-display text-[clamp(1.4rem,2.8vw,2rem)] text-white tracking-[-0.015em]">
                About this page
              </h2>
              <p className="mt-4">
                This page lists every repost on{" "}
                <span className="text-white">
                  @{username}&apos;s
                </span>{" "}
                public TikTok profile that an anonymous visitor can see in
                a single session. The reposts feed is a curated playlist:
                videos the account chose to amplify to its own followers,
                rather than the account&apos;s own uploads.
              </p>
              <p className="mt-3">
                If the result above is empty, the profile&apos;s reposts
                tab is set to private. TikTok lets each user hide the tab
                from public view, and a lot of creators do. Try another
                handle from the{" "}
                <Link
                  href="/"
                  className="underline underline-offset-4 hover:text-white"
                >
                  home page
                </Link>{" "}
                or read the{" "}
                <Link
                  href="/guide"
                  className="underline underline-offset-4 hover:text-white"
                >
                  guide
                </Link>{" "}
                on how the reposts tab works.
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
