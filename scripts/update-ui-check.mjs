import { app, BrowserWindow } from "electron";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const outputDirectory = path.resolve(".debug");
mkdirSync(outputDirectory, { recursive: true });
app.on("window-all-closed", () => {});

app.whenReady().then(async () => {
  const windows = [];
  for (const state of [
    "available",
    "downloading",
    "verifying",
    "installing",
    "error",
  ]) {
    const window = new BrowserWindow({
      width: 500,
      height: 452,
      show: false,
      frame: false,
      backgroundColor: "#0a0a0b",
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    const query = {
      current: "0.1.6",
      latest: "0.1.7",
      bytes: String(142_300_000),
      kind: "Setup",
    };
    if (state !== "available") query.preview = state;

    await window.loadFile(path.resolve("desktop/update.html"), { query });
    const overflow = await window.webContents.executeJavaScript(`({
      horizontal: document.documentElement.scrollWidth > window.innerWidth,
      vertical: document.documentElement.scrollHeight > window.innerHeight
    })`);
    if (overflow.horizontal || overflow.vertical) {
      throw new Error(`${state} update screen overflows: ${JSON.stringify(overflow)}`);
    }
    const image = await window.webContents.capturePage();
    writeFileSync(
      path.join(outputDirectory, `update-${state}.png`),
      image.toPNG(),
    );
    windows.push(window);
  }

  console.log("Update UI states rendered without overflow.");
  for (const window of windows) window.destroy();
  app.quit();
}).catch((error) => {
  console.error(error);
  app.exit(1);
});
