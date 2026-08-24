"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const settingsSource = fs.readFileSync(path.join(root, "public", "js", "panels", "settings.js"), "utf8");
const catalog = require("../public/js/i18n-catalog.js");

test("settings describes desktop preference persistence without changing the Web wording", () => {
  const desktopHtml = renderSettings({
    readPreferences: async () => ({}),
    writePreference: async () => true,
    removePreference: async () => true,
  });
  assert.match(desktopHtml, /主题保存在 Forkline 本机用户数据中，重启和更新后保留。/);
  assert.match(desktopHtml, /界面语言保存在 Forkline 本机用户数据中，重启和更新后保留。/);
  assert.doesNotMatch(desktopHtml, /保存在当前浏览器/);

  const webHtml = renderSettings();
  assert.match(webHtml, /主题会保存在当前浏览器。/);
  assert.match(webHtml, /界面语言会保存在当前浏览器。/);
  assert.doesNotMatch(webHtml, /Forkline 本机用户数据/);
});

test("desktop preference persistence copy has complete English translations", () => {
  assert.equal(
    catalog.translate("en", "主题保存在 Forkline 本机用户数据中，重启和更新后保留。"),
    "The theme is stored in Forkline's local user data and is kept after restarts and updates.",
  );
  assert.equal(
    catalog.translate("en", "界面语言保存在 Forkline 本机用户数据中，重启和更新后保留。"),
    "The interface language is stored in Forkline's local user data and is kept after restarts and updates.",
  );
  assert.equal(
    catalog.translate("en", "本机偏好保存失败，本次更改不会在重启后保留。"),
    "Forkline could not save the local preference. This change will not be kept after restart.",
  );
  assert.equal(catalog.translate("en", "快捷键"), "Keyboard shortcuts");
  assert.equal(catalog.translate("en", "Ctrl / ⌘ + A：选择当前工作区或暂存区的全部文件"), "Ctrl / ⌘ + A: Select all files in the current working tree or staging list");
  assert.equal(catalog.translate("en", "Ctrl / ⌘ + X/C/V/Z/Y：在输入框和文件编辑器中剪切、复制、粘贴、撤回、恢复"), "Ctrl / ⌘ + X/C/V/Z/Y: Cut, copy, paste, undo, and redo in inputs and the file editor");
});

function renderSettings(desktop = null) {
  const detailBody = { innerHTML: "" };
  const context = vm.createContext({
    window: desktop ? { forklineDesktop: desktop } : {},
    state: {
      appUpdate: { status: "current", currentVersion: "0.4.5", latestVersion: "0.4.5" },
      data: { repo: { isSample: true, name: "示例仓库" } },
      desktopZoom: 0.9,
      locale: "zh-CN",
      recoveryPolicy: { keepDays: 90, maxPerBranch: 50 },
      selectedTab: "settings",
      theme: "dark",
    },
    els: {
      detailBody,
      detailNode: { style: {} },
      detailSub: { textContent: "" },
      detailTitle: { textContent: "" },
    },
    themeCatalog: [
      { id: "dark", label: "深色", description: "适合长时间查看提交图谱", swatches: ["#000", "#111", "#222", "#333"] },
    ],
    recentRepos: () => [],
    normalizedRecoveryPolicy: () => ({ keepDays: 90, maxPerBranch: 50 }),
    recoveryPolicyLabel: () => "保留最近 90 天；每个分支保留 50 个",
    recoveryAutoPruneHtml: () => "",
    selfUpdateRecoveryText: () => "",
    setActiveDiff: () => {},
    renderInspector: () => {},
    t: interpolate,
    tt: (strings, ...values) => strings.reduce((output, text, index) => `${output}${text}${values[index] ?? ""}`, ""),
    escapeHtml: (value) => String(value ?? ""),
    escapeAttr: (value) => String(value ?? "").replaceAll('"', "&quot;"),
  });

  vm.runInContext(settingsSource, context);
  vm.runInContext("renderSettingsTab()", context);
  if (desktop) assert.match(detailBody.innerHTML, /settings-shortcuts/);
  return detailBody.innerHTML;
}

function interpolate(text, values = {}) {
  return String(text).replace(/\{(\w+)\}/g, (_match, key) => String(values[key] ?? ""));
}
