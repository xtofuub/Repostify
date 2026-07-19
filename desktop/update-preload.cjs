const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("repostifyUpdater", {
  choose(action) {
    if (action === "update" || action === "later") {
      ipcRenderer.send("repostify:update-action", action);
    }
  },
  onState(callback) {
    ipcRenderer.on("repostify:update-state", (_event, detail) => callback(detail));
  },
});
