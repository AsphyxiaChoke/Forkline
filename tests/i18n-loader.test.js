"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const catalog = require("../public/js/i18n-catalog.js");
const loaderSource = fs.readFileSync(path.resolve(__dirname, "..", "public", "js", "i18n-loader.js"), "utf8");

function createLoaderSandbox(failFirst = false) {
  let resource = null;
  let attempts = 0;
  const appended = [];
  const window = {};
  const sandbox = {
    window,
    document: {
      head: {
        appendChild(element) {
          resource = element;
          attempts += 1;
          appended.push(element.src);
          queueMicrotask(() => {
            if (failFirst && attempts === 1) {
              element.onerror();
              return;
            }
            window.ForklineI18nCatalog = catalog;
            element.onload();
          });
        },
      },
      createElement() {
        return {
          dataset: {},
          remove() {
            resource = null;
          },
        };
      },
      querySelector() {
        return resource;
      },
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(loaderSource, sandbox);
  return { sandbox, window, appended };
}

test("Chinese locale starts without requesting the English catalog", async () => {
  const { sandbox, window, appended } = createLoaderSandbox();

  await window.ForklineI18nLoader.ensure("zh-CN");

  assert.equal(appended.length, 0);
  assert.equal(window.ForklineI18nCatalog.translate("zh-CN", "已打开 {name}", { name: "仓库" }), "已打开 仓库");
});

test("English locale shares one catalog request", async () => {
  const { window, appended } = createLoaderSandbox();

  await Promise.all([
    window.ForklineI18nLoader.ensure("en"),
    window.ForklineI18nLoader.ensure("en-US"),
  ]);

  assert.deepEqual(appended, ["./js/i18n-catalog.js"]);
  assert.equal(window.ForklineI18nCatalog.translateKnown("en", "打开"), "Open");
});

test("English catalog load can retry after a failed request", async () => {
  const { window, appended } = createLoaderSandbox(true);

  await assert.rejects(window.ForklineI18nLoader.ensure("en"), /英文语言包加载失败/);
  await window.ForklineI18nLoader.ensure("en");

  assert.deepEqual(appended, ["./js/i18n-catalog.js", "./js/i18n-catalog.js"]);
  assert.equal(window.ForklineI18nCatalog.translateKnown("en", "打开"), "Open");
});
