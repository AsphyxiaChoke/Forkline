// Commit actions, history rewrite, remote commit links, patches, and tags.
function currentCompareBaseRef() {
  const branch = state.data?.repo?.branch || "HEAD";
  return branch && branch !== "detached HEAD" ? branch : "HEAD";
}

async function openCompareBranch(head, base = currentCompareBaseRef()) {
  if (!head) return;
  const repoPath = repoPathSnapshot();
  const requestId = ++state.compareRequestId;
  state.compare = { base, head, data: null, loading: true, error: "" };
  state.selectedCompareFile = "";
  state.selectedTab = "compare";
  renderInspector();
  try {
    const data = await api(`/api/compare?base=${encodeURIComponent(base)}&head=${encodeURIComponent(head)}`);
    if (requestId !== state.compareRequestId || !isCurrentRepoPath(repoPath)) return;
    state.compare = { base: data.base || base, head: data.head || head, data, loading: false, error: "" };
    state.selectedCompareFile = data.files?.[0]?.file || "";
    renderInspector();
  } catch (error) {
    if (requestId !== state.compareRequestId || !isCurrentRepoPath(repoPath)) return;
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
    toast(t("请选择要比较的目标引用"));
    return;
  }
  await openCompareBranch(head, base);
}

async function runCommitContextAction(action) {
  const commit = commitRecordForSha(state.contextCommitSha) || commitRecordForSha(state.selectedSha);
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
    toast(t("已复制提交 SHA"));
    return;
  }
  if (action === "copyMessage") {
    await copyText(commit.message);
    toast(t("已复制提交信息"));
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
  const commit = commitRecordForSha(sha) || commitRecordForSha(state.selectedSha);
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

function renderHistoryRewritePlan(commit) {
  const plan = state.historyPlan;
  if (!plan || plan.sha !== commit.sha) return "";
  const config = historyRewriteConfig(plan.mode) || { title: t("编辑历史"), command: "git rebase -i" };
  if (plan.loading) {
    return tt`
      <section class="history-plan loading">
        <div class="history-plan-head">
          <strong>${escapeHtml(t("{title}计划", { title: config.title }))}</strong>
          <span>${escapeHtml(config.command)}</span>
        </div>
        <div class="history-plan-empty">正在预检历史编辑范围...</div>
      </section>
    `;
  }
  if (plan.error && !plan.preview) {
    return tt`
      <section class="history-plan blocked">
        <div class="history-plan-head">
          <strong>${escapeHtml(t("{title}计划", { title: config.title }))}</strong>
          <span>${escapeHtml(config.command)}</span>
        </div>
        <div class="history-plan-alert">${escapeHtml(t(plan.error))}</div>
        <div class="history-plan-actions">
          <button class="mini-btn" data-history-plan-action="refresh" type="button">重新预检</button>
          <button class="mini-btn" data-history-plan-action="cancel" type="button">取消</button>
        </div>
      </section>
    `;
  }
  const preview = plan.preview || {};
  const blockers = preview.blockers || [];
  const warnings = preview.warnings || [];
  const affected = preview.affectedPreview || [];
  return tt`
    <section class="history-plan ${preview.canRun ? "" : "blocked"}">
      <div class="history-plan-head">
        <strong>${escapeHtml(t("{title}计划", { title: t(preview.title || config.title) }))}</strong>
        <span>${escapeHtml(preview.command || config.command)}</span>
      </div>
      <p class="history-plan-effect">${escapeHtml(t(preview.effect || config.effect || ""))}</p>
      <div class="history-plan-grid">
        <span>当前分支</span><strong>${escapeHtml(preview.branch || state.data?.repo?.branch || t("未知"))}</strong>
        <span>目标提交</span><strong>${escapeHtml(preview.target?.short || commit.short)} · ${escapeHtml(preview.target?.message || commit.message)}</strong>
        <span>父提交</span><strong>${preview.parent ? `${escapeHtml(preview.parent.short)} · ${escapeHtml(preview.parent.message)}` : t("无父提交")}</strong>
        <span>重放范围</span><strong>${escapeHtml(preview.rebaseStart || t("待计算"))}</strong>
        <span>影响提交</span><strong>${t("{count} 个", { count: escapeHtml(String(preview.affectedCount ?? affected.length)) })}</strong>
      </div>
      ${
        blockers.length
          ? `<div class="history-plan-alert">${blockers.map((item) => `<span>${escapeHtml(t(item))}</span>`).join("")}</div>`
          : `<div class="history-plan-ok">${t("预检通过，可以执行。执行前会创建恢复点。")}</div>`
      }
      ${
        warnings.length
          ? `<div class="history-plan-warnings">${warnings.map((item) => `<span>${escapeHtml(t(item))}</span>`).join("")}</div>`
          : ""
      }
      <div class="history-plan-list">
        ${affected.length ? affected.map((item) => renderHistoryPlanCommit(item, preview.target?.sha)).join("") : `<div class="history-plan-empty">${t("没有可显示的影响提交")}</div>`}
      </div>
      <div class="history-plan-actions">
        <button class="mini-btn" data-history-plan-action="refresh" type="button">重新预检</button>
        <button class="mini-btn" data-history-plan-action="cancel" type="button">取消</button>
        <button class="mini-btn ${plan.mode === "drop" ? "danger" : ""}" data-history-plan-action="execute" type="button" ${preview.canRun ? "" : "disabled"}>
          <span>确认执行</span><span class="command-hint">${escapeHtml(preview.command || config.command)}</span>
        </button>
      </div>
    </section>
  `;
}

function renderHistoryPlanCommit(commit, targetSha) {
  const isTarget = commit.sha === targetSha;
  return `
    <div class="history-plan-commit ${isTarget ? "target" : ""}">
      <span>${t(isTarget ? "目标" : "重放")}</span>
      <strong>${escapeHtml(commit.short)} · ${escapeHtml(commit.message)}</strong>
      <em>${escapeHtml(commit.author || "")} ${escapeHtml(commit.time || "")}</em>
    </div>
  `;
}

function renderHistoryRewriteQueue() {
  const queue = state.historyQueue;
  const items = queue.items || [];
  if (!items.length) {
    return `<div class="history-plan-empty history-queue-empty">${t("队列为空。可以把多个提交加入队列后一次预检和执行。")}</div>`;
  }
  const preview = queue.preview || {};
  const blockers = preview.blockers || [];
  const warnings = preview.warnings || [];
  const affected = preview.affectedPreview || [];
  const actionDetails = new Map((preview.actions || []).map((item) => [item.target?.sha, item]));
  return tt`
    <section class="history-plan history-queue ${preview.canRun ? "" : "blocked"}">
      <div class="history-plan-head">
        <strong>历史编辑队列</strong>
        <span>git rebase -i / queue</span>
      </div>
      <p class="history-plan-effect">把多个 squash / fixup / drop / reword 动作排队，预检通过后一次重写当前分支历史。</p>
      <div class="history-plan-grid">
        <span>当前分支</span><strong>${escapeHtml(preview.branch || state.data?.repo?.branch || t("未知"))}</strong>
        <span>队列动作</span><strong>${t("{count} 项", { count: escapeHtml(String(preview.queueCount ?? items.length)) })}</strong>
        <span>重放范围</span><strong>${escapeHtml(preview.rebaseStart || t(queue.loading ? "正在计算" : "待预检"))}</strong>
        <span>影响提交</span><strong>${t("{count} 个", { count: escapeHtml(String(preview.affectedCount ?? affected.length)) })}</strong>
      </div>
      <div class="history-plan-list history-queue-list">
        ${items.map((item, index) => renderHistoryQueueItem(item, index, actionDetails.get(item.sha))).join("")}
      </div>
      ${queue.loading ? `<div class="history-plan-empty">${t("正在预检历史编辑队列...")}</div>` : ""}
      ${queue.error ? `<div class="history-plan-alert"><span>${escapeHtml(t(queue.error))}</span></div>` : ""}
      ${
        blockers.length
          ? `<div class="history-plan-alert">${blockers.map((item) => `<span>${escapeHtml(t(item))}</span>`).join("")}</div>`
          : !queue.loading && preview.canRun
            ? `<div class="history-plan-ok">${t("预检通过，可以执行队列。执行前会创建恢复点。")}</div>`
            : ""
      }
      ${
        warnings.length
          ? `<div class="history-plan-warnings">${warnings.map((item) => `<span>${escapeHtml(t(item))}</span>`).join("")}</div>`
          : ""
      }
      ${
        affected.length
          ? `<div class="history-queue-preview-title"><strong>${t("实际执行顺序")}</strong><span>${t("按当前分支历史生成")}</span></div><div class="history-plan-list">${affected.map(renderHistoryQueueAffectedCommit).join("")}</div>`
          : ""
      }
      <div class="history-plan-actions">
        <button class="mini-btn" data-history-queue-action="refresh" type="button">重新预检</button>
        <button class="mini-btn" data-history-queue-action="clear" type="button">清空队列</button>
        <button class="mini-btn danger" data-history-queue-action="execute" type="button" ${preview.canRun && !queue.loading ? "" : "disabled"}>
          <span>执行队列</span><span class="command-hint">git rebase -i</span>
        </button>
      </div>
    </section>
  `;
}

function renderHistoryQueueItem(item, index, detail) {
  const config = historyRewriteConfig(item.mode) || { title: t("编辑历史"), command: "git rebase -i" };
  const target = detail?.target || item;
  const commandText = item.mode === "reword" && item.summary ? `${config.command} -> ${item.summary}` : config.command;
  const modeOptions = ["squash", "fixup", "reword", "drop"]
    .map((mode) => {
      const modeConfig = historyRewriteConfig(mode);
      return `<option value="${escapeAttr(mode)}" ${mode === item.mode ? "selected" : ""}>${escapeHtml(modeConfig.title)}</option>`;
    })
    .join("");
  const rewordItem = historyQueueItemWithMode(item, "reword");
  const rewordFields = item.mode === "reword"
    ? tt`
      <div class="history-queue-reword">
        <label>
          <span>新摘要</span>
          <input data-history-queue-field data-sha="${escapeAttr(item.sha)}" data-field="summary" value="${escapeAttr(rewordItem.summary || "")}" autocomplete="off" />
        </label>
        <label>
          <span>新正文</span>
          <textarea data-history-queue-field data-sha="${escapeAttr(item.sha)}" data-field="body">${escapeHtml(rewordItem.body || "")}</textarea>
        </label>
      </div>
    `
    : "";
  return tt`
    <div class="history-plan-commit history-queue-item ${item.mode === "drop" ? "danger" : ""}">
      <div class="history-queue-mode-cell">
        <span>${t("第 {index} 项", { index: index + 1 })}</span>
        <select data-history-queue-action="changeMode" data-sha="${escapeAttr(item.sha)}" title="${t("修改此队列项动作")}">
          ${modeOptions}
        </select>
      </div>
      <div class="history-queue-copy">
        <strong>${escapeHtml(target.short || item.short || item.sha.slice(0, 7))} · ${escapeHtml(target.message || item.message || "")}</strong>
        <em>${escapeHtml(commandText)}</em>
      </div>
      ${rewordFields}
      <div class="history-queue-buttons">
        <button class="mini-btn" data-history-queue-action="moveUp" data-sha="${escapeAttr(item.sha)}" type="button" ${index === 0 ? "disabled" : ""} title="${t("上移队列显示顺序")}">${t("上移")}</button>
        <button class="mini-btn" data-history-queue-action="moveDown" data-sha="${escapeAttr(item.sha)}" type="button" ${index >= state.historyQueue.items.length - 1 ? "disabled" : ""} title="${t("下移队列显示顺序")}">${t("下移")}</button>
        <button class="mini-btn" data-history-queue-action="remove" data-sha="${escapeAttr(item.sha)}" type="button" title="${t("从历史编辑队列移除第 {index} 项", { index: index + 1 })}">${t("移除")}</button>
      </div>
    </div>
  `;
}

function renderHistoryQueueAffectedCommit(commit) {
  const action = commit.queueAction || "pick";
  const isChanged = action !== "pick";
  const command = commit.queueSummary ? `${commit.queueCommand || "pick"} -> ${commit.queueSummary}` : commit.queueCommand || "pick";
  return `
    <div class="history-plan-commit ${isChanged ? "target" : ""} ${action === "drop" ? "danger" : ""}">
      <span>${escapeHtml(t(commit.queueActionLabel || (isChanged ? action : "保留")))}</span>
      <strong>${escapeHtml(commit.short)} · ${escapeHtml(commit.message)}</strong>
      <em>${escapeHtml(command)} · ${escapeHtml(commit.author || "")} ${escapeHtml(commit.time || "")}</em>
    </div>
  `;
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
    toast(t("merge 提交暂不支持加入历史编辑队列。"));
    return;
  }
  if (config.needsParent && !(commit.parents || []).length) {
    toast(t("根提交没有父提交，不能压缩或修补。"));
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
    toast(t("历史编辑队列一次最多 12 条动作。"));
    return;
  }
  state.selectedTab = "details";
  state.selectedSha = commit.sha;
  state.historyPlan = null;
  state.historyQueue = { items, loading: true, preview: state.historyQueue.preview, error: "" };
  renderCommits();
  await loadCommit(commit.sha);
  renderInspector();
  toast(existing
    ? t("已更新队列：{sha} -> {action}", { sha: commit.short, action: config.title })
    : t("已加入历史编辑队列：{sha} {action}", { sha: commit.short, action: config.title }));
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
  const repoPath = repoPathSnapshot();
  const signature = historyQueueSignature(items);
  state.historyQueue = { ...state.historyQueue, loading: true, error: "" };
  renderInspector();
  try {
    const preview = await api("/api/history-rewrite-queue-preview", {
      method: "POST",
      body: JSON.stringify({ items: historyQueuePayload(items) }),
    });
    if (signature !== historyQueueSignature() || !isCurrentRepoPath(repoPath)) return;
    state.historyQueue = { ...state.historyQueue, loading: false, preview, error: "" };
    renderInspector();
  } catch (error) {
    if (signature !== historyQueueSignature() || !isCurrentRepoPath(repoPath)) return;
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
    toast((preview?.blockers || [state.historyQueue.error || "历史编辑队列还不能执行"]).map((item) => t(item)).join("\n"));
    return;
  }
  const message = t(
    "确认执行历史编辑队列 {count} 项？\n\n分支：{branch}\n影响提交：{affected} 个\n命令：git rebase -i / queue\n\n这会重写队列影响范围内的历史 SHA。执行前会创建恢复点。",
    {
      count: state.historyQueue.items.length,
      branch: preview.branch || state.data?.repo?.branch || t("当前分支"),
      affected: preview.affectedCount || 0,
    }
  );
  if (!state.data.repo.isSample && !confirm(message)) return;
  if (button) button.disabled = true;
  const repoPath = repoPathSnapshot();
  try {
    const result = await api("/api/action", {
      method: "POST",
      body: JSON.stringify({
        action: "rewriteHistoryQueue",
        items: historyQueuePayload(),
        ...currentBranchSnapshotPayload(),
      }),
    });
    if (!isCurrentRepoPath(repoPath)) return;
    state.historyQueue = { items: [], loading: false, preview: null, error: "" };
    toast(result.output || t("历史编辑队列已执行"));
    await reloadAfterHistoryAction(repoPath);
    if (typeof offerRecoveryUndo === "function") offerRecoveryUndo(result);
  } catch (error) {
    if (!isCurrentRepoPath(repoPath)) return;
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
    toast(t("暂不支持对 merge 提交执行自动历史编辑。"));
    return;
  }
  if (config.needsParent && !(commit.parents || []).length) {
    toast(t("根提交没有父提交，不能压缩或修补。"));
    return;
  }
  state.selectedTab = "details";
  state.selectedSha = commit.sha;
  state.historyPlan = { sha: commit.sha, mode, loading: true, preview: null, error: "" };
  const repoPath = repoPathSnapshot();
  renderCommits();
  await loadCommit(commit.sha);
  if (!isCurrentRepoPath(repoPath)) return;
  renderInspector();
  try {
    const preview = await api(`/api/history-rewrite-preview?sha=${encodeURIComponent(commit.sha)}&mode=${encodeURIComponent(mode)}`);
    if (state.historyPlan?.sha !== commit.sha || state.historyPlan?.mode !== mode || !isCurrentRepoPath(repoPath)) return;
    state.historyPlan = { sha: commit.sha, mode, loading: false, preview, error: "" };
    renderInspector();
  } catch (error) {
    if (state.historyPlan?.sha !== commit.sha || state.historyPlan?.mode !== mode || !isCurrentRepoPath(repoPath)) return;
    state.historyPlan = { sha: commit.sha, mode, loading: false, preview: null, error: error.message };
    renderInspector();
  }
}

