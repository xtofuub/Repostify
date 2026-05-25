import Link from "next/link";
import { ArrowUpRight, Users } from "lucide-react";
import {
  BackgroundVideo,
  GuideLines,
  LogoMark,
  PrimaryButton,
  SectionLabel,
} from "@/components/brand";
import { RepostSearch } from "@/components/repost-search";
import { TikTokConnect } from "@/components/tiktok-connect";
import { SITE_NAME, SITE_URL } from "@/lib/seo";

const FAQ_ITEMS = [
  {
    q: "How many reposts does it pull?",
    a: "Every public repost on the profile. TikTok paginates the reposts feed roughly 30 items at a time, and we walk every page until the server signals no more. Big feeds (hundreds of items) finish in one to three minutes; small ones in under a minute.",
  },
  {
    q: "Can I play the videos here?",
    a: "Yes. Click any cover in the grid. The video opens in a player overlay. Press ESC or click outside to close.",
  },
  {
    q: "Do I need a TikTok account?",
    a: "No. The scraper walks the public profile page like any visitor would. Nothing is logged in, nothing is stored.",
  },
  {
    q: "The result was empty. What happened?",
    a: "Most profiles keep their reposts tab private. That is on the creator, not us. Try a public account like @khaby.lame or @mrbeast.",
  },
  {
    q: "Is this affiliated with TikTok?",
    a: "No. Repostify is an independent tool that reads the same public page you can. Not affiliated with or endorsed by TikTok.",
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
        "Open any public TikTok profile, walk the reposts tab, and view every repost as a playable grid with stats, top creators, and a recency-sorted reel.",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      featureList: [
        "View every repost on a public TikTok profile",
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
    <div id="top" className="relative min-h-screen overflow-x-hidden flex flex-col">
      <BackgroundVideo src={BG_VIDEO} />
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
        <a href="/" className="flex items-center gap-2.5 group">
          <LogoMark className="w-7 h-7" />
          <span className="text-[17px] tracking-tight font-semibold">
              Repostify
          </span>
        </a>
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
          <a
            href="https://www.tiktok.com/"
            target="_blank"
            rel="noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 text-[12px] uppercase tracking-[0.22em] text-white/45 hover:text-white transition-colors"
          >
            On TikTok
            <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </nav>
  );
}

function Hero() {
  return (
    <header className="relative pt-12 pb-16 md:pt-16 md:pb-20">
      <div className="aurora absolute inset-x-0 top-0 h-[640px] -z-[1]" />
      <div className="max-w-[72rem] mx-auto px-6">
        <div className="text-center max-w-[44rem] mx-auto">
          <SectionLabel>TikTok repost viewer</SectionLabel>
          <h1 className="mt-6 font-display text-[clamp(2.4rem,6vw,5rem)] leading-[0.95] tracking-[-0.02em]">
            Every repost on a{" "}
            <span className="italic text-[#25f4ee]">profile</span>,
            <br />
            playable here.
          </h1>
          <p className="mt-5 max-w-[44ch] mx-auto text-[14.5px] leading-[1.65] text-white/65">
            Paste a TikTok handle. We open the public profile, click the
            reposts tab, and load every repost into a clean grid you can play
            in-browser.
          </p>
        </div>
        <div className="mt-9">
          <RepostSearch />
        </div>
        <div className="mt-6 flex flex-col items-center gap-3">
          <Link
            href="/compare"
            className="group inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-5 py-2.5 text-[13px] text-white/85 hover:text-white hover:border-white/30 hover:bg-white/[0.08] transition-colors"
          >
            <Users className="h-4 w-4 text-[#25f4ee]" />
            Or compare two accounts
            <ArrowUpRight className="h-3.5 w-3.5 opacity-60 group-hover:opacity-100 transition-opacity" />
          </Link>
          <p className="max-w-[44rem] mx-auto text-center text-[12px] leading-[1.6] text-white/45">
            Public profiles only. No login. An empty result means the
            profile&apos;s reposts tab is set to private.
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
              Things people ask{" "}
              <span className="italic text-white/55">before paste.</span>
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
    <section className="relative py-20 md:py-28">
      <div className="max-w-[72rem] mx-auto px-6">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02] px-8 py-16 md:px-16 md:py-20 text-center">
          <div className="aurora absolute inset-0 -z-[1]" />
          <SectionLabel>Try another handle</SectionLabel>
          <h2 className="mt-5 font-display text-[clamp(2.2rem,5.5vw,4.5rem)] leading-[0.95] tracking-[-0.025em]">
            One more profile.{" "}
            <span className="italic text-[#25f4ee]">One more reel.</span>
          </h2>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <a href="#top">
              <PrimaryButton size="lg">
                Back to search
                <ArrowUpRight className="ml-1 h-4 w-4" />
              </PrimaryButton>
            </a>
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
            A read-only tool for viewing public TikTok reposts. No login, no
            API key, nothing stored.
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
          </ul>
        </nav>
      </div>
      <div className="border-t border-white/8 py-5">
        <div className="max-w-[78rem] mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-white/40">
          <p>© {new Date().getFullYear()} Repostify</p>
          <p className="tracking-[0.18em] uppercase">
            v1.0 · public profiles only
          </p>
        </div>
      </div>
    </footer>
  );
}
