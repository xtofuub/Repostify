const params = new URLSearchParams(window.location.search);
const currentVersion = params.get("current") || "unknown";
const latestVersion = params.get("latest") || "new";
const assetBytes = Number(params.get("bytes")) || 0;
const buildKind = params.get("kind") || "Windows";
const updater = window.repostifyUpdater || {
  choose() {},
  onState() {},
};

const elements = {
  body: document.body,
  currentVersion: document.querySelector("[data-current-version]"),
  latestVersion: document.querySelector("[data-latest-version]"),
  meta: document.querySelector("[data-update-meta]"),
  title: document.querySelector("[data-title]"),
  description: document.querySelector("[data-description]"),
  progress: document.querySelector("[data-progress]"),
  progressText: document.querySelector("[data-progress-text]"),
  progressBytes: document.querySelector("[data-progress-bytes]"),
  error: document.querySelector("[data-error]"),
  actions: document.querySelector("[data-actions]"),
};

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "Windows x64";
  const units = ["B", "KB", "MB", "GB"];
  const unit = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** unit;
  return `${value >= 100 || unit === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unit]}`;
}

function setProgress(value) {
  const progress = Math.max(0, Math.min(Number(value) || 0, 1));
  elements.progress.style.setProperty("--progress", progress);
  elements.progress.setAttribute("aria-valuenow", String(Math.round(progress * 100)));
  elements.progressText.textContent = `${Math.round(progress * 100)}%`;
}

function setState(detail) {
  const state = detail.state || "available";
  elements.body.dataset.state = state;
  elements.error.textContent = "";

  if (state === "downloading") {
    elements.title.textContent = "Downloading update.";
    elements.description.textContent =
      "Keep this window open. Repostify will verify the file before anything is installed.";
    setProgress(detail.progress);
    elements.progressBytes.textContent = detail.total
      ? `${formatBytes(detail.downloaded || 0)} of ${formatBytes(detail.total)}`
      : "Starting download";
  } else if (state === "verifying") {
    elements.title.textContent = "Verifying download.";
    elements.description.textContent =
      "The download is complete. Its SHA-256 signature is being checked now.";
    setProgress(1);
    elements.progressBytes.textContent = "Security check in progress";
    elements.progressText.textContent = "Done";
  } else if (state === "installing") {
    elements.title.textContent = "Installing update.";
    elements.description.textContent =
      "Repostify will close and reopen automatically. Your settings and TikTok connection stay in place.";
    setProgress(1);
    elements.progressBytes.textContent = "Ready to restart";
    elements.progressText.textContent = "100%";
  } else if (state === "error") {
    elements.title.textContent = "Update did not finish.";
    elements.description.textContent =
      "Nothing was replaced. Check your connection and try the download again.";
    elements.error.textContent = detail.message || "Unknown update error.";
  }
}

elements.currentVersion.textContent = currentVersion;
elements.latestVersion.textContent = latestVersion;
elements.meta.textContent = `${formatBytes(assetBytes)} · Windows x64 · ${buildKind}`;

document.querySelectorAll("[data-action]").forEach((button) => {
  button.addEventListener("click", () => {
    updater.choose(button.dataset.action);
  });
});

updater.onState(setState);

const previewState = params.get("preview");
if (["downloading", "verifying", "installing", "error"].includes(previewState)) {
  setState({
    state: previewState,
    progress: Number(params.get("progress")) || 0.64,
    downloaded: Math.round(assetBytes * 0.64),
    total: assetBytes,
    message: "The downloaded file could not be verified.",
  });
}
