import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
for (const p of ["/about", "/guide", "/privacy", "/u/khaby.lame"]) {
  await page.goto("http://localhost:3000" + p, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(800);
  const slug = p.replace(/\W+/g, "-").replace(/^-|-$/g, "") || "home";
  await page.screenshot({ path: `.debug/page-${slug}.png`, fullPage: false });
  console.log("→", slug);
}
await browser.close();
