import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const OUT = ".debug";
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();

console.log("→ home (1440x900)");
await page.goto("http://localhost:3000", { waitUntil: "networkidle", timeout: 60_000 });
await page.waitForTimeout(2_500);
await page.screenshot({ path: `${OUT}/ui-home.png`, fullPage: false });

console.log("→ hero only (1440x900)");
await page.screenshot({
  path: `${OUT}/ui-hero.png`,
  clip: { x: 0, y: 0, width: 1440, height: 900 },
});

console.log("→ method + limits");
await page.evaluate(() => document.querySelector("#method")?.scrollIntoView({ block: "start" }));
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/ui-method.png`, fullPage: false });

await page.evaluate(() => document.querySelector("#limits")?.scrollIntoView({ block: "start" }));
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/ui-limits.png`, fullPage: false });

console.log("→ typing username");
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(400);
await page.fill('input[placeholder="paste a tiktok handle"]', "khaby.lame");
await page.click('button[type="submit"]');

console.log("→ wait for results");
await page.waitForSelector("text=/Reel ·/i", { timeout: 120_000 }).catch(() => {});
await page.waitForTimeout(3_000);
await page.evaluate(() => document.querySelector("#analyzer")?.scrollIntoView({ block: "start" }));
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/ui-results.png`, fullPage: false });

console.log("→ full results page");
await page.screenshot({ path: `${OUT}/ui-results-full.png`, fullPage: true });

// Mobile pass
console.log("→ mobile");
await ctx.close();
const mctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
});
const m = await mctx.newPage();
await m.goto("http://localhost:3000", { waitUntil: "networkidle", timeout: 60_000 });
await m.waitForTimeout(2_000);
await m.screenshot({ path: `${OUT}/ui-mobile-home.png`, fullPage: false });
await m.screenshot({ path: `${OUT}/ui-mobile-full.png`, fullPage: true });

await browser.close();
console.log("done");
