const { app, BrowserWindow, dialog, shell } = require("electron");
const { spawn, spawnSync } = require("node:child_process");
const { createWriteStream, mkdirSync } = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");

const TITLEBAR_HEIGHT = 42;
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

app.on("second-instance", () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
});

app.whenReady().then(async () => {
  app.setAppUserModelId("app.repostify.desktop");
  try {
    openWindow(await startServer());
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
