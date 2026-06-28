// Commit actions, history rewrite, remote commit links, patches, and tags.
function currentCompareBaseRef() {
  const branch = state.data?.repo?.branch || "HEAD";
  return branch && branch !== "detached HEAD" ? branch : "HEAD";
}

async function openCompareBranch(head, base = currentCompareBaseRef()) {
  if (!head) return;
  state.compare = { base, head, data: null, loading: true, error: "" };
  state.selectedCompareFile = "";
  state.selectedTab = "compare";
  renderInspector();
  try {
    const data = await api(`/api/compare?base=${encodeURIComponent(base)}&head=${encodeURIComponent(head)}`);
    state.compare = { base: data.base || base, head: data.head || head, data, loading: false, error: "" };
    state.selectedCompareFile = data.files?.[0]?.file || "";
    renderInspector();
  } catch (error) {
    state.compare = { base, head, data: null, loading: false, error: error.message };
    state.selectedCompareFile = "";
    renderInspector();
  }
}

async function refreshCompare() {
  const current = state.compare || {};
  const picker = comparePickerRefs();
  const base = picker.base || current.base || currentCompareBaseRef();
  const head = picker.head || current.head || "";
  if (!head) {
    toast("请选择要比较的目标引用");
    return;
  }
  await openCompareBranch(head, base);
}

async function runCommitContextAction(action) {
  const commit = state.data?.commits.find((item) => item.sha === state.contextCommitSha || item.sha === state.selectedSha);
  hideCommitContextMenu();
  if (!commit) return;
  if (action === "details") {
    state.selectedTab = "details";
    await selectCommit(commit.sha);
    return;
  }
  if (action === "branch") {
    state.selectedSha = commit.sha;
    renderCommits();
    await loadCommit(commit.sha);
    renderInspector();
    openBranchModal();
    return;
  }
  if (action === "tag") {
    state.selectedSha = commit.sha;
    renderCommits();
    await loadCommit(commit.sha);
    renderInspector();
    openTagModal(commit);
    return;
  }
  if (action === "copySha") {
    await copyText(commit.sha);
    toast("已复制提交 SHA");
    return;
  }
  if (action === "copyMessage") {
    await copyText(commit.message);
    toast("已复制提交信息");
    return;
  }
  if (action === "copyPatch") {
    await copyCommitPatch(commit);
    return;
  }
  if (action === "downloadPatch") {
    await downloadCommitPatch(commit);
    return;
  }
  if (action === "openRemote") {
    openRemoteCommit(commit);
    return;
  }
  if (action === "editMessage") {
    state.selectedTab = "details";
    await selectCommit(commit.sha);
    setTimeout(() => els.detailBody.querySelector("[data-reword-form] input")?.focus(), 0);
    return;
  }
  if (
    action === "cherryPick" ||
    action === "revert" ||
    action === "squash" ||
    action === "fixup" ||
    action === "drop" ||
    action === "queueSquash" ||
    action === "queueFixup" ||
    action === "queueDrop" ||
    action === "queueReword" ||
    action === "resetSoft" ||
    action === "resetMixed" ||
    action === "resetHard"
  ) {
    await runCommitToolAction(action, commit.sha);
  }
}

async function runCommitToolAction(action, sha) {
  const commit = state.data?.commits.find((item) => item.sha === sha || item.sha === state.selectedSha);
  if (!commit) return;
  const queueMode = historyQueueModeFromAction(action);
  if (queueMode) {
    await addHistoryQueueItem(commit, queueMode);
    return;
  }
  if (action === "branch") {
    state.selectedSha = commit.sha;
    renderCommits();
    await loadCommit(commit.sha);
    renderInspector();
    openBranchModal();
    return;
  }
  if (action === "copyPatch") {
    await copyCommitPatch(commit);
    return;
  }
  if (action === "downloadPatch") {
    await downloadCommitPatch(commit);
    return;
  }
  if (action === "openRemote") {
    openRemoteCommit(commit);
    return;
  }
  if (action === "cherryPick") {
    if (needsMainline(commit)) {
      openMainlineModal(action, commit);
      return;
    }
    await cherryPickCommit(commit);
    return;
  }
  if (action === "revert") {
    if (needsMainline(commit)) {
      openMainlineModal(action, commit);
      return;
    }
    await revertCommit(commit);
    return;
  }
  if (action === "squash" || action === "fixup" || action === "drop") {
    await openHistoryRewritePlan(commit, action);
    return;
  }
  if (action === "resetSoft" || action === "resetMixed" || action === "resetHard") {
    await resetToCommit(commit, action.replace(/^reset/, "").toLowerCase());
  }
}

