// Next.js instrumentation hook. Runs once per server process at boot.
// Pre-warms the browser before the first runtime request without triggering a
// Chromium download in `next build` workers.
// Docs: node_modules/next/dist/docs/14-instrumentation.mdx
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { prewarmBrowser } = await import("@/lib/tiktok");
    if (process.env.NEXT_PHASE !== "phase-production-build") {
      void prewarmBrowser().catch(() => {});
    }
  }
}
