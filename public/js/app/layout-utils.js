// Theme, layout resizing, and small shared utility functions.
const themeCatalog = [
  { id: "dark", label: "深色", description: "适合长时间查看提交图谱", swatches: ["#0e1117", "#1b2130", "#22d3c3", "#ff826f"] },
  { id: "light", label: "浅色", description: "适合明亮环境", swatches: ["#f4f7fb", "#ffffff", "#0d8f86", "#3f7db7"] },
  { id: "graphite", label: "石墨", description: "中性灰黑，强调色更克制", swatches: ["#111315", "#20242a", "#4fd1c5", "#f2c96d"] },
  { id: "forest", label: "森林", description: "深绿背景，适合长时间查看", swatches: ["#0d1513", "#192a24", "#63d6a4", "#ff8b7a"] },
  { id: "rose", label: "樱色", description: "浅粉灰背景，层次更柔和", swatches: ["#f8f3f6", "#ffffff", "#b3426d", "#3f7db7"] },
  { id: "contrast", label: "高对比", description: "黑白对比更强，状态更醒目", swatches: ["#050607", "#11151a", "#35e6d0", "#ffd45c"] },
];

function laneColor(index) {
  return ["#23c7b7", "#ff7a67", "#f0b85b", "#5ca9ff", "#9c7cff", "#6bd58c", "#f071b8"][index % 7];
}

function initTheme() {
  const queryTheme = new URLSearchParams(window.location.search).get("theme");
  const storedTheme = localStorage.getItem("forkline-theme");
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
  if (persist) localStorage.setItem("forkline-theme", selected);
  els.themeToggle.textContent = t(next.label);
  els.themeToggle.title = t("当前配色：{current}；点击切换到：{next}", { current: t(current.label), next: t(next.label) });
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
    ["forkline-changes-w", "--changes-w"],
    ["forkline-stage-h", "--stage-h"],
    ["forkline-commit-form-h", "--commit-form-h"],
  ].forEach(([store, variable]) => {
    try {
      localStorage.removeItem(store);
    } catch {
    }
    document.documentElement.style.removeProperty(variable);
  });
  toast(t("布局已恢复默认"));
  renderInspector();
}

function initLayoutResizers() {
  const root = document.documentElement;
  const configs = {
    sidebar: { varName: "--sidebar-w", store: "forkline-sidebar-w", min: 160, max: () => layoutMax("sidebar"), axis: "x", sign: 1 },
    inspector: { varName: "--inspector-w", store: "forkline-inspector-w", min: 220, max: () => layoutMax("inspector"), axis: "x", sign: -1 },
    changes: { varName: "--changes-w", store: "forkline-changes-w", min: 180, max: () => layoutMax("changes"), axis: "x", sign: 1 },
    stage: { varName: "--stage-h", store: "forkline-stage-h", min: 220, max: () => layoutMax("stage"), axis: "y", sign: -1 },
    commitForm: { varName: "--commit-form-h", store: "forkline-commit-form-h", min: 90, max: () => layoutMax("commitForm"), axis: "y", sign: -1 },
  };
  Object.values(configs).forEach((config) => {
    const storedValue = localStorage.getItem(config.store);
    const stored = Number(storedValue);
    if (storedValue !== null && Number.isFinite(stored)) {
      root.style.setProperty(config.varName, `${clamp(stored, config.min, configMax(config))}px`);
    }
  });
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
        if (config.varName === "--stage-h") {
          const commitConfig = configs.commitForm;
          const currentCommit = numericCssVar(commitConfig.varName);
          root.style.setProperty(commitConfig.varName, `${clamp(currentCommit, commitConfig.min, configMax(commitConfig))}px`);
        }
      };
      const onUp = () => {
        const current = numericCssVar(config.varName);
        localStorage.setItem(config.store, String(current));
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
}

function clampLayoutVars(configs) {
  Object.values(configs).forEach((config) => {
    const current = numericCssVar(config.varName);
    const next = clamp(current, config.min, configMax(config));
    document.documentElement.style.setProperty(config.varName, `${next}px`);
  });
}

function layoutMax(kind) {
  const width = window.innerWidth || 1160;
  const height = window.innerHeight || 760;
  const sidebar = numericCssVar("--sidebar-w") || 240;
  const inspector = numericCssVar("--inspector-w") || 340;
  const resizers = 14;
  const mainMin = width <= 840 ? 360 : width <= 960 ? 420 : width <= 1120 ? 480 : 560;
  if (kind === "sidebar") return Math.max(160, Math.min(420, width - inspector - resizers - mainMin));
  if (kind === "inspector") return Math.max(220, Math.min(560, width - sidebar - resizers - mainMin));
  if (kind === "changes") {
    const mainWidth = width - sidebar - inspector - resizers;
    return Math.max(180, Math.min(620, mainWidth - 220));
  }
  if (kind === "stage") return Math.max(240, Math.min(500, height - 260));
  if (kind === "commitForm") {
    const stageHeight = numericCssVar("--stage-h") || 300;
    return Math.max(110, Math.min(320, stageHeight - 90));
  }
  return 520;
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

function toast(message) {
  const text = String(message || "");
  els.toast.textContent = text;
  els.toast.classList.add("show");
  clearTimeout(toast.timer);
  const duration = clamp(2200 + text.length * 45, 2600, text.includes("\n") ? 16000 : 7600);
  toast.timer = setTimeout(() => els.toast.classList.remove("show"), duration);
}