function historyRewriteConfig(mode) {
  return {
    squash: {
      title: "压缩进父提交",
      command: "git rebase -i / squash",
      effect: "此提交的改动和提交信息会合并进它的父提交，此提交本身会消失。",
      needsParent: true,
    },
    fixup: {
      title: "修补进父提交",
      command: "git rebase -i / fixup",
      effect: "此提交的改动会合并进它的父提交，但此提交信息会被丢弃。",
      needsParent: true,
    },
    drop: {
      title: "丢弃此提交",
      command: "git rebase -i / drop",
      effect: "此提交会从当前分支历史中删除，后续提交会被重新播放。",
      needsParent: false,
    },
    reword: {
      title: "修改提交信息",
      command: "git rebase -i / reword",
      effect: "只修改此提交的提交信息，后续提交会被重新播放。",
      needsParent: false,
    },
  }[mode];
}

function historyQueueModeFromAction(action) {
  return {
    queueSquash: "squash",
    queueFixup: "fixup",
    queueDrop: "drop",
    queueReword: "reword",
  }[action];
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

function historyQueuePayload(items = state.historyQueue.items) {
  return items.map((item) => {
    const payload = { sha: item.sha, mode: item.mode };
    if (item.mode === "reword") {
      const next = historyQueueItemWithMode(item, "reword");
      payload.summary = next.summary || "";
      payload.body = next.body || "";
    }
    return payload;
  });
}

async function addHistoryQueueItem(commit, mode) {
  if (!state.data || !commit) return;
  const config = historyRewriteConfig(mode);
  if (!config) return;
  if (needsMainline(commit)) {
    toast("merge 提交暂不支持加入历史编辑队列。");
    return;
  }
  if (config.needsParent && !(commit.parents || []).length) {
    toast("根提交没有父提交，不能压缩或修补。");
    return;
  }
  const existing = state.historyQueue.items.find((item) => item.sha === commit.sha);
  const message = historyQueueMessageParts(commit);
  const nextItem = {
    sha: commit.sha,
    short: commit.short,
    message: commit.message,
    mode,
    parents: commit.parents || [],
    summary: mode === "reword" ? existing?.summary || message.summary : existing?.summary || "",
    body: mode === "reword" ? existing?.body ?? message.body : existing?.body || "",
  };
  const items = existing
    ? state.historyQueue.items.map((item) => (item.sha === commit.sha ? { ...item, ...nextItem } : item))
    : [...state.historyQueue.items, nextItem];
  if (items.length > 12) {
    toast("历史编辑队列一次最多 12 条动作。");
    return;
  }
  state.selectedTab = "details";
  state.selectedSha = commit.sha;
  state.historyPlan = null;
  state.historyQueue = { items, loading: true, preview: state.historyQueue.preview, error: "" };
  renderCommits();
  await loadCommit(commit.sha);
  renderInspector();
  toast(existing ? `已更新队列：${commit.short} -> ${config.title}` : `已加入历史编辑队列：${commit.short} ${config.title}`);
  await refreshHistoryRewriteQueuePreview();
}

function historyQueueSignature(items = state.historyQueue.items) {
  return items.map((item) => `${item.sha}:${item.mode}:${item.mode === "reword" ? `${item.summary || ""}\n${item.body || ""}` : ""}`).join("|");
}

async function refreshHistoryRewriteQueuePreview() {
  const items = state.historyQueue.items;
  if (!items.length) {
    state.historyQueue = { items: [], loading: false, preview: null, error: "" };
    renderInspector();
    return;
  }
  const signature = historyQueueSignature(items);
  state.historyQueue = { ...state.historyQueue, loading: true, error: "" };
  renderInspector();
  try {
    const preview = await api("/api/history-rewrite-queue-preview", {
      method: "POST",
      body: JSON.stringify({ items: historyQueuePayload(items) }),
    });
    if (signature !== historyQueueSignature()) return;
    state.historyQueue = { ...state.historyQueue, loading: false, preview, error: "" };
    renderInspector();
  } catch (error) {
    if (signature !== historyQueueSignature()) return;
    state.historyQueue = { ...state.historyQueue, loading: false, preview: null, error: error.message };
    renderInspector();
  }
}

async function replaceHistoryQueueItems(items) {
  state.historyQueue = { items, loading: Boolean(items.length), preview: null, error: "" };
  renderInspector();
  await refreshHistoryRewriteQueuePreview();
}

function scheduleHistoryQueuePreviewRefresh() {
  if (state.historyQueuePreviewTimer) window.clearTimeout(state.historyQueuePreviewTimer);
  state.historyQueuePreviewTimer = window.setTimeout(() => {
    state.historyQueuePreviewTimer = 0;
    refreshHistoryRewriteQueuePreview().catch((error) => toast(error.message));
  }, 450);
}

function updateHistoryQueueField(control) {
  const sha = control?.dataset.sha || "";
  const field = control?.dataset.field || "";
  if (!sha || !["summary", "body"].includes(field)) return;
  const value = control.value;
  const items = state.historyQueue.items.map((item) => {
    if (item.sha !== sha) return item;
    return { ...historyQueueItemWithMode(item, "reword"), [field]: value };
  });
  state.historyQueue = { ...state.historyQueue, items, error: "" };
  scheduleHistoryQueuePreviewRefresh();
}

async function runHistoryRewriteQueue(action, button) {
  if (action === "clear") {
    state.historyQueue = { items: [], loading: false, preview: null, error: "" };
    renderInspector();
    return;
  }
  if (action === "refresh") {
    await refreshHistoryRewriteQueuePreview();
    return;
  }
  if (action === "remove") {
    const sha = button?.dataset.sha || "";
    const items = state.historyQueue.items.filter((item) => item.sha !== sha);
    await replaceHistoryQueueItems(items);
    return;
  }
  if (action === "moveUp" || action === "moveDown") {
    const sha = button?.dataset.sha || "";
    const currentIndex = state.historyQueue.items.findIndex((item) => item.sha === sha);
    const offset = action === "moveUp" ? -1 : 1;
    const nextIndex = currentIndex + offset;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= state.historyQueue.items.length) return;
    const items = [...state.historyQueue.items];
    [items[currentIndex], items[nextIndex]] = [items[nextIndex], items[currentIndex]];
    await replaceHistoryQueueItems(items);
    return;
  }
  if (action === "changeMode") {
    const sha = button?.dataset.sha || "";
    const mode = button?.dataset.mode || button?.value || "";
    const config = historyRewriteConfig(mode);
    if (!sha || !config) return;
    const items = state.historyQueue.items.map((item) => (item.sha === sha ? historyQueueItemWithMode(item, mode) : item));
    await replaceHistoryQueueItems(items);
    return;
  }
  if (action !== "execute") return;
  const preview = state.historyQueue.preview;
  if (!preview?.canRun) {
    toast((preview?.blockers || [state.historyQueue.error || "历史编辑队列还不能执行"]).join("\n"));
    return;
  }
  const message = [
    `确认执行历史编辑队列 ${state.historyQueue.items.length} 项？`,
    "",
    `分支：${preview.branch || state.data?.repo?.branch || "当前分支"}`,
    `影响提交：${preview.affectedCount || 0} 个`,
    "命令：git rebase -i / queue",
    "",
    "这会重写队列影响范围内的历史 SHA。执行前会创建恢复点。",
  ].join("\n");
  if (!state.data.repo.isSample && !confirm(message)) return;
  if (button) button.disabled = true;
  try {
    const result = await api("/api/action", {
      method: "POST",
      body: JSON.stringify({
        action: "rewriteHistoryQueue",
        items: historyQueuePayload(),
      }),
    });
    state.historyQueue = { items: [], loading: false, preview: null, error: "" };
    toast(result.output || "历史编辑队列已执行");
    await reloadAfterHistoryAction();
  } catch (error) {
    toast(error.message);
    state.historyQueue = { ...state.historyQueue, loading: false, error: error.message };
    renderInspector();
    await refreshWorktree(true);
  } finally {
    if (button) button.disabled = false;
  }
}

