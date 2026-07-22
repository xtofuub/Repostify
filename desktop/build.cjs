const { spawnSync } = require("node:child_process");
const {
  copyFileSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const stage = path.join(__dirname, "stage");
const runtime = path.join(stage, "runtime");
const node = process.execPath;
const nextCli = path.join(root, "node_modules", "next", "dist", "bin", "next");
const builderCli = path.join(root, "node_modules", "electron-builder", "cli.js");
const signedBuild = process.argv.includes("--signed");

if (signedBuild) {
  const hasCertificate = Boolean(
    process.env.WIN_CSC_LINK ||
      process.env.CSC_LINK ||
      process.env.WIN_CSC_SUBJECT_NAME,
  );
  if (!hasCertificate) {
    throw new Error(
      "Signed build requested, but no certificate was provided. Set WIN_CSC_LINK and WIN_CSC_KEY_PASSWORD, or WIN_CSC_SUBJECT_NAME for a certificate in the Windows certificate store.",
    );
  }
  process.env.REPOSTIFY_REQUIRE_SIGNING = "1";
}

function run(command, args, cwd = root) {
  const result = spawnSync(command, args, {
    cwd,
    env: { ...process.env, CI: "true", NEXT_TELEMETRY_DISABLED: "1" },
    stdio: "inherit",
    shell: false,
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed (${result.status})`);
  }
}

function copyRuntime() {
  const standalone = path.join(root, ".next", "standalone");
  if (!existsSync(path.join(standalone, "server.js"))) {
    throw new Error("Next.js standalone server was not produced.");
  }

  rmSync(stage, { recursive: true, force: true });
  mkdirSync(runtime, { recursive: true });
  cpSync(standalone, runtime, { recursive: true });
  cpSync(path.join(root, ".next", "static"), path.join(runtime, ".next", "static"), {
    recursive: true,
  });
  cpSync(path.join(root, "public"), path.join(runtime, "public"), {
    recursive: true,
  });
  for (const file of [
    "main.cjs",
    "app-preload.cjs",
    "update-preload.cjs",
    "update-renderer.js",
    "update.html",
  ]) {
    copyFileSync(path.join(__dirname, file), path.join(stage, file));
  }

  const rootPackage = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
  writeFileSync(
    path.join(stage, "package.json"),
    `${JSON.stringify(
      {
        name: rootPackage.name,
        version: rootPackage.version,
        description: rootPackage.description,
        author: rootPackage.author,
        private: true,
        main: "main.cjs",
      },
      null,
      2,
    )}\n`,
  );
}

function pruneUnusedElectronRuntime() {
  const modules = path.join(root, ".next", "standalone", "node_modules");
  const electronLink = path.join(modules, "electron");
  if (existsSync(electronLink)) {
    if (lstatSync(electronLink).isSymbolicLink()) {
      unlinkSync(electronLink);
    } else {
      rmSync(electronLink, { recursive: true, force: true });
    }
  }

  const pnpmModules = path.join(modules, ".pnpm");
  for (const entry of readdirSync(pnpmModules, { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name.startsWith("electron@")) {
      rmSync(path.join(pnpmModules, entry.name), {
        recursive: true,
        force: true,
      });
    }
  }
}

function pruneWorkspaceArtifacts() {
  const standalone = path.join(root, ".next", "standalone");
  for (const name of [".debug", "release", "repost-cache"]) {
    const target = path.join(standalone, name);
    if (existsSync(target)) rmSync(target, { recursive: true, force: true });
  }
}

function normalizeTracedPlaywrightImport() {
  const serverRoot = path.join(root, ".next", "standalone", ".next", "server");
  const aliasRoot = path.join(root, ".next", "standalone", ".next", "node_modules");
  if (!existsSync(aliasRoot)) return;

  const aliases = readdirSync(aliasRoot)
    .filter((name) => /^playwright-core-[0-9a-f]+$/.test(name));
  if (aliases.length === 0) return;

  let replacements = 0;

  function rewriteDirectory(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        rewriteDirectory(target);
        continue;
      }
      if (!entry.isFile() || !/\.(?:c|m)?js$/.test(entry.name)) continue;

      const source = readFileSync(target, "utf8");
      let rewritten = source;
      for (const alias of aliases) {
        const occurrences = rewritten.split(alias).length - 1;
        if (occurrences > 0) {
          replacements += occurrences;
          rewritten = rewritten.split(alias).join("playwright-core");
        }
      }
      if (rewritten !== source) writeFileSync(target, rewritten);
    }
  }

  rewriteDirectory(serverRoot);
  if (replacements === 0) {
    throw new Error(`Found ${aliases.join(", ")} but no server import to normalize.`);
  }
  console.log(`Normalized ${replacements} traced Playwright import(s).`);
}

rmSync(stage, { recursive: true, force: true });
rmSync(path.join(root, ".next", "standalone"), {
  recursive: true,
  force: true,
});
run(node, [nextCli, "build"]);
pruneWorkspaceArtifacts();
normalizeTracedPlaywrightImport();
pruneUnusedElectronRuntime();
copyRuntime();

const builderArgs = [
  builderCli,
  "--config",
  "electron-builder.config.cjs",
  "--win",
  "--x64",
  "--publish",
  "never",
];

if (process.argv.includes("--dir")) {
  builderArgs.push("--dir");
} else if (process.argv.includes("--portable")) {
  builderArgs.splice(4, 0, "portable");
} else {
  builderArgs.splice(4, 0, "nsis");
}

run(node, builderArgs);
