# Repostify

**A read-only TikTok repost analyzer.**  
Open any public profile, crawl the reposts tab, and view every repost as a playable grid with aggregate stats, top-creator rankings, and an in-browser video player. No login. No API key. Nothing stored server-side.

---

## Why

TikTok's reposts tab is a high-signal feed: every video an account chose to amplify to its own followers. But scrolling it in the app is slow, videos auto-play one at a time, and there's no aggregate view of who the account actually boosts. Repostify flattens the feed into a single page — playable thumbnails, summed engagement, ranked creators.

## Features

- **Profile overview** — Avatar, bio, follower/following/hearts counts pulled from the public page.
- **Repost grid** — 9:16 cover images with play overlay, duration badge, author info, and engagement stats (plays, likes, comments, shares).
- **In-browser player** — Click any cover to open a full-screen overlay with TikTok's embed player and a detail panel.
- **Aggregate stats** — Total plays, likes, comments, shares, and unique creators across the batch.
- **Top creators ranking** — Counts how often each creator appears and ranks by frequency with horizontal bar charts.
- **Captcha-aware** — Stops when TikTok throws a slider captcha and labels the result as partial rather than failing silently.
- **Image proxy** — TikTok blocks hotlinks; every thumbnail and avatar routes through a server-side proxy with the correct Referer header.
- **SEO-ready** — Dynamic metadata, JSON-LD structured data (FAQPage, WebApplication, BreadcrumbList, Article), sitemap with popular handles, robots.txt.

## How it works

1. A headless Chromium (Playwright) loads the public TikTok profile.
2. Anti-detection patches are applied (`navigator.webdriver`, `chrome.runtime`, plugins, languages).
3. The cookie banner is dismissed via shadow DOM traversal.
4. Profile data is extracted from TikTok's `__UNIVERSAL_DATA_FOR_REHYDRATION__` SSR script tag — no rendering wait.
5. The Reposts tab is located and clicked.
6. The XHR response from `/api/repost/item_list` is intercepted as it comes over the wire.
7. The page is scrolled in human-paced increments with random delays, collecting additional pages.
8. Captcha containers are checked after every scroll — the session stops immediately if one appears.
9. Results are normalized, deduplicated, sorted by recency, and returned as JSON.

The data you see is the data TikTok's own page would have shown a person scrolling. No undocumented API is called. No account is logged in. Nothing is stored.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | [Next.js](https://nextjs.org) 16.2.6 |
| Runtime | React 19.2.4 with React Compiler |
| Styling | Tailwind CSS v4 |
| Primitives | [@base-ui/react](https://base-ui.com) 1.4.1 (MUI team's new headless library) |
| Components | shadcn (base-nova style) |
| Animation | motion 12.38 |
| Scraping | Playwright 1.59.1 (headless Chromium) |
| Icons | lucide-react |
| Fonts | Inter + Instrument Serif (via next/font) |
| Language | TypeScript 5 |
| Package manager | pnpm |

## Getting started

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Search a TikTok handle.

### Production build

```bash
pnpm build
pnpm start
```

### Debug mode

Set `DEBUG_TIKTOK=1` to dump HTML screenshots and debug metadata into `.debug/` on each scrape.

## Project structure

```
src/
├── app/
│   ├── page.tsx            # Home — hero, search, popular handles, FAQ
│   ├── layout.tsx          # Root layout, fonts, global CSS, Toaster
│   ├── u/[username]/       # Dynamic profile page with auto-search
│   ├── about/              # About page
│   ├── guide/              # Educational guide on TikTok reposts
│   ├── privacy/            # Privacy policy
│   ├── sitemap.ts          # Static + popular-handle routes
│   ├── robots.ts           # Disallows /api/
│   └── api/
│       ├── reposts/        # GET /api/reposts?username= — runs the scraper (120s timeout)
│       ├── img/            # Image proxy (24h cache, domain-whitelisted)
│       └── video/          # Video proxy (5min cache, byte-range support)
├── components/
│   ├── repost-search.tsx   # Main client component — state machine (idle|loading|error|ok)
│   ├── repost-card.tsx     # Single repost thumbnail in the grid
│   ├── repost-player.tsx   # Full-screen overlay with TikTok embed + detail panel
│   ├── brand.tsx           # LogoMark, PrimaryButton, GhostButton, GuideLines, BackgroundVideo
│   └── ui/                 # shadcn primitives (button, card, input, badge, avatar, tabs, etc.)
└── lib/
    ├── tiktok.ts           # Playwright scraper — the core logic (~500 lines)
    ├── seo.ts              # Site constants, canonical URL builder, popular handles list
    ├── format.ts           # formatCount, formatDuration, formatRelativeTime
    └── utils.ts            # cn() utility
```

## Limitations

- **~30 reposts per session** — TikTok throws a slider captcha after the first page of reposts. This tool doesn't solve captchas.
- **Private reposts tabs** — Many profiles hide their reposts tab. That's a TikTok privacy setting, not something this tool can bypass.
- **Read-only** — No write operations, no API abuse, no logged-in sessions.

## License

MIT. Not affiliated with TikTok or ByteDance.
