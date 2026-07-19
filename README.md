<h1 align="center">Repostify</h1>

<p align="center">
  <strong>See every TikTok repost on any public profile.</strong><br/>
  No login required. No API key. No notification to the account you're checking.
</p>

<p align="center">
  <img src=".github/assets/01-home.png" alt="Repostify landing page" width="900" />
</p>

---

## What it does

Paste any public TikTok handle → Repostify walks the reposts tab and lays every repost out as a playable grid with stats, top-amplified creators, and one-click video or photo-slideshow playback. Connecting TikTok is optional and is used only when a profile requires an approved viewer.

The reposts tab is where someone's taste actually lives. Likes are noise. Posts are performance. Reposts are what they wanted their followers to see. This tool flattens that feed into a single page you can scan in seconds.

## Screenshots

### Result page

Per-profile view: header, full stats row, top-creators leaderboard, repost grid.

<p align="center">
  <img src=".github/assets/03-result.png" alt="Result page for @khaby.lame" width="900" />
</p>

### Top creators ranking

Counts how many times each original creator appears in the feed, ranked.

<p align="center">
  <img src=".github/assets/05-top-creators.png" alt="Top amplified creators" width="900" />
</p>

### Inline player

Click any cover → full-screen overlay with direct video playback + caption, stats, and author details. If a direct stream expires, the player falls back to TikTok's embed.

<p align="center">
  <img src=".github/assets/07-player.png" alt="Inline TikTok player" width="900" />
</p>

### Mobile

<p align="center">
  <img src=".github/assets/08-mobile.png" alt="Mobile view" width="320" />
</p>

---

## Features

