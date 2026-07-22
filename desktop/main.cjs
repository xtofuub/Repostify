const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const { spawn, spawnSync } = require("node:child_process");
const { createHash } = require("node:crypto");
const {
  appendFileSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");
const { Readable, Transform } = require("node:stream");
const { pipeline } = require("node:stream/promises");

const TITLEBAR_HEIGHT = 42;
const LATEST_RELEASE_API =
  "https://api.github.com/repos/xtofuub/Repostify/releases/latest";
const DESKTOP_CHROME_CSS = `
  html { background: #0a0a0b !important; }
  body { padding-top: ${TITLEBAR_HEIGHT}px !important; }
  body::before {
    content: "Repostify";
    position: fixed;
    inset: 0 138px auto 0;
    z-index: 2147483646;
    height: ${TITLEBAR_HEIGHT}px;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    padding-left: 34px;
    color: rgba(255, 255, 255, 0.82);
    font: 500 12px/1 "Inter", "Segoe UI", system-ui, sans-serif;
    letter-spacing: 0.01em;
    background:
      radial-gradient(circle at 18px 50%, #25f4ee 0 2px, transparent 2.5px),
      #0a0a0b;
    box-shadow: 0 1px 0 rgba(255, 255, 255, 0.07);
    -webkit-app-region: drag;
    user-select: none;
  }
`;

let mainWindow = null;
let serverProcess = null;
let quitting = false;
let updateCheckRunning = false;
let updateWindow = null;

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

function runtimeRoot() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "app.asar.unpacked", "runtime")
    : path.join(__dirname, "stage", "runtime");
}

function reservePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

function waitForServer(url, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      if (serverProcess?.exitCode !== null) {
        reject(new Error("Local server stopped during startup."));
        return;
      }
      const request = http.get(url, (response) => {
        response.resume();
        if ((response.statusCode ?? 500) < 500) {
          resolve();
        } else {
          retry();
        }
      });
      request.setTimeout(1_000, () => request.destroy());
      request.on("error", retry);
    };
    const retry = () => {
      if (Date.now() >= deadline) {
        reject(new Error("Local server did not become ready in time."));
      } else {
        setTimeout(attempt, 250);
      }
    };
    attempt();
  });
}

