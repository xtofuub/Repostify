const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("repostifyDesktop", {
  getInfo() {
    return ipcRenderer.invoke("repostify:app-info");
  },
  checkForUpdates() {
    return ipcRenderer.invoke("repostify:check-for-updates");
  },
  openDataFolder() {
    return ipcRenderer.invoke("repostify:open-data-folder");
  },
  syncTikTokSession() {
    return ipcRenderer.invoke("repostify:sync-tiktok-session");
  },
});
