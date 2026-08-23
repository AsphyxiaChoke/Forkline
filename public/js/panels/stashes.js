// Stash panel and actions.
function renderStashesTab() {
  if (renderRepoDetailPlaceholder("stashes", "储藏列表", "var(--amber)")) return;
  const stashes = state.data?.stashes || [];
  if (state.selectedStash && !stashes.some((stash) => stash.ref === state.selectedStash)) {
    state.selectedStash = "";
  }
  if (!state.selectedStash && stashes.length) state.selectedStash = stashes[0].ref;
  const selected = stashes.find((stash) => stash.ref === state.selectedStash);
  let detail = selected ? state.stashDetails.get(selected.ref) : null;
  if (selected && !detail) {
    detail = { loading: true };
    loadStashDetail(selected.ref);
  }

  els.detailNode.style.borderColor = "var(--amber)";
  els.detailTitle.textContent = t("储藏列表");
  els.detailSub.textContent = stashes.length ? t("{count} 个储藏", { count: stashes.length }) : t("没有储藏");
  if (!stashes.length) {
    els.detailBody.innerHTML = tt`
      <div class="empty-panel">
        <strong>没有储藏记录</strong>
        <span>使用“储藏并签出”或 Git stash 后会显示在这里。</span>
      </div>
    `;
    return;
  }

  const files = detail?.files || [];
  const diff = detail?.diff || [];
  if (selected && diff.length) {
    setActiveDiff({ source: "stash", title: t("{ref} · 储藏", { ref: selected.ref }), path: selected.message, diff, emptyText: t("没有可显示的储藏改动") });
  } else {
    setActiveDiff(null);
  }
  els.detailBody.innerHTML = tt`
    <div class="stash-layout">
      <div class="stash-list">
        ${stashes.map((stash) => stashRowHtml(stash, stash.ref === state.selectedStash)).join("")}
      </div>
      <div class="stash-detail">
        ${selected ? stashDetailHtml(selected, detail, files, diff) : ""}
      </div>
    </div>
  `;
}

function stashRowHtml(stash, active) {
  return `
    <button class="stash-row ${active ? "active" : ""}" data-stash-ref="${escapeAttr(stash.ref)}" type="button">
      <span class="stash-row-top">
        <strong>${escapeHtml(stash.ref)}</strong>
        <em>${escapeHtml(stash.time || "")}</em>
      </span>
      <span class="stash-message" title="${escapeAttr(stash.message)}">${escapeHtml(stash.message)}</span>
      <span class="stash-branch" title="${escapeAttr(stash.subject)}">${escapeHtml(stash.branch || t("未知分支"))}</span>
    </button>
  `;
}

function stashDetailHtml(stash, detail, files, diff) {
  if (detail?.loading) {
    return `<div class="empty-panel compact"><span>${t("正在读取储藏内容...")}</span></div>`;
  }
  if (detail?.error) {
    return `<div class="empty-panel compact"><strong>${t("读取失败")}</strong><span>${escapeHtml(t(detail.error))}</span></div>`;
  }
  const actionDisabled = stashActionBusyForCurrentRepo() ? " disabled" : "";
  return tt`
    <div class="stash-actions">
      <button class="mini-btn" data-stash-action="apply" data-stash-ref="${escapeAttr(stash.ref)}" type="button"${actionDisabled}>应用</button>
      <button class="mini-btn" data-stash-action="pop" data-stash-ref="${escapeAttr(stash.ref)}" type="button"${actionDisabled}>弹出</button>
      <button class="mini-btn" data-stash-action="branch" data-stash-ref="${escapeAttr(stash.ref)}" type="button"${actionDisabled}>建分支</button>
      <button class="mini-btn danger" data-stash-action="drop" data-stash-ref="${escapeAttr(stash.ref)}" type="button"${actionDisabled}>删除</button>
    </div>
    <div class="meta-grid stash-meta">
      <span>引用</span><div class="meta-value">${escapeHtml(stash.ref)}</div>
      <span>分支</span><div class="meta-value">${escapeHtml(stash.branch || t("未知"))}</div>
      <span>时间</span><div class="meta-value">${escapeHtml(stash.time || t("未知"))}</div>
      <span>消息</span><div class="meta-value" title="${escapeAttr(stash.message)}">${escapeHtml(stash.message)}</div>
    </div>
    <div class="detail-section-title">变更文件</div>
    <div class="stash-files">${files.length ? fileTreeHtml(files) : `<div class="file-row"><span></span><span class="file-name">${t("没有文件列表")}</span><span></span></div>`}</div>
    <div class="panel-title compact stash-diff-title">
      <div class="panel-title-text">
        <span>储藏差异</span>
        <span class="panel-subtitle">${escapeHtml(stash.ref)}</span>
      </div>
      <button class="mini-btn diff-max-btn" data-open-diff-modal type="button" ${diff.length ? "" : "disabled"}>最大化</button>
    </div>
    <div class="stash-diff">${renderSideDiff(diff, "没有可显示的储藏改动")}</div>
  `;
}

