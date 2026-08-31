// Loads the file editor only when a file is opened for the first time.
const fileEditorStyleResources = [
  "./file-editor.css",
  "./vendor/codemirror/lib/codemirror.css",
  "./vendor/codemirror/addon/merge/merge.css",
];

const fileEditorScriptResourceGroups = [
  [
    "./vendor/codemirror/diff-match-patch.js",
    "./vendor/codemirror/lib/codemirror.js",
  ],
  [
    "./vendor/codemirror/addon/search/searchcursor.js",
    "./vendor/codemirror/addon/edit/closebrackets.js",
    "./vendor/codemirror/addon/edit/matchbrackets.js",
    "./vendor/codemirror/addon/selection/active-line.js",
    "./vendor/codemirror/addon/mode/simple.js",
    "./vendor/codemirror/mode/xml/xml.js",
    "./vendor/codemirror/mode/javascript/javascript.js",
    "./vendor/codemirror/mode/css/css.js",
    "./vendor/codemirror/mode/clike/clike.js",
    "./vendor/codemirror/mode/python/python.js",
    "./vendor/codemirror/mode/shell/shell.js",
    "./vendor/codemirror/mode/sql/sql.js",
    "./vendor/codemirror/mode/yaml/yaml.js",
    "./vendor/codemirror/mode/properties/properties.js",
    "./vendor/codemirror/mode/diff/diff.js",
    "./vendor/codemirror/mode/powershell/powershell.js",
    "./vendor/codemirror/mode/cmake/cmake.js",
    "./vendor/codemirror/mode/go/go.js",
    "./vendor/codemirror/mode/rust/rust.js",
    "./vendor/codemirror/mode/toml/toml.js",
    "./vendor/codemirror/addon/merge/merge.js",
  ],
  [
    "./vendor/codemirror/mode/jsx/jsx.js",
    "./vendor/codemirror/mode/htmlmixed/htmlmixed.js",
    "./vendor/codemirror/mode/markdown/markdown.js",
    "./vendor/codemirror/mode/dockerfile/dockerfile.js",
  ],
  ["./vendor/codemirror/mode/php/php.js"],
  ["./js/features/file-editor-utils.js"],
  ["./js/features/file-editor-actions.js"],
  ["./js/features/file-editor-window.js"],
  ["./js/features/file-editor-search.js"],
  ["./js/features/file-editor.js"],
];
const fileEditorScriptResources = fileEditorScriptResourceGroups.flat();

let fileEditorLoadPromise = null;
let fileEditorEventsBound = false;
let fileEditorOpenRequest = null;

function fileEditorOpenRequestKey(filePath, previousFilePath = "", options = {}, repoPath = "") {
  const recoveryDraft = options.recoveryDraft && typeof options.recoveryDraft === "object"
    ? [String(options.recoveryDraft.snapshot || ""), String(options.recoveryDraft.content || "")]
    : null;
  return JSON.stringify([
    String(filePath || ""),
    String(previousFilePath || ""),
    String(repoPath || ""),
    options.source === "commit" ? "commit" : "worktree",
    String(options.commit || ""),
    Boolean(options.force),
    Boolean(options.reload),
    recoveryDraft,
  ]);
}

function shareFileEditorOpenRequest(filePath, previousFilePath, options, repoPath, operation) {
  const key = fileEditorOpenRequestKey(filePath, previousFilePath, options, repoPath);
  if (fileEditorOpenRequest?.key === key) return fileEditorOpenRequest.promise;
  const promise = Promise.resolve().then(operation);
  fileEditorOpenRequest = { key, promise };
  promise.then(
    () => {
      if (fileEditorOpenRequest?.promise === promise) fileEditorOpenRequest = null;
    },
    () => {
      if (fileEditorOpenRequest?.promise === promise) fileEditorOpenRequest = null;
    }
  );
  return promise;
}

function fileEditorResourceElement(resource) {
  return Array.from(document.querySelectorAll("[data-file-editor-resource]")).find((element) => element.dataset.fileEditorResource === resource) || null;
}

function loadFileEditorStyle(resource) {
  const existing = fileEditorResourceElement(resource);
  if (existing?.dataset.loaded === "true") return Promise.resolve();
  return new Promise((resolve, reject) => {
    const link = existing || document.createElement("link");
    link.rel = "stylesheet";
    link.href = resource;
    link.dataset.fileEditorResource = resource;
    link.onload = () => {
      link.dataset.loaded = "true";
      resolve();
    };
    link.onerror = () => {
      link.remove();
      reject(new Error(t("文件编辑器资源加载失败，请重试。")));
    };
    if (!existing) document.head.appendChild(link);
  });
}

function loadFileEditorScript(resource) {
  const existing = fileEditorResourceElement(resource);
  if (existing?.dataset.loaded === "true") return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = existing || document.createElement("script");
    script.src = resource;
    script.async = false;
    script.dataset.fileEditorResource = resource;
    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = () => {
      script.remove();
      reject(new Error(t("文件编辑器资源加载失败，请重试。")));
    };
    if (!existing) document.head.appendChild(script);
  });
}

function fileEditorResourcesLoaded() {
  return typeof CodeMirror === "function" && typeof openFileEditor === "function";
}

