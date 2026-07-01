// Inspector shell, commit details, files, file history, and blame panels.
function renderInspector() {
  renderInspectorTabs();
  if (state.selectedTab === "stashes") {
    renderStashesTab();
    return;
  }
  if (state.selectedTab === "tags") {
    renderTagsTab();
    return;
  }
  if (state.selectedTab === "recovery") {
    renderRecoveryTab();
    return;
  }
  if (state.selectedTab === "logs") {
    renderLogsTab();
    return;
  }
  if (state.selectedTab === "settings") {
    renderSettingsTab();
    return;
  }
  if (state.selectedTab === "sync") {
    renderSyncTab();
    return;
  }
  if (state.selectedTab === "compare") {
    renderCompareTab();
    return;
  }
  if (state.selectedTab === "fileHistory") {
    renderFileHistoryTab();
    return;
  }
  if (state.selectedTab === "fileBlame") {
    renderFileBlameTab();
    return;
  }
  if (state.selectedTab === "branches") {
    const branchCommit = state.data?.commits.find((item) => item.sha === state.selectedSha) || state.data?.commits?.[0] || null;
    renderBranchesTab(branchCommit);
    return;
  }
  if (state.selectedTab === "worktrees") {
    renderWorktreesTab();
    return;
  }
  if (state.selectedTab === "submodules") {
    renderSubmodulesTab();
    return;
  }
  const commit = commitRecordForSha(state.selectedSha);
  if (!commit) {
    els.detailTitle.textContent = "没有提交";
    els.detailSub.textContent = "当前列表为空";
    els.detailBody.innerHTML = "";
    return;
  }
  const detail = state.commitDetails.get(commit.sha) || { files: commit.files || [], diff: commit.diff || [] };
  els.detailNode.style.borderColor = commit.color;
  els.detailTitle.textContent = commit.message;
  els.detailSub.textContent = `${commit.short} · ${commit.author} · ${commit.time}`;
  if (state.selectedTab === "files") renderFilesTab(commit, detail);
  else renderDetailsTab(commit, detail);
}

function commitRecordForSha(sha) {
  if (!sha) return null;
  const graphCommit = state.data?.commits.find((item) => item.sha === sha);
  if (graphCommit) return graphCommit;
  const loadedDetail = state.commitDetails.get(sha) || {};
  const historyCommit = state.fileHistory?.data?.commits?.find((item) => item.sha === sha);
  if (historyCommit) {
    return {
      ...historyCommit,
      ...loadedDetail,
      sha: historyCommit.sha,
      short: historyCommit.short || loadedDetail.short || String(historyCommit.sha || "").slice(0, 7),
      author: loadedDetail.author || historyCommit.author,
      time: loadedDetail.time || historyCommit.time,
      message: historyCommit.message || loadedDetail.summary || loadedDetail.message,
      parents: loadedDetail.parents || historyCommit.parents || [],
      refs: historyCommit.refs || "文件历史",
      color: historyCommit.color || "#23c7b7",
    };
  }
  const blameLine = state.fileBlame?.data?.lines?.find((item) => item.sha === sha);
  if (!blameLine) return null;
  return {
    ...loadedDetail,
    sha: blameLine.sha,
    short: blameLine.short || loadedDetail.short || String(blameLine.sha || "").slice(0, 7),
    author: loadedDetail.author || blameLine.author || "unknown",
    time: loadedDetail.time || blameLine.time || "",
    message: blameLine.summary || loadedDetail.summary || loadedDetail.message || "(无提交信息)",
    refs: "逐行追踪",
    parents: loadedDetail.parents || [],
    files: [],
    diff: [],
    color: "#5ca9ff",
  };
}

function isGraphCommitLoaded(sha) {
  return Boolean(sha && state.data?.commits?.some((item) => item.sha === sha));
}

