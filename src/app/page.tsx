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
import { SITE_NAME, SITE_URL } from "@/lib/seo";

const FAQ_ITEMS = [
  {
    q: "Will they know I looked?",
    a: "No. We open the profile as an anonymous visitor, the same way it loads when anyone googles their handle. TikTok doesn't notify accounts that someone viewed their reposts, viewed their profile, or watched a video. There's no view history on the account-owner side, no \"who viewed your profile\" feature, nothing.",
  },
  {
    q: "Can I check my ex / crush / a friend's reposts?",
    a: "Yes, if their reposts tab is public. Paste their handle and hit Analyze. You'll see every video they pushed to their followers, the original creator each video came from, and how often that creator gets amplified. Nothing logs in to your account or theirs.",
  },
  {
    q: "Can I check my own reposts?",
    a: "Yes. Paste your handle and you'll see exactly what a stranger sees when they land on your profile and tap the reposts tab. Useful for auditing what you're broadcasting before someone you know finds it.",
  },
  {
    q: "Do I need a TikTok account?",
    a: "No. The viewer reads the same public page Google indexes. No login on your side, no API key, no extension to install.",
  },
  {
    q: "Why is the result empty?",
    a: "TikTok lets each user hide their reposts tab from public view. If a profile flipped that switch, the page is empty for everyone, including us. Try another handle.",
  },
  {
    q: "Can they see I'm using a third-party viewer?",
    a: "They can't. The request leaves from our server, not your device. From TikTok's side it looks like a generic anonymous page load on the profile, nothing else.",
  },
  {
    q: "Is this affiliated with TikTok?",
    a: "No. Repostify is an independent tool that reads the same public page anyone can. Not affiliated with or endorsed by TikTok or ByteDance.",
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
    <header className="relative pt-14 pb-20 md:pt-20 md:pb-24">
      <div className="aurora absolute inset-x-0 top-0 h-[640px] -z-[1]" />
      <div className="max-w-[72rem] mx-auto px-6">
        <div className="text-center max-w-[58rem] mx-auto">
          <SectionLabel>TikTok repost viewer</SectionLabel>
          <h1 className="mt-7 font-display text-[clamp(2.8rem,7.5vw,6rem)] leading-[0.95] tracking-[-0.025em]">
            See what{" "}
            <span className="italic text-[#25f4ee]">they</span> repost.
            <span className="block text-white/60 mt-2 text-[clamp(1.6rem,4vw,3.25rem)] leading-[1.05] tracking-[-0.015em]">
              They never know you looked.
            </span>
          </h1>

          <p className="mt-8 max-w-[52ch] mx-auto text-[15.5px] leading-[1.7] text-white/70">
            Paste any public TikTok handle. We open the profile as anonymous
            traffic, walk the reposts tab, and pull every video they amplified.
            No TikTok account on your end. No notification on theirs.
          </p>

          {/* Three explicit promises — the watcher checks these before pasting. */}
          <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-7 gap-y-2 text-[13px] text-white/70">
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[#25f4ee]" />
              No login, no signup
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[#25f4ee]" />
              They don&apos;t get notified
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[#25f4ee]" />
              Any public profile
            </li>
          </ul>
        </div>

        <div className="mt-12">
          <RepostSearch />
        </div>

        <p className="mt-6 max-w-[44rem] mx-auto text-center text-[12.5px] leading-[1.65] text-white/45">
          Empty result? Their reposts tab is set to private. Try another
          handle, or check your own to see what strangers see when they land
          on yours.
        </p>
      </div>
    </header>
  );
}

function FAQ() {
  const items = FAQ_ITEMS;
  return (
    <section id="faq" className="relative scroll-mt-24 py-20 md:py-24">
      <div className="max-w-[60rem] mx-auto px-6">
        <div className="text-center mb-12">
          <SectionLabel>FAQ</SectionLabel>
          <h2 className="mt-5 font-display text-[clamp(2rem,4vw,3rem)] leading-[1] tracking-[-0.015em]">
            Questions, answered.
          </h2>
        </div>
        <div className="space-y-3">
          {items.map((it) => (
            <details
              key={it.q}
              className="group rounded-xl border border-white/10 bg-white/[0.02] open:bg-white/[0.04] open:border-white/20 transition-colors"
            >
              <summary className="flex items-center justify-between cursor-pointer list-none gap-4 px-5 py-4">
                <span className="text-[15px] font-medium">{it.q}</span>
                <span className="text-white/50 group-open:rotate-45 transition-transform text-xl leading-none flex-none">
                  +
                </span>
              </summary>
              <p className="px-5 pb-5 text-[14px] leading-[1.65] text-white/70 max-w-[68ch]">
                {it.a}
              </p>
            </details>
          ))}
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
          <SectionLabel>Got a handle in mind?</SectionLabel>
          <h2 className="mt-5 font-display text-[clamp(2.2rem,5.5vw,4.5rem)] leading-[0.95] tracking-[-0.025em]">
            Paste it.{" "}
            <span className="italic text-[#25f4ee]">Nobody finds out.</span>
          </h2>
          <p className="mt-6 max-w-[44ch] mx-auto text-[14px] leading-[1.65] text-white/65">
            One field. One click. Every repost on their profile, in your
            browser, in seconds.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
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
