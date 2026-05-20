// scripts/scrape-smoke.mjs — health check for the TikTok repost scraper.
// Usage: node scripts/scrape-smoke.mjs [base-url]

const BASE = process.argv[2] || "http://localhost:3000";

const BASELINES = [
  { handle: "khaby.lame", expect: 13, tolerance: 3 },
  { handle: "mrbeast", expect: 39, tolerance: 10 },
  { handle: "charlidamelio", expect: 480, tolerance: 100 },
];

async function probe(b) {
  const url = `${BASE}/api/reposts?username=${encodeURIComponent(b.handle)}`;
  const t0 = Date.now();
  const res = await fetch(url, { signal: AbortSignal.timeout(240_000) });
  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  if (!res.ok) {
    return { ...b, ok: false, reason: `HTTP ${res.status}`, dt };
  }
  const j = await res.json();
  const n = j.reposts?.length ?? 0;
  const captcha = Boolean(j.captchaSuspected);
  const xhr = j.debug?.repostXhrSeen ?? "-";
  const profile = Boolean(j.profile);

  let ok = true;
  const failures = [];
  if (!profile) {
    ok = false;
    failures.push("profile not loaded");
  }
  if (captcha) {
    ok = false;
    failures.push("captcha flag");
  }
  if (Math.abs(n - b.expect) > b.tolerance) {
    ok = false;
    failures.push(`count ${n} vs ${b.expect}±${b.tolerance}`);
  }
  return { ...b, ok, n, captcha, xhr, dt, hasMore: j.hasMore, failures };
}

async function main() {
  console.log(`scrape-smoke → ${BASE}`);
  console.log("");
  let allOk = true;
  for (const b of BASELINES) {
    process.stdout.write(`  ${b.handle.padEnd(16)} ... `);
    try {
      const r = await probe(b);
      if (r.ok) {
        console.log(
          `OK  n=${r.n}  xhr=${r.xhr}  ${r.dt}s  hasMore=${r.hasMore}`,
        );
      } else {
        allOk = false;
        console.log(
          `FAIL n=${r.n}  xhr=${r.xhr}  ${r.dt}s  → ${r.failures.join("; ")}`,
        );
      }
    } catch (e) {
      allOk = false;
      console.log(`ERROR ${e?.message ?? e}`);
    }
  }
  console.log("");
  console.log(allOk ? "verdict: PASS" : "verdict: REGRESSION");
  process.exit(allOk ? 0 : 1);
}

main();