function renderDetailsTab(commit, detail) {
  const message = commitMessageParts(commit, detail);
  const isMergeCommit = (commit.parents || []).length > 1;
  const canFold = !isMergeCommit && (commit.parents || []).length === 1;
  const canDrop = !isMergeCommit;
  const remoteUrl = commitRemoteUrl(commit.sha);
  els.detailBody.innerHTML = `
    <div class="meta-grid">
      <span>提交</span><div class="meta-value">${escapeHtml(commit.short)}</div>
      <span>作者</span><div class="meta-value">${escapeHtml(commit.author)}</div>
      <span>父提交</span><div class="meta-value">${escapeHtml(commit.parents?.length ? commit.parents.map((p) => p.slice(0, 7)).join(", ") : "根提交")}</div>
      <span>引用</span><div class="meta-value">${escapeHtml(commit.refs || "无")}</div>
    </div>
    <div class="detail-section-title">提交信息</div>
    <form class="reword-form" data-reword-form data-sha="${escapeAttr(commit.sha)}">
      <label class="edit-field">
        <span>摘要</span>
        <input name="summary" autocomplete="off" value="${escapeAttr(message.summary)}" ${isMergeCommit ? "disabled" : ""} />
      </label>
      <label class="edit-field">
        <span>正文</span>
        <textarea name="body" ${isMergeCommit ? "disabled" : ""}>${escapeHtml(message.body)}</textarea>
      </label>
      <div class="reword-actions">
        <span class="rewrite-note">${isMergeCommit ? "merge 提交暂不支持自动修改" : "保存会重写此提交之后的历史 SHA"}</span>
        <button class="mini-btn" type="submit" ${isMergeCommit ? "disabled" : ""}>保存信息</button>
      </div>
    </form>
    <div class="detail-section-title">提交操作</div>
    <div class="commit-tools">
      <button class="mini-btn" data-commit-tool="branch" data-sha="${escapeAttr(commit.sha)}" type="button" title="git branch：从此提交创建本地分支"><span>新建分支</span><span class="command-hint">git branch</span></button>
      <button class="mini-btn" data-commit-tool="openRemote" data-sha="${escapeAttr(commit.sha)}" type="button" ${remoteUrl ? "" : "disabled"} title="${remoteUrl ? `打开远端提交：${escapeAttr(remoteUrl)}` : "当前仓库没有可识别的网页远端 URL"}"><span>远端查看</span><span class="command-hint">web</span></button>
      <button class="mini-btn" data-commit-tool="copyPatch" data-sha="${escapeAttr(commit.sha)}" type="button" title="git format-patch -1：复制此提交补丁"><span>复制补丁</span><span class="command-hint">format-patch</span></button>
      <button class="mini-btn" data-commit-tool="downloadPatch" data-sha="${escapeAttr(commit.sha)}" type="button" title="下载此提交的 .patch 文件"><span>下载补丁</span><span class="command-hint">.patch</span></button>
      <button class="mini-btn" data-commit-tool="cherryPick" data-sha="${escapeAttr(commit.sha)}" type="button" title="${isMergeCommit ? "git cherry-pick -m：挑选 merge 提交前选择主线" : "git cherry-pick：把此提交复制到当前分支"}"><span>挑选</span><span class="command-hint">${isMergeCommit ? "git cherry-pick -m" : "git cherry-pick"}</span></button>
      <button class="mini-btn" data-commit-tool="revert" data-sha="${escapeAttr(commit.sha)}" type="button" title="${isMergeCommit ? "git revert -m：还原 merge 提交前选择主线" : "git revert：创建一个反向提交来抵消此提交"}"><span>还原</span><span class="command-hint">${isMergeCommit ? "git revert -m" : "git revert"}</span></button>
      <button class="mini-btn" data-commit-tool="resetSoft" data-sha="${escapeAttr(commit.sha)}" type="button" title="git reset --soft：移动当前分支，改动保留在已暂存区"><span>软重置</span><span class="command-hint">git reset --soft</span></button>
      <button class="mini-btn" data-commit-tool="resetMixed" data-sha="${escapeAttr(commit.sha)}" type="button" title="git reset --mixed：移动当前分支，改动保留在工作区"><span>混合重置</span><span class="command-hint">git reset --mixed</span></button>
      <button class="mini-btn danger" data-commit-tool="resetHard" data-sha="${escapeAttr(commit.sha)}" type="button" title="git reset --hard：移动当前分支，并丢弃工作区改动"><span>硬重置</span><span class="command-hint">git reset --hard</span></button>
    </div>
    <div class="detail-section-title">历史编辑</div>
    <div class="commit-tools">
      <button class="mini-btn" data-commit-tool="squash" data-sha="${escapeAttr(commit.sha)}" type="button" ${canFold ? "" : "disabled"} title="${isMergeCommit ? "merge 提交暂不支持自动压缩" : canFold ? "git rebase -i squash：把此提交和信息压缩进父提交" : "根提交没有父提交，不能压缩"}"><span>压缩进父提交</span><span class="command-hint">git rebase -i squash</span></button>
      <button class="mini-btn" data-commit-tool="fixup" data-sha="${escapeAttr(commit.sha)}" type="button" ${canFold ? "" : "disabled"} title="${isMergeCommit ? "merge 提交暂不支持自动修补" : canFold ? "git rebase -i fixup：把此提交改动修补进父提交，并丢弃此提交信息" : "根提交没有父提交，不能修补"}"><span>修补进父提交</span><span class="command-hint">git rebase -i fixup</span></button>
      <button class="mini-btn danger" data-commit-tool="drop" data-sha="${escapeAttr(commit.sha)}" type="button" ${canDrop ? "" : "disabled"} title="${isMergeCommit ? "merge 提交暂不支持自动丢弃" : "git rebase -i drop：从当前分支历史中删除此提交"}"><span>丢弃此提交</span><span class="command-hint">git rebase -i drop</span></button>
    </div>
    ${renderHistoryRewritePlan(commit)}
    <div class="detail-section-title">历史编辑队列</div>
    <div class="commit-tools">
      <button class="mini-btn" data-commit-tool="queueSquash" data-sha="${escapeAttr(commit.sha)}" type="button" ${canFold ? "" : "disabled"} title="${canFold ? "加入历史编辑队列，执行时压缩进前一条提交" : "此提交不能加入压缩队列"}"><span>加入队列：压缩</span><span class="command-hint">queue squash</span></button>
      <button class="mini-btn" data-commit-tool="queueFixup" data-sha="${escapeAttr(commit.sha)}" type="button" ${canFold ? "" : "disabled"} title="${canFold ? "加入历史编辑队列，执行时修补进前一条提交" : "此提交不能加入修补队列"}"><span>加入队列：修补</span><span class="command-hint">queue fixup</span></button>
      <button class="mini-btn" data-commit-tool="queueReword" data-sha="${escapeAttr(commit.sha)}" type="button" ${canDrop ? "" : "disabled"} title="${canDrop ? "加入历史编辑队列，执行时修改提交信息" : "此提交不能加入改信息队列"}"><span>加入队列：改信息</span><span class="command-hint">queue reword</span></button>
      <button class="mini-btn danger" data-commit-tool="queueDrop" data-sha="${escapeAttr(commit.sha)}" type="button" ${canDrop ? "" : "disabled"} title="${canDrop ? "加入历史编辑队列，执行时丢弃此提交" : "此提交不能加入丢弃队列"}"><span>加入队列：丢弃</span><span class="command-hint">queue drop</span></button>
    </div>
    ${renderHistoryRewriteQueue()}
    <div class="detail-section-title">DIFF 预览</div>
    ${renderDiff(detail.diff)}
  `;
}

