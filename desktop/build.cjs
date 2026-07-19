const { spawnSync } = require("node:child_process");
const {
  copyFileSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
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
const { version: electronVersion } = require(path.join(
  root,
  "node_modules",
  "electron",
  "package.json",
));
const betterSqliteRoot = realpathSync(
  path.join(root, "node_modules", "better-sqlite3"),
);
const prebuildCli = require.resolve("prebuild-install/bin.js", {
  paths: [betterSqliteRoot],
});
const nativeRelative = path.join(
  "node_modules",
  "better-sqlite3",
  "build",
  "Release",
  "better_sqlite3.node",
);

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
  copyFileSync(path.join(__dirname, "main.cjs"), path.join(stage, "main.cjs"));

  const nativeSource = path.join(root, nativeRelative);
  const nativeTarget = path.join(runtime, nativeRelative);
  mkdirSync(path.dirname(nativeTarget), { recursive: true });
  copyFileSync(nativeSource, nativeTarget);

  const rootPackage = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
  writeFileSync(
    path.join(stage, "package.json"),
    `${JSON.stringify(
      {
        name: rootPackage.name,
        version: rootPackage.version,
        private: true,
        main: "main.cjs",
      },
      null,
      2,
    )}\n`,
  );
}

function normalizeNativeModuleAlias() {
  const serverRoot = path.join(root, ".next", "standalone", ".next", "server");
  let replacements = 0;

  function visit(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(file);
      } else if (entry.isFile() && entry.name.endsWith(".js")) {
        const source = readFileSync(file, "utf8");
        const normalized = source.replace(
          /better-sqlite3-[0-9a-f]+/g,
          "better-sqlite3",
        );
        if (normalized !== source) {
          writeFileSync(file, normalized);
          replacements += 1;
        }
      }
    }
  }

  visit(serverRoot);
  if (replacements === 0) {
    throw new Error("Next.js did not emit the expected better-sqlite3 alias.");
  }
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

const nativeSource = path.join(root, nativeRelative);
let nativeBackup = null;
try {
  rmSync(stage, { recursive: true, force: true });
  rmSync(path.join(root, ".next", "standalone"), {
    recursive: true,
    force: true,
  });
  run(node, [nextCli, "build"]);
  normalizeNativeModuleAlias();
  pruneUnusedElectronRuntime();
  nativeBackup = readFileSync(nativeSource);
  run(node, [
    prebuildCli,
    "--runtime",
    "electron",
    "--target",
    electronVersion,
    "--arch",
    "x64",
    "--force",
  ], betterSqliteRoot);
  copyRuntime();
} finally {
  if (nativeBackup) {
    mkdirSync(path.dirname(nativeSource), { recursive: true });
    writeFileSync(nativeSource, nativeBackup);
  }
}

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
} else {
  builderArgs.splice(4, 0, "portable");
}

run(node, builderArgs);
