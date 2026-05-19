import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();

page.on("console", (m) => console.log("[browser]", m.type(), m.text()));
page.on("requestfailed", (r) => console.log("[failed]", r.url(), r.failure()?.errorText));

await page.goto("http://localhost:3000", { waitUntil: "networkidle", timeout: 60000 });
await page.fill('input[placeholder="paste a tiktok handle"]', "khaby.lame");
await page.click('button[type="submit"]');
await page.waitForSelector("text=/Reel ·/i", { timeout: 120000 });
await page.waitForTimeout(2000);

// Click first repost card
await page.evaluate(() => document.querySelector("[aria-label^='Play repost']")?.click());
await page.waitForTimeout(2500);
await page.screenshot({ path: ".debug/player-open.png", fullPage: false });
console.log("→ player-open");

// Wait for video element
const videoStatus = await page.evaluate(() => {
  const v = document.querySelector("video");
  return {
    has: Boolean(v),
    src: v?.src ?? null,
    readyState: v?.readyState ?? null,
    error: v?.error?.code ?? null,
    paused: v?.paused ?? null,
  };
});
console.log("video:", JSON.stringify(videoStatus));

await browser.close();
