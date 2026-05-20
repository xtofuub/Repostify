// Smoke test for cloakbrowser-based scraper.
// Usage: npx tsx scripts/scrape-test.mjs <username>
const { scrapeReposts } = await import("../src/lib/tiktok.ts");

const username = process.argv[2] || "khaby.lame";
console.log(`scraping @${username}…`);
process.env.DEBUG_TIKTOK = "1";

const t0 = Date.now();
try {
  const r = await scrapeReposts(username, { maxScrolls: 40 });
  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`done in ${dt}s`);
  console.log({
    reposts: r.reposts.length,
    hasMore: r.hasMore,
    captchaSuspected: r.captchaSuspected,
    profileFound: Boolean(r.profile),
    debug: r.debug,
  });
} catch (e) {
  console.error("FAIL:", e);
  process.exit(1);
}
process.exit(0);
