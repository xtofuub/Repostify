const { app, BrowserWindow, dialog, shell } = require("electron");
const { spawn, spawnSync } = require("node:child_process");
const { createHash } = require("node:crypto");
const { createWriteStream, mkdirSync, rmSync } = require("node:fs");
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

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

function runtimeRoot() {
  return app.isPackaged
    ? path.join(app.getAppPath(), "runtime")
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
  serverProcess = spawn(process.execPath, [serverFile], {
    cwd: root,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      HOSTNAME: "127.0.0.1",
      PORT: String(port),
      NODE_ENV: "production",
      NEXT_TELEMETRY_DISABLED: "1",
      REPOSTIFY_DATA_DIR: dataDir,
      REPOSTIFY_DESKTOP: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
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
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  void mainWindow.webContents.insertCSS(DESKTOP_CHROME_CSS);

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

async function downloadUpdateAsset(asset) {
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
        mainWindow.setProgressBar(Math.min(downloaded / expectedSize, 1));
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

function launchAfterExit(updateFile) {
  const escapedFile = updateFile.replace(/'/g, "''");
  const command = [
    `Wait-Process -Id ${process.pid} -ErrorAction SilentlyContinue`,
    `Start-Process -FilePath '${escapedFile}'`,
  ].join("; ");
  const encoded = Buffer.from(command, "utf16le").toString("base64");
  spawn(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-WindowStyle",
      "Hidden",
      "-EncodedCommand",
      encoded,
    ],
    { detached: true, stdio: "ignore", windowsHide: true },
  ).unref();
}

async function checkForUpdates() {
  if (
    updateCheckRunning ||
    !app.isPackaged ||
    process.platform !== "win32" ||
    !mainWindow ||
    mainWindow.isDestroyed()
  ) {
    return;
  }
  updateCheckRunning = true;
  let updateAccepted = false;
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
    if (!latestVersion || !isNewerVersion(latestVersion, app.getVersion())) return;

    const wanted = isPortableBuild() ? /Portable\.exe$/i : /Setup\.exe$/i;
    const asset = Array.isArray(release.assets)
      ? release.assets.find((item) => wanted.test(String(item.name ?? "")))
      : null;
    if (!asset) return;

    const choice = await dialog.showMessageBox(mainWindow, {
      type: "info",
      title: "Repostify update available",
      message: `Repostify ${latestVersion} is ready`,
      detail: `You have ${app.getVersion()}. Download and install the newer version now?`,
      buttons: ["Update now", "Later"],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
    });
    if (choice.response !== 0) return;
    updateAccepted = true;

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setTitle("Downloading Repostify update...");
    }
    const updateFile = await downloadUpdateAsset(asset);
    launchAfterExit(updateFile);
    quitting = true;
    app.quit();
  } catch (error) {
    // Startup checks are intentionally quiet when offline or rate-limited.
    // Once the user presses Update now, download/install failures are useful.
    if (updateAccepted && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setTitle("Repostify");
      await dialog.showMessageBox(mainWindow, {
        type: "error",
        title: "Update failed",
        message: "Repostify could not install the update",
        detail: error instanceof Error ? error.message : String(error),
        buttons: ["OK"],
      });
    }
  } finally {
    updateCheckRunning = false;
  }
}

app.on("second-instance", () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
});

app.whenReady().then(async () => {
  app.setAppUserModelId("app.repostify.desktop");
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
