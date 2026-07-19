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

rmSync(stage, { recursive: true, force: true });
rmSync(path.join(root, ".next", "standalone"), {
  recursive: true,
  force: true,
});
run(node, [nextCli, "build"]);
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
