---
name: scrape-smoke
description: Smoke-test the TikTok repost scraper against known baseline handles. Run after editing src/lib/tiktok.ts or after cloakbrowser updates. Reports count, hasMore, captcha flag, and time per handle; flags regressions.
---

# scrape-smoke

Run a health check on the scraper.

## When to run

- After editing `src/lib/tiktok.ts` or `src/app/api/reposts/route.ts`
- After `pnpm update cloakbrowser` or `pnpm update playwright`
- Before pushing to main
- When user reports "no results" or "captcha" symptoms

## How

1. Confirm dev server is alive on `http://localhost:3000`. If not, ask user to run `pnpm dev`.
2. Run `node scripts/scrape-smoke.mjs` — hits 3 baseline profiles.
3. Report each row + overall verdict.

## Baselines

| Handle | Expected items | Tolerance | Notes |
|---|---|---|---|
| `khaby.lame` | 13 | ±3 | Low-volume reposter |
| `mrbeast` | ~39 | ±10 | Medium-volume, 3 XHR pages |
| `charlidamelio` | ~480 | ±100 | High-volume stress test, 30+ XHR pages |

## Regression triggers

- Any handle returns 0 items with profile loaded → bot detection broke
- `captchaSuspected: true` on any baseline → bot detection broke
- mrbeast drops below 25 → cloakbrowser fingerprint stale
- charlidamelio drops below 100 → server pagination cap re-engaged

If any trigger fires, suggest: `pnpm update cloakbrowser@latest`, then re-run.