async function openHistoryRewritePlan(commit, mode) {
  if (!state.data || !commit) return;
  const config = historyRewriteConfig(mode);
  if (!config) return;
  if (needsMainline(commit)) {
    toast("暂不支持对 merge 提交执行自动历史编辑。");
    return;
  }
  if (config.needsParent && !(commit.parents || []).length) {
    toast("根提交没有父提交，不能压缩或修补。");
    return;
  }
  state.selectedTab = "details";
  state.selectedSha = commit.sha;
  state.historyPlan = { sha: commit.sha, mode, loading: true, preview: null, error: "" };
  renderCommits();
  await loadCommit(commit.sha);
  renderInspector();
  try {
    const preview = await api(`/api/history-rewrite-preview?sha=${encodeURIComponent(commit.sha)}&mode=${encodeURIComponent(mode)}`);
    if (state.historyPlan?.sha !== commit.sha || state.historyPlan?.mode !== mode) return;
    state.historyPlan = { sha: commit.sha, mode, loading: false, preview, error: "" };
    renderInspector();
  } catch (error) {
    if (state.historyPlan?.sha !== commit.sha || state.historyPlan?.mode !== mode) return;
    state.historyPlan = { sha: commit.sha, mode, loading: false, preview: null, error: error.message };
    renderInspector();
  }
}

