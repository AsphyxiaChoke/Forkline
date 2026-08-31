"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const loaderSource = fs.readFileSync(path.join(root, "public", "js", "features", "file-editor-loader.js"), "utf8");

function createLoaderSandbox(failOnce = "", options = {}) {
  const resources = new Map();
  const appended = [];
  const failed = new Set();
  const pendingScripts = new Map();
  const sandbox = {
    bindCount: 0,
    contextMenuStyleLoads: 0,
    openCalls: [],
    repoPath: "C:/repo",
    repoPathSnapshot: () => sandbox.repoPath,
    isCurrentRepoPath: (repoPath) => sandbox.repoPath === repoPath,
    t: (value) => value,
    ensureContextMenuStyleLoaded: async () => {
      sandbox.contextMenuStyleLoads += 1;
    },
    document: {
      head: {
        appendChild(element) {
          const resource = element.dataset.fileEditorResource;
          resources.set(resource, element);
          appended.push(resource);
          const finishLoad = () => {
            if (resource === failOnce && !failed.has(resource)) {
              failed.add(resource);
              element.onerror();
              return;
            }
            if (resource.endsWith("/lib/codemirror.js")) sandbox.CodeMirror = function CodeMirror() {};
            if (resource.endsWith("/file-editor.js")) {
              sandbox.openFileEditor = async (...args) => {
                sandbox.openCalls.push(args);
                return true;
              };
            }
            element.onload();
          };
          if (options.holdScripts && element.tagName === "SCRIPT") pendingScripts.set(resource, finishLoad);
          else queueMicrotask(finishLoad);
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
  return {
    sandbox,
    appended,
    releaseScripts(resourcesToRelease) {
      resourcesToRelease.forEach((resource) => {
        const finishLoad = pendingScripts.get(resource);
        assert.equal(typeof finishLoad, "function", `${resource} was not waiting to load`);
        pendingScripts.delete(resource);
        finishLoad();
      });
    },
  };
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
  assert.equal(sandbox.contextMenuStyleLoads, 1);
  assert.equal(sandbox.bindCount, 1);
});

test("file editor loader starts independent scripts together and waits between dependency groups", async () => {
  const { sandbox, appended, releaseScripts } = createLoaderSandbox("", { holdScripts: true });
  const groups = Array.from(
    vm.runInContext("fileEditorScriptResourceGroups.map((group) => Array.from(group))", sandbox),
    (group) => Array.from(group)
  );
  const loading = vm.runInContext("ensureFileEditorLoaded()", sandbox);
  const appendedScripts = () => appended.filter((resource) => resource.endsWith(".js"));

  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(appendedScripts(), groups[0]);
  for (let index = 0; index < groups.length; index += 1) {
    releaseScripts(groups[index]);
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(appendedScripts(), groups.slice(0, index + 2).flat());
  }

  await loading;
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

test("file editor project styles load first and can retry independently", async () => {
  const failedResource = "./file-editor.css";
  const { sandbox, appended } = createLoaderSandbox(failedResource);
  const styleResources = vm.runInContext("Array.from(fileEditorStyleResources)", sandbox);

  assert.deepEqual(Array.from(styleResources), [
    "./file-editor.css",
    "./vendor/codemirror/lib/codemirror.css",
    "./vendor/codemirror/addon/merge/merge.css",
  ]);
  await assert.rejects(vm.runInContext("ensureFileEditorLoaded()", sandbox), /文件编辑器资源加载失败/);
  await vm.runInContext("ensureFileEditorLoaded()", sandbox);

  assert.equal(appended.filter((resource) => resource === failedResource).length, 2);
  assert.ok(appended.indexOf("./file-editor.css") < appended.indexOf("./vendor/codemirror/lib/codemirror.css"));
  assert.ok(appended.indexOf("./vendor/codemirror/lib/codemirror.css") < appended.indexOf("./vendor/codemirror/addon/merge/merge.css"));
  assert.equal(sandbox.bindCount, 1);
});

test("a file editor open waiting for resources is discarded after repository switch", async () => {
  const { sandbox } = createLoaderSandbox();
  const opening = vm.runInContext('openFileEditorLazy("src/main.c")', sandbox);

  sandbox.repoPath = "C:/other-repo";

  assert.equal(await opening, false);
  assert.deepEqual(sandbox.openCalls, []);
});

test("file editor switch and double-click open share one in-flight request", async () => {
  const { sandbox } = createLoaderSandbox();
  let releaseOpen;
  let openCalls = 0;
  const opening = new Promise((resolve) => {
    releaseOpen = resolve;
  });
  sandbox.CodeMirror = function CodeMirror() {};
  sandbox.els = { fileEditorModal: { classList: { contains: () => true } } };
  sandbox.openFileEditor = async (...args) => {
    openCalls += 1;
    sandbox.openCalls.push(args);
    await opening;
    return true;
  };
  sandbox.switchOpenFileEditor = (...args) => sandbox.openFileEditor(...args);

  const switching = vm.runInContext('switchOpenFileEditorLazy("src/main.c")', sandbox);
  await new Promise((resolve) => setImmediate(resolve));
  const doubleClickOpen = vm.runInContext('openFileEditorLazy("src/main.c")', sandbox);
  releaseOpen();

  assert.deepEqual(await Promise.all([switching, doubleClickOpen]), [true, true]);
  assert.equal(openCalls, 1);
  assert.deepEqual(sandbox.openCalls, [["src/main.c", ""]]);
});

test("file editor opens from a new repository do not reuse an old request", async () => {
  const { sandbox } = createLoaderSandbox();
  let openCalls = 0;
  sandbox.CodeMirror = function CodeMirror() {};
  sandbox.els = { fileEditorModal: { classList: { contains: () => true } } };
  sandbox.openFileEditor = async (...args) => {
    openCalls += 1;
    sandbox.openCalls.push(args);
    return true;
  };
  sandbox.switchOpenFileEditor = (...args) => sandbox.openFileEditor(...args);

  const first = vm.runInContext('switchOpenFileEditorLazy("src/main.c")', sandbox);
  await new Promise((resolve) => setImmediate(resolve));
  sandbox.repoPath = "C:/other-repo";
  const second = vm.runInContext('openFileEditorLazy("src/main.c")', sandbox);

  assert.deepEqual(await Promise.all([first, second]), [true, true]);
  assert.equal(openCalls, 2);
});
