import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

mkdirSync(".github/assets", { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();
const BASE = "http://localhost:3000";

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

// 2. FAQ section
await page.evaluate(() => {
  const el = document.querySelector("#faq");
  if (el) el.scrollIntoView({ behavior: "instant", block: "start" });
});
await shot("02-faq");

// 3. Result page — pre-cached scrape, expect fast load
await page.goto(`${BASE}/u/khaby.lame`, {
  waitUntil: "domcontentloaded",
  timeout: 60_000,
});
// wait for grid to render
await page.waitForSelector('[aria-label^="Play repost"]', { timeout: 120_000 });
await page.waitForTimeout(1200);
await shot("03-result");

// 4. Full-page result (scroll-stitched)
await shot("04-result-full", { fullPage: true });

// 5. Top creators section
await page.evaluate(() => {
  const headings = Array.from(document.querySelectorAll("p, h2"));
  const target = headings.find((h) => /top creators/i.test(h.textContent || ""));
  if (target) target.scrollIntoView({ behavior: "instant", block: "center" });
});
await shot("05-top-creators");

// 6. Stats row
await page.evaluate(() => window.scrollTo({ top: 350, behavior: "instant" }));
await shot("06-stats");

// 7. Player modal — click first cover
await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
const firstCard = await page.$('[aria-label^="Play repost"]');
if (firstCard) {
  await firstCard.click();
  await page.waitForTimeout(2500); // iframe needs to load
  await shot("07-player");
  // close
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
}

// 8. Mobile shot — narrow viewport home
await page.setViewportSize({ width: 414, height: 896 });
await page.goto(BASE, { waitUntil: "networkidle", timeout: 30_000 });
await shot("08-mobile");

await browser.close();
console.log("done. shots in .github/assets/");