async function runHistoryRewritePlan(action, button) {
  const plan = state.historyPlan;
  if (!plan) return;
  const commit = state.data?.commits.find((item) => item.sha === plan.sha || item.sha === state.selectedSha);
  if (action === "cancel") {
    state.historyPlan = null;
    renderInspector();
    return;
  }
  if (action === "refresh") {
    await openHistoryRewritePlan(commit, plan.mode);
    return;
  }
  if (action !== "execute") return;
  const preview = plan.preview;
  if (!preview?.canRun) {
    toast((preview?.blockers || ["当前计划还不能执行"]).join("\n"));
    return;
  }
  if (button) button.disabled = true;
  try {
    const result = await api("/api/action", {
      method: "POST",
      body: JSON.stringify({ action: "rewriteHistoryCommit", sha: plan.sha, mode: plan.mode }),
    });
    state.historyPlan = null;
    state.historyQueue = { items: [], loading: false, preview: null, error: "" };
    toast(result.output || `已${preview.title || "编辑历史"} ${preview.target?.short || ""}`);
    await reloadAfterHistoryAction();
  } catch (error) {
    toast(error.message);
    state.historyPlan = { ...plan, loading: false, error: error.message };
    renderInspector();
    await refreshWorktree(true);
  } finally {
    if (button) button.disabled = false;
  }
}

async function rewriteHistoryCommit(commit, mode) {
  if (!state.data || !commit) return;
  const config = historyRewriteConfig(mode);
  if (!config) return;
  if (needsMainline(commit)) {
    toast("暂不支持对 merge 提交执行自动历史编辑。");
    return;
  }
  if (config.needsParent && !(commit.parents || []).length) {
    toast("根提交没有父提交，不能压缩或修补。");
    return;
  }
  const dirtyCount = (state.data.workingFiles || []).length;
  const dirtyNote = dirtyCount ? `\n\n当前还有 ${dirtyCount} 个未提交改动，Git 会阻止历史编辑。请先提交或储藏。` : "";
  const warning = mode === "drop" ? "\n\n危险：如果后续提交依赖此提交，可能会产生冲突。" : "";
  const current = state.data.repo.branch || "当前分支";
  const message = `确认${config.title} ${commit.short}？\n\n命令：${config.command}\n分支：${current}\n效果：${config.effect}\n这会重写此提交之后的历史 SHA。${warning}${dirtyNote}\n\n提交信息：${commit.message}`;
  if (!state.data.repo.isSample && !confirm(message)) return;
  try {
    const result = await api("/api/action", {
      method: "POST",
      body: JSON.stringify({ action: "rewriteHistoryCommit", sha: commit.sha, mode }),
    });
    toast(result.output || `已${config.title} ${commit.short}`);
    await reloadAfterHistoryAction();
  } catch (error) {
    toast(error.message);
    await refreshWorktree(false);
  }
}

async function cherryPickCommit(commit, mainline = null) {
  if (!state.data || !commit) return;
  const mainlineText = mainline ? `\n主线：父提交 ${mainline}` : "";
  if (!state.data.repo.isSample && !confirm(`确认挑选提交 ${commit.short} 到当前分支？\n\n这会在当前分支创建一个内容相同的新提交，不会移动原分支。${mainlineText}\n提交信息：${commit.message}`)) return;
  try {
    const result = await api("/api/action", {
      method: "POST",
      body: JSON.stringify({ action: "cherryPickCommit", sha: commit.sha, mainline }),
    });
    toast(result.output || `已挑选提交 ${commit.short}`);
    await reloadAfterHistoryAction();
  } catch (error) {
    toast(error.message);
    await refreshWorktree(false);
  }
}