function renderHistoryRewritePlan(commit) {
  const plan = state.historyPlan;
  if (!plan || plan.sha !== commit.sha) return "";
  const config = historyRewriteConfig(plan.mode) || { title: "编辑历史", command: "git rebase -i" };
  if (plan.loading) {
    return `
      <section class="history-plan loading">
        <div class="history-plan-head">
          <strong>${escapeHtml(config.title)}计划</strong>
          <span>${escapeHtml(config.command)}</span>
        </div>
        <div class="history-plan-empty">正在预检历史编辑范围...</div>
      </section>
    `;
  }
  if (plan.error && !plan.preview) {
    return `
      <section class="history-plan blocked">
        <div class="history-plan-head">
          <strong>${escapeHtml(config.title)}计划</strong>
          <span>${escapeHtml(config.command)}</span>
        </div>
        <div class="history-plan-alert">${escapeHtml(plan.error)}</div>
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
  return `
    <section class="history-plan ${preview.canRun ? "" : "blocked"}">
      <div class="history-plan-head">
        <strong>${escapeHtml(preview.title || config.title)}计划</strong>
        <span>${escapeHtml(preview.command || config.command)}</span>
      </div>
      <p class="history-plan-effect">${escapeHtml(preview.effect || config.effect || "")}</p>
      <div class="history-plan-grid">
        <span>当前分支</span><strong>${escapeHtml(preview.branch || state.data?.repo?.branch || "未知")}</strong>
        <span>目标提交</span><strong>${escapeHtml(preview.target?.short || commit.short)} · ${escapeHtml(preview.target?.message || commit.message)}</strong>
        <span>父提交</span><strong>${preview.parent ? `${escapeHtml(preview.parent.short)} · ${escapeHtml(preview.parent.message)}` : "无父提交"}</strong>
        <span>重放范围</span><strong>${escapeHtml(preview.rebaseStart || "待计算")}</strong>
        <span>影响提交</span><strong>${escapeHtml(String(preview.affectedCount ?? affected.length))} 个</strong>
      </div>
      ${
        blockers.length
          ? `<div class="history-plan-alert">${blockers.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>`
          : `<div class="history-plan-ok">预检通过，可以执行。执行前会创建恢复点。</div>`
      }
      ${
        warnings.length
          ? `<div class="history-plan-warnings">${warnings.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>`
          : ""
      }
      <div class="history-plan-list">
        ${affected.length ? affected.map((item) => renderHistoryPlanCommit(item, preview.target?.sha)).join("") : `<div class="history-plan-empty">没有可显示的影响提交</div>`}
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
      <span>${isTarget ? "目标" : "重放"}</span>
      <strong>${escapeHtml(commit.short)} · ${escapeHtml(commit.message)}</strong>
      <em>${escapeHtml(commit.author || "")} ${escapeHtml(commit.time || "")}</em>
    </div>
  `;
}

function renderHistoryRewriteQueue() {
  const queue = state.historyQueue;
  const items = queue.items || [];
  if (!items.length) {
    return `<div class="history-plan-empty history-queue-empty">队列为空。可以把多个提交加入队列后一次预检和执行。</div>`;
  }
  const preview = queue.preview || {};
  const blockers = preview.blockers || [];
  const warnings = preview.warnings || [];
  const affected = preview.affectedPreview || [];
  const actionDetails = new Map((preview.actions || []).map((item) => [item.target?.sha, item]));
  return `
    <section class="history-plan history-queue ${preview.canRun ? "" : "blocked"}">
      <div class="history-plan-head">
        <strong>历史编辑队列</strong>
        <span>git rebase -i / queue</span>
      </div>
      <p class="history-plan-effect">把多个 squash / fixup / drop / reword 动作排队，预检通过后一次重写当前分支历史。</p>
      <div class="history-plan-grid">
        <span>当前分支</span><strong>${escapeHtml(preview.branch || state.data?.repo?.branch || "未知")}</strong>
        <span>队列动作</span><strong>${escapeHtml(String(preview.queueCount ?? items.length))} 项</strong>
        <span>重放范围</span><strong>${escapeHtml(preview.rebaseStart || (queue.loading ? "正在计算" : "待预检"))}</strong>
        <span>影响提交</span><strong>${escapeHtml(String(preview.affectedCount ?? affected.length))} 个</strong>
      </div>
      <div class="history-plan-list history-queue-list">
        ${items.map((item, index) => renderHistoryQueueItem(item, index, actionDetails.get(item.sha))).join("")}
      </div>
      ${queue.loading ? `<div class="history-plan-empty">正在预检历史编辑队列...</div>` : ""}
      ${queue.error ? `<div class="history-plan-alert"><span>${escapeHtml(queue.error)}</span></div>` : ""}
      ${
        blockers.length
          ? `<div class="history-plan-alert">${blockers.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>`
          : !queue.loading && preview.canRun
            ? `<div class="history-plan-ok">预检通过，可以执行队列。执行前会创建恢复点。</div>`
            : ""
      }
      ${
        warnings.length
          ? `<div class="history-plan-warnings">${warnings.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>`
          : ""
      }
      ${
        affected.length
          ? `<div class="history-queue-preview-title"><strong>实际执行顺序</strong><span>按当前分支历史生成</span></div><div class="history-plan-list">${affected.map(renderHistoryQueueAffectedCommit).join("")}</div>`
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
  const config = historyRewriteConfig(item.mode) || { title: "编辑历史", command: "git rebase -i" };
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
    ? `
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
  return `
    <div class="history-plan-commit history-queue-item ${item.mode === "drop" ? "danger" : ""}">
      <div class="history-queue-mode-cell">
        <span>第 ${index + 1} 项</span>
        <select data-history-queue-action="changeMode" data-sha="${escapeAttr(item.sha)}" title="修改此队列项动作">
          ${modeOptions}
        </select>
      </div>
      <div class="history-queue-copy">
        <strong>${escapeHtml(target.short || item.short || item.sha.slice(0, 7))} · ${escapeHtml(target.message || item.message || "")}</strong>
        <em>${escapeHtml(commandText)}</em>
      </div>
      ${rewordFields}
      <div class="history-queue-buttons">
        <button class="mini-btn" data-history-queue-action="moveUp" data-sha="${escapeAttr(item.sha)}" type="button" ${index === 0 ? "disabled" : ""} title="上移队列显示顺序">上移</button>
        <button class="mini-btn" data-history-queue-action="moveDown" data-sha="${escapeAttr(item.sha)}" type="button" ${index >= state.historyQueue.items.length - 1 ? "disabled" : ""} title="下移队列显示顺序">下移</button>
        <button class="mini-btn" data-history-queue-action="remove" data-sha="${escapeAttr(item.sha)}" type="button" title="从历史编辑队列移除第 ${index + 1} 项">移除</button>
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
      <span>${escapeHtml(commit.queueActionLabel || (isChanged ? action : "保留"))}</span>
      <strong>${escapeHtml(commit.short)} · ${escapeHtml(commit.message)}</strong>
      <em>${escapeHtml(command)} · ${escapeHtml(commit.author || "")} ${escapeHtml(commit.time || "")}</em>
    </div>
  `;
}

function commitMessageParts(commit, detail) {
  const raw = String(detail.message || commit.message || "").replace(/\r\n/g, "\n").trimEnd();
  const lines = raw.split("\n");
  const summary = (lines.shift() || commit.message || "").trim();
  while (lines[0] === "") lines.shift();
  return { summary, body: lines.join("\n").trimEnd() };
}

function renderFilesTab(commit, detail) {
  const files = detail.files || [];
  if (files.length) {
    if (!files.some((file) => file.file === state.selectedCommitFile)) {
      state.selectedCommitFile = files[0].file;
    }
  } else {
    state.selectedCommitFile = "";
  }
  const selectedDiff = state.selectedCommitFile ? diffForFile(detail.diff || [], state.selectedCommitFile) : [];
  if (state.selectedCommitFile) renderHistoryDiffInWorkbench(commit, detail, state.selectedCommitFile);
  else renderWorkDiffEmpty("这个提交没有文件改动");
  els.detailBody.innerHTML = `
    <div class="detail-section-title">变更文件</div>
    <div class="commit-file-view">
      <div class="commit-file-tree">${files.length ? fileTreeHtml(files) : `<div class="file-row"><span></span><span class="file-name">没有文件列表</span><span></span></div>`}</div>
      <div class="commit-file-diff">
        <div class="panel-title compact">
          <div class="panel-title-text">
            <span>${escapeHtml(state.selectedCommitFile ? shortFileName(state.selectedCommitFile) : commit.short)}</span>
            <span class="panel-subtitle">${escapeHtml(state.selectedCommitFile || "未选择文件")}</span>
          </div>
          <button class="mini-btn" data-file-history-open data-file="${escapeAttr(state.selectedCommitFile || "")}" data-ref="${escapeAttr(commit.sha)}" type="button" ${state.selectedCommitFile ? "" : "disabled"}>文件历史</button>
          <button class="mini-btn" data-file-blame-open data-file="${escapeAttr(state.selectedCommitFile || "")}" data-ref="${escapeAttr(commit.sha)}" type="button" ${state.selectedCommitFile ? "" : "disabled"}>逐行追踪</button>
          <button class="mini-btn diff-max-btn" data-open-diff-modal type="button" ${selectedDiff.length ? "" : "disabled"}>最大化</button>
        </div>
        ${renderSideDiff(selectedDiff, "没有可显示的历史改动")}
      </div>
    </div>
  `;
  bindFileTree(els.detailBody, { mode: "commit" });
  markCommitFile();
}

function renderFileHistoryTab() {
  const history = state.fileHistory;
  els.detailNode.style.borderColor = "var(--teal)";
  els.detailTitle.textContent = "文件历史";
  els.detailSub.textContent = history.file || "从文件右键菜单或提交文件列表打开";
  if (!history.file) {
    els.detailBody.innerHTML = `
      <div class="empty-state">
        <strong>还没有选择文件</strong>
        <span>在工作区文件上右键选择“查看文件历史”，或在提交的文件面板里点击“文件历史”。</span>
      </div>
    `;
    return;
  }
  if (history.loading) {
    els.detailBody.innerHTML = `<div class="empty-state"><strong>正在读取文件历史</strong><span>${escapeHtml(history.file)}</span></div>`;
    return;
  }
  if (history.error) {
    els.detailBody.innerHTML = `<div class="empty-state danger"><strong>读取失败</strong><span>${escapeHtml(history.error)}</span></div>`;
    return;
  }
  const data = history.data || {};
  const commits = data.commits || [];
  els.detailBody.innerHTML = `
    <div class="file-history-head">
      <div>
        <div class="detail-section-title">文件历史</div>
        <strong>${escapeHtml(data.file || history.file)}</strong>
        <span>${escapeHtml(data.command || `git log --follow -- ${history.file}`)}</span>
      </div>
      <button class="mini-btn" data-file-history-refresh type="button">刷新</button>
    </div>
    ${
      commits.length
        ? `<div class="file-history-list">${commits.map(renderFileHistoryCommit).join("")}</div>`
        : `<div class="empty-state"><strong>没有找到历史记录</strong><span>这个文件可能还没有提交，或在当前引用 ${escapeHtml(data.ref || history.ref || "HEAD")} 中不存在。</span></div>`
    }
  `;
}

function renderFileHistoryCommit(commit) {
  const change = fileHistoryChangeLabel(commit.change || commit.files?.[0]?.state || "M");
  const renameText = commit.previousFile ? `<span class="file-history-rename">${escapeHtml(commit.previousFile)} -> ${escapeHtml(commit.files?.[0]?.file || "")}</span>` : "";
  return `
    <article class="file-history-row">
      <span class="state-pill ${change.className}">${escapeHtml(change.label)}</span>
      <div class="file-history-main">
        <strong>${escapeHtml(commit.message || "(无提交信息)")}</strong>
        <span>${escapeHtml(commit.short || commit.sha?.slice(0, 7) || "")} · ${escapeHtml(commit.author || "unknown")} · ${escapeHtml(commit.time || "")}</span>
        ${renameText}
      </div>
      <div class="file-history-actions">
        <button class="mini-btn" data-file-history-action="view" data-sha="${escapeAttr(commit.sha || "")}" type="button">查看提交</button>
        <button class="mini-btn" data-file-history-action="file" data-sha="${escapeAttr(commit.sha || "")}" data-file="${escapeAttr(commit.files?.[0]?.file || state.fileHistory.file)}" type="button">文件改动</button>
      </div>
    </article>
  `;
}

function fileHistoryChangeLabel(stateCode) {
  const code = String(stateCode || "M").slice(0, 1);
  const map = {
    A: { label: "新增", className: "added" },
    D: { label: "删除", className: "deleted" },
    R: { label: "重命名", className: "renamed" },
    C: { label: "复制", className: "renamed" },
    M: { label: "修改", className: "modified" },
  };
  return map[code] || map.M;
}

function renderFileBlameTab() {
  const blame = state.fileBlame;
  els.detailNode.style.borderColor = "var(--blue)";
  els.detailTitle.textContent = "逐行追踪";
  els.detailSub.textContent = blame.file || "从文件右键菜单或提交文件列表打开";
  if (!blame.file) {
    els.detailBody.innerHTML = `
      <div class="empty-state">
        <strong>还没有选择文件</strong>
        <span>在工作区文件上右键选择“逐行追踪”，或在提交的文件面板里点击“逐行追踪”。</span>
      </div>
    `;
    return;
  }
  if (blame.loading) {
    els.detailBody.innerHTML = `<div class="empty-state"><strong>正在读取逐行追踪</strong><span>${escapeHtml(blame.file)}</span></div>`;
    return;
  }
  if (blame.error) {
    els.detailBody.innerHTML = `<div class="empty-state danger"><strong>读取失败</strong><span>${escapeHtml(blame.error)}</span></div>`;
    return;
  }
  const data = blame.data || {};
  const lines = data.lines || [];
  els.detailBody.innerHTML = `
    <div class="file-blame-head">
      <div>
        <div class="detail-section-title">逐行追踪</div>
        <strong>${escapeHtml(data.file || blame.file)}</strong>
        <span>${escapeHtml(data.command || `git blame --line-porcelain -- ${blame.file}`)}</span>
      </div>
      <div class="file-blame-actions">
        ${data.truncated ? `<span class="blame-truncated">仅显示前 ${lines.length} 行</span>` : ""}
        <button class="mini-btn" data-file-blame-refresh type="button">刷新</button>
      </div>
    </div>
    ${
      lines.length
        ? `<div class="file-blame-list">${lines.map(renderFileBlameLine).join("")}</div>`
        : `<div class="empty-state"><strong>没有可显示的内容</strong><span>这个文件可能在当前引用 ${escapeHtml(data.ref || blame.ref || "HEAD")} 中不存在，或是空文件。</span></div>`
    }
  `;
}

function renderFileBlameLine(line, index, lines) {
  const previous = lines[index - 1];
  const grouped = previous?.sha === line.sha;
  return `
    <div class="file-blame-row ${grouped ? "grouped" : ""}">
      <button class="blame-commit" data-file-blame-action="view" data-sha="${escapeAttr(line.sha || "")}" type="button" title="${escapeAttr(line.summary || "")}">
        <strong>${grouped ? "" : escapeHtml(line.short || line.sha?.slice(0, 7) || "")}</strong>
        <span>${grouped ? "" : escapeHtml(line.author || "unknown")}</span>
      </button>
      <span class="blame-line">${escapeHtml(line.line || index + 1)}</span>
      <code>${escapeHtml(line.text || "")}</code>
    </div>
  `;
}

async function openFileBlame(filePath, ref = "") {
  if (!filePath) {
    toast("请选择文件");
    return;
  }
  const targetRef = ref || currentFileHistoryRef();
  state.fileBlame = { file: filePath, ref: targetRef, data: null, loading: true, error: "" };
  state.selectedTab = "fileBlame";
  renderInspector();
  try {
    const data = await api(`/api/file-blame?file=${encodeURIComponent(filePath)}&ref=${encodeURIComponent(targetRef)}`);
    state.fileBlame = { file: filePath, ref: data.ref || targetRef, data, loading: false, error: "" };
  } catch (error) {
    state.fileBlame = { file: filePath, ref: targetRef, data: null, loading: false, error: error.message };
  }
  renderInspector();
}

async function runFileBlameAction(action, button) {
  const sha = button.dataset.sha || "";
  if (!sha) return;
  const commit = commitRecordForSha(sha);
  if (!commit) {
    toast("这条逐行追踪记录已经过期，请刷新逐行追踪后再试。");
    return;
  }
  if (action === "view") {
    els.searchInput.value = "";
    state.selectedTab = "details";
    await openHistoryCommit(sha);
  }
}

async function openFileHistory(filePath, ref = "") {
  if (!filePath) {
    toast("请选择文件");
    return;
  }
  const targetRef = ref || currentFileHistoryRef();
  state.fileHistory = { file: filePath, ref: targetRef, data: null, loading: true, error: "" };
  state.selectedTab = "fileHistory";
  renderInspector();
  try {
    const data = await api(`/api/file-history?file=${encodeURIComponent(filePath)}&ref=${encodeURIComponent(targetRef)}`);
    state.fileHistory = { file: filePath, ref: data.ref || targetRef, data, loading: false, error: "" };
  } catch (error) {
    state.fileHistory = { file: filePath, ref: targetRef, data: null, loading: false, error: error.message };
  }
  renderInspector();
}

function currentFileHistoryRef() {
  return state.selectedRef || state.data?.repo?.selectedRef || state.data?.repo?.branch || "HEAD";
}

async function runFileHistoryAction(action, button) {
  const sha = button.dataset.sha || "";
  const file = button.dataset.file || state.fileHistory.file || "";
  if (!sha) return;
  const commit = commitRecordForSha(sha);
  if (!commit) {
    toast("这条文件历史记录已经过期，请刷新文件历史后再试。");
    return;
  }
  els.searchInput.value = "";
  if (action === "view") {
    state.selectedTab = "details";
    await openHistoryCommit(sha);
    return;
  }
  if (action === "file") {
    state.selectedCommitFile = file;
    state.selectedTab = "files";
    await openHistoryCommit(sha);
  }
}

async function openHistoryCommit(sha) {
  if (isGraphCommitLoaded(sha)) {
    await selectCommit(sha);
    return;
  }
  setInspectorContext("commit", inspectorTabs.commit.includes(state.selectedTab) ? state.selectedTab : "details");
  state.selectedSha = sha;
  renderCommits({ inspector: "never" });
  await loadCommit(sha);
  renderInspector();
}