async function ensureFileEditorLoaded() {
  if (fileEditorResourcesLoaded()) {
    bindFileEditorEvents();
    return;
  }
  if (!fileEditorLoadPromise) {
    fileEditorLoadPromise = (async () => {
      await Promise.all([
        ensureContextMenuStyleLoaded(),
        ...fileEditorStyleResources.map(loadFileEditorStyle),
      ]);
      for (const group of fileEditorScriptResourceGroups) {
        await Promise.all(group.map(loadFileEditorScript));
      }
      if (!fileEditorResourcesLoaded()) throw new Error(t("文件编辑器资源加载失败，请重试。"));
      bindFileEditorEvents();
    })();
  }
  try {
    await fileEditorLoadPromise;
  } catch (error) {
    fileEditorLoadPromise = null;
    throw error;
  }
}

function bindFileEditorEvents() {
  if (fileEditorEventsBound) return;
  fileEditorEventsBound = true;
  els.fileEditorForm.addEventListener("submit", (event) => submitFileEditor(event).catch((error) => toast(error.message)));
  els.fileEditorText.addEventListener("input", () => updateFileEditorStatus());
  els.fileEditorMerge.addEventListener("contextmenu", showFileEditorContextMenu);
  els.fileEditorText.addEventListener("contextmenu", showFileEditorContextMenu);
  els.fileEditorCompareMode.addEventListener("click", (event) => {
    const button = event.target.closest("[data-file-editor-compare-mode]");
    if (!button || button.disabled) return;
    try {
      setFileEditorCompareMode(button.dataset.fileEditorCompareMode);
    } catch (error) {
      toast(error.message);
    }
  });
  els.fileEditorToggleSearch.addEventListener("click", toggleFileEditorSearch);
  els.fileEditorSearchInput.addEventListener("input", scheduleFileEditorSearchRefresh);
  els.fileEditorSearchInput.addEventListener("keydown", handleFileEditorSearchKeydown);
  els.fileEditorReplaceInput.addEventListener("keydown", handleFileEditorSearchKeydown);
  els.fileEditorCaseSensitive.addEventListener("change", refreshFileEditorSearchMatches);
  els.fileEditorFindPrevious.addEventListener("click", () => findFileEditorMatch(-1));
  els.fileEditorFindNext.addEventListener("click", () => findFileEditorMatch(1));
  els.fileEditorReplaceOne.addEventListener("click", replaceCurrentFileEditorMatch);
  els.fileEditorReplaceAll.addEventListener("click", replaceAllFileEditorMatches);
  els.fileEditorCancel.addEventListener("click", () => closeFileEditor());
  els.fileEditorClose.addEventListener("click", () => closeFileEditor());
  els.fileEditorForm.querySelector(".file-editor-head").addEventListener("mousedown", beginFileEditorDrag);
  els.fileEditorResizeHandle.addEventListener("mousedown", beginFileEditorResize);
  window.addEventListener("mousemove", (event) => {
    moveFileEditorDrag(event);
    moveFileEditorResize(event);
  });
  window.addEventListener("mouseup", () => {
    endFileEditorDrag();
    endFileEditorResize();
  });
}

async function openFileEditorLazy(filePath, previousFilePath = "", options = {}) {
  const desktop = typeof window === "object" ? window.forklineDesktop : null;
  const standalone = typeof isStandaloneFileEditorWindow === "function" && isStandaloneFileEditorWindow();
  const repoPath = repoPathSnapshot();
  return shareFileEditorOpenRequest(filePath, previousFilePath, options, repoPath, async () => {
    if (!standalone && typeof desktop?.openFileEditorWindow === "function") {
      return desktop.openFileEditorWindow(
        filePath,
        previousFilePath,
        options.source === "commit" ? "commit" : "worktree",
        options.source === "commit" ? options.commit : "",
        state.theme
      );
    }
    await ensureFileEditorLoaded();
    if (!isCurrentRepoPath(repoPath)) return false;
    return openFileEditor(filePath, previousFilePath, options);
  });
}

async function openCommitFileViewerLazy(filePath, previousFilePath = "", commitSha = "") {
  const desktop = typeof window === "object" ? window.forklineDesktop : null;
  const standalone = typeof isStandaloneFileEditorWindow === "function" && isStandaloneFileEditorWindow();
  const repoPath = repoPathSnapshot();
  const options = { source: "commit", commit: commitSha };
  return shareFileEditorOpenRequest(filePath, previousFilePath, options, repoPath, async () => {
    if (!standalone && typeof desktop?.openFileEditorWindow === "function") {
      return desktop.openFileEditorWindow(filePath, previousFilePath, "commit", commitSha, state.theme);
    }
    await ensureFileEditorLoaded();
    if (!isCurrentRepoPath(repoPath)) return false;
    return openCommitFileViewer(filePath, previousFilePath, commitSha);
  });
}

async function switchOpenFileEditorLazy(filePath, previousFilePath = "") {
  if (!els.fileEditorModal.classList.contains("show")) return true;
  const repoPath = repoPathSnapshot();
  return shareFileEditorOpenRequest(filePath, previousFilePath, {}, repoPath, async () => {
    await ensureFileEditorLoaded();
    if (!isCurrentRepoPath(repoPath)) return false;
    return switchOpenFileEditor(filePath, previousFilePath);
  });
}
