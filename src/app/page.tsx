import Link from "next/link";
import {
  ArrowUpRight,
  BookOpen,
  Info,
  Search,
  Settings,
  Users,
} from "lucide-react";
import {
  BackgroundVideo,
  GuideLines,
  LogoMark,
  SectionLabel,
} from "@/components/brand";
import { RepostSearch } from "@/components/repost-search";
import { TikTokConnect } from "@/components/tiktok-connect";
import { SITE_NAME, SITE_URL } from "@/lib/seo";

const FAQ_ITEMS = [
  {
    q: "Can I search someone's reposts by keyword?",
    a: "Yes. After a scan, search captions and hashtags for any word or phrase. You can keep multiple keyword filters active and switch exact matching on when needed.",
  },
  {
    q: "How many reposts can I load?",
    a: "Choose 30, 60, 120, 250, or All. Repostify follows TikTok's feed cursor until it reaches your limit or TikTok reports that no more items are available.",
  },
  {
    q: "Can it scan private or restricted profiles?",
    a: "Sometimes. Connect TikTok in the desktop app and Repostify will use that session. It still depends on what TikTok Web allows the signed-in account to view.",
  },
  {
    q: "Why did a scan return nothing?",
    a: "The reposts tab may be hidden, the profile may use audience controls, or TikTok may be rate-limiting the browser. Wait briefly, reconnect if needed, then scan again.",
  },
  {
    q: "Can I play videos and photo posts here?",
    a: "Yes. Repostify opens TikTok's native player first and provides a direct fallback for unavailable videos. Photo posts use an in-app slideshow with music when TikTok provides it.",
  },
  {
    q: "What does Repostify save?",
    a: "Successful scans use a 15-minute local JSON cache. A connected TikTok session also stays on your device. Both can be managed from Settings.",
  },
  {
    q: "Is this affiliated with TikTok?",
    a: "No. Repostify is an independent, read-only tool. It is not affiliated with or endorsed by TikTok or ByteDance.",
  },
];

