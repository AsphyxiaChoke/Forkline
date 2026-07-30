"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const layoutSource = fs.readFileSync(path.join(projectRoot, "public", "js", "app", "layout-utils.js"), "utf8");
const settingsSource = fs.readFileSync(path.join(projectRoot, "public", "js", "panels", "recovery-settings.js"), "utf8");
const styles = fs.readFileSync(path.join(projectRoot, "public", "styles.css"), "utf8");
const catalog = require("../public/js/i18n-catalog.js");

const themeIds = ["dark", "light", "graphite", "forest", "rose", "contrast"];

test("theme runtime accepts, restores, persists, and cycles through every palette", () => {
  const storage = new Map();
  const state = { theme: "dark", selectedTab: "settings" };
  const themeToggle = { textContent: "", title: "" };
  const document = { documentElement: { dataset: {} } };
  let inspectorRenders = 0;
  const context = createThemeContext({ storage, state, themeToggle, document, search: "?theme=forest", onRenderInspector: () => inspectorRenders += 1 });

  vm.runInContext(layoutSource, context);
  vm.runInContext("initTheme()", context);

  assert.equal(state.theme, "forest");
  assert.equal(document.documentElement.dataset.theme, "forest");
  assert.equal(themeToggle.textContent, "森林");
  assert.equal(storage.has("forkline-theme"), false, "query initialization should not rewrite browser storage");

  for (const theme of themeIds) {
    assert.equal(vm.runInContext(`normalizeTheme(${JSON.stringify(theme)})`, context), theme);
  }
  assert.equal(vm.runInContext('normalizeTheme("unsupported")', context), "");

  vm.runInContext("toggleTheme()", context);
  assert.equal(state.theme, "rose");
  assert.equal(storage.get("forkline-theme"), "rose");
  assert.equal(themeToggle.textContent, "樱色");
  assert.match(themeToggle.title, /当前配色：樱色/);
  assert.equal(inspectorRenders, 1, "top theme cycling should refresh the active settings card");
});

test("settings renders every theme as a compact palette preview", () => {
  const context = createThemeContext({ state: { theme: "graphite" } });
  vm.runInContext(layoutSource, context);
  vm.runInContext(settingsSource, context);

  const html = vm.runInContext("themeCatalog.map(settingsThemeButton).join('')", context);
  for (const theme of themeIds) {
    assert.match(html, new RegExp(`data-settings-theme="${theme}"`));
  }
  assert.equal((html.match(/class="settings-theme-preview"/g) || []).length, themeIds.length);
  assert.equal((html.match(/class="settings-theme-swatch"/g) || []).length, themeIds.length * 4);
  assert.match(html, /data-settings-theme="graphite"[^>]*class="[^"]*active|class="[^"]*active[^"]*"[^>]*data-settings-theme="graphite"/);
});

test("new palettes define complete readable color surfaces and English labels", () => {
  for (const theme of ["graphite", "forest", "rose", "contrast"]) {
    const block = styles.match(new RegExp(`html\\[data-theme="${theme}"\\] \\{([\\s\\S]*?)\\n\\}`));
    assert.ok(block, `missing CSS palette for ${theme}`);
    for (const variable of ["--bg", "--panel-2", "--text", "--muted", "--teal", "--blue", "--row-selected", "--diff-add-bg", "--diff-del-bg"]) {
      assert.match(block[1], new RegExp(`${variable}:`), `${theme} should define ${variable}`);
    }
  }

  assert.match(styles, /rgba\(var\(--teal-rgb\),/);
  assert.match(styles, /rgba\(var\(--blue-rgb\),/);
  assert.equal(catalog.translate("en", "石墨"), "Graphite");
  assert.equal(catalog.translate("en", "森林"), "Forest");
  assert.equal(catalog.translate("en", "樱色"), "Sakura");
  assert.equal(catalog.translate("en", "高对比"), "High contrast");
});

function createThemeContext(options = {}) {
  const storage = options.storage || new Map();
  const state = options.state || { theme: "dark" };
  const themeToggle = options.themeToggle || { textContent: "", title: "" };
  const document = options.document || { documentElement: { dataset: {} } };
  const context = vm.createContext({
    URLSearchParams,
    window: { location: { search: options.search || "" } },
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, String(value)),
    },
    state,
    document,
    els: { themeToggle },
    renderInspector: () => options.onRenderInspector?.(),
    t: interpolate,
    escapeHtml: (value) => String(value ?? ""),
    escapeAttr: (value) => String(value ?? "").replaceAll('"', "&quot;"),
  });
  return context;
}

function interpolate(text, values = {}) {
  return String(text).replace(/\{(\w+)\}/g, (_match, key) => String(values[key] ?? ""));
}