async function loadStashDetail(ref) {
  if (!ref || state.stashDetails.get(ref)?.loading) return;
  const repoPath = repoPathSnapshot();
  state.stashDetails.set(ref, { loading: true });
  try {
    const detail = await api(`/api/stash?ref=${encodeURIComponent(ref)}`);
    if (!isCurrentRepoPath(repoPath)) return;
    state.stashDetails.set(ref, detail);
  } catch (error) {
    if (!isCurrentRepoPath(repoPath)) return;
    state.stashDetails.set(ref, { error: error.message });
  }
  if (isCurrentRepoPath(repoPath) && state.selectedTab === "stashes" && state.selectedStash === ref) renderInspector();
}

function selectStash(ref) {
  if (!ref || ref === state.selectedStash) return;
  state.selectedStash = ref;
  renderInspector();
}

function stashActionListSignature(stashes) {
  return (stashes || [])
    .map((stash) => [stash.ref, stash.sha, stash.message, stash.branch, stash.time, stash.subject].map((value) => value || "").join("\u001f"))
    .join("\u001e");
}

function stashActionWorktreeSignature(data) {
  const snapshot = data?.worktreeSnapshot || (data?.workingFiles || [])
    .map((file) => [file.state, file.file, file.extra, file.indexStatus, file.worktreeStatus, file.snapshot].map((value) => value || "").join("\u001f"))
    .join("\u001e");
  const operation = data?.repo?.operation || {};
  return [snapshot, operation.type || "", operation.snapshot || ""].join("\u001f");
}

function stashActionContext() {
  const data = state.data;
  const repo = data?.repo || {};
  return {
    data,
    repoPath: repo.path || "",
    stateRequestId: state.stateRequestId,
    openRepoRequestId: state.openRepoRequestId,
    branch: repo.branch || "",
    headSha: repo.headSha || "",
    worktreeSignature: stashActionWorktreeSignature(data),
    stashSignature: stashActionListSignature(data?.stashes),
  };
}

function isCurrentStashAction(lock) {
  const current = stashActionContext();
  return stashActionLocks().get(lock.repoPath) === lock
    && current.data === lock.data
    && current.repoPath === lock.repoPath
    && current.stateRequestId === lock.stateRequestId
    && current.openRepoRequestId === lock.openRepoRequestId
    && current.branch === lock.branch
    && current.headSha === lock.headSha
    && current.worktreeSignature === lock.worktreeSignature
    && current.stashSignature === lock.stashSignature;
}

function updateStashActionContext(lock) {
  Object.assign(lock, stashActionContext());
}

function stashActionLocks() {
  if (!(state.stashActionLocks instanceof Map)) state.stashActionLocks = new Map();
  return state.stashActionLocks;
}

function stashActionBusyForCurrentRepo() {
  return stashActionLocks().has(repoPathSnapshot());
}

function setStashActionButtonsDisabled(disabled) {
  if (typeof document !== "object" || typeof document.querySelectorAll !== "function") return;
  document.querySelectorAll("[data-stash-action]").forEach((button) => {
    button.disabled = disabled;
  });
}

function beginStashAction(action, ref) {
  const context = stashActionContext();
  const locks = stashActionLocks();
  if (!context.repoPath || locks.has(context.repoPath)) return null;
  const lock = { ...context, action, ref };
  locks.set(context.repoPath, lock);
  setStashActionButtonsDisabled(true);
  return lock;
}

function finishStashAction(lock, button) {
  const locks = stashActionLocks();
  const ownsLock = locks.get(lock.repoPath) === lock;
  if (ownsLock) {
    locks.delete(lock.repoPath);
    if (!stashActionBusyForCurrentRepo()) setStashActionButtonsDisabled(false);
    return;
  }
  if (!stashActionBusyForCurrentRepo() && button) button.disabled = false;
}

