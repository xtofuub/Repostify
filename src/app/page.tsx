import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import {
  BackgroundVideo,
  GuideLines,
  LogoMark,
  PrimaryButton,
  SectionLabel,
} from "@/components/brand";
import { RepostSearch } from "@/components/repost-search";
import { POPULAR_HANDLES, SITE_NAME, SITE_URL } from "@/lib/seo";

const FAQ_ITEMS = [
  {
    q: "Why do I only get around thirty reposts?",
    a: "TikTok throws a slider captcha the moment anonymous traffic asks for a second page of reposts. Repostify reads everything before that gate and then stops, with no solver and no proxy roulette.",
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
          <PopularHandles />
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
        <div className="flex items-center gap-6">
          <a
            href="#faq"
            className="hidden sm:inline text-[12px] uppercase tracking-[0.22em] text-white/45 hover:text-white transition-colors"
          >
            FAQ
          </a>
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
        <p className="mt-6 max-w-[44rem] mx-auto text-center text-[12px] leading-[1.6] text-white/45">
          Public profiles only. No login. TikTok shows a captcha after the
          first batch, so each session captures roughly thirty reposts. If a
          result lands empty, the profile&apos;s reposts tab is private.
        </p>
      </div>
    </header>
  );
}

function PopularHandles() {
  const featured = POPULAR_HANDLES.slice(0, 12);
  // Cycle accent colors so the grid feels alive, not stamped.
  const accents = [
    "from-[#25f4ee] to-[#0ea5b3]",
    "from-[#ff2d8a] to-[#c11a64]",
    "from-[#f5b740] to-[#c98a1a]",
    "from-[#9b6cff] to-[#5e3ec0]",
    "from-[#36d399] to-[#1f8a64]",
    "from-[#ff7a59] to-[#c54a2d]",
  ];

  return (
    <section className="relative py-16 md:py-24 border-t border-white/8">
      <div className="max-w-[72rem] mx-auto px-6">
        <div className="max-w-[44rem]">
          <SectionLabel>Popular handles</SectionLabel>
          <h2 className="mt-5 font-display text-[clamp(2rem,4vw,3.25rem)] leading-[0.95] tracking-[-0.02em]">
            Skip the paste.{" "}
            <span className="italic text-white/55">
              One click to a profile.
            </span>
          </h2>
          <p className="mt-5 text-[14.5px] leading-[1.65] text-white/60 max-w-[56ch]">
            Public TikTok accounts with the reposts tab visible. Tap any card
            — the scrape runs the moment the page loads.
          </p>
        </div>

        <ul className="mt-10 md:mt-12 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {featured.map((h, i) => {
            const accent = accents[i % accents.length];
            const initials = h.replace(/[^a-z0-9]/gi, "").slice(0, 2).toUpperCase();
            return (
              <li key={h}>
                <Link
                  href={`/u/${h}`}
                  className="group relative block rounded-2xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/25 transition-all duration-300 p-4 overflow-hidden"
                >
                  {/* Soft accent glow on hover */}
                  <div
                    className={`absolute -top-12 -right-12 h-28 w-28 rounded-full bg-gradient-to-br ${accent} opacity-0 group-hover:opacity-25 blur-2xl transition-opacity duration-500 pointer-events-none`}
                  />
                  <div className="relative flex items-center gap-3">
                    <div
                      className={`flex-none h-11 w-11 rounded-full bg-gradient-to-br ${accent} flex items-center justify-center font-display text-[15px] text-black/85 tracking-tight`}
                    >
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[14px] font-medium truncate">
                        <span className="text-white/40">@</span>
                        {h}
                      </p>
                      <p className="text-[10.5px] uppercase tracking-[0.22em] text-white/40 mt-0.5">
                        Reposts open
                      </p>
                    </div>
                    <ArrowUpRight className="ml-auto h-4 w-4 text-white/35 group-hover:text-white group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>

        {POPULAR_HANDLES.length > featured.length && (
          <p className="mt-8 text-[12.5px] text-white/45">
            {POPULAR_HANDLES.length - featured.length} more in the{" "}
            <Link
              href="/sitemap.xml"
              className="underline underline-offset-4 hover:text-white"
            >
              sitemap
            </Link>
            . Or just paste any handle.
          </p>
        )}
      </div>
    </section>
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
        <div className="col-span-12 sm:col-span-4">
          <div className="flex items-center gap-2.5">
            <LogoMark className="w-6 h-6" />
              <span className="text-[15px] text-white/85 font-medium">
              Repostify
            </span>
          </div>
          <p className="mt-3 text-[13px] leading-[1.65] text-white/55 max-w-[36ch]">
            A read-only tool for viewing public TikTok reposts. No login, no
            API key, nothing stored.
          </p>
        </div>
        <nav className="col-span-6 sm:col-span-2">
          <p className="text-[10px] uppercase tracking-[0.22em] text-white/40 mb-3">
            Pages
          </p>
          <ul className="space-y-2 text-[13px] text-white/70">
            <li>
              <Link href="/" className="hover:text-white transition-colors">
                Home
              </Link>
            </li>
            <li>
              <Link href="/guide" className="hover:text-white transition-colors">
                How to see TikTok reposts
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
        <nav className="col-span-6 sm:col-span-3">
          <p className="text-[10px] uppercase tracking-[0.22em] text-white/40 mb-3">
            Popular profiles
          </p>
          <ul className="space-y-2 text-[13px] text-white/70">
            {POPULAR_HANDLES.slice(0, 4).map((h) => (
              <li key={h}>
                <Link
                  href={`/u/${h}`}
                  className="hover:text-white transition-colors"
                >
                  <span className="text-white/45">@</span>
                  {h}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="col-span-12 sm:col-span-3 sm:text-right">
          <p className="text-[10px] uppercase tracking-[0.22em] text-white/40 mb-3">
            Built with
          </p>
          <p className="text-[13px] text-white/70">Next.js · Playwright</p>
          <p className="mt-2 text-[11px] text-white/40">
            Not affiliated with TikTok.
          </p>
        </div>
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