- **Profile overview** — Avatar, bio, follower / following / hearts pulled from the public page rehydration script.
- **Repost grid** — 9:16 cover thumbnails with duration badge, original creator handle, play overlay, and per-video engagement stats.
- **Inline player** — TikTok video embed or native photo slideshow with its original music, plus a detail panel. Scroll wheel, arrow keys, j/k, or the compact buttons to navigate.
- **Smart session fallback** — Uses a connected TikTok session when needed, but automatically retries public profiles anonymously when TikTok blocks the connected identity.
- **Aggregate stats** — Total plays, likes, comments, shares, and unique creators across the captured batch.
- **Top creators leaderboard** — Frequency-ranked list of every original creator with horizontal bar chart.
- **Caption filter** — Type a word (`fyp`, `lol`, `edit`) to filter the grid live. Toggle between fuzzy substring and exact-word match. Top extracted hashtags suggested.
- **Fetch-limit selector** — Hidden in a popover behind the search bar gear: 30 / 60 / 120 / 250 / All.
- **Bot-detection bypass** — Uses [cloakbrowser](https://github.com/CloakHQ/CloakBrowser) (stealth Chromium with source-level C++ fingerprint patches) instead of stock Playwright, so TikTok serves the full repost feed instead of cutting off at the captcha gate.
- **Direct-cursor pagination** — After the first XHR fires, subsequent pages are fetched via the captured URL template, not by scrolling. Roughly 35% faster on big feeds.
- **Image proxy** — TikTok blocks hotlinks; all thumbnails route through `/api/img` with the Referer header set.
- **SEO** — Dynamic per-handle metadata, JSON-LD (`WebApplication`, `FAQPage`, `BreadcrumbList`, `Article`), sitemap with curated popular handles, `robots.txt`.

- **Fast local scan cache** — Successful scans are stored as plain JSON for 15 minutes. Repeat the same handle and fetch limit for an instant result, use **Scan fresh** to bypass it, or clear everything from Settings.
- **Desktop settings** — See the installed version and build type, check for updates, manage the TikTok connection, inspect or clear cache usage, and open the local diagnostics folder.

## How the scraper works

1. Cloakbrowser launches a stealth Chromium with source-level fingerprint patches.
2. Navigates to `https://www.tiktok.com/@<handle>`.
3. Dismisses the cookie banner via shadow-DOM traversal.
4. Parses `__UNIVERSAL_DATA_FOR_REHYDRATION__` for profile + initial repost list.
5. Finds the Reposts tab by `role="tab"` text match, clicks it.
6. Captures the first `/api/repost/item_list/` XHR as a URL template.
7. Paginates: each subsequent call hits the same URL with an updated cursor via `page.evaluate(fetch)` (TikTok's own fetch interceptor signs the request).
8. Detects captcha, private-tab, and TikTok business-status errors. If a connected identity is blocked from a public profile, retries anonymously.
9. Normalizes, dedupes, sorts by recency.

Login is optional. The data is limited to what TikTok Web returns to the anonymous or connected browser session.

## Tech stack

| Layer            | Choice                                                                                       |
| ---------------- | -------------------------------------------------------------------------------------------- |
| Framework        | [Next.js](https://nextjs.org) 16.2.10 (App Router, Turbopack, React Compiler)                |
| Runtime          | React 19                                                                                     |
| Styling          | Tailwind CSS v4 with `@theme inline`                                                         |
| Components       | shadcn/ui                                                                                    |
| Animation        | motion (Framer Motion v12)                                                                   |
| Scraping         | [cloakbrowser](https://github.com/CloakHQ/CloakBrowser) (stealth Chromium, Playwright API)   |
| Icons            | lucide-react                                                                                 |
| Fonts            | Inter + Instrument Serif (via `next/font`)                                                   |
| Language         | TypeScript 5                                                                                 |
| Package manager  | pnpm                                                                                         |

## Getting started

```bash
pnpm install
pnpm dev
```

First use downloads the cloakbrowser binary (several hundred MB, cached in `~/.cloakbrowser/`).

Open [http://localhost:3000](http://localhost:3000). Paste a handle, pick a fetch limit, hit Analyze.

### Production build

```bash
pnpm build
pnpm start
```

### Windows desktop app

Requirements: Windows 10/11 x64, Git, Node.js 20.9 or newer, and pnpm.

Clone and install dependencies:

```bash
git clone https://github.com/xtofuub/Repostify.git
cd Repostify
corepack enable
pnpm install --frozen-lockfile
```

Build the Windows installer from source:

```bash
pnpm desktop:build
```

Build the no-install portable EXE from source:

```bash
node desktop/build.cjs --portable
```

The files are written to:

- `release/Repostify-<version>-Windows-x64-Setup.exe`
- `release/Repostify-<version>-Windows-x64-Portable.exe`

It runs the Next.js server locally, opens it in a hardened Electron window, and
stores session data, short-lived JSON scan cache, and logs under the current
Windows user's app-data folder. The Settings page can clear scan cache without
touching the TikTok connection.
The packaged app checks the GitHub Releases page when it starts. When a newer
version exists, the in-app update window shows the download and verification
progress. Choose **Update now** and leave the window open. The installed build
closes, installs silently, and reopens on the new version automatically; Windows
can take a few minutes to unpack it. The portable build replaces the original
portable EXE in place and then reopens it, so an old shortcut cannot start the
previous version again. Every download is verified against GitHub's SHA-256
digest before it is allowed to run.

You can also open **Settings → App → Check for updates** at any time. The same
verified updater window is used for both automatic and manual checks.

### Debug mode

```bash
DEBUG_TIKTOK=1 pnpm dev
```

Dumps the raw first XHR response, full page HTML, and a viewport screenshot into `.debug/` for each scrape.

## API

```
GET /api/reposts?username=<handle>&limit=<n>&refresh=<0|1>
```

| Param      | Notes                                                |
| ---------- | ---------------------------------------------------- |
| `username` | Required. TikTok handle without `@`.                 |
| `limit`    | Optional integer. Omit or `0` = no cap. Max 5000.    |
| `refresh`  | Optional. `1` bypasses the 15-minute local scan cache. |

Returns:

```ts
{
  username: string;
  profile: { nickname, avatar, verified, bio, followers, following, likes } | null;
  reposts: Repost[];
  hasMore: boolean;
  captchaSuspected: boolean;
  fetchedAt: number;
}
```

## Project layout

```
src/
├── app/
│   ├── page.tsx              # Home: hero + search + FAQ + CTA
│   ├── u/[username]/         # Per-handle result page (auto-scrapes on load)
│   ├── about/, guide/, privacy/
│   ├── api/
│   │   ├── reposts/          # GET /api/reposts (the scraper endpoint)
│   │   ├── img/              # Image proxy (24 h cache, domain-whitelisted)
│   │   └── video/            # Video proxy fallback (mostly unused)
│   ├── sitemap.ts            # Static routes + popular handles
│   └── robots.ts             # Disallows /api/
├── components/
│   ├── repost-search.tsx     # Main client component: state machine + UI
│   ├── repost-card.tsx       # Thumbnail card
│   ├── repost-player.tsx     # Full-screen overlay player
│   ├── brand.tsx             # LogoMark, PrimaryButton, GuideLines, BackgroundVideo
│   └── ui/                   # shadcn primitives
├── lib/
│   ├── tiktok.ts             # Scraper core (~700 lines)
│   ├── seo.ts                # Site constants + popular-handle list
│   ├── format.ts             # Number / time formatters
│   └── utils.ts              # cn()
└── instrumentation.ts        # Next.js boot hook: pre-warms cloakbrowser
```

## Limitations

- **Connected private profiles** — TikTok Web can return access code `10222` even for an approved account. Repostify cannot scrape cards the web page never renders.

- **Private reposts tabs** — Many accounts hide it. That's a TikTok setting; can't bypass without auth.
- **Repost timestamps** — TikTok's anonymous endpoint exposes only the original video's createTime, not when the user reposted it. Order in the feed (most-recent-first) is the only repost-recency signal.
- **Big feeds are slow** — 500+ items can take 2-3 min. TikTok server is the bottleneck. Pick a smaller fetch limit if you only need the recent.
- **Read-only** — No write ops, no logged-in sessions, no DM-anyone weirdness.
- **Vercel won't run this** — Needs persistent server (cloakbrowser binary launch). Render, Fly, Railway, VPS all work.

## License

MIT. Not affiliated with or endorsed by TikTok or ByteDance.