async function revertCommit(commit, mainline = null) {
  if (!state.data || !commit) return;
  const mainlineText = mainline ? `\n主线：父提交 ${mainline}` : "";
  if (!state.data.repo.isSample && !confirm(`确认还原提交 ${commit.short}？\n\n这会创建一个新的反向提交，不会删除历史提交。${mainlineText}\n提交信息：${commit.message}`)) return;
  try {
    const result = await api("/api/action", {
      method: "POST",
      body: JSON.stringify({ action: "revertCommit", sha: commit.sha, mainline }),
    });
    toast(result.output || `已还原提交 ${commit.short}`);
    await reloadAfterHistoryAction();
  } catch (error) {
    toast(error.message);
  }
}

function needsMainline(commit) {
  return (commit?.parents || []).length > 1;
}

function openMainlineModal(action, commit) {
  const parents = commit?.parents || [];
  if (!commit || parents.length <= 1) return;
  state.mainlineAction = action;
  state.mainlineCommitSha = commit.sha;
  const actionText = action === "cherryPick" ? "挑选" : "还原";
  const command = action === "cherryPick" ? "git cherry-pick -m" : "git revert -m";
  els.mainlineModalTitle.textContent = `${actionText} merge 提交`;
  els.mainlineStartText.textContent = `提交 ${commit.short} 有 ${parents.length} 个父提交。选择主线后会执行 ${command}。`;
  els.mainlineSubmit.textContent = `继续${actionText}`;
  els.mainlineOptions.innerHTML = parents
    .map((parentSha, index) => {
      const mainline = index + 1;
      const checked = index === 0 ? "checked" : "";
      const hint = index === 0 ? "通常是执行合并时所在的分支方向" : "通常是被合并进来的分支方向";
      return `
        <label class="mainline-option">
          <input type="radio" name="mainline" value="${mainline}" ${checked} />
          <span>
            <strong>父提交 ${mainline} · ${escapeHtml(parentSha.slice(0, 7))}</strong>
            <em>${escapeHtml(hint)}</em>
          </span>
        </label>
      `;
    })
    .join("");
  els.mainlineModal.classList.add("show");
  els.mainlineModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  setTimeout(() => els.mainlineOptions.querySelector("input[name='mainline']:checked")?.focus(), 0);
}

function closeMainlineModal() {
  els.mainlineModal.classList.remove("show");
  els.mainlineModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
  state.mainlineAction = "";
  state.mainlineCommitSha = "";
  els.mainlineOptions.innerHTML = "";
}

async function submitMainlineForm(event) {
  event.preventDefault();
  const commit = state.data?.commits.find((item) => item.sha === state.mainlineCommitSha);
  const action = state.mainlineAction;
  const selected = Number.parseInt(els.mainlineOptions.querySelector("input[name='mainline']:checked")?.value || "", 10);
  if (!commit || !Number.isInteger(selected)) {
    toast("请选择主线");
    return;
  }
  closeMainlineModal();
  if (action === "cherryPick") {
    await cherryPickCommit(commit, selected);
    return;
  }
  if (action === "revert") {
    await revertCommit(commit, selected);
  }
}

async function resetToCommit(commit, mode) {
  if (!state.data || !commit) return;
  const modeText = { soft: "软重置（soft）", mixed: "混合重置（mixed）", hard: "硬重置（hard）" }[mode] || "混合重置（mixed）";
  const effects = {
    soft: "当前分支会移动到此提交；后续提交的改动会保留在已暂存区。",
    mixed: "当前分支会移动到此提交；后续提交的改动会保留在工作区，且不会暂存。",
    hard: "当前分支会移动到此提交；后续提交和当前工作区改动都会被丢弃，无法从工作区恢复。",
  };
  const warning = mode === "hard" ? "\n\n危险：Hard Reset 会丢弃未提交改动，请确认你真的不需要它们。" : "";
  if (!state.data.repo.isSample && !confirm(`确认执行${modeText}到提交 ${commit.short}？\n\n${effects[mode]}${warning}\n\n提交信息：${commit.message}`)) return;
  try {
    const result = await api("/api/action", {
      method: "POST",
      body: JSON.stringify({ action: "resetToCommit", sha: commit.sha, mode }),
    });
    toast(result.output || `已${modeText}到 ${commit.short}`);
    await reloadAfterHistoryAction();
  } catch (error) {
    toast(error.message);
  }
}

