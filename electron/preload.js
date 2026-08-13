const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("forklineDesktop", {
  zoomFactors: [0.75, 0.8, 0.9, 1, 1.1],
  getZoomFactor: () => ipcRenderer.invoke("forkline:desktop-zoom:get"),
  setZoomFactor: (value) => ipcRenderer.invoke("forkline:desktop-zoom:set", value),
  setTitleBarTheme: (value) => ipcRenderer.send("forkline:desktop-titlebar-theme", value),
  reportRecoveryState: (value) => ipcRenderer.send("forkline:desktop-recovery-state", value),
  saveRecoveryDraft: (value) => ipcRenderer.invoke("forkline:desktop-recovery-draft:save", value),
  readRecoveryDraft: () => ipcRenderer.invoke("forkline:desktop-recovery-draft:read"),
  getInstallerUpdateState: () => ipcRenderer.invoke("forkline:installer-update:get-state"),
  checkInstallerUpdate: () => ipcRenderer.invoke("forkline:installer-update:check"),
  installInstallerUpdate: (version) => ipcRenderer.invoke("forkline:installer-update:install", String(version || "")),
  onInstallerUpdateState: (handler) => {
    if (typeof handler !== "function") return () => {};
    const listener = (_event, state) => handler(state && typeof state === "object" ? { ...state } : null);
    ipcRenderer.on("forkline:installer-update:state", listener);
    return () => ipcRenderer.removeListener("forkline:installer-update:state", listener);
  },
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