async function startServer() {
  const port = await reservePort();
  const root = runtimeRoot();
  const serverFile = path.join(root, "server.js");
  const dataDir = app.getPath("userData");
  mkdirSync(dataDir, { recursive: true });

  const log = createWriteStream(path.join(dataDir, "server.log"), {
    flags: "a",
  });
  log.write(`[desktop] Starting runtime from ${root}\n`);
  serverProcess = spawn(process.execPath, [serverFile], {
    cwd: root,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      HOSTNAME: "127.0.0.1",
      PORT: String(port),
      NODE_ENV: "production",
      NODE_PATH: path.join(app.getAppPath(), "node_modules"),
      NEXT_TELEMETRY_DISABLED: "1",
      REPOSTIFY_DATA_DIR: dataDir,
      REPOSTIFY_DESKTOP: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  const serverStarted = new Promise((resolve, reject) => {
    serverProcess.once("spawn", resolve);
    serverProcess.once("error", (error) => {
      log.write(`[desktop] Failed to spawn local server: ${error.stack ?? error}\n`);
      reject(error);
    });
  });
  serverProcess.stdout.pipe(log);
  serverProcess.stderr.pipe(log);
  serverProcess.once("exit", (code) => {
    log.end();
    if (!quitting && code !== 0) {
      void dialog.showErrorBox(
        "Repostify stopped",
        `The local server exited with code ${code}. Log: ${path.join(dataDir, "server.log")}`,
      );
      app.quit();
    }
  });

  await serverStarted;
  const url = `http://127.0.0.1:${port}`;
  await waitForServer(url);
  return url;
}

function openWindow(url) {
  const origin = new URL(url).origin;
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#0a0a0b",
    title: "Repostify",
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "#0a0a0b",
      symbolColor: "#dedee3",
      height: TITLEBAR_HEIGHT,
    },
    roundedCorners: true,
    webPreferences: {
      preload: path.join(__dirname, "app-preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  void mainWindow.webContents.insertCSS(DESKTOP_CHROME_CSS);

  // Wheel events inside TikTok's cross-origin iframe never bubble into React.
  // Electron can install a tiny forwarder inside that frame without covering
  // or disabling any of TikTok's native controls.
  mainWindow.webContents.on("frame-created", (_event, { frame }) => {
    frame?.on("dom-ready", () => {
      if (!frame.url.startsWith("https://www.tiktok.com/player/")) return;
      void frame
        .executeJavaScript(`
          (() => {
            if (window.__repostifyWheelForwarder) return;
            window.__repostifyWheelForwarder = true;
            if (/access denied|don't have permission to access/i.test(document.body?.innerText || "")) {
              window.parent.postMessage({ type: "repostify:player-denied" }, "*");
            }
            window.addEventListener("wheel", (event) => {
              window.parent.postMessage({
                type: "repostify:player-wheel",
                deltaY: event.deltaY,
              }, "*");
            }, { capture: true, passive: true });
          })();
        `)
        .catch(() => {});
    });
  });

  mainWindow.webContents.setWindowOpenHandler(({ url: target }) => {
    if (target.startsWith("https://") || target.startsWith("http://")) {
      void shell.openExternal(target);
    }
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, target) => {
    if (new URL(target).origin !== origin) {
      event.preventDefault();
      if (target.startsWith("https://") || target.startsWith("http://")) {
        void shell.openExternal(target);
      }
    }
  });
  let revealed = false;
  const reveal = () => {
    if (revealed || !mainWindow || mainWindow.isDestroyed()) return;
    revealed = true;
    mainWindow.show();
    mainWindow.focus();
  };
  mainWindow.once("ready-to-show", reveal);
  mainWindow.webContents.once("did-finish-load", reveal);
  setTimeout(reveal, 3_000).unref();
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  void mainWindow.loadURL(url);
}

function stopServer() {
  if (!serverProcess || serverProcess.exitCode !== null) return;
  if (process.platform === "win32" && serverProcess.pid) {
    spawnSync("taskkill.exe", ["/pid", String(serverProcess.pid), "/T", "/F"], {
      windowsHide: true,
      stdio: "ignore",
    });
  } else {
    serverProcess.kill("SIGTERM");
  }
  serverProcess = null;
}

function isNewerVersion(candidate, current) {
  const parse = (value) =>
    String(value)
      .replace(/^v/i, "")
      .split("-")[0]
      .split(".")
      .map((part) => Number.parseInt(part, 10) || 0);
  const next = parse(candidate);
  const installed = parse(current);
  for (let index = 0; index < Math.max(next.length, installed.length); index++) {
    const difference = (next[index] ?? 0) - (installed[index] ?? 0);
    if (difference !== 0) return difference > 0;
  }
  return false;
}

function isPortableBuild() {
  return Boolean(process.env.PORTABLE_EXECUTABLE_FILE);
}

function appendUpdateLog(message) {
  try {
    appendFileSync(
      path.join(app.getPath("userData"), "update.log"),
      `[${new Date().toISOString()}] ${message}\n`,
      "utf8",
    );
  } catch {
    // Update logging must never stop the app from launching.
  }
}

function createUpdateWindow({ currentVersion, latestVersion, asset }) {
  const window = new BrowserWindow({
    width: 500,
    height: 500,
    minWidth: 500,
    minHeight: 500,
    maxWidth: 500,
    maxHeight: 500,
    parent: mainWindow,
    modal: true,
    show: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    autoHideMenuBar: true,
    backgroundColor: "#0a0a0b",
    title: "Repostify update",
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "#0a0a0b",
      symbolColor: "#d7d7dc",
      height: TITLEBAR_HEIGHT,
    },
    webPreferences: {
      preload: path.join(__dirname, "update-preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  updateWindow = window;

  let closed = false;
  let closeLocked = false;
  let resolveAction = null;
  let cancelDownload = null;

  const finishAction = (action) => {
    if (!resolveAction) return;
    const resolve = resolveAction;
    resolveAction = null;
    resolve(action);
  };

  const onAction = (event, action) => {
    if (event.sender !== window.webContents) return;
    if (!new Set(["update", "later"]).has(action)) return;
    if (action === "later") {
      window.close();
      return;
    }
    finishAction("update");
  };
  ipcMain.on("repostify:update-action", onAction);

  window.on("close", (event) => {
    if (closeLocked && !quitting) event.preventDefault();
  });
  window.on("closed", () => {
    closed = true;
    ipcMain.removeListener("repostify:update-action", onAction);
    if (updateWindow === window) updateWindow = null;
    cancelDownload?.();
    finishAction("later");
  });
  window.once("ready-to-show", () => window.show());
  void window.loadFile(path.join(__dirname, "update.html"), {
    query: {
      current: currentVersion,
      latest: latestVersion,
      bytes: String(Number(asset.size) || 0),
      kind: isPortableBuild() ? "Portable" : "Setup",
    },
  });

  return {
    waitForAction() {
      if (closed) return Promise.resolve("later");
      return new Promise((resolve) => {
        resolveAction = resolve;
      });
    },
    sendState(state, detail = {}) {
      if (closed || window.isDestroyed()) return;
      window.webContents.send("repostify:update-state", { state, ...detail });
    },
    setCancelDownload(handler) {
      cancelDownload = handler;
    },
    lockClose() {
      closeLocked = true;
    },
    unlockClose() {
      closeLocked = false;
    },
    close() {
      if (!closed && !window.isDestroyed()) window.destroy();
    },
  };
}

async function downloadUpdateAsset(asset, { signal, onProgress } = {}) {
  const expectedDigest = String(asset.digest ?? "").toLowerCase();
  if (!/^sha256:[0-9a-f]{64}$/.test(expectedDigest)) {
    throw new Error("GitHub did not provide a valid SHA-256 digest for this update.");
  }

  const fileName = path.basename(String(asset.name ?? ""));
  if (!fileName.toLowerCase().endsWith(".exe")) {
    throw new Error("The release does not contain a valid Windows application.");
  }
  const tempRoot = path.resolve(app.getPath("temp"));
  const target = path.resolve(tempRoot, fileName);
  if (path.dirname(target) !== tempRoot) {
    throw new Error("Unsafe update file path.");
  }

  rmSync(target, { force: true });
  const response = await fetch(asset.browser_download_url, {
    headers: { "User-Agent": `Repostify/${app.getVersion()}` },
    redirect: "follow",
    signal,
  });
  if (!response.ok || !response.body) {
    throw new Error(`Update download failed with HTTP ${response.status}.`);
  }

  const hash = createHash("sha256");
  let downloaded = 0;
  const expectedSize = Number(asset.size) || 0;
  const meter = new Transform({
    transform(chunk, _encoding, callback) {
      downloaded += chunk.length;
      hash.update(chunk);
      if (expectedSize > 0 && mainWindow && !mainWindow.isDestroyed()) {
        const progress = Math.min(downloaded / expectedSize, 1);
        mainWindow.setProgressBar(progress);
        onProgress?.({ downloaded, total: expectedSize, progress });
      }
      callback(null, chunk);
    },
  });

  try {
    await pipeline(
      Readable.fromWeb(response.body),
      meter,
      createWriteStream(target, { flags: "wx" }),
    );
    if (expectedSize > 0 && downloaded !== expectedSize) {
      throw new Error("The downloaded update has the wrong size.");
    }
    const actualDigest = `sha256:${hash.digest("hex")}`;
    if (actualDigest !== expectedDigest) {
      throw new Error("The downloaded update failed its security check.");
    }
    return target;
  } catch (error) {
    rmSync(target, { force: true });
    throw error;
  } finally {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.setProgressBar(-1);
  }
}

function spawnDetached(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
      ...options,
    });
    child.once("error", reject);
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
  });
}

function quotePowerShell(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function launchPortableReplacement(updateFile, latestVersion) {
  const portableFile = path.resolve(String(process.env.PORTABLE_EXECUTABLE_FILE));
  if (
    path.extname(portableFile).toLowerCase() !== ".exe" ||
    !existsSync(portableFile)
  ) {
    throw new Error("The original portable application could not be found.");
  }

  const userData = app.getPath("userData");
  const logFile = path.join(userData, "update.log");
  const helperFile = path.join(userData, "finish-portable-update.ps1");
  const expectedSize = statSync(updateFile).size;
  const installedLogMessage = quotePowerShell(
    `Portable update installed: ${latestVersion}`,
  );
  const script = [
    "$ErrorActionPreference = 'Stop'",
    `$source = ${quotePowerShell(updateFile)}`,
    `$destination = ${quotePowerShell(portableFile)}`,
    `$staging = ${quotePowerShell(`${portableFile}.repostify-update`)}`,
    `$backup = ${quotePowerShell(`${portableFile}.repostify-backup`)}`,
    `$log = ${quotePowerShell(logFile)}`,
    `Wait-Process -Id ${process.pid} -ErrorAction SilentlyContinue`,
    "try {",
    "  Remove-Item -LiteralPath $staging -Force -ErrorAction SilentlyContinue",
    "  Remove-Item -LiteralPath $backup -Force -ErrorAction SilentlyContinue",
    "  Copy-Item -LiteralPath $source -Destination $staging -Force",
    `  if ((Get-Item -LiteralPath $staging).Length -ne ${expectedSize}) { throw 'Portable update copy is incomplete.' }`,
    "  [System.IO.File]::Replace($staging, $destination, $backup)",
    "  Remove-Item -LiteralPath $backup -Force",
    "  Remove-Item -LiteralPath $source -Force -ErrorAction SilentlyContinue",
    `  Add-Content -LiteralPath $log -Value ('[' + (Get-Date).ToUniversalTime().ToString('o') + '] ' + ${installedLogMessage})`,
    "  Start-Process -FilePath $destination -ArgumentList '--updated'",
    "} catch {",
    "  Remove-Item -LiteralPath $staging -Force -ErrorAction SilentlyContinue",
    "  if ((-not (Test-Path -LiteralPath $destination)) -and (Test-Path -LiteralPath $backup)) { Move-Item -LiteralPath $backup -Destination $destination -Force }",
    "  Add-Content -LiteralPath $log -Value ('[' + (Get-Date).ToUniversalTime().ToString('o') + '] Portable update failed: ' + $_.Exception.Message)",
    "  Add-Type -AssemblyName PresentationFramework",
    "  [System.Windows.MessageBox]::Show('Repostify could not replace the portable EXE. The old copy is unchanged. See update.log in AppData for details.', 'Update failed', 'OK', 'Error') | Out-Null",
    "  Start-Process -FilePath $destination",
    "  exit 1",
    "}",
  ].join("\r\n");
  writeFileSync(helperFile, `${script}\r\n`, "utf8");

  await spawnDetached("powershell.exe", [
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy",
    "Bypass",
    "-WindowStyle",
    "Hidden",
    "-File",
    helperFile,
  ]);
}

async function launchInstalledUpdate(updateFile) {
  await spawnDetached(
    updateFile,
    ["/S", "--updated", "--force-run"],
    { cwd: path.dirname(updateFile) },
  );
}

async function launchUpdate(updateFile, latestVersion) {
  appendUpdateLog(
    `Starting ${isPortableBuild() ? "portable" : "setup"} update ${app.getVersion()} -> ${latestVersion}`,
  );
  if (isPortableBuild()) {
    await launchPortableReplacement(updateFile, latestVersion);
  } else {
    await launchInstalledUpdate(updateFile);
  }
}

async function checkForUpdates() {
  const currentVersion = app.getVersion();
  if (
    !app.isPackaged ||
    process.platform !== "win32" ||
    !mainWindow ||
    mainWindow.isDestroyed()
  ) {
    return {
      status: "unavailable",
      currentVersion,
      message: app.isPackaged
        ? "Update checks are unavailable right now."
        : "Update checks are enabled in packaged Windows builds.",
    };
  }
  if (updateCheckRunning) {
    return { status: "busy", currentVersion };
  }
  updateCheckRunning = true;
  let updateUi = null;
  let retryRequested = false;
  try {
    const response = await fetch(LATEST_RELEASE_API, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": `Repostify/${app.getVersion()}`,
      },
    });
    if (!response.ok) throw new Error(`GitHub returned HTTP ${response.status}.`);
    const release = await response.json();
    const latestVersion = String(release.tag_name ?? "").replace(/^v/i, "");
    if (!latestVersion || !isNewerVersion(latestVersion, currentVersion)) {
      return {
        status: "up-to-date",
        currentVersion,
        latestVersion: latestVersion || currentVersion,
      };
    }

    const wanted = isPortableBuild() ? /Portable\.exe$/i : /Setup\.exe$/i;
    const asset = Array.isArray(release.assets)
      ? release.assets.find((item) => wanted.test(String(item.name ?? "")))
      : null;
    if (!asset) {
      throw new Error(
        `Repostify v${latestVersion} has no matching Windows ${isPortableBuild() ? "Portable" : "Setup"} asset.`,
      );
    }

    updateUi = createUpdateWindow({
      currentVersion: app.getVersion(),
      latestVersion,
      asset,
    });
    if ((await updateUi.waitForAction()) !== "update") {
      return {
        status: "available",
        currentVersion,
        latestVersion,
      };
    }

    const abortController = new AbortController();
    updateUi.setCancelDownload(() => abortController.abort());
    updateUi.sendState("downloading", { progress: 0 });
    const updateFile = await downloadUpdateAsset(asset, {
      signal: abortController.signal,
      onProgress: ({ downloaded, total, progress }) =>
        updateUi?.sendState("downloading", {
          downloaded,
          total,
          progress,
        }),
    });
    updateUi.sendState("verifying", { progress: 1 });
    updateUi.lockClose();
    updateUi.sendState("installing", { latestVersion });
    await launchUpdate(updateFile, latestVersion);
    quitting = true;
    setTimeout(() => app.quit(), 700).unref();
    return {
      status: "available",
      currentVersion,
      latestVersion,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (updateUi && error?.name !== "AbortError") {
      appendUpdateLog(`Update failed: ${message}`);
      updateUi.unlockClose();
      updateUi.sendState("error", { message });
      if ((await updateUi.waitForAction()) === "update") {
        updateUi.close();
        retryRequested = true;
      }
    } else if (error?.name !== "AbortError") {
      appendUpdateLog(`Update check failed: ${message}`);
    }
    return {
      status: "error",
      currentVersion,
      message,
    };
  } finally {
    if (quitting) return;
    updateCheckRunning = false;
    if (retryRequested) setTimeout(() => void checkForUpdates(), 0).unref();
  }
}

function isMainRenderer(event) {
  return Boolean(
    mainWindow &&
      !mainWindow.isDestroyed() &&
      event.sender === mainWindow.webContents,
  );
}

ipcMain.handle("repostify:app-info", (event) => {
  if (!isMainRenderer(event)) throw new Error("Untrusted renderer.");
  return {
    version: app.getVersion(),
    buildType: app.isPackaged
      ? isPortableBuild()
        ? "Portable"
        : "Setup"
      : "Development",
    packaged: app.isPackaged,
    platform: process.platform,
    autoUpdateChecks: app.isPackaged && process.platform === "win32",
  };
});

ipcMain.handle("repostify:check-for-updates", (event) => {
  if (!isMainRenderer(event)) throw new Error("Untrusted renderer.");
  return checkForUpdates();
});

ipcMain.handle("repostify:open-data-folder", async (event) => {
  if (!isMainRenderer(event)) throw new Error("Untrusted renderer.");
  const error = await shell.openPath(app.getPath("userData"));
  return error === "";
});

ipcMain.handle("repostify:sync-tiktok-session", async (event) => {
  if (!isMainRenderer(event)) throw new Error("Untrusted renderer.");

  const cookieStore = event.sender.session.cookies;
  const existing = await cookieStore.get({ domain: "tiktok.com" });
  await Promise.all(
    existing.map((cookie) => {
      const protocol = cookie.secure ? "https" : "http";
      const host = cookie.domain.replace(/^\./, "");
      return cookieStore.remove(`${protocol}://${host}${cookie.path}`, cookie.name);
    }),
  );

  const sessionPath = path.join(app.getPath("userData"), ".tiktok-session.json");
  if (!existsSync(sessionPath)) return { synced: 0 };

  const stored = JSON.parse(readFileSync(sessionPath, "utf8"));
  const cookies = Array.isArray(stored?.cookies) ? stored.cookies : [];
  let synced = 0;
  for (const cookie of cookies) {
    if (!cookie?.name || !cookie?.value || !/(^|\.)tiktok\.com$/i.test(cookie.domain ?? "")) {
      continue;
    }
    const host = cookie.domain.replace(/^\./, "");
    const cookiePath = cookie.path || "/";
    const sameSite =
      cookie.sameSite === "None"
        ? "no_restriction"
        : cookie.sameSite === "Strict"
          ? "strict"
          : cookie.sameSite === "Lax"
            ? "lax"
            : "unspecified";
    const details = {
      url: `${cookie.secure === false ? "http" : "https"}://${host}${cookiePath}`,
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain,
      path: cookiePath,
      secure: cookie.secure !== false,
      httpOnly: Boolean(cookie.httpOnly),
      sameSite,
    };
    if (Number.isFinite(cookie.expires) && cookie.expires > 0) {
      details.expirationDate = cookie.expires;
    }
    await cookieStore.set(details);
    synced += 1;
  }
  await event.sender.session.flushStorageData();
  return { synced };
});

app.on("second-instance", () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
});

app.whenReady().then(async () => {
  app.setAppUserModelId("app.repostify.desktop");
  if (process.argv.includes("--updated")) {
    appendUpdateLog(`Update complete. Running Repostify ${app.getVersion()}.`);
  }
  try {
    openWindow(await startServer());
    setTimeout(() => void checkForUpdates(), 5_000).unref();
  } catch (error) {
    dialog.showErrorBox(
      "Repostify could not start",
      error instanceof Error ? error.message : String(error),
    );
    app.quit();
  }
});

app.on("window-all-closed", () => app.quit());
app.on("will-quit", () => {
  quitting = true;
  stopServer();
});
