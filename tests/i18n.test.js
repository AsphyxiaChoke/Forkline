"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const catalog = require("../public/js/i18n-catalog.js");
const runtimeSource = fs.readFileSync(path.resolve(__dirname, "..", "public", "js", "i18n.js"), "utf8");

test("locale normalization defaults to Chinese and accepts English variants", () => {
  assert.equal(catalog.defaultLocale, "zh-CN");
  assert.equal(catalog.normalizeLocale("zh-CN"), "zh-CN");
  assert.equal(catalog.normalizeLocale("zh-TW"), "zh-CN");
  assert.equal(catalog.normalizeLocale("en-US"), "en");
  assert.equal(catalog.normalizeLocale("fr"), "");
});

test("known translations preserve repository data and raw Git output", () => {
  assert.equal(catalog.translate("en", "已打开 {name}", { name: "桌面/设置" }), "Opened 桌面/设置");
  assert.equal(catalog.translateKnown("en", "克隆仓库到 D:\\桌面\\repo"), "Clone repository to D:\\桌面\\repo");
  assert.equal(catalog.translateKnown("en", "Updating D:\\桌面\\repo"), "Updating D:\\桌面\\repo");
  assert.equal(catalog.translateFragment("en", "  天  "), "  days  ");
});

test("locale switching persists in browser storage and restores on reload", () => {
  const storage = new Map();
  const first = createRuntime(storage);

  first.context.initLocale();
  assert.equal(first.state.locale, "zh-CN");
  assert.equal(first.document.documentElement.lang, "zh-CN");

  first.context.applyLocale("en");
  assert.equal(first.state.locale, "en");
  assert.equal(storage.get("forkline-locale"), "en");
  assert.equal(first.document.documentElement.lang, "en");
  assert.equal(first.document.documentElement.dataset.locale, "en");

  const reloaded = createRuntime(storage);
  reloaded.context.initLocale();
  assert.equal(reloaded.state.locale, "en");
  assert.equal(reloaded.document.documentElement.lang, "en");

  reloaded.context.applyLocale("unsupported");
  assert.equal(reloaded.state.locale, "zh-CN");
  assert.equal(storage.get("forkline-locale"), "zh-CN");
});

test("captured static UI text switches between Chinese and English", () => {
  const textNode = { nodeValue: "设置", parentElement: { tagName: "DIV" } };
  const input = createAttributeNode({ placeholder: "搜索提交、作者、分支或 SHA" });
  const resizer = createAttributeNode({ "aria-label": "拖拽调整列宽", title: "拖拽调整列宽" });
  const runtime = createRuntime(new Map(), { textNodes: [textNode], elements: [input, resizer] });

  runtime.context.initLocale();
  runtime.context.applyLocale("en", false);
  assert.equal(textNode.nodeValue, "Settings");
  assert.equal(input.getAttribute("placeholder"), "Search commits, authors, branches, or SHA");
  assert.equal(resizer.getAttribute("aria-label"), "Drag to resize the column");
  assert.equal(resizer.getAttribute("title"), "Drag to resize the column");

  runtime.context.applyLocale("zh-CN", false);
  assert.equal(textNode.nodeValue, "设置");
  assert.equal(input.getAttribute("placeholder"), "搜索提交、作者、分支或 SHA");
  assert.equal(resizer.getAttribute("aria-label"), "拖拽调整列宽");
});

function createRuntime(storage, options = {}) {
  const textNodes = options.textNodes || [];
  const elements = options.elements || [];
  let walkerIndex = 0;
  const document = {
    body: {
      querySelectorAll: () => elements,
    },
    documentElement: { lang: "", dataset: {} },
    createTreeWalker: () => ({
      nextNode: () => textNodes[walkerIndex++] || null,
    }),
  };
  const localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
  };
  const state = { locale: "zh-CN" };
  const window = { Forkline: {}, ForklineI18nCatalog: catalog };
  const context = vm.createContext({
    document,
    localStorage,
    NodeFilter: { SHOW_TEXT: 4 },
    localeStorageKey: "forkline-locale",
    state,
    window,
  });
  vm.runInContext(runtimeSource, context);
  return { context, document, state };
}

function createAttributeNode(attributes) {
  const values = new Map(Object.entries(attributes));
  return {
    getAttribute: (name) => values.get(name) ?? null,
    setAttribute: (name, value) => values.set(name, String(value)),
  };
}