function HomeJsonLd() {
  const data = [
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: SITE_NAME,
      url: SITE_URL,
      applicationCategory: "UtilityApplication",
      operatingSystem: "Any (web browser)",
      browserRequirements: "Requires JavaScript and a modern web browser",
      description:
        "Turn a visible TikTok repost feed into a searchable trail with keyword filters, playback, comparisons, stats, and creator insights.",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      featureList: [
        "View the reposts TikTok Web exposes for a profile",
        "Search repost captions and hashtags by keyword",
        "Compare two accounts and find shared reposts",
        "Play each repost video in-browser",
        "See aggregate plays, likes, comments, and shares",
        "Rank the most-amplified creators",
        "No login, no API key required",
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQ_ITEMS.map((it) => ({
        "@type": "Question",
        name: it.q,
        acceptedAnswer: { "@type": "Answer", text: it.a },
      })),
    },
  ];
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

const BG_VIDEO =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260508_064122_c4750c0e-7476-4b44-94a2-a85a65c63bf2.mp4";

export default function Home() {
  return (
    <div id="top" className="relative flex min-h-[100dvh] flex-col overflow-x-hidden">
      <BackgroundVideo src={BG_VIDEO} intensity="subtle" />
      <GuideLines />

      <HomeJsonLd />
      <div className="relative z-10 flex-1 flex flex-col">
        <Navbar />
        <main className="flex-1">
          <Hero />
          <FAQ />
          <FinalCTA />
        </main>
        <Footer />
      </div>
    </div>
  );
}

function Navbar() {
  return (
    <nav className="relative z-20">
      <div className="max-w-[78rem] mx-auto px-6 pt-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <LogoMark className="w-7 h-7" />
          <span className="text-[17px] tracking-tight font-semibold">
              Repostify
          </span>
        </Link>
        <div className="flex items-center gap-4 sm:gap-6">
          <Link
            href="/compare"
            className="inline-flex items-center gap-1.5 text-[12px] uppercase tracking-[0.22em] text-white hover:text-[#25f4ee] transition-colors"
          >
            <Users className="h-3.5 w-3.5" />
            Compare
          </Link>
          <a
            href="#faq"
            className="hidden sm:inline text-[12px] uppercase tracking-[0.22em] text-white/45 hover:text-white transition-colors"
          >
            FAQ
          </a>
          <span className="hidden md:inline">
            <TikTokConnect />
          </span>
          <Link
            href="/settings"
            className="inline-flex items-center gap-1.5 text-[12px] uppercase tracking-[0.18em] text-white/45 hover:text-white transition-colors"
          >
            <Settings className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Settings</span>
          </Link>
        </div>
      </div>
    </nav>
  );
}

function Hero() {
  return (
    <header className="relative pt-12 pb-16 md:pt-16 md:pb-20">
      <div className="max-w-[72rem] mx-auto px-6">
        <div className="text-center max-w-[44rem] mx-auto">
          <SectionLabel>Follow the repost trail</SectionLabel>
          <h1 className="mt-6 font-display text-[clamp(2.4rem,6vw,5rem)] leading-[0.95] tracking-[-0.02em]">
            Their{" "}
            <span className="inline-block pb-1 italic leading-[1.1] text-[#25f4ee]">
              reposts
            </span>{" "}
            tell on them.
          </h1>
          <p className="mt-5 max-w-[44ch] mx-auto text-[14.5px] leading-[1.65] text-white/65">
            Search a crush, an ex, or any creator. Filter visible reposts by
            keyword and see what keeps showing up.
          </p>
        </div>
        <div id="search" className="mt-9 scroll-mt-8">
          <RepostSearch />
        </div>
        <div className="mt-6 flex flex-col items-center gap-3">
          <Link
            href="/compare"
            className="group inline-flex h-10 items-center gap-2 rounded-lg border border-white/12 bg-white/[0.035] px-4 text-[13px] text-white/75 transition-colors hover:border-white/25 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
          >
            <Users className="h-4 w-4 text-[#25f4ee]" />
            Or compare two accounts
            <ArrowUpRight className="h-3.5 w-3.5 opacity-60 group-hover:opacity-100 transition-opacity" />
          </Link>
          <p className="max-w-[44rem] mx-auto text-center text-[12px] leading-[1.6] text-white/45">
            Public profiles work without login. Connect TikTok for profiles
            your account is allowed to view.
          </p>
        </div>
      </div>
    </header>
  );
}

function FAQ() {
  const items = FAQ_ITEMS;
  return (
    <section id="faq" className="relative scroll-mt-24 py-20 md:py-24">
      <div className="max-w-[72rem] mx-auto px-6">
        <div className="grid grid-cols-12 gap-x-6 gap-y-8 items-start">
          <div className="col-span-12 md:col-span-4">
            <SectionLabel>FAQ</SectionLabel>
            <h2 className="mt-6 font-display text-[clamp(2rem,4vw,3.25rem)] leading-[0.95] tracking-[-0.015em]">
              Questions before{" "}
              <span className="italic text-white/55">you scan.</span>
            </h2>
          </div>
          <div className="col-span-12 md:col-span-8 space-y-3">
            {items.map((it) => (
              <details
                key={it.q}
                className="rounded-xl border border-white/10 bg-white/[0.015] px-5 py-4 group open:bg-white/[0.03] open:border-white/20 transition-colors"
              >
                <summary className="flex items-center justify-between cursor-pointer list-none gap-4">
                  <span className="text-[15px] font-medium">{it.q}</span>
                  <span className="text-white/50 group-open:rotate-45 transition-transform text-xl leading-none flex-none">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-[14px] leading-[1.65] text-white/70 max-w-[68ch]">
                  {it.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="relative py-16 md:py-20">
      <div className="max-w-[72rem] mx-auto px-6">
        <div className="rounded-2xl border border-white/10 bg-[#0d0d0f]/90 px-6 py-10 text-center md:px-10 md:py-12">
          <h2 className="font-display text-[clamp(2rem,4vw,3.4rem)] leading-[1] tracking-[-0.02em]">
            Curious what they keep reposting?
          </h2>
          <p className="mx-auto mt-3 max-w-[38ch] text-[14px] leading-[1.6] text-white/55">
            Enter a handle, scan the visible feed, then search captions and
            hashtags for the clues you care about.
          </p>

          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="#search"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-white/80 bg-white px-5 text-[13px] font-semibold text-[#0a0a0b] transition-colors hover:bg-white/90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0b]"
            >
              <Search className="h-4 w-4" />
              Follow the trail
            </Link>

            <div className="flex items-center gap-2">
              <Link
                href="/guide"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/10 px-3 text-[12px] font-medium text-white/60 transition-colors hover:border-white/20 hover:bg-white/[0.04] hover:text-white"
              >
                <BookOpen className="h-3.5 w-3.5" />
                Guide
              </Link>
              <Link
                href="/about"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/10 px-3 text-[12px] font-medium text-white/60 transition-colors hover:border-white/20 hover:bg-white/[0.04] hover:text-white"
              >
                <Info className="h-3.5 w-3.5" />
                About
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="relative border-t border-white/8 mt-10">
      <div className="max-w-[78rem] mx-auto px-6 py-10 grid grid-cols-12 gap-x-6 gap-y-8">
        <div className="col-span-12 sm:col-span-6">
          <div className="flex items-center gap-2.5">
            <LogoMark className="w-6 h-6" />
            <span className="text-[15px] text-white/85 font-medium">
              Repostify
            </span>
          </div>
          <p className="mt-3 text-[13px] leading-[1.65] text-white/55 max-w-[42ch]">
            Search and compare visible TikTok repost trails. Repostify is
            read-only, and its short local cache can be cleared anytime.
          </p>
        </div>
        <nav className="col-span-12 sm:col-span-6 sm:text-right">
          <ul className="flex flex-wrap sm:justify-end gap-x-6 gap-y-2 text-[13px] text-white/70">
            <li>
              <Link href="/" className="hover:text-white transition-colors">
                Home
              </Link>
            </li>
            <li>
              <Link href="/compare" className="hover:text-white transition-colors">
                Compare
              </Link>
            </li>
            <li>
              <Link href="/guide" className="hover:text-white transition-colors">
                Guide
              </Link>
            </li>
            <li>
              <Link href="/about" className="hover:text-white transition-colors">
                About
              </Link>
            </li>
            <li>
              <Link
                href="/privacy"
                className="hover:text-white transition-colors"
              >
                Privacy
              </Link>
            </li>
            <li>
              <Link href="/settings" className="hover:text-white transition-colors">
                Settings
              </Link>
            </li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-white/8 py-5">
        <div className="max-w-[78rem] mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-white/40">
          <p>© {new Date().getFullYear()} Repostify</p>
          <p>Visible feeds only. Read-only by design.</p>
        </div>
      </div>
    </footer>
  );
}
