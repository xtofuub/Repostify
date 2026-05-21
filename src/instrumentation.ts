// Next.js instrumentation hook. Runs once per server process at boot.
// Used to pre-load tiktok scraper module so its fire-and-forget browser
// pre-warm starts before any user request lands.
// Docs: node_modules/next/dist/docs/14-instrumentation.mdx
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Importing the module triggers `getBrowser()` at the bottom of tiktok.ts.
    await import("@/lib/tiktok");
  }
}
