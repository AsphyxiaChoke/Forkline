const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("forklineDesktop", {
  zoomFactors: [0.75, 0.8, 0.9, 1, 1.1],
  getZoomFactor: () => ipcRenderer.invoke("forkline:desktop-zoom:get"),
  setZoomFactor: (value) => ipcRenderer.invoke("forkline:desktop-zoom:set", value),
  setTitleBarTheme: (value) => ipcRenderer.send("forkline:desktop-titlebar-theme", value),
  reportRecoveryState: (value) => ipcRenderer.send("forkline:desktop-recovery-state", value),
  saveRecoveryDraft: (value) => ipcRenderer.invoke("forkline:desktop-recovery-draft:save", value),
  readRecoveryDraft: () => ipcRenderer.invoke("forkline:desktop-recovery-draft:read"),
  onOpenRepository: (handler) => {
    if (typeof handler !== "function") return () => {};
    const listener = (_event, repository) => handler(String(repository || ""));
    ipcRenderer.on("forkline:open-repository", listener);
    return () => ipcRenderer.removeListener("forkline:open-repository", listener);
  },
});

window.addEventListener("DOMContentLoaded", () => {
  document.documentElement.dataset.shell = "electron";
});
