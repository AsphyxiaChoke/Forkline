"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const loaderSource = fs.readFileSync(path.join(root, "public", "js", "features", "file-editor-loader.js"), "utf8");

function createLoaderSandbox(failOnce = "") {
  const resources = new Map();
  const appended = [];
  const failed = new Set();
  const sandbox = {
    bindCount: 0,
    t: (value) => value,
    document: {
      head: {
        appendChild(element) {
          const resource = element.dataset.fileEditorResource;
          resources.set(resource, element);
          appended.push(resource);
          queueMicrotask(() => {
            if (resource === failOnce && !failed.has(resource)) {
              failed.add(resource);
              element.onerror();
              return;
            }
            if (resource.endsWith("/lib/codemirror.js")) sandbox.CodeMirror = function CodeMirror() {};
            if (resource.endsWith("/file-editor.js")) sandbox.openFileEditor = async () => true;
            element.onload();
          });
        },
      },
      createElement(tagName) {
        return {
          tagName: tagName.toUpperCase(),
          dataset: {},
          remove() {
            resources.delete(this.dataset.fileEditorResource);
          },
        };
      },
      querySelectorAll() {
        return Array.from(resources.values());
      },
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(loaderSource, sandbox);
  vm.runInContext("bindFileEditorEvents = () => { bindCount += 1; };", sandbox);
  return { sandbox, appended };
}

test("file editor loader shares one in-flight resource load", async () => {
  const { sandbox, appended } = createLoaderSandbox();
  const resourceCount = vm.runInContext("fileEditorStyleResources.length + fileEditorScriptResources.length", sandbox);

  await Promise.all([
    vm.runInContext("ensureFileEditorLoaded()", sandbox),
    vm.runInContext("ensureFileEditorLoaded()", sandbox),
  ]);

  assert.equal(appended.length, resourceCount);
  assert.equal(new Set(appended).size, resourceCount);
  assert.equal(sandbox.bindCount, 1);
});

test("file editor loader retries only the failed resource", async () => {
  const failedResource = "./vendor/codemirror/mode/python/python.js";
  const { sandbox, appended } = createLoaderSandbox(failedResource);
  const resourceCount = vm.runInContext("fileEditorStyleResources.length + fileEditorScriptResources.length", sandbox);

  await assert.rejects(vm.runInContext("ensureFileEditorLoaded()", sandbox), /文件编辑器资源加载失败/);
  await vm.runInContext("ensureFileEditorLoaded()", sandbox);

  assert.equal(appended.length, resourceCount + 1);
  assert.equal(appended.filter((resource) => resource === failedResource).length, 2);
  assert.equal(sandbox.bindCount, 1);
});
