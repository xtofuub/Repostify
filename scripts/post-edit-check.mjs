// PostToolUse hook: typecheck after edits to .ts/.tsx files.
// Reads tool input JSON from stdin (Claude Code hook contract).
// Exits 0 = silent, exits 2 = surface stderr to Claude.

import { spawnSync } from "node:child_process";

const chunks = [];
process.stdin.on("data", (c) => chunks.push(c));
process.stdin.on("end", () => {
  let payload = {};
  try {
    payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    process.exit(0);
  }

  const path =
    payload?.tool_input?.file_path ??
    payload?.tool_input?.filePath ??
    "";
  if (!/\.(ts|tsx)$/.test(path)) process.exit(0);
  if (/\.d\.ts$/.test(path)) process.exit(0);

  const r = spawnSync("npx", ["tsc", "--noEmit"], {
    shell: process.platform === "win32",
    encoding: "utf8",
  });

  if (r.status !== 0) {
    const out = (r.stdout || "") + (r.stderr || "");
    process.stderr.write(`typecheck failed after editing ${path}:\n${out}`);
    process.exit(2);
  }
  process.exit(0);
});
