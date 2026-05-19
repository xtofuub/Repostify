import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const OUT = ".debug";
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();

await page.goto("http://localhost:3000", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(1500);

for (const [name, sel] of [
  ["signal", "#signal"],
  ["inside", "#inside"],
  ["builtfor", "section:has(h2:has-text('what other people watch'))"],
  ["limits", "section:has(h2:has-text('We stop at the captcha'))"],
  ["faq", "#faq"],
  ["cta", "section:has(h2:has-text('More watching'))"],
]) {
  try {
    await page.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: "start" }), sel);
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${OUT}/sec-${name}.png`, fullPage: false });
    console.log("→", name);
  } catch (e) { console.log("skip", name, e.message); }
}
await browser.close();
