import { launch } from "cloakbrowser";
import type { Browser, BrowserContext, Page } from "playwright";
import { writeFile, unlink } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { DATA_DIR } from "@/lib/data-dir";

const SESSION_PATH = join(DATA_DIR, ".tiktok-session.json");
const TIMEOUT_MS = 10 * 60_000;

export type LoginPhase =
  | "idle"
  | "opening"
  | "awaiting"
  | "saved"
  | "timeout"
  | "cancelled"
  | "error";

type LoginState = {
  phase: LoginPhase;
  message: string;
  startedAt: number | null;
  // Epoch ms of the session file, or null when not connected.
  connectedAt: number | null;
};

let state: LoginState = {
  phase: "idle",
  message: "",
  startedAt: null,
  connectedAt: null,
};

// Live handles so a second click (or cancel) can tear the window down.
let activeBrowser: Browser | null = null;
let activeContext: BrowserContext | null = null;
let activePage: Page | null = null;
let running = false;

function sessionConnectedAt(): number | null {
  if (!existsSync(SESSION_PATH)) return null;
  try {
    return statSync(SESSION_PATH).mtimeMs;
  } catch {
    return null;
  }
}

export function getLoginState(): LoginState {
  // Always reflect the on-disk session so a restart still shows "connected".
  return { ...state, connectedAt: sessionConnectedAt() };
}

async function teardown(): Promise<void> {
  try {
    await activeBrowser?.close();
  } catch {
    // ignore
  }
  activeBrowser = null;
  activeContext = null;
  activePage = null;
  running = false;
}

// Launch a visible browser, navigate to the TikTok login page, and poll for
// the `sessionid` cookie. Saves storageState to .tiktok-session.json. Returns
// immediately; callers poll getLoginState(). Requires a desktop session on the
// host (i.e. local / self-hosted), so it's disabled in production.
export function startLogin(): LoginState {
  if (running) return getLoginState();
  running = true;
  state = {
    phase: "opening",
    message: "Launching a browser window…",
    startedAt: Date.now(),
    connectedAt: sessionConnectedAt(),
  };

  void (async () => {
    try {
      activeBrowser = (await launch({
        headless: false,
        humanize: false,
        timezone: "America/Los_Angeles",
        locale: "en-US",
        launchOptions: { args: ["--no-sandbox"] },
      })) as unknown as Browser;
      activeContext = await activeBrowser.newContext({
        viewport: { width: 1366, height: 900 },
        deviceScaleFactor: 1,
        extraHTTPHeaders: { "Accept-Language": "en-US,en;q=0.9" },
      });
      activePage = await activeContext.newPage();
      await activePage.goto("https://www.tiktok.com/login", {
        waitUntil: "domcontentloaded",
      });

      state = {
        ...state,
        phase: "awaiting",
        message: "Log in to TikTok in the window that opened.",
      };

      const deadline = Date.now() + TIMEOUT_MS;
      while (Date.now() < deadline) {
        if (!activeContext || !activePage) break;
        if (activePage.isClosed()) {
          state = {
            ...state,
            phase: "cancelled",
            message: "Login window closed before finishing.",
          };
          break;
        }
        const cookies = await activeContext
          .cookies("https://www.tiktok.com")
          .catch(() => []);
        const sessionid = cookies.find(
          (c) => c.name === "sessionid" && c.value,
        );
        if (sessionid) {
          const storage = await activeContext.storageState();
          await writeFile(SESSION_PATH, JSON.stringify(storage, null, 2));
          state = {
            phase: "saved",
            message: "Connected. Future scrapes use this session.",
            startedAt: state.startedAt,
            connectedAt: sessionConnectedAt(),
          };
          break;
        }
        await new Promise((r) => setTimeout(r, 1000));
      }

      if (state.phase === "awaiting") {
        state = {
          ...state,
          phase: "timeout",
          message: "Timed out waiting for login.",
        };
      }
    } catch (err) {
      state = {
        ...state,
        phase: "error",
        message: err instanceof Error ? err.message : "Login failed.",
      };
    } finally {
      await teardown();
    }
  })();

  return getLoginState();
}

export async function cancelLogin(): Promise<void> {
  if (running) {
    state = { ...state, phase: "cancelled", message: "Login cancelled." };
  }
  await teardown();
}

// Disconnect: remove the saved session so scrapes go anonymous again.
export async function logout(): Promise<void> {
  await teardown();
  if (existsSync(SESSION_PATH)) {
    await unlink(SESSION_PATH).catch(() => {});
  }
  state = {
    phase: "idle",
    message: "Disconnected.",
    startedAt: null,
    connectedAt: null,
  };
}
