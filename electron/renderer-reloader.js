const fs = require("node:fs");
const path = require("node:path");

const RENDERER_RELOAD_SWITCH = "--watch-renderer";
const DEFAULT_DEBOUNCE_MS = 180;

function isRendererReloadEnabled(argv, isPackaged) {
  return !isPackaged && argv.includes(RENDERER_RELOAD_SWITCH);
}

function watchRendererFiles(appRoot, onReload, options = {}) {
  const watch = options.watch || fs.watch;
  const debounceMs = Number.isFinite(options.debounceMs)
    ? options.debounceMs
    : DEFAULT_DEBOUNCE_MS;
  let active = true;
  let timer = null;
  let changedFile = "";

  const watcher = watch(path.join(appRoot, "public"), { recursive: true }, (_eventType, filename) => {
    if (!active) return;
    changedFile = filename ? String(filename) : "";
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      if (active) onReload(changedFile);
    }, debounceMs);
  });

  return () => {
    active = false;
    if (timer) clearTimeout(timer);
    timer = null;
    watcher.close();
  };
}

module.exports = {
  DEFAULT_DEBOUNCE_MS,
  RENDERER_RELOAD_SWITCH,
  isRendererReloadEnabled,
  watchRendererFiles,
};
