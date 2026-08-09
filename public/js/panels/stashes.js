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
  return tt`
    <div class="stash-actions">
      <button class="mini-btn" data-stash-action="apply" data-stash-ref="${escapeAttr(stash.ref)}" type="button">应用</button>
      <button class="mini-btn" data-stash-action="pop" data-stash-ref="${escapeAttr(stash.ref)}" type="button">弹出</button>
      <button class="mini-btn" data-stash-action="branch" data-stash-ref="${escapeAttr(stash.ref)}" type="button">建分支</button>
      <button class="mini-btn danger" data-stash-action="drop" data-stash-ref="${escapeAttr(stash.ref)}" type="button">删除</button>
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

async function runStashAction(action, ref, button) {
  if (!state.data || !ref) return;
  const names = { apply: "应用储藏", pop: "弹出储藏", drop: "删除储藏", branch: "从储藏创建分支" };
  const stash = state.data.stashes?.find((item) => item.ref === ref);
  if (action === "branch") {
    await branchFromStash(ref, button);
    return;
  }
  const message = stashActionConfirmMessage(action, ref);
  if (!state.data.repo.isSample && !confirm(message)) return;
  const repoPath = repoPathSnapshot();
  try {
    if (button) button.disabled = true;
    const result = await api("/api/action", { method: "POST", body: JSON.stringify({ action: `${action}Stash`, ref, sha: stash?.sha || "", ...currentBranchSnapshotPayload() }) });
    if (!isCurrentRepoPath(repoPath)) return;
    toast(result.output || t("{action}完成", { action: t(names[action] || "储藏操作") }));
    state.stashDetails.clear();
    const data = await api("/api/worktree?stashes=1");
    if (!isCurrentRepoPath(repoPath)) return;
    mergeWorktreeState(data, { stashes: true });
    if (!state.data.stashes?.some((stash) => stash.ref === state.selectedStash)) {
      state.selectedStash = state.data.stashes?.[0]?.ref || "";
    }
    renderStage();
    renderInspector();
    if (state.selectedSha && state.selectedTab !== "stashes") {
      await loadCommit(state.selectedSha);
      renderInspector();
    }
  } catch (error) {
    if (!isCurrentRepoPath(repoPath)) return;
    toast(error.message);
  } finally {
    if (button) button.disabled = false;
  }
}

async function branchFromStash(ref, button) {
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
  const repoPath = repoPathSnapshot();
  try {
    if (button) button.disabled = true;
    const result = await api("/api/action", {
      method: "POST",
      body: JSON.stringify({ action: "branchFromStash", ref, sha: stash?.sha || "", branch: trimmed, ...currentBranchSnapshotPayload() }),
    });
    if (!isCurrentRepoPath(repoPath)) return;
    toast(result.output || t("已从 {ref} 创建分支 {branch}", { ref, branch: trimmed }));
    state.stashDetails.clear();
    if (result.state) {
      state.data = result.state;
    } else {
      const data = await api("/api/state");
      if (!isCurrentRepoPath(repoPath)) return;
      state.data = data;
    }
    state.selectedRef = state.data.repo.branch && state.data.repo.branch !== "detached HEAD" ? state.data.repo.branch : "";
    state.selectedStash = state.data.stashes?.[0]?.ref || "";
    state.selectedTab = "stashes";
    state.selectedSha = state.data.commits[0]?.sha || "";
    renderAll();
    if (state.selectedSha) {
      await loadCommit(state.selectedSha);
      renderInspector();
    }
  } catch (error) {
    if (!isCurrentRepoPath(repoPath)) return;
    toast(error.message);
  } finally {
    if (button) button.disabled = false;
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
