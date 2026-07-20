import { chromium } from "playwright";
import { ensureBinary } from "cloakbrowser";
import { existsSync, mkdirSync } from "node:fs";

mkdirSync(".github/assets", { recursive: true });

const browserCandidates = [
  process.env.REPOSTIFY_SCREENSHOT_BROWSER,
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
].filter(Boolean);
const executablePath =
  browserCandidates.find((candidate) => existsSync(candidate)) ||
  (await ensureBinary());
const browser = await chromium.launch({
  headless: true,
  ...(executablePath ? { executablePath } : {}),
});
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
});
const page = await ctx.newPage();
const BASE = process.env.REPOSTIFY_BASE_URL || "http://127.0.0.1:3012";
const HANDLE = process.env.REPOSTIFY_SCREENSHOT_HANDLE || "zachking";

async function shot(name, opts = {}) {
  await page.waitForTimeout(opts.wait ?? 600);
  await page.screenshot({
    path: `.github/assets/${name}.png`,
    fullPage: opts.fullPage ?? false,
  });
  console.log("→", name);
}

// 1. Home: hero
await page.goto(BASE, { waitUntil: "networkidle", timeout: 30_000 });
await shot("01-home");

// 2. Result page, using the local scan cache when available.
await page.goto(`${BASE}/u/${HANDLE}`, {
  waitUntil: "domcontentloaded",
  timeout: 60_000,
});
// wait for grid to render
await page.waitForSelector('[aria-label^="Play repost"]', { timeout: 120_000 });
await page.waitForTimeout(1200);
await shot("03-result");

// 3. Top creators section
await page.evaluate(() => {
  const headings = Array.from(document.querySelectorAll("p, h2"));
  const target = headings.find((h) => /top creators/i.test(h.textContent || ""));
  if (target) target.scrollIntoView({ behavior: "instant", block: "center" });
});
await shot("05-top-creators");

// 4. Player modal. Use the local fallback so automated screenshots do not
// depend on TikTok allowing its iframe inside a headless browser.
await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
const cards = await page.$$('[aria-label^="Play repost"]');
const playerCard = cards[1] || cards[0];
if (playerCard) {
  await playerCard.click();
  await page.waitForTimeout(1000);
  const fallbackButton = page.getByRole("button", {
    name: "Video unavailable? Try fallback player",
    exact: true,
  });
  if (await fallbackButton.isVisible()) {
    await fallbackButton.click();
    await page.waitForSelector("video", { timeout: 30_000 });
  }
  await page.waitForTimeout(1200);
  await shot("07-player");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
}

// 5. Desktop settings.
await page.goto(`${BASE}/settings`, {
  waitUntil: "networkidle",
  timeout: 30_000,
});
await shot("08-settings");

await browser.close();
console.log("done. shots in .github/assets/");
