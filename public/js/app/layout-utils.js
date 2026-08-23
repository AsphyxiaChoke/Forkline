// Theme, layout resizing, and small shared utility functions.
const themeCatalog = [
  { id: "dark", label: "深色", description: "适合长时间查看提交图谱", swatches: ["#0e1117", "#1b2130", "#22d3c3", "#ff826f"] },
  { id: "light", label: "浅色", description: "适合明亮环境", swatches: ["#f4f7fb", "#ffffff", "#0d8f86", "#3f7db7"] },
  { id: "graphite", label: "石墨", description: "中性灰黑，强调色更克制", swatches: ["#111315", "#20242a", "#4fd1c5", "#f2c96d"] },
  { id: "forest", label: "森林", description: "深绿背景，适合长时间查看", swatches: ["#0d1513", "#192a24", "#63d6a4", "#ff8b7a"] },
  { id: "rose", label: "樱色", description: "浅粉灰背景，层次更柔和", swatches: ["#f8f3f6", "#ffffff", "#b3426d", "#3f7db7"] },
  { id: "contrast", label: "高对比", description: "黑白对比更强，状态更醒目", swatches: ["#050607", "#11151a", "#35e6d0", "#ffd45c"] },
];
const historyColumnStorageKey = "forkline-history-columns";
const historyColumnVariables = {
  graph: "--history-graph-col-w",
  author: "--history-author-w",
  time: "--history-time-w",
  sha: "--history-sha-w",
};
let historyColumnPreferences = {};

function laneColor(index) {
  return ["#23c7b7", "#ff7a67", "#f0b85b", "#5ca9ff", "#9c7cff", "#6bd58c", "#f071b8"][index % 7];
}

function initTheme() {
  const queryTheme = new URLSearchParams(window.location.search).get("theme");
  const storedTheme = (window.ForklinePreferenceStorage?.storage || localStorage).getItem("forkline-theme");
  const theme = normalizeTheme(queryTheme) || normalizeTheme(storedTheme) || "dark";
  applyTheme(theme, false);
}

function normalizeTheme(theme) {
  const value = String(theme || "").trim().toLowerCase();
  return themeCatalog.some((item) => item.id === value) ? value : "";
}

function applyTheme(theme, persist = true) {
  const selected = normalizeTheme(theme) || "dark";
  const current = themeCatalog.find((item) => item.id === selected) || themeCatalog[0];
  const currentIndex = themeCatalog.indexOf(current);
  const next = themeCatalog[(currentIndex + 1) % themeCatalog.length];
  state.theme = selected;
  document.documentElement.dataset.theme = selected;
  if (persist) (window.ForklinePreferenceStorage?.storage || localStorage).setItem("forkline-theme", selected);
  els.themeToggle.textContent = t(current.label);
  els.themeToggle.title = t("当前配色：{current}；点击切换到：{next}", { current: t(current.label), next: t(next.label) });
  syncDesktopTitleBarTheme();
}

function syncDesktopTitleBarTheme() {
  const setTitleBarTheme = window.forklineDesktop?.setTitleBarTheme;
  if (typeof setTitleBarTheme !== "function") return;
  const styles = getComputedStyle(document.documentElement);
  setTitleBarTheme({
    color: styles.getPropertyValue("--topbar").trim(),
    symbolColor: styles.getPropertyValue("--text").trim(),
  });
}

function toggleTheme() {
  const currentIndex = themeCatalog.findIndex((item) => item.id === state.theme);
  applyTheme(themeCatalog[(currentIndex + 1 + themeCatalog.length) % themeCatalog.length].id);
  if (state.selectedTab === "settings") renderInspector();
}

function decorateCommandHints(root = document) {
  const hints = [];
  if (root?.matches?.(".mini-btn > .command-hint")) hints.push(root);
  root?.querySelectorAll?.(".mini-btn > .command-hint").forEach((hint) => hints.push(hint));
  hints.forEach((hint) => {
    const button = hint.parentElement;
    const command = String(hint.textContent || "").trim();
    if (!button?.classList?.contains("mini-btn") || !command) return;
    const currentTitle = String(button.getAttribute("title") || "").trim();
    if (!currentTitle) {
      button.setAttribute("title", command);
      return;
    }
    if (!currentTitle.toLowerCase().includes(command.toLowerCase())) {
      button.setAttribute("title", `${currentTitle}\n${command}`);
    }
  });
}