async function reloadAfterHistoryAction() {
  state.commitDetails.clear();
  state.data = await api(`/api/state?ref=${encodeURIComponent(state.selectedRef)}`);
  state.selectedRef = state.data.repo.selectedRef || state.selectedRef;
  state.selectedSha = state.data.commits[0]?.sha || "";
  state.selectedFile = "";
  state.selectedCommitFile = "";
  renderAll();
  if (state.selectedSha) {
    await loadCommit(state.selectedSha);
    renderInspector();
  }
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

function openRemoteCommit(commit) {
  const url = commitRemoteUrl(commit?.sha);
  if (!url) {
    toast("当前仓库没有可识别的网页远端 URL");
    return;
  }
  const opened = window.open(url, "_blank");
  if (!opened) {
    toast(`浏览器拦截了新窗口，可以复制地址手动打开：\n${url}`);
    return;
  }
  opened.opener = null;
  toast("已打开远端提交页面");
}

async function fetchCommitPatch(commit) {
  if (!commit?.sha) throw new Error("没有选中的提交");
  return api(`/api/patch?sha=${encodeURIComponent(commit.sha)}`);
}

async function copyCommitPatch(commit) {
  const result = await fetchCommitPatch(commit);
  await copyText(result.patch || "");
  toast(`已复制补丁：${result.fileName || result.short || commit.short}`);
}

async function downloadCommitPatch(commit) {
  const result = await fetchCommitPatch(commit);
  downloadTextFile(result.fileName || `${commit.short || "commit"}.patch`, result.patch || "", "text/x-patch;charset=utf-8");
  toast(`已下载补丁：${result.fileName || commit.short}`);
}

function downloadTextFile(fileName, text, type = "text/plain;charset=utf-8") {
  const blob = new Blob([String(text || "")], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = safeDownloadName(fileName);
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function safeDownloadName(value) {
  const name = String(value || "forkline.patch")
    .replace(/[<>:"/\\|?*\x00-\x1f]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  return name || "forkline.patch";
}

async function runSyncPullRequestAction(action) {
  const pullRequest = state.data?.sync?.pullRequest || {};
  if (!pullRequest.available || !pullRequest.url) {
    toast(pullRequest.reason || "当前分支暂时不能生成 PR 链接");
    return;
  }
  if (action === "copy") {
    await copyText(pullRequest.url);
    toast("已复制 PR 链接");
    return;
  }
  const opened = window.open(pullRequest.url, "_blank");
  if (!opened) {
    toast(`浏览器拦截了新窗口，可以复制地址手动打开：\n${pullRequest.url}`);
    return;
  }
  opened.opener = null;
  toast(pullRequest.title === "创建 Merge Request" ? "已打开 Merge Request 页面" : "已打开 Pull Request 页面");
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

function openTagModal(commit) {
  if (!commit) return;
  state.tagTargetSha = commit.sha;
  els.tagNameInput.value = "";
  els.tagAnnotatedToggle.checked = false;
  els.tagMessageInput.value = "";
  els.tagStartText.textContent = `基于提交 ${commit.short} 创建 Tag。`;
  els.tagModal.classList.add("show");
  els.tagModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  setTimeout(() => els.tagNameInput.focus(), 0);
}

function closeTagModal() {
  els.tagModal.classList.remove("show");
  els.tagModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
  state.tagTargetSha = "";
}

async function createTagFromForm(event) {
  event.preventDefault();
  if (!state.data) return;
  const name = els.tagNameInput.value.trim();
  if (!name) {
    toast("请输入标签名");
    els.tagNameInput.focus();
    return;
  }
  const target = state.tagTargetSha || state.selectedSha;
  if (!target) {
    toast("没有选中的提交");
    return;
  }
  try {
    els.tagSubmit.disabled = true;
    const result = await api("/api/action", {
      method: "POST",
      body: JSON.stringify({
        action: "createTag",
        name,
        target,
        annotated: els.tagAnnotatedToggle.checked,
        message: els.tagMessageInput.value.trim(),
      }),
    });
    toast(result.output || `已创建 Tag ${name}`);
    closeTagModal();
    state.selectedTag = result.tag || name;
    state.commitDetails.clear();
    state.data = await api(`/api/state?ref=${encodeURIComponent(state.selectedRef)}`);
    state.selectedRef = state.data.repo.selectedRef || state.selectedRef;
    renderAll();
    if (state.selectedSha) {
      await loadCommit(state.selectedSha);
      renderInspector();
    }
  } catch (error) {
    toast(error.message);
  } finally {
    els.tagSubmit.disabled = false;
  }
}

