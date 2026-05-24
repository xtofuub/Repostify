import Link from "next/link";
import type { Metadata } from "next";
import {
  BackgroundVideo,
  GuideLines,
  LogoMark,
  SectionLabel,
} from "@/components/brand";
import { CompareSearch } from "@/components/compare-search";
import { canonical, SITE_NAME } from "@/lib/seo";

const BG =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260508_064122_c4750c0e-7476-4b44-94a2-a85a65c63bf2.mp4";

const HANDLE_RE = /^[A-Za-z0-9._]{1,30}$/;

function normalize(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const v = raw.replace(/^@/, "").trim().toLowerCase();
  return HANDLE_RE.test(v) ? v : undefined;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; b?: string }>;
}): Promise<Metadata> {
  const { a: rawA, b: rawB } = await searchParams;
  const a = normalize(rawA);
  const b = normalize(rawB);
  const title =
    a && b
      ? `@${a} vs @${b}: shared TikTok reposts`
      : "Compare two TikTok accounts";
  const description =
    a && b
      ? `See which TikTok videos both @${a} and @${b} reposted. Side-by-side overlap, shared repost grid, and percent agreement.`
      : "Paste two TikTok handles to see which videos both accounts reposted. Reveals shared taste, follow circles, and amplification overlap.";
  return {
    title,
    description,
    alternates: {
      canonical: canonical(a && b ? `/compare?a=${a}&b=${b}` : "/compare"),
    },
    openGraph: {
      title: `${title} · ${SITE_NAME}`,
      description,
      url: canonical("/compare"),
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} · ${SITE_NAME}`,
      description,
    },
  };
}

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; b?: string }>;
}) {
  const { a: rawA, b: rawB } = await searchParams;
  const a = normalize(rawA);
  const b = normalize(rawB);

  return (
    <div className="relative min-h-screen overflow-x-hidden flex flex-col">
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
            Single search
          </Link>
        </nav>

        <main className="flex-1">
          <header className="relative pt-10 pb-10 md:pt-14 md:pb-12">
            <div className="aurora absolute inset-x-0 top-0 h-[520px] -z-[1]" />
            <div className="max-w-[72rem] mx-auto px-6 text-center">
              <SectionLabel>Compare two TikTok accounts</SectionLabel>
              <h1 className="mt-5 font-display text-[clamp(2.2rem,5.5vw,4.5rem)] leading-[0.95] tracking-[-0.02em]">
                Two handles.{" "}
                <span className="italic text-[#25f4ee]">Shared reposts.</span>
              </h1>
              <p className="mt-5 max-w-[48ch] mx-auto text-[14px] leading-[1.65] text-white/60">
                Paste two TikTok handles. We scrape both repost feeds in
                parallel and surface every video both accounts reposted.
              </p>
            </div>
            <div className="max-w-[60rem] mx-auto px-6 mt-10">
              <CompareSearch initialA={a} initialB={b} />
            </div>
          </header>
        </main>

        <footer className="border-t border-white/8 py-6 mt-10">
          <div className="max-w-[78rem] mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-white/40">
            <p>© {new Date().getFullYear()} Repostify</p>
            <div className="flex gap-5">
              <Link href="/" className="hover:text-white transition-colors">
                Home
              </Link>
              <Link href="/guide" className="hover:text-white transition-colors">
                Guide
              </Link>
              <Link href="/about" className="hover:text-white transition-colors">
                About
              </Link>
              <Link href="/privacy" className="hover:text-white transition-colors">
                Privacy
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