async function runHistoryRewritePlan(action, button) {
  const plan = state.historyPlan;
  if (!plan) return;
  const commit = commitRecordForSha(plan.sha) || commitRecordForSha(state.selectedSha);
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
    toast((preview?.blockers || ["当前计划还不能执行"]).map((item) => t(item)).join("\n"));
    return;
  }
  if (button) button.disabled = true;
  const repoPath = repoPathSnapshot();
  try {
    const result = await api("/api/action", {
      method: "POST",
      body: JSON.stringify({ action: "rewriteHistoryCommit", sha: plan.sha, mode: plan.mode, ...currentBranchSnapshotPayload() }),
    });
    if (!isCurrentRepoPath(repoPath)) return;
    state.historyPlan = null;
    state.historyQueue = { items: [], loading: false, preview: null, error: "" };
    toast(result.output || t("已{action} {sha}", { action: t(preview.title || "编辑历史"), sha: preview.target?.short || "" }));
    await reloadAfterHistoryAction(repoPath);
    if (typeof offerRecoveryUndo === "function") offerRecoveryUndo(result);
  } catch (error) {
    if (!isCurrentRepoPath(repoPath)) return;
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
    toast(t("暂不支持对 merge 提交执行自动历史编辑。"));
    return;
  }
  if (config.needsParent && !(commit.parents || []).length) {
    toast(t("根提交没有父提交，不能压缩或修补。"));
    return;
  }
  const dirtyCount = (state.data.workingFiles || []).length;
  const dirtyNote = dirtyCount ? t("\n\n当前还有 {count} 个未提交改动，Git 会阻止历史编辑。请先提交或储藏。", { count: dirtyCount }) : "";
  const warning = mode === "drop" ? t("\n\n危险：如果后续提交依赖此提交，可能会产生冲突。") : "";
  const current = state.data.repo.branch || t("当前分支");
  const message = t("确认{action} {sha}？\n\n命令：{command}\n分支：{branch}\n效果：{effect}\n这会重写此提交之后的历史 SHA。{warning}{dirtyNote}\n\n提交信息：{message}", {
    action: config.title,
    sha: commit.short,
    command: config.command,
    branch: current,
    effect: config.effect,
    warning,
    dirtyNote,
    message: commit.message,
  });
  if (!state.data.repo.isSample && !confirm(message)) return;
  const repoPath = repoPathSnapshot();
  try {
    const result = await api("/api/action", {
      method: "POST",
      body: JSON.stringify({ action: "rewriteHistoryCommit", sha: commit.sha, mode, ...currentBranchSnapshotPayload() }),
    });
    if (!isCurrentRepoPath(repoPath)) return;
    toast(result.output || t("已{action} {sha}", { action: config.title, sha: commit.short }));
    await reloadAfterHistoryAction(repoPath);
    if (typeof offerRecoveryUndo === "function") offerRecoveryUndo(result);
  } catch (error) {
    if (!isCurrentRepoPath(repoPath)) return;
    toast(error.message);
    await refreshWorktree(false);
  }
}

