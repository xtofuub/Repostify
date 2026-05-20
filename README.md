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
- **Bot-detection bypass** — cloakbrowser's source-level Chromium patches pass TikTok fingerprinting where stock Playwright hits a captcha wall at ~30 items.
- **Fetch-limit chips** — Pick 30 / 60 / 120 / 250 / All in the UI; the scraper stops early at your cap.
- **Image proxy** — TikTok blocks hotlinks; every thumbnail and avatar routes through a server-side proxy with the correct Referer header.
- **SEO-ready** — Dynamic metadata, JSON-LD structured data (FAQPage, WebApplication, BreadcrumbList, Article), sitemap with popular handles, robots.txt.

## How it works

1. [cloakbrowser](https://github.com/CloakHQ/CloakBrowser) (stealth Chromium with source-level C++ fingerprint patches) loads the public profile.
2. Cookie banner dismissed via shadow DOM.
3. Profile data extracted from `__UNIVERSAL_DATA_FOR_REHYDRATION__` SSR script.
4. Reposts tab located + clicked.
5. `/api/repost/item_list` XHR responses intercepted as they arrive.
6. Page scrolled until TikTok returns `hasMore: false` or the user-selected limit is hit.
7. Tab-error / captcha / blocked-response signals cause early bail.
8. Results normalized, deduplicated, sorted by recency.

No login. No undocumented API. Nothing stored server-side.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | [Next.js](https://nextjs.org) 16.2.6 |
| Runtime | React 19.2.4 with React Compiler |
| Styling | Tailwind CSS v4 |
| Primitives | [@base-ui/react](https://base-ui.com) 1.4.1 (MUI team's new headless library) |
| Components | shadcn (base-nova style) |
| Animation | motion 12.38 |
| Scraping | [cloakbrowser](https://github.com/CloakHQ/CloakBrowser) 0.3.28 (stealth Chromium, drop-in Playwright API) |
| Icons | lucide-react |
| Fonts | Inter + Instrument Serif (via next/font) |
| Language | TypeScript 5 |
| Package manager | pnpm |

## Getting started

```bash
pnpm install
pnpm dev
```

First run downloads the cloakbrowser binary (~200MB, cached in `~/.cloakbrowser/`).

Open [http://localhost:3000](http://localhost:3000). Paste a handle. Pick a fetch limit (30 / 60 / 120 / 250 / All). Hit Analyze.

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

## API

```
GET /api/reposts?username=<handle>&limit=<n>
```

- `username` — required, TikTok handle without `@`
- `limit` — optional, max items. Omit or `0` for no cap.

## Limitations

- **Private reposts tabs** — Many profiles hide their reposts tab. TikTok privacy setting, can't bypass.
- **Big feeds = slow** — 250+ items can take 1-3 min. Use a tight limit if you only need recent.
- **Read-only** — No write ops, no logged-in sessions.

## License

MIT. Not affiliated with TikTok or ByteDance.
