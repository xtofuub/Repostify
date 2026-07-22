"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  Check,
  Database,
  ExternalLink,
  FolderOpen,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { TikTokConnect } from "@/components/tiktok-connect";

type AppInfo = {
  version: string;
  buildType: "Setup" | "Portable" | "Development" | "Web";
  packaged: boolean;
  platform: string;
  autoUpdateChecks: boolean;
};

type UpdateResult = {
  status:
    | "up-to-date"
    | "available"
    | "busy"
    | "unavailable"
    | "error";
  currentVersion: string;
  latestVersion?: string;
  message?: string;
};

type DesktopBridge = {
  getInfo: () => Promise<AppInfo>;
  checkForUpdates: () => Promise<UpdateResult>;
  openDataFolder: () => Promise<boolean>;
  syncTikTokSession: () => Promise<{ synced: number }>;
};

declare global {
  interface Window {
    repostifyDesktop?: DesktopBridge;
  }
}

type CacheStats = {
  entries: number;
  handles: number;
  reposts: number;
  bytes: number;
  newestAt: number | null;
  oldestAt: number | null;
  ttlMs: number;
  manageable: boolean;
};

const SETTINGS_NAV = [
  ["#app", "App"],
  ["#cache", "Scan cache"],
  ["#tiktok", "TikTok"],
  ["#diagnostics", "Diagnostics"],
] as const;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

