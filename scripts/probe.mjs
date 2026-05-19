import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto("http://localhost:3000", { waitUntil: "networkidle", timeout: 60000 });
await page.fill('input[placeholder="paste a tiktok handle"]', "khaby.lame");
await page.click('button[type="submit"]');
await page.waitForSelector("text=/Reel ·/i", { timeout: 120000 });
await page.waitForTimeout(1500);
const res = await page.evaluate(async () => {
  const r = await fetch("/api/reposts?username=khaby.lame");
  const j = await r.json();
  return { count: j.reposts?.length, first: j.reposts?.[0] };
});
console.log(JSON.stringify(res, null, 2));
await browser.close();