async function cherryPickCommit(commit, mainline = null) {
  if (!state.data || !commit) return;
  const mainlineText = mainline ? t("\n主线：父提交 {mainline}", { mainline }) : "";
  if (!state.data.repo.isSample && !confirm(t("确认挑选提交 {sha} 到当前分支？\n\n这会在当前分支创建一个内容相同的新提交，不会移动原分支。{mainline}\n提交信息：{message}", {
    sha: commit.short,
    mainline: mainlineText,
    message: commit.message,
  }))) return;
  const repoPath = repoPathSnapshot();
  try {
    const result = await api("/api/action", {
      method: "POST",
      body: JSON.stringify({ action: "cherryPickCommit", sha: commit.sha, mainline, ...currentBranchSnapshotPayload() }),
    });
    if (!isCurrentRepoPath(repoPath)) return;
    toast(result.output || t("已挑选提交 {sha}", { sha: commit.short }));
    await reloadAfterHistoryAction(repoPath);
  } catch (error) {
    if (!isCurrentRepoPath(repoPath)) return;
    toast(error.message);
    await refreshWorktree(false);
  }
}

async function revertCommit(commit, mainline = null) {
  if (!state.data || !commit) return;
  const mainlineText = mainline ? t("\n主线：父提交 {mainline}", { mainline }) : "";
  if (!state.data.repo.isSample && !confirm(t("确认还原提交 {sha}？\n\n这会创建一个新的反向提交，不会删除历史提交。{mainline}\n提交信息：{message}", {
    sha: commit.short,
    mainline: mainlineText,
    message: commit.message,
  }))) return;
  const repoPath = repoPathSnapshot();
  try {
    const result = await api("/api/action", {
      method: "POST",
      body: JSON.stringify({ action: "revertCommit", sha: commit.sha, mainline, ...currentBranchSnapshotPayload() }),
    });
    if (!isCurrentRepoPath(repoPath)) return;
    toast(result.output || t("已还原提交 {sha}", { sha: commit.short }));
    await reloadAfterHistoryAction(repoPath);
  } catch (error) {
    if (!isCurrentRepoPath(repoPath)) return;
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
  const actionText = t(action === "cherryPick" ? "挑选" : "还原");
  const command = action === "cherryPick" ? "git cherry-pick -m" : "git revert -m";
  els.mainlineModalTitle.textContent = t("{action} merge 提交", { action: actionText });
  els.mainlineStartText.textContent = t("提交 {sha} 有 {count} 个父提交。选择主线后会执行 {command}。", { sha: commit.short, count: parents.length, command });
  els.mainlineSubmit.textContent = t("继续{action}", { action: actionText });
  els.mainlineOptions.innerHTML = parents
    .map((parentSha, index) => {
      const mainline = index + 1;
      const checked = index === 0 ? "checked" : "";
      const hint = t(index === 0 ? "通常是执行合并时所在的分支方向" : "通常是被合并进来的分支方向");
      return `
        <label class="mainline-option">
          <input type="radio" name="mainline" value="${mainline}" ${checked} />
          <span>
            <strong>${t("父提交 {mainline} · {sha}", { mainline, sha: escapeHtml(parentSha.slice(0, 7)) })}</strong>
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
  const commit = commitRecordForSha(state.mainlineCommitSha);
  const action = state.mainlineAction;
  const selected = Number.parseInt(els.mainlineOptions.querySelector("input[name='mainline']:checked")?.value || "", 10);
  if (!commit || !Number.isInteger(selected)) {
    toast(t("请选择主线"));
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
  const modeText = t({ soft: "软重置（soft）", mixed: "混合重置（mixed）", hard: "硬重置（hard）" }[mode] || "混合重置（mixed）");
  const effects = {
    soft: t("当前分支会移动到此提交；后续提交的改动会保留在已暂存区。"),
    mixed: t("当前分支会移动到此提交；后续提交的改动会保留在工作区，且不会暂存。"),
    hard: t("当前分支会移动到此提交；后续提交和当前工作区改动都会被丢弃，无法从工作区恢复。"),
  };
  const warning = mode === "hard" ? t("\n\n危险：Hard Reset 会丢弃未提交改动，请确认你真的不需要它们。") : "";
  if (!state.data.repo.isSample && !confirm(t("确认执行{mode}到提交 {sha}？\n\n{effect}{warning}\n\n提交信息：{message}", {
    mode: modeText,
    sha: commit.short,
    effect: effects[mode],
    warning,
    message: commit.message,
  }))) return;
  const repoPath = repoPathSnapshot();
  try {
    const result = await api("/api/action", {
      method: "POST",
      body: JSON.stringify({ action: "resetToCommit", sha: commit.sha, mode, ...currentBranchSnapshotPayload() }),
    });
    if (!isCurrentRepoPath(repoPath)) return;
    toast(result.output || t("已{mode}到 {sha}", { mode: modeText, sha: commit.short }));
    await reloadAfterHistoryAction(repoPath);
    if (typeof offerRecoveryUndo === "function") offerRecoveryUndo(result);
  } catch (error) {
    if (!isCurrentRepoPath(repoPath)) return;
    toast(error.message);
  }
}

async function reloadAfterHistoryAction(repoPath = repoPathSnapshot()) {
  state.commitDetails.clear();
  const data = await api(`/api/state?ref=${encodeURIComponent(state.selectedRef)}`);
  if (!isCurrentRepoPath(repoPath)) return;
  state.data = data;
  state.selectedRef = state.data.repo.selectedRef || state.selectedRef;
  state.selectedSha = state.data.commits[0]?.sha || "";
  state.selectedFile = "";
  state.selectedCommitFile = "";
  renderAll();
  if (state.selectedSha) {
    await loadCommit(state.selectedSha);
    if (!isCurrentRepoPath(repoPath)) return;
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
    toast(t("当前仓库没有可识别的网页远端 URL"));
    return;
  }
  const opened = window.open(url, "_blank");
  if (!opened) {
    toast(t("浏览器拦截了新窗口，可以复制地址手动打开：\n{url}", { url }));
    return;
  }
  opened.opener = null;
  toast(t("已打开远端提交页面"));
}

async function fetchCommitPatch(commit) {
  if (!commit?.sha) throw new Error(t("没有选中的提交"));
  return api(`/api/patch?sha=${encodeURIComponent(commit.sha)}`);
}

async function copyCommitPatch(commit) {
  const repoPath = repoPathSnapshot();
  const result = await fetchCommitPatch(commit);
  if (!isCurrentRepoPath(repoPath)) return;
  await copyText(result.patch || "");
  toast(t("已复制补丁：{file}", { file: result.fileName || result.short || commit.short }));
}

async function downloadCommitPatch(commit) {
  const repoPath = repoPathSnapshot();
  const result = await fetchCommitPatch(commit);
  if (!isCurrentRepoPath(repoPath)) return;
  downloadTextFile(result.fileName || `${commit.short || "commit"}.patch`, result.patch || "", "text/x-patch;charset=utf-8");
  toast(t("已下载补丁：{file}", { file: result.fileName || commit.short }));
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
    toast(t(pullRequest.reason || "当前分支暂时不能生成 PR 链接"));
    return;
  }
  if (action === "copy") {
    await copyText(pullRequest.url);
    toast(t("已复制 PR 链接"));
    return;
  }
  const opened = window.open(pullRequest.url, "_blank");
  if (!opened) {
    toast(t("浏览器拦截了新窗口，可以复制地址手动打开：\n{url}", { url: pullRequest.url }));
    return;
  }
  opened.opener = null;
  toast(t(pullRequest.platform === "gitlab" ? "已打开 Merge Request 页面" : "已打开 Pull Request 页面"));
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
  els.tagStartText.textContent = t("基于提交 {sha} 创建 Tag。", { sha: commit.short });
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
    toast(t("请输入标签名"));
    els.tagNameInput.focus();
    return;
  }
  const target = state.tagTargetSha || state.selectedSha;
  if (!target) {
    toast(t("没有选中的提交"));
    return;
  }
  const repoPath = repoPathSnapshot();
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
    if (!isCurrentRepoPath(repoPath)) return;
    toast(result.output || t("已创建 Tag {name}", { name }));
    const data = await loadStateForRepoPath(repoPath);
    if (!data) return;
    closeTagModal();
    state.selectedTag = result.tag || name;
    state.commitDetails.clear();
    state.data = data;
    state.selectedRef = state.data.repo.selectedRef || state.selectedRef;
    renderAll();
    await renderSelectedCommitForRepoPath(repoPath);
  } catch (error) {
    if (!isCurrentRepoPath(repoPath)) return;
    toast(error.message);
  } finally {
    els.tagSubmit.disabled = false;
  }
}

globalThis.ForklineCommitActions = {
  openCompareBranch,
  refreshCompare,
  runCommitContextAction,
  runCommitToolAction,
  updateHistoryQueueField,
  runHistoryRewriteQueue,
  runHistoryRewritePlan,
  reloadAfterHistoryAction,
  openRemoteCommit,
  copyCommitPatch,
  downloadCommitPatch,
  runSyncPullRequestAction,
  openTagModal,
  createTagFromForm,
  submitMainlineForm,
  renderHistoryRewritePlan,
  renderHistoryRewriteQueue,
};

