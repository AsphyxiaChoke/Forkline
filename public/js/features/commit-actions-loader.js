// Keeps commit display helpers eager while loading history and remote actions on first use.
const commitActionsResource = "./js/features/commit-actions.js";
const commitActionsStyleResource = "./commit-actions.css";
const commitActionMethodNames = [
  "openCompareBranch",
  "refreshCompare",
  "runCommitContextAction",
  "runCommitToolAction",
  "updateHistoryQueueField",
  "runHistoryRewriteQueue",
  "runHistoryRewritePlan",
  "reloadAfterHistoryAction",
  "openRemoteCommit",
  "copyCommitPatch",
  "downloadCommitPatch",
  "runSyncPullRequestAction",
  "openTagModal",
  "createTagFromForm",
  "submitMainlineForm",
  "renderHistoryRewritePlan",
  "renderHistoryRewriteQueue",
];

let commitActionsLoadPromise = null;
let commitActionsStyleLoadPromise = null;
let commitActionUiRefreshPending = false;

function commitActionsImplementation() {
  return window.ForklineCommitActions || null;
}

function commitActionsImplementationLoaded() {
  const implementation = commitActionsImplementation();
  return Boolean(implementation && commitActionMethodNames.every((name) => typeof implementation[name] === "function"));
}

function commitActionsLoaded() {
  return commitActionsImplementationLoaded() && commitActionsStyleLoaded();
}

function commitActionsResourceElement() {
  return document.querySelector("[data-commit-actions-resource]");
}

function commitActionsStyleElement() {
  return document.querySelector("[data-commit-actions-style]");
}

function commitActionsStyleLoaded() {
  return commitActionsStyleElement()?.dataset.loaded === "true";
}

function commitActionsLoadError() {
  return t("提交操作资源加载失败，请重试。");
}

function loadCommitActionsScript() {
  if (commitActionsImplementationLoaded()) return Promise.resolve();
  const existing = commitActionsResourceElement();
  return new Promise((resolve, reject) => {
    const script = existing || document.createElement("script");
    script.src = commitActionsResource;
    script.async = false;
    script.dataset.commitActionsResource = "true";
    script.onload = () => {
      if (!commitActionsImplementationLoaded()) {
        script.remove();
        reject(new Error(commitActionsLoadError()));
        return;
      }
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = () => {
      script.remove();
      reject(new Error(commitActionsLoadError()));
    };
    if (!existing) document.head.appendChild(script);
  });
}

function loadCommitActionsStyle() {
  if (commitActionsStyleLoaded()) return Promise.resolve();
  if (commitActionsStyleLoadPromise) return commitActionsStyleLoadPromise;
  const existing = commitActionsStyleElement();
  const promise = new Promise((resolve, reject) => {
    const link = existing || document.createElement("link");
    link.rel = "stylesheet";
    link.href = commitActionsStyleResource;
    link.dataset.commitActionsStyle = "true";
    link.onload = () => {
      link.dataset.loaded = "true";
      resolve();
    };
    link.onerror = () => {
      link.remove();
      reject(new Error(commitActionsLoadError()));
    };
    if (!existing) document.head.appendChild(link);
  });
  commitActionsStyleLoadPromise = promise;
  promise.catch(() => {
    if (commitActionsStyleLoadPromise === promise) commitActionsStyleLoadPromise = null;
  });
  return promise;
}

function loadCommitActionsResources() {
  return Promise.all([
    loadCommitActionsStyle(),
    loadCommitActionsScript(),
  ]);
}

async function ensureCommitActionsLoaded() {
  if (commitActionsLoaded()) return;
  if (!commitActionsLoadPromise) commitActionsLoadPromise = loadCommitActionsResources();
  try {
    await commitActionsLoadPromise;
  } catch (error) {
    commitActionsLoadPromise = null;
    throw error;
  }
}

async function runLazyCommitAction(method, args) {
  const repoPath = repoPathSnapshot();
  await ensureCommitActionsLoaded();
  if (!isCurrentRepoPath(repoPath)) return false;
  return commitActionsImplementation()[method](...args);
}

async function openCompareBranch(head, base = currentCompareBaseRef()) {
  return runLazyCommitAction("openCompareBranch", [head, base]);
}

async function refreshCompare() {
  return runLazyCommitAction("refreshCompare", []);
}

async function runCommitContextAction(action) {
  return runLazyCommitAction("runCommitContextAction", [action]);
}

async function runCommitToolAction(action, sha) {
  return runLazyCommitAction("runCommitToolAction", [action, sha]);
}

async function updateHistoryQueueField(control) {
  return runLazyCommitAction("updateHistoryQueueField", [control]);
}

async function runHistoryRewriteQueue(action, button) {
  return runLazyCommitAction("runHistoryRewriteQueue", [action, button]);
}

async function runHistoryRewritePlan(action, button) {
  return runLazyCommitAction("runHistoryRewritePlan", [action, button]);
}

async function reloadAfterHistoryAction(repoPath = repoPathSnapshot()) {
  return runLazyCommitAction("reloadAfterHistoryAction", [repoPath]);
}

async function openRemoteCommit(commit) {
  return runLazyCommitAction("openRemoteCommit", [commit]);
}

async function copyCommitPatch(commit) {
  return runLazyCommitAction("copyCommitPatch", [commit]);
}

async function downloadCommitPatch(commit) {
  return runLazyCommitAction("downloadCommitPatch", [commit]);
}

async function runSyncPullRequestAction(action) {
  return runLazyCommitAction("runSyncPullRequestAction", [action]);
}

async function openTagModal(commit) {
  return runLazyCommitAction("openTagModal", [commit]);
}

async function createTagFromForm(event) {
  return runLazyCommitAction("createTagFromForm", [event]);
}

async function submitMainlineForm(event) {
  return runLazyCommitAction("submitMainlineForm", [event]);
}

function requestCommitActionUiRefresh() {
  if (commitActionsLoaded() || commitActionUiRefreshPending) return;
  commitActionUiRefreshPending = true;
  ensureCommitActionsLoaded()
    .then(() => renderInspector())
    .catch((error) => toast(error.message))
    .finally(() => {
      commitActionUiRefreshPending = false;
    });
}

function renderHistoryRewritePlan(commit) {
  const implementation = commitActionsImplementation();
  if (commitActionsLoaded() && typeof implementation?.renderHistoryRewritePlan === "function") {
    return implementation.renderHistoryRewritePlan(commit);
  }
  const plan = state.historyPlan;
  if (!plan || plan.sha !== commit.sha) return "";
  requestCommitActionUiRefresh();
  return `<section class="history-plan loading"><div class="history-plan-empty">${t("正在载入历史编辑界面...")}</div></section>`;
}

function renderHistoryRewriteQueue() {
  const implementation = commitActionsImplementation();
  if (commitActionsLoaded() && typeof implementation?.renderHistoryRewriteQueue === "function") {
    return implementation.renderHistoryRewriteQueue();
  }
  const queue = state.historyQueue || {};
  const items = queue.items || [];
  if (!items.length && !queue.loading && !queue.preview && !queue.error) {
    return `<div class="history-plan-empty history-queue-empty">${t("队列为空。可以把多个提交加入队列后一次预检和执行。")}</div>`;
  }
  requestCommitActionUiRefresh();
  return `<div class="history-plan-empty">${t("正在载入历史编辑界面...")}</div>`;
}

function currentCompareBaseRef() {
  const branch = state.data?.repo?.branch || "HEAD";
  return branch && branch !== "detached HEAD" ? branch : "HEAD";
}

function historyRewriteConfig(mode) {
  return {
    squash: {
      title: t("压缩进父提交"),
      command: "git rebase -i / squash",
      effect: t("此提交的改动和提交信息会合并进它的父提交，此提交本身会消失。"),
      needsParent: true,
    },
    fixup: {
      title: t("修补进父提交"),
      command: "git rebase -i / fixup",
      effect: t("此提交的改动会合并进它的父提交，但此提交信息会被丢弃。"),
      needsParent: true,
    },
    drop: {
      title: t("丢弃此提交"),
      command: "git rebase -i / drop",
      effect: t("此提交会从当前分支历史中删除，后续提交会被重新播放。"),
      needsParent: false,
    },
    reword: {
      title: t("修改提交信息"),
      command: "git rebase -i / reword",
      effect: t("只修改此提交的提交信息，后续提交会被重新播放。"),
      needsParent: false,
    },
  }[mode];
}

function historyQueueMessageParts(item) {
  const detail = item?.sha ? state.commitDetails.get(item.sha) || {} : {};
  return commitMessageParts(item || {}, detail);
}

function historyQueueItemWithMode(item, mode) {
  if (mode !== "reword") return { ...item, mode };
  const parts = item.summary ? { summary: item.summary, body: item.body || "" } : historyQueueMessageParts(item);
  return { ...item, mode, summary: parts.summary, body: parts.body || "" };
}

async function copyText(text) {
  const value = String(text || "");
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
    }
  }
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function commitRemoteUrl(sha) {
  const webBase = preferredRemoteWebBase();
  if (!webBase || !sha) return "";
  return `${webBase}/${remoteCommitPathSegment(webBase)}/${encodeURIComponent(sha)}`;
}

