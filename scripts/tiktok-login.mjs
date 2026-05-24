// Headed login flow: opens cloakbrowser visible, you log in to TikTok by
// hand (captcha + 2FA handled by you), script saves the storage state to
// .tiktok-session.json. Scraper auto-loads it on next request.
//
// Usage: npm run tiktok:login
// Re-run whenever TikTok invalidates the session (you'll get logged-out
// scrape behavior — anonymous results — until you re-login).
import { launch } from "cloakbrowser";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

const SESSION_PATH = join(process.cwd(), ".tiktok-session.json");
const TIMEOUT_MIN = 10;

const browser = await launch({
  headless: false,
  humanize: false,
  timezone: "America/Los_Angeles",
  locale: "en-US",
  launchOptions: { args: ["--no-sandbox"] },
});

const context = await browser.newContext({
  viewport: { width: 1366, height: 900 },
  deviceScaleFactor: 1,
  extraHTTPHeaders: { "Accept-Language": "en-US,en;q=0.9" },
});
const page = await context.newPage();
await page.goto("https://www.tiktok.com/login", { waitUntil: "domcontentloaded" });

console.log("");
console.log("→ Log in to TikTok in the browser window that opened.");
console.log(`  Waiting up to ${TIMEOUT_MIN} min. Session saves automatically once logged in.`);
console.log("");

const deadline = Date.now() + TIMEOUT_MIN * 60_000;
let saved = false;

while (Date.now() < deadline) {
  if (page.isClosed()) {
    console.log("Browser closed before login finished. Nothing saved.");
    break;
  }
  const cookies = await context.cookies("https://www.tiktok.com").catch(() => []);
  const sessionid = cookies.find((c) => c.name === "sessionid" && c.value);
  if (sessionid) {
    const state = await context.storageState();
    await writeFile(SESSION_PATH, JSON.stringify(state, null, 2));
    saved = true;
    console.log(`✓ Session saved to ${SESSION_PATH}`);
    console.log(`  Logged in as user with sessionid ${sessionid.value.slice(0, 8)}…`);
    break;
  }
  await new Promise((r) => setTimeout(r, 1000));
}

if (!saved && Date.now() >= deadline) {
  console.log(`Timed out after ${TIMEOUT_MIN} min. No sessionid cookie detected.`);
}

await browser.close().catch(() => {});
process.exit(saved ? 0 : 1);