function initCommandHints() {
  decorateCommandHints(document);
  const observer = new MutationObserver((records) => {
    records.forEach((record) => {
      record.addedNodes.forEach((node) => {
        if (node?.nodeType === 1) decorateCommandHints(node);
      });
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
  return observer;
}

function resetLayoutPreferences() {
  [
    ["forkline-sidebar-w", "--sidebar-w"],
    ["forkline-inspector-w", "--inspector-w"],
    ["forkline-stage-h", "--stage-h"],
  ].forEach(([store, variable]) => {
    try {
      (window.ForklinePreferenceStorage?.storage || localStorage).removeItem(store);
    } catch {
    }
    document.documentElement.style.removeProperty(variable);
  });
  try {
    (window.ForklinePreferenceStorage?.storage || localStorage).removeItem(historyColumnStorageKey);
  } catch {
  }
  historyColumnPreferences = {};
  Object.values(historyColumnVariables).forEach((variable) => document.documentElement.style.removeProperty(variable));
  if (typeof scheduleCommitViewportRender === "function") scheduleCommitViewportRender();
  toast(t("布局已恢复默认"));
  renderInspector();
}

function initLayoutResizers() {
  const root = document.documentElement;
  const configs = {
    sidebar: { varName: "--sidebar-w", store: "forkline-sidebar-w", preferred: 240, min: 160, max: () => layoutMax("sidebar"), axis: "x", sign: 1 },
    inspector: { varName: "--inspector-w", store: "forkline-inspector-w", preferred: 340, min: 220, max: () => layoutMax("inspector"), axis: "x", sign: -1 },
    stage: { varName: "--stage-h", store: "forkline-stage-h", preferred: 300, min: 220, max: () => layoutMax("stage"), axis: "y", sign: -1 },
  };
  document.querySelectorAll("[data-resizer]").forEach((handle) => {
    const config = configs[handle.dataset.resizer];
    if (!config) return;
    handle.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      handle.setPointerCapture?.(event.pointerId);
      const startPoint = config.axis === "x" ? event.clientX : event.clientY;
      const startSize = numericCssVar(config.varName);
      document.body.classList.add("resizing");
      const onMove = (moveEvent) => {
        const point = config.axis === "x" ? moveEvent.clientX : moveEvent.clientY;
        const next = clamp(startSize + (point - startPoint) * config.sign, config.min, configMax(config));
        root.style.setProperty(config.varName, `${next}px`);
        if (config.axis === "y" && typeof scheduleCommitViewportRender === "function") scheduleCommitViewportRender();
      };
      const onUp = () => {
        const current = numericCssVar(config.varName);
        (window.ForklinePreferenceStorage?.storage || localStorage).setItem(config.store, String(current));
        applyHistoryColumnPreferences();
        document.body.classList.remove("resizing");
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
      };
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp, { once: true });
    });
  });
  window.addEventListener("resize", () => clampLayoutVars(configs));
  clampLayoutVars(configs);
  initHistoryColumnResizers();
}

function initHistoryColumnResizers() {
  const handles = [...document.querySelectorAll("[data-history-resizer]")].filter((handle) => handle.dataset.historyResizer);
  if (!handles.length) return;
  historyColumnPreferences = loadHistoryColumnPreferences();
  applyHistoryColumnPreferences();
  handles.forEach((handle) => {
    handle.addEventListener("pointerdown", (event) => beginHistoryColumnResize(event, handle));
    handle.addEventListener("keydown", (event) => resizeHistoryColumnFromKeyboard(event, handle));
  });
  window.addEventListener("resize", applyHistoryColumnPreferences);
}

function beginHistoryColumnResize(event, handle) {
  const boundary = historyResizeBoundary(handle);
  if (!boundary) return;
  event.preventDefault();
  freezeVisibleHistoryColumnWidths(boundary.cells);
  handle.setPointerCapture?.(event.pointerId);
  const startX = event.clientX;
  const leftWidth = boundary.left.getBoundingClientRect().width;
  const rightWidth = boundary.right.getBoundingClientRect().width;
  document.body.classList.add("resizing");
  const onMove = (moveEvent) => {
    resizeHistoryBoundary(boundary.left.dataset.historyColumn, boundary.right.dataset.historyColumn, leftWidth, rightWidth, moveEvent.clientX - startX);
  };
  const onUp = () => {
    saveHistoryColumnPreferences();
    document.body.classList.remove("resizing");
    document.removeEventListener("pointermove", onMove);
    document.removeEventListener("pointerup", onUp);
    document.removeEventListener("pointercancel", onUp);
  };
  document.addEventListener("pointermove", onMove);
  document.addEventListener("pointerup", onUp, { once: true });
  document.addEventListener("pointercancel", onUp, { once: true });
}

function resizeHistoryColumnFromKeyboard(event, handle) {
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  const boundary = historyResizeBoundary(handle);
  if (!boundary) return;
  event.preventDefault();
  freezeVisibleHistoryColumnWidths(boundary.cells);
  resizeHistoryBoundary(
    boundary.left.dataset.historyColumn,
    boundary.right.dataset.historyColumn,
    boundary.left.getBoundingClientRect().width,
    boundary.right.getBoundingClientRect().width,
    event.key === "ArrowRight" ? 8 : -8
  );
  saveHistoryColumnPreferences();
}

function historyResizeBoundary(handle) {
  const left = handle.closest?.("[data-history-column]");
  const cells = visibleHistoryColumnCells();
  const index = cells.indexOf(left);
  if (!left || index < 0 || index >= cells.length - 1) return null;
  return { cells, left, right: cells[index + 1] };
}

function visibleHistoryColumnCells() {
  return [...document.querySelectorAll(".history-head > [data-history-column]")]
    .filter((cell) => getComputedStyle(cell).display !== "none");
}

function freezeVisibleHistoryColumnWidths(cells = visibleHistoryColumnCells()) {
  cells.forEach((cell) => {
    const name = cell.dataset.historyColumn;
    if (!historyColumnVariables[name]) return;
    const width = Math.round(cell.getBoundingClientRect().width);
    historyColumnPreferences[name] = width;
    setHistoryColumnWidth(name, width);
  });
}

function resizeHistoryBoundary(leftName, rightName, leftWidth, rightWidth, delta) {
  const pairWidth = leftWidth + rightWidth;
  if (leftName === "graph" && rightName === "message") {
    const limit = historyColumnLimit("graph");
    const next = clamp(leftWidth + delta, limit.min, Math.min(limit.max, pairWidth - historyMessageMinimumWidth()));
    updateHistoryColumnPreference("graph", next);
    return;
  }
  if (leftName === "message" && historyColumnVariables[rightName]) {
    const limit = historyColumnLimit(rightName);
    const next = clamp(rightWidth - delta, limit.min, Math.min(limit.max, pairWidth - historyMessageMinimumWidth()));
    updateHistoryColumnPreference(rightName, next);
    return;
  }
  if (!historyColumnVariables[leftName] || !historyColumnVariables[rightName]) return;
  const leftLimit = historyColumnLimit(leftName);
  const rightLimit = historyColumnLimit(rightName);
  const min = Math.max(leftLimit.min, pairWidth - rightLimit.max);
  const max = Math.min(leftLimit.max, pairWidth - rightLimit.min);
  const nextLeft = clamp(leftWidth + delta, min, max);
  updateHistoryColumnPreference(leftName, nextLeft);
  updateHistoryColumnPreference(rightName, pairWidth - nextLeft);
}

function updateHistoryColumnPreference(name, width) {
  const next = Math.round(width);
  historyColumnPreferences[name] = next;
  setHistoryColumnWidth(name, next);
}

function setHistoryColumnWidth(name, width) {
  const variable = historyColumnVariables[name];
  if (variable) document.documentElement.style.setProperty(variable, `${Math.round(width)}px`);
  if (name === "graph" && typeof scheduleCommitGraphResize === "function") scheduleCommitGraphResize();
}

function applyHistoryColumnPreferences() {
  const entries = Object.entries(historyColumnPreferences).filter(([name, width]) => historyColumnVariables[name] && Number.isFinite(width));
  if (!entries.length) return;
  entries.forEach(([name, width]) => {
    const limit = historyColumnLimit(name);
    setHistoryColumnWidth(name, clamp(width, limit.min, limit.max));
  });
  fitHistoryColumnPreferences();
}

function fitHistoryColumnPreferences() {
  const head = document.querySelector(".history-head");
  const cells = visibleHistoryColumnCells();
  if (!head || !cells.length) return;
  const fixed = cells
    .map((cell) => ({ cell, name: cell.dataset.historyColumn }))
    .filter((item) => historyColumnVariables[item.name]);
  let overflow = fixed.reduce((total, item) => total + item.cell.getBoundingClientRect().width, 0) + historyMessageMinimumWidth() - head.clientWidth;
  ["author", "time", "sha", "graph"].forEach((name) => {
    if (overflow <= 0) return;
    const item = fixed.find((entry) => entry.name === name);
    if (!item) return;
    const current = item.cell.getBoundingClientRect().width;
    const minimum = historyColumnLimit(name).min;
    const reduction = Math.min(overflow, Math.max(0, current - minimum));
    if (reduction > 0) setHistoryColumnWidth(name, current - reduction);
    overflow -= reduction;
  });
}

function historyColumnLimit(name) {
  if (name === "graph") return { min: historyGraphMinimumWidth(), max: 420 };
  if (name === "author") return { min: 72, max: 220 };
  if (name === "time") return { min: 64, max: 160 };
  return { min: 64, max: 160 };
}

function historyGraphMinimumWidth() {
  const history = document.querySelector(".history");
  const value = Number.parseFloat(getComputedStyle(history || document.documentElement).getPropertyValue("--graph-w"));
  return Math.max(120, value || 176);
}

function historyMessageMinimumWidth() {
  const width = document.querySelector(".history-head")?.clientWidth || window.innerWidth || 800;
  return width <= 500 ? 96 : 140;
}

function loadHistoryColumnPreferences() {
  try {
    const parsed = JSON.parse((window.ForklinePreferenceStorage?.storage || localStorage).getItem(historyColumnStorageKey) || "{}");
    return Object.fromEntries(Object.entries(parsed).filter(([name, width]) => historyColumnVariables[name] && Number.isFinite(width)));
  } catch {
    return {};
  }
}

function saveHistoryColumnPreferences() {
  (window.ForklinePreferenceStorage?.storage || localStorage).setItem(historyColumnStorageKey, JSON.stringify(historyColumnPreferences));
}

function clampLayoutVars(configs) {
  Object.values(configs).forEach((config) => {
    const next = clamp(preferredLayoutSize(config), config.min, configMax(config));
    document.documentElement.style.setProperty(config.varName, `${next}px`);
  });
}

function preferredLayoutSize(config) {
  const storedValue = (window.ForklinePreferenceStorage?.storage || localStorage).getItem(config.store);
  const stored = Number(storedValue);
  return storedValue !== null && Number.isFinite(stored) ? stored : config.preferred;
}

function layoutMax(kind) {
  const width = window.innerWidth || 1160;
  const height = window.innerHeight || 760;
  const sidebar = numericCssVar("--sidebar-w") || 240;
  const inspector = numericCssVar("--inspector-w") || 340;
  if (portraitWorkspaceActive()) {
    const portraitMainMin = width <= 840 ? 420 : width <= 1120 ? 560 : 680;
    if (kind === "sidebar") return Math.max(160, Math.min(420, width - 7 - portraitMainMin));
    if (kind === "inspector") return Math.max(220, Math.min(560, width - 28));
  }
  const resizers = 14;
  const mainMin = width <= 840 ? 360 : width <= 960 ? 420 : width <= 1120 ? 480 : 560;
  if (kind === "sidebar") return Math.max(160, Math.min(420, width - inspector - resizers - mainMin));
  if (kind === "inspector") return Math.max(220, Math.min(560, width - sidebar - resizers - mainMin));
  if (kind === "stage") return Math.max(240, Math.min(500, height - 260));
  return 520;
}

function portraitWorkspaceActive() {
  return typeof window.matchMedia === "function"
    && window.matchMedia("(orientation: portrait) and (max-width: 1600px)").matches;
}

function configMax(config) {
  return typeof config.max === "function" ? config.max() : config.max;
}

function numericCssVar(name) {
  return Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || 0;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function initials(name) {
  const parts = String(name || "?").trim().split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) return escapeHtml((parts[0][0] + parts[1][0]).toUpperCase());
  return escapeHtml(parts[0]?.slice(0, 2).toUpperCase() || "?");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("\n", " ");
}

function dismissToast() {
  clearTimeout(toast.timer);
  toast.timer = 0;
  els.toast.classList.remove("show");
  els.toast.setAttribute("aria-hidden", "true");
  if (els.toastClose) els.toastClose.disabled = true;
}

function toast(message) {
  const text = String(message || "");
  if (els.toastMessage) {
    els.toastMessage.textContent = text;
  } else {
    els.toast.textContent = text;
  }
  if (els.toastClose) {
    const label = typeof t === "function" ? t("关闭提示") : "关闭提示";
    els.toastClose.disabled = false;
    els.toastClose.title = label;
    els.toastClose.setAttribute("aria-label", label);
  }
  els.toast.setAttribute("aria-hidden", "false");
  els.toast.classList.add("show");
  clearTimeout(toast.timer);
  const duration = clamp(2200 + text.length * 45, 2600, text.includes("\n") ? 16000 : 7600);
  toast.timer = setTimeout(dismissToast, duration);
}