function remoteCommitPathSegment(webBase) {
  try {
    const host = new URL(webBase).hostname.toLowerCase();
    if (host === "bitbucket.org" || host.endsWith(".bitbucket.org")) return "commits";
    if (host === "gitlab.com" || host.includes("gitlab")) return "-/commit";
  } catch {
  }
  return "commit";
}

function preferredRemoteWebBase() {
  const remotes = state.data?.sync?.remotes || [];
  const ordered = [
    ...remotes.filter((remote) => remote.name === "origin"),
    ...remotes.filter((remote) => remote.name !== "origin"),
  ];
  for (const remote of ordered) {
    const base = remoteWebBase(remote.pushUrl || remote.fetchUrl) || remoteWebBase(remote.fetchUrl);
    if (base) return base;
  }
  return "";
}

function remoteWebBase(remoteUrl) {
  const value = String(remoteUrl || "").trim();
  if (!value) return "";
  const scpLike = value.match(/^git@([^:]+):(.+)$/);
  if (scpLike) return cleanRemoteWebPath(`https://${scpLike[1]}/${scpLike[2]}`);
  try {
    const url = new URL(value);
    if (url.protocol === "http:" || url.protocol === "https:") {
      url.username = "";
      url.password = "";
      return cleanRemoteWebPath(url.toString());
    }
    if (url.protocol === "ssh:" && url.hostname && url.pathname) {
      return cleanRemoteWebPath(`https://${url.hostname}${url.pathname}`);
    }
  } catch {
  }
  return "";
}

function cleanRemoteWebPath(value) {
  return String(value || "")
    .replace(/\/+$/, "")
    .replace(/\.git$/i, "");
}

function closeMainlineModal() {
  els.mainlineModal.classList.remove("show");
  els.mainlineModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
  state.mainlineAction = "";
  state.mainlineCommitSha = "";
  els.mainlineOptions.innerHTML = "";
}

function closeTagModal() {
  els.tagModal.classList.remove("show");
  els.tagModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
  state.tagTargetSha = "";
}
