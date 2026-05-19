import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto("http://localhost:3000", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(1500);
const sections = await page.evaluate(() => {
  const headings = Array.from(document.querySelectorAll("h2"));
  return headings.map((h) => {
    const sec = h.closest("section");
    if (!sec) return null;
    const r = sec.getBoundingClientRect();
    return { txt: h.textContent.slice(0,40), top: window.scrollY + r.top };
  }).filter(Boolean);
});
for (const s of sections) {
  await page.evaluate((t) => window.scrollTo(0, t - 60), s.top);
  await page.waitForTimeout(400);
  const slug = s.txt.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0,30);
  await page.screenshot({ path: `.debug/sec2-${slug}.png`, fullPage: false });
  console.log("→", slug);
}
await browser.close();