async function runStashAction(action, ref, button) {
  if (!state.data || !ref) return;
  const repoPath = repoPathSnapshot();
  if (stashActionLocks().has(repoPath)) return;
  const names = { apply: "应用储藏", pop: "弹出储藏", drop: "删除储藏", branch: "从储藏创建分支" };
  const stash = state.data.stashes?.find((item) => item.ref === ref);
  if (action === "branch") {
    await branchFromStash(ref, button);
    return;
  }
  const message = stashActionConfirmMessage(action, ref);
  if (!state.data.repo.isSample && !confirm(message)) return;
  const lock = beginStashAction(action, ref);
  if (!lock) return;
  try {
    if (button) button.disabled = true;
    const result = await api("/api/action", { method: "POST", body: JSON.stringify({ action: `${action}Stash`, ref, sha: stash?.sha || "", ...currentBranchSnapshotPayload() }) });
    if (!isCurrentStashAction(lock)) return;
    toast(result.output || t("{action}完成", { action: t(names[action] || "储藏操作") }));
    state.stashDetails.clear();
    const data = await api("/api/worktree?stashes=1");
    if (!isCurrentStashAction(lock)) return;
    mergeWorktreeState(data, { stashes: true });
    updateStashActionContext(lock);
    if (!state.data.stashes?.some((stash) => stash.ref === state.selectedStash)) {
      state.selectedStash = state.data.stashes?.[0]?.ref || "";
    }
    renderStage();
    renderInspector();
    if (state.selectedSha && state.selectedTab !== "stashes") {
      await loadCommit(state.selectedSha);
      if (!isCurrentStashAction(lock)) return;
      renderInspector();
    }
  } catch (error) {
    if (!isCurrentStashAction(lock)) return;
    toast(error.message);
  } finally {
    finishStashAction(lock, button);
  }
}

async function branchFromStash(ref, button) {
  const repoPath = repoPathSnapshot();
  if (!state.data || !ref || stashActionLocks().has(repoPath)) return;
  const stash = state.data?.stashes?.find((item) => item.ref === ref);
  const defaultName = defaultStashBranchName(ref);
  const branch = prompt(t("从 {ref} 创建新分支：", { ref }), defaultName);
  if (branch === null) return;
  const trimmed = branch.trim();
  if (!trimmed) {
    toast(t("请填写分支名"));
    return;
  }
  const message = t("确认从 {ref} 创建并切换到分支 {branch}？\n\n命令：git stash branch <分支> <储藏>\n成功后这条储藏会从列表删除，改动会出现在新分支工作区。", { ref, branch: trimmed });
  if (!state.data.repo.isSample && !confirm(message)) return;
  const lock = beginStashAction("branch", ref);
  if (!lock) return;
  try {
    if (button) button.disabled = true;
    const result = await api("/api/action", {
      method: "POST",
      body: JSON.stringify({ action: "branchFromStash", ref, sha: stash?.sha || "", branch: trimmed, ...currentBranchSnapshotPayload() }),
    });
    if (!isCurrentStashAction(lock)) return;
    toast(result.output || t("已从 {ref} 创建分支 {branch}", { ref, branch: trimmed }));
    state.stashDetails.clear();
    if (result.state) {
      state.data = result.state;
    } else {
      const data = await api("/api/state");
      if (!isCurrentStashAction(lock)) return;
      state.data = data;
    }
    updateStashActionContext(lock);
    state.selectedRef = state.data.repo.branch && state.data.repo.branch !== "detached HEAD" ? state.data.repo.branch : "";
    state.selectedStash = state.data.stashes?.[0]?.ref || "";
    state.selectedTab = "stashes";
    state.selectedSha = state.data.commits[0]?.sha || "";
    renderAll();
    if (state.selectedSha) {
      await loadCommit(state.selectedSha);
      if (!isCurrentStashAction(lock)) return;
      renderInspector();
    }
  } catch (error) {
    if (!isCurrentStashAction(lock)) return;
    toast(error.message);
  } finally {
    finishStashAction(lock, button);
  }
}

function defaultStashBranchName(ref) {
  const index = String(ref || "").match(/\d+/)?.[0] || "0";
  const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `stash/${stamp}-${index}`;
}

function stashActionConfirmMessage(action, ref) {
  if (action === "apply") return t("确认应用 {ref}？储藏会保留在列表中。", { ref });
  if (action === "pop") return t("确认弹出 {ref}？成功后这条储藏会从列表删除。", { ref });
  if (action === "drop") return t("确认删除 {ref}？这个操作不能撤销。", { ref });
  return t("确认操作 {ref}？", { ref });
}
