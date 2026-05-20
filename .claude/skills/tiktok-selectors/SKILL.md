---
name: tiktok-selectors
description: Background reference for the TikTok DOM selectors, JSON scopes, and XHR shapes that src/lib/tiktok.ts depends on. Consult when scraper behavior changes, when adding new fields, or when debugging why XHR/tab detection broke.
disable-model-invocation: false
user-invocable: false
---

# TikTok internals — what the scraper depends on

When the scraper stops working, it's almost always because one of these surfaces changed.

## Profile entry point

```
https://www.tiktok.com/@<handle>
```

Username regex: `^[A-Za-z0-9._]{1,30}$`.

## Rehydration script (SSR data)

```html
<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">
  { "__DEFAULT_SCOPE__": { ...scopes } }
</script>
```

### Scopes we read

| Scope key | Shape | What we extract |
|---|---|---|
| `webapp.user-detail` | `{ userInfo: { user, stats } }` | nickname, avatar, verified, bio, followers, following, hearts |
| `webapp.repost-list` | `{ itemList: TikTokItem[] }` | Pre-rendered reposts on first paint (often empty until tab click) |
| `webapp.app-context` | `{ language, region, appId, wid }` | (not used currently) |

If `webapp.user-detail` missing → page didn't load properly (captcha, geo-block, or redirect).

If `webapp.repost-list` missing → reposts tab is server-restricted for this account (often shows "Something went wrong" overlay).

## Tab detection

We find the Reposts tab via:

```js
document.querySelectorAll('[role="tab"]')
  .find(el => /reposts?/i.test(el.textContent))
```

Fallback selectors:
- `[data-e2e="reposts-tab"]`
- `[data-e2e="user-post-item-list-repost"]`

Tab item attribute: `div[data-e2e="user-post-item"]` (used for scroll-into-view).

## Repost XHR

After clicking the tab, TikTok issues:

```
GET /api/repost/item_list/?...
```

Match regex: `/\/api\/repost\/item_list/i`.

Response shape:

```ts
{
  itemList?: TikTokItem[];
  hasMore?: boolean;
  statusCode?: number;  // non-zero = server-side rejection
  cursor?: string;
}
```

`hasMore: false` from the server = no more pages, even if scroll fires.

## TikTokItem shape (only fields we use)

```ts
{
  id: string;
  desc?: string;
  createTime?: number;       // unix seconds
  video?: {
    cover?: string;
    originCover?: string;
    dynamicCover?: string;   // preferred
    playAddr?: string;       // direct CDN URL, requires session cookies to play
    duration?: number;       // seconds
  };
  author?: {
    uniqueId?: string;       // @ handle
    nickname?: string;
    avatarLarger?: string;
    avatarMedium?: string;
    avatarThumb?: string;
    verified?: boolean;
  };
  stats?: { playCount, diggCount, commentCount, shareCount };
  statsV2?: { playCount, diggCount, commentCount, shareCount }; // strings — preferred when present
}
```

## Cookie banner

Shadow DOM element: `tiktok-cookie-banner`. Buttons live in shadow root. We click the one whose textContent matches `/decline/i`.

If we don't dismiss it, it blocks pointer events on the whole viewport and IntersectionObserver-based lazy loading stops firing on scroll.

## Captcha indicators

Page-level signals that bot detection fired:

- URL or page title matches `/captcha|verify|security/i`
- DOM contains: `#captcha-verify-container`, `.captcha_verify_container`, `[class*="captcha-verify"]`
- Repost XHR returns `status >= 400` or body `statusCode !== 0`

## Inline playback (player)

```
https://www.tiktok.com/player/v1/<videoId>?autoplay=1&loop=1&mute=0&music_info=0&description=0&rel=0&native_context_menu=0&closed_caption=1
```

Cross-origin iframe — we can't control mute from outside.

## Image proxy

Direct hotlinks to `*.tiktokcdn-*.com` return 403. We route every image through `/api/img?u=<encodedUrl>`.