function formatDate(value: number | null): string {
  if (!value) return "No scans saved";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

async function fetchCacheStats(): Promise<CacheStats> {
  const response = await fetch("/api/cache", { cache: "no-store" });
  if (!response.ok) throw new Error("Cache status unavailable");
  return (await response.json()) as CacheStats;
}

function Row({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-start gap-3.5">
        <span className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-white/[0.05] text-white/65">
          {icon}
        </span>
        <div className="min-w-0">
          <h3 className="text-[14px] font-medium text-white/90">{title}</h3>
          <p className="mt-1 max-w-[52ch] text-[12.5px] leading-5 text-white/50">
            {description}
          </p>
        </div>
      </div>
      <div className="flex flex-none items-center gap-2 pl-[46px] sm:pl-0">
        {children}
      </div>
    </div>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-8">
      <h2 className="mb-3 text-[12px] font-medium uppercase tracking-[0.16em] text-white/40">
        {title}
      </h2>
      <div className="divide-y divide-white/8 overflow-hidden rounded-xl border border-white/10 bg-white/[0.018]">
        {children}
      </div>
    </section>
  );
}

export function SettingsPanel({ sourceVersion }: { sourceVersion: string }) {
  const [appInfo, setAppInfo] = useState<AppInfo>({
    version: sourceVersion,
    buildType: "Web",
    packaged: false,
    platform: "web",
    autoUpdateChecks: false,
  });
  const [checking, setChecking] = useState(false);
  const [updateMessage, setUpdateMessage] = useState("");
  const [cache, setCache] = useState<CacheStats | null>(null);
  const [cacheLoading, setCacheLoading] = useState(true);
  const [confirmClear, setConfirmClear] = useState(false);
  const [desktopAvailable, setDesktopAvailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const bridge = window.repostifyDesktop;
    async function initialize() {
      const [cacheResult, infoResult] = await Promise.allSettled([
        fetchCacheStats(),
        bridge?.getInfo(),
      ]);
      if (cancelled) return;
      setCache(
        cacheResult.status === "fulfilled" ? cacheResult.value : null,
      );
      setCacheLoading(false);
      setDesktopAvailable(Boolean(bridge));
      if (
        infoResult.status === "fulfilled" &&
        infoResult.value
      ) {
        setAppInfo(infoResult.value);
      }
    }
    void initialize();
    return () => {
      cancelled = true;
    };
  }, []);

  async function checkUpdates() {
    if (!window.repostifyDesktop) return;
    setChecking(true);
    setUpdateMessage("");
    try {
      const result = await window.repostifyDesktop.checkForUpdates();
      if (result.status === "up-to-date") {
        setUpdateMessage(`v${result.currentVersion} is current.`);
        toast.success("Repostify is up to date");
      } else if (result.status === "available") {
        setUpdateMessage(`v${result.latestVersion} is available.`);
      } else if (result.status === "busy") {
        setUpdateMessage("An update check is already running.");
      } else {
        setUpdateMessage(result.message || "Update check unavailable.");
        if (result.status === "error") toast.error("Update check failed");
      }
    } catch {
      setUpdateMessage("Update check failed. Try again.");
      toast.error("Update check failed");
    } finally {
      setChecking(false);
    }
  }

  async function clearCache() {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    setCacheLoading(true);
    try {
      const response = await fetch("/api/cache", { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || "Could not clear cache");
      setCache(result as CacheStats);
      setConfirmClear(false);
      toast.success(`Cleared ${result.clearedEntries ?? 0} cached scans`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not clear cache");
    } finally {
      setCacheLoading(false);
    }
  }

  async function openDataFolder() {
    const opened = await window.repostifyDesktop?.openDataFolder();
    if (!opened) toast.error("Could not open the app data folder");
  }

  return (
    <div className="mt-10 grid gap-10 lg:grid-cols-[10rem_minmax(0,1fr)]">
      <aside className="hidden lg:block">
        <nav className="sticky top-8 space-y-1 text-[13px] text-white/50">
          {SETTINGS_NAV.map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="block rounded-lg px-3 py-2 transition-colors hover:bg-white/[0.04] hover:text-white"
            >
              {label}
            </a>
          ))}
        </nav>
      </aside>

      <div className="space-y-9">
        <Section id="app" title="App">
          <Row
            icon={<RefreshCw className="h-4 w-4" />}
            title={`Repostify v${appInfo.version}`}
            description={`${appInfo.buildType} build. The desktop app checks GitHub automatically after launch.`}
          >
            <div className="text-right">
              <button
                type="button"
                onClick={checkUpdates}
                disabled={!desktopAvailable || checking}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-white px-3.5 text-[12.5px] font-semibold text-black transition-colors hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25f4ee]/70"
              >
                {checking ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                Check for updates
              </button>
              {updateMessage && (
                <p className="mt-1.5 text-[11.5px] text-white/45">
                  {updateMessage}
                </p>
              )}
            </div>
          </Row>
          <Row
            icon={<ShieldCheck className="h-4 w-4" />}
            title="Verified updates"
            description="Downloads are matched to this build type and checked against GitHub's SHA-256 digest before installation."
          >
            <span className="inline-flex items-center gap-1.5 text-[12px] text-[#25f4ee]">
              <Check className="h-3.5 w-3.5" />
              Enabled
            </span>
          </Row>
        </Section>

        <Section id="cache" title="Scan cache">
          <Row
            icon={<Database className="h-4 w-4" />}
            title={
              cacheLoading
                ? "Reading cache…"
                : `${cache?.entries ?? 0} saved scan${cache?.entries === 1 ? "" : "s"}`
            }
            description="Successful scans stay cached for 15 minutes. Repeating the same handle and fetch limit returns instantly; Scan fresh always bypasses it."
          >
            <div className="text-right text-[12px] text-white/55">
              <p>{formatBytes(cache?.bytes ?? 0)}</p>
              <p className="mt-0.5 text-[11px] text-white/35">
                {formatDate(cache?.newestAt ?? null)}
              </p>
            </div>
          </Row>
          <Row
            icon={<Trash2 className="h-4 w-4" />}
            title="Clear scan cache"
            description="Deletes saved repost results only. Your TikTok connection, settings, and application files stay untouched."
          >
            {confirmClear && (
              <button
                type="button"
                onClick={() => setConfirmClear(false)}
                className="h-9 rounded-lg px-3 text-[12.5px] text-white/55 transition-colors hover:bg-white/[0.04] hover:text-white"
              >
                Cancel
              </button>
            )}
            <button
              type="button"
              onClick={clearCache}
              disabled={cacheLoading || !cache?.manageable || (cache?.entries ?? 0) === 0}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#ff2d8a]/30 px-3 text-[12.5px] font-medium text-[#ff77b3] transition-colors hover:bg-[#ff2d8a]/10 disabled:cursor-not-allowed disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff2d8a]/60"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {confirmClear ? "Confirm clear" : "Clear cache"}
            </button>
          </Row>
        </Section>

        <Section id="tiktok" title="TikTok">
          <Row
            icon={<Smartphone className="h-4 w-4" />}
            title="Connected session"
            description="A saved TikTok session can read profiles your account is allowed to see. Session cookies stay in this app's local data folder."
          >
            <TikTokConnect />
          </Row>
        </Section>

        <Section id="diagnostics" title="Diagnostics">
          <Row
            icon={<FolderOpen className="h-4 w-4" />}
            title="Local app data"
            description="Open the folder containing server.log, update.log, the TikTok session, and cached scans. Useful when troubleshooting."
          >
            <button
              type="button"
              onClick={openDataFolder}
              disabled={!desktopAvailable}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/10 px-3 text-[12.5px] font-medium text-white/70 transition-colors hover:border-white/20 hover:bg-white/[0.04] hover:text-white disabled:cursor-not-allowed disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25f4ee]/60"
            >
              <FolderOpen className="h-3.5 w-3.5" />
              Open folder
            </button>
          </Row>
          <Row
            icon={<ExternalLink className="h-4 w-4" />}
            title="Release notes"
            description="See every published version and download the Setup or Portable build manually."
          >
            <a
              href="https://github.com/xtofuub/Repostify/releases"
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/10 px-3 text-[12.5px] font-medium text-white/70 transition-colors hover:border-white/20 hover:bg-white/[0.04] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25f4ee]/60"
            >
              View releases
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Row>
        </Section>
      </div>
    </div>
  );
}
