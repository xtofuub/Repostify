import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, Settings } from "lucide-react";
import {
  LogoMark,
} from "@/components/brand";
import { CompareSearch } from "@/components/compare-search";
import { canonical, SITE_NAME } from "@/lib/seo";

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
      ? `See which visible TikTok reposts appeared in both @${a} and @${b}'s scans.`
      : "Paste two TikTok handles to compare their visible repost feeds and find shared results.";
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
    <div className="flex min-h-[100dvh] flex-col bg-[#08080a] text-white">
      <div className="border-b border-white/[0.07] bg-[#08080a]/95">
        <nav className="mx-auto flex h-16 w-full max-w-[72rem] items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <LogoMark className="h-7 w-7" />
            <span className="text-[16px] font-semibold tracking-tight">
              Repostify
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.025] px-3 text-[12px] font-medium text-white/60 transition-colors hover:border-white/20 hover:bg-white/[0.055] hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.8} />
              Single search
            </Link>
            <Link
              href="/settings"
              aria-label="Settings"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.025] text-white/45 transition-colors hover:border-white/20 hover:bg-white/[0.055] hover:text-white"
            >
              <Settings className="h-4 w-4" strokeWidth={1.8} />
            </Link>
          </div>
        </nav>
      </div>

      <main className="mx-auto w-full max-w-[68rem] flex-1 px-4 pb-16 pt-10 sm:px-6 sm:pt-14">
        <header className="max-w-[42rem]">
          <p className="text-[13px] font-medium text-[#25f4ee]">Compare repost trails</p>
          <h1 className="mt-3 font-display text-[clamp(2.35rem,5vw,4rem)] leading-[0.98] tracking-[-0.02em] text-white">
            See where their repost trails cross.
          </h1>
          <p className="mt-4 max-w-[54ch] text-[15px] leading-7 text-white/55">
            Compare two visible feeds and spot the exact videos both accounts reposted.
          </p>
        </header>

        <section className="mt-8">
          <CompareSearch initialA={a} initialB={b} />
        </section>
      </main>

      <footer className="border-t border-white/[0.07] py-6">
          <div className="mx-auto flex w-full max-w-[72rem] flex-col items-center justify-between gap-3 px-4 text-[11px] text-white/40 sm:flex-row sm:px-6">
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
              <Link href="/settings" className="hover:text-white transition-colors">
                Settings
              </Link>
            </div>
          </div>
      </footer>
    </div>
  );
}
