# Repostify

## Product purpose

A read-only TikTok reposts viewer. Paste any public handle, get every video that account amplified to its followers as a playable grid with stats and ranked top-amplified creators. No login, no signup, no API key.

The viewer scrapes the public profile in a headless stealth Chromium (cloakbrowser), clicks the Reposts tab, captures the `/api/repost/item_list/` XHR, paginates until TikTok says `hasMore: false`, then returns a clean JSON shape to the React frontend.

## Register

**brand** — landing surface is the product's marketing. The result page (`/u/[handle]`) is also functional product UI, so that route is dual register (brand hero + product grid below).

## Users

Two clear audiences, both arriving via search:

1. **The watcher.** Curious about someone else: an ex, a crush, a creator they follow, a competitor brand, a friend. Wants to see what that account shares without leaving a trail on their own TikTok account. Privacy is the unspoken feature.
2. **The self-checker.** Their own account. Wants to audit what their reposts tab looks like to strangers, see how recency sorts, spot which creators they amplify most.

Both arrive from Google searching variations of "see tiktok reposts", "view someone's reposts on tiktok", "tiktok repost viewer", or "tiktok repost analyzer". Bounce risk is high — if the homepage looks generic or makes them log in, they leave.

## Tone

Direct. Lowercase-friendly. A bit knowing. The product helps people look — say so plainly, no euphemism, no moralizing. Mechanical metaphors for the scraper part ("opens the tab", "walks the feed") because the truth is more interesting than marketing speak.

Avoid: corporate SaaS landings ("Empower your TikTok analytics"), fitness-app hype ("Unlock insights!"), AI-tool gloss ("Powered by AI"), generic privacy theater ("Your data is safe with us"). The audience knows what they're doing.

## Anti-references

- ❌ SaaS cream + soft gradients (Stripe-clone, Linear-clone)
- ❌ Generic "analytics" dashboards with KPI tiles
- ❌ Glassmorphism stacks, blur-everything
- ❌ Stock illustrations of phones with smiling people
- ❌ Hero metric template (giant number + tiny label)
- ❌ TikTok's own pink/cyan palette as the only color story (too obvious; we use accents only)
- ❌ "Login with TikTok" buttons — there is no login
- ❌ Crypto-bro neon-on-black, AI-tool purple gradient
- ❌ Corporate trust signals ("Used by 10,000+ creators")

## Strategic principles

1. **Anonymity is the killer feature.** Front-load it in the hero. "They don't get notified" is the line everyone wants to hear.
2. **Search lands you in the product.** No splash, no scroll, no signup. The search input is the hero — paste and Analyze should be visible above the fold.
3. **One tool, one job.** Don't bolt on growth-hack features (newsletters, leaderboards, social comparisons). The brand is "focused".
4. **The result page is the proof.** Make it good enough to share. Big covers, recency sort, top-creator ranking. That page is the marketing.
5. **No moralizing.** Don't add "use responsibly" warnings or "please respect privacy" copy. The data is already public — that's a TikTok product decision, not ours.

## Brand color story

Dark canvas (`#0a0a0b`). Cyan `#25f4ee` and fuchsia `#ff2d8a` as accent pair — picked because they're the TikTok logo accents, used sparingly (≤10% surface), so the brand reads as TikTok-adjacent without aping. Tinted neutrals across the rest. The aesthetic is more "studio app at midnight" than "TikTok colors".

## Surface inventory

- `/` — Landing + search panel + FAQ + CTA. Brand register.
- `/u/[handle]` — Result page. Brand hero on top, product grid below. Dual register.
- `/guide` — Long-form SEO article. Brand register, editorial.
- `/about`, `/privacy` — Short policy pages. Brand register, utilitarian.
