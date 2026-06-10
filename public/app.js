const $ = (selector) => document.querySelector(selector);

const state = {
  data: null,
  filtered: [],
  selectedSha: "",
  selectedTab: "details",
  selectedRef: "",
  theme: "dark",
  selectedFile: "",
  selectedCommitFile: "",
  activeDiff: null,
  openDiffOnInit: false,
  diffRequestId: 0,
  refreshingWorktree: false,
  worktreeSignature: "",
  commitDetails: new Map(),
};

const laneX = [28, 54, 80, 106, 118, 126, 128];
const rowH = 62;

const els = {
  repoName: $("#repoName"),
  repoPath: $("#repoPath"),
  sideRepoName: $("#sideRepoName"),
  sideRepoBranch: $("#sideRepoBranch"),
  repoInput: $("#repoInput"),
  openRepo: $("#openRepo"),
  searchInput: $("#searchInput"),
  branchList: $("#branchList"),
  remoteList: $("#remoteList"),
  worktreeList: $("#worktreeList"),
  branchStrip: $("#branchStrip"),
  commitGraph: $("#commitGraph"),
  changeList: $("#changeList"),
  stageAll: $("#stageAll"),
  commitForm: $("#commitForm"),
  commitSummary: $("#commitSummary"),
  commitBody: $("#commitBody"),
  draftNote: $("#draftNote"),
  workDiffTitle: $("#workDiffTitle"),
  workDiffPath: $("#workDiffPath"),
  workDiffView: $("#workDiffView"),
  maximizeDiff: $("#maximizeDiff"),
  refreshChanges: $("#refreshChanges"),
  diffModal: $("#diffModal"),
  diffModalTitle: $("#diffModalTitle"),
  diffModalPath: $("#diffModalPath"),
  diffModalBody: $("#diffModalBody"),
  closeDiffModal: $("#closeDiffModal"),
  detailNode: $("#detailNode"),
  detailTitle: $("#detailTitle"),
  detailSub: $("#detailSub"),
  detailBody: $("#detailBody"),
  toast: $("#toast"),
  themeToggle: $("#themeToggle"),
  graphModeLabel: $("#graphModeLabel"),
};

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await response.json();
  if (!response.ok || data.error) throw new Error(data.error || "请求失败");
  return data;
}

async function init() {
  try {
    const params = new URLSearchParams(window.location.search);
    const initialRef = params.get("ref") || "";
    const initialTab = params.get("tab") || "";
    state.openDiffOnInit = params.get("diff") === "max";
    if (["details", "files", "branches"].includes(initialTab)) state.selectedTab = initialTab;
    state.selectedRef = initialRef;
    state.data = await api(`/api/state?ref=${encodeURIComponent(initialRef)}`);
    state.selectedRef = state.data.repo.selectedRef || initialRef;
    state.selectedSha = state.data.commits[0]?.sha || "";
    renderAll();
    if (state.selectedSha) {
      await loadCommit(state.selectedSha);
      renderInspector();
      if (state.openDiffOnInit) openDiffModal();
    }
  } catch (error) {
    toast(error.message);
  }
}

function renderAll() {
  renderRepo();
  renderBranches();
  renderWorkingFiles();
  renderStage();
  renderCommits();
  renderInspector();
}

function renderRepo() {
  const repo = state.data.repo;
  els.repoName.textContent = repo.name;
  els.repoPath.textContent = state.selectedRef ? `${repo.path} · ${state.selectedRef}` : repo.path;
  els.sideRepoName.textContent = repo.name;
  els.sideRepoBranch.textContent = state.selectedRef || repo.branch;
  if (!repo.isSample) els.repoInput.value = repo.path;
}

function renderBranches() {
  els.branchList.innerHTML = "";
  els.remoteList.innerHTML = "";
  els.branchStrip.innerHTML = "";
  const currentRef = state.selectedRef;

  const allChip = document.createElement("button");
  allChip.className = `branch-chip ${state.selectedRef ? "" : "active"}`;
  allChip.type = "button";
  allChip.innerHTML = `<span class="branch-dot" style="--branch:var(--quiet)"></span><span>全部分支</span>`;
  allChip.addEventListener("click", () => selectRef(""));
  els.branchStrip.appendChild(allChip);

  state.data.branches.forEach((branch, index) => {
    els.branchList.appendChild(branchButton(branch, index, branch === currentRef));
    const chip = document.createElement("button");
    chip.className = `branch-chip ${branch === currentRef ? "active" : ""}`;
    chip.type = "button";
    chip.innerHTML = `<span class="branch-dot" style="--branch:${laneColor(index)}"></span><span>${escapeHtml(branch)}</span>`;
    chip.addEventListener("click", () => selectRef(branch));
    els.branchStrip.appendChild(chip);
  });
  state.data.remotes.forEach((branch, index) => {
    els.remoteList.appendChild(branchButton(branch, index + 3, branch === currentRef));
  });
}

function branchButton(branch, index, active) {
  const button = document.createElement("button");
  button.className = `nav-item ${active ? "active" : ""}`;
  button.type = "button";
  button.innerHTML = `<span class="branch-dot" style="--branch:${laneColor(index)}"></span><span>${escapeHtml(branch)}</span>`;
  button.addEventListener("click", () => selectRef(branch));
  return button;
}

function renderWorkingFiles() {
  els.worktreeList.innerHTML = "";
  const files = state.data.workingFiles;
  state.worktreeSignature = worktreeSignature(files);
  if (!files.length) {
    els.worktreeList.innerHTML = `<div class="file-row"><span></span><span class="file-name">工作区干净</span><span></span></div>`;
    return;
  }
  els.worktreeList.innerHTML = fileTreeHtml(files);
  bindFileTree(els.worktreeList, { selectable: true });
}

function renderStage() {
  els.changeList.innerHTML = "";
  const files = state.data.workingFiles;
  state.worktreeSignature = worktreeSignature(files);
  if (!files.length) {
    state.selectedFile = "";
    els.changeList.innerHTML = `<div class="file-row"><span></span><span class="file-name">没有未提交的更改</span><span></span></div>`;
    if (state.activeDiff?.source !== "history") renderWorkDiffEmpty("没有未提交的更改");
  } else {
    if (!files.some((file) => file.file === state.selectedFile)) {
      state.selectedFile = files[0].file;
    }
    els.changeList.innerHTML = fileTreeHtml(files);
    bindFileTree(els.changeList, { selectable: true });
    markSelectedFile();
    if (state.activeDiff?.source !== "history") loadWorkingDiff(state.selectedFile);
  }
  const counts = countFiles(files);
  els.draftNote.textContent = `${counts.M} 个修改，${counts.A} 个新增，${counts.D} 个删除`;
}

function renderCommits() {
  const term = els.searchInput.value.trim().toLowerCase();
  state.filtered = !term
    ? state.data.commits
    : state.data.commits.filter((commit) => {
        return [commit.sha, commit.short, commit.author, commit.message, commit.refs]
          .join(" ")
          .toLowerCase()
          .includes(term);
      });

  if (state.filtered.length && !state.filtered.some((commit) => commit.sha === state.selectedSha)) {
    state.selectedSha = state.filtered[0].sha;
  }

  const minHeight = Math.max(rowH, state.filtered.length * rowH);
  const isBranchScope = Boolean(state.selectedRef);
  els.commitGraph.style.minHeight = `${minHeight}px`;
  els.commitGraph.classList.toggle("branch-scope", isBranchScope);
  els.commitGraph.classList.toggle("all-scope", !isBranchScope);
  els.graphModeLabel.textContent = isBranchScope ? state.selectedRef : "全部分支";
  els.graphModeLabel.title = isBranchScope ? `当前只显示 ${state.selectedRef}` : "当前显示所有分支";
  const graphCommits = layoutGraphCommits(state.filtered, state.selectedRef);
  els.commitGraph.innerHTML = renderGraphSvg(graphCommits, minHeight, state.selectedRef);

  if (!state.filtered.length) {
    els.commitGraph.insertAdjacentHTML(
      "beforeend",
      `<div class="commit-row" style="grid-template-columns:1fr;min-width:0"><div class="message"><strong>没有匹配的提交</strong><span>换一个关键词试试</span></div></div>`
    );
    renderInspector();
    return;
  }

  state.filtered.forEach((commit) => {
    const row = document.createElement("button");
    row.className = `commit-row ${commit.sha === state.selectedSha ? "selected" : ""}`;
    row.type = "button";
    row.innerHTML = `
      <div class="graph-cell">
      </div>
      <div class="message">
        <strong title="${escapeAttr(commit.message)}">${escapeHtml(commit.message)}</strong>
        <span title="${escapeAttr(commit.refs || "提交历史")}">${escapeHtml(commit.refs || "提交历史")}</span>
      </div>
      <div class="author">
        <span class="author-badge" style="--avatar:${commit.color}">${initials(commit.author)}</span>
        <span>${escapeHtml(commit.author)}</span>
      </div>
      <div class="time">${escapeHtml(commit.time)}</div>
      <div class="sha">${escapeHtml(commit.short)}</div>
    `;
    row.addEventListener("click", async () => {
      state.selectedSha = commit.sha;
      renderCommits();
      await loadCommit(commit.sha);
      renderInspector();
    });
    els.commitGraph.appendChild(row);
  });
  renderInspector();
}

function renderGraphSvg(commits, height, selectedRef) {
  const bySha = new Map(commits.map((commit, index) => [commit.sha, { commit, index }]));
  const byShort = new Map(commits.map((commit, index) => [commit.short, { commit, index }]));
  const selectedColor = selectedRef ? refColor(selectedRef) : "";
  const isFocused = Boolean(selectedRef);
  const guides = laneGuides(commits, height, selectedColor, isFocused);
  let paths = "";
  let nodes = "";
  let labels = "";
  commits.forEach((commit, index) => {
    const x1 = laneX[commit.lane] || laneX[0];
    const y1 = index * rowH + rowH / 2;
    const color = selectedColor || commit.color;
    const isPrimaryNode = !isFocused && commit.lane === 0;
    nodes += node(x1, y1, color, isFocused, isPrimaryNode);
    const label = selectedRef && index === 0 ? selectedRef : !selectedRef ? tipLabel(commit.refs) : "";
    if (label) labels += graphLabel(x1, y1, label, color, isFocused);
    const parents = commit.parents || [];
    if (!parents.length && index < commits.length - 1) {
      const next = commits[index + 1];
      paths += curve(x1, y1, laneX[next.lane] || laneX[0], (index + 1) * rowH + rowH / 2, color, isFocused, isPrimaryNode && next.lane === 0);
    }
    parents.forEach((parentSha) => {
      const parent = bySha.get(parentSha) || byShort.get(parentSha.slice(0, 7));
      if (!parent) {
        paths += curve(x1, y1, x1, Math.min(y1 + rowH, height), color, isFocused, isPrimaryNode);
        return;
      }
      if (parent.index <= index) return;
      paths += curve(x1, y1, laneX[parent.commit.lane] || laneX[0], parent.index * rowH + rowH / 2, color, isFocused, isPrimaryNode && parent.commit.lane === 0);
    });
  });
  return `
    <svg class="graph-lines ${isFocused ? "focus" : "overview"}" height="${height}" viewBox="0 0 132 ${height}" preserveAspectRatio="none" aria-hidden="true">
      <g class="lane-guides" fill="none" stroke-linecap="round">${guides}</g>
      <g fill="none" stroke-linecap="round" stroke-linejoin="round">${paths}</g>
      <g>${labels}</g>
      <g>${nodes}</g>
    </svg>
  `;
}

function layoutGraphCommits(visibleCommits, selectedRef) {
  if (selectedRef || !state.data?.commits?.length) return visibleCommits;
  const allCommits = state.data.commits;
  const primary = primaryBranchName();
  const primaryLine = primaryLineSet(allCommits, primary);
  if (!primaryLine.size) return visibleCommits;

  const inheritedLane = new Map();
  const laneBySha = new Map();
  const namedLanes = new Map([[primary, 0]]);
  let nextLane = 1;

  const allocateLane = (name = "") => {
    if (name && namedLanes.has(name)) return namedLanes.get(name);
    const lane = Math.min(nextLane, laneX.length - 1);
    if (name) namedLanes.set(name, lane);
    nextLane = Math.min(laneX.length - 1, nextLane + 1);
    return lane;
  };

  allCommits.forEach((commit) => {
    let lane = 0;
    if (!primaryLine.has(commit.sha)) {
      const branch = sideBranchName(commit, primary);
      lane = inheritedLane.get(commit.sha) ?? allocateLane(branch);
    }
    laneBySha.set(commit.sha, lane);
    (commit.parents || []).forEach((parentSha) => {
      if (!primaryLine.has(parentSha) && !inheritedLane.has(parentSha)) inheritedLane.set(parentSha, lane);
    });
  });

  return visibleCommits.map((commit) => {
    const lane = laneBySha.has(commit.sha) ? laneBySha.get(commit.sha) : Number(commit.lane) || 0;
    return { ...commit, lane, color: laneColor(lane) };
  });
}

function primaryBranchName() {
  const branches = state.data?.branches || [];
  if (branches.includes("main")) return "main";
  if (branches.includes("master")) return "master";
  const current = state.data?.repo?.branch || "";
  if (branches.includes(current)) return current;
  return branches[0] || current || "";
}

function primaryLineSet(commits, primary) {
  const bySha = new Map(commits.map((commit) => [commit.sha, commit]));
  const tip = commits.find((commit) => refNames(commit.refs).some((name) => isPrimaryRef(name, primary)));
  const line = new Set();
  let cursor = tip;
  while (cursor && !line.has(cursor.sha)) {
    line.add(cursor.sha);
    cursor = bySha.get(cursor.parents?.[0]);
  }
  return line;
}

function sideBranchName(commit, primary) {
  const names = refNames(commit.refs);
  const branches = state.data?.branches || [];
  const remotes = state.data?.remotes || [];
  const local = names.find((name) => branches.includes(name) && name !== primary);
  if (local) return local;
  const remote = names.find((name) => remotes.includes(name) && !isPrimaryRef(name, primary));
  if (remote) return remote;
  return "";
}

function refNames(refs) {
  return String(refs || "")
    .split(",")
    .map((ref) => ref.trim().replace(/^HEAD\s+->\s+/, ""))
    .filter(Boolean);
}

function isPrimaryRef(name, primary) {
  return Boolean(primary) && (name === primary || name.endsWith(`/${primary}`));
}

function curve(x1, y1, x2, y2, color, selected, primary = false) {
  const mid = (y1 + y2) / 2;
  const d = `M ${x1} ${y1} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}`;
  if (selected) {
    return `
      <path d="${d}" stroke="${color}" stroke-width="10" opacity="0.16" />
      <path d="${d}" stroke="${color}" stroke-width="4.6" opacity="0.98" />
    `;
  }
  return `<path d="${d}" stroke="${color}" stroke-width="${primary ? 4.8 : 3.1}" opacity="${primary ? 0.9 : 0.72}" />`;
}

function laneGuides(commits, height, selectedColor, selected) {
  if (selected) {
    const lanes = [...new Set(commits.map((commit) => Number(commit.lane) || 0))].sort((a, b) => a - b);
    return lanes
      .map((lane, index) => {
        const x = laneX[lane] || laneX[0];
        const opacity = index === 0 ? 0.15 : 0.08;
        const width = index === 0 ? 18 : 12;
        return `<line x1="${x}" y1="8" x2="${x}" y2="${Math.max(8, height - 8)}" stroke="${selectedColor}" stroke-width="${width}" opacity="${opacity}" />`;
      })
      .join("");
  }
  const lanes = [...new Set(commits.map((commit) => Number(commit.lane) || 0))].sort((a, b) => a - b);
  return lanes
    .map((lane) => {
      const x = laneX[lane] || laneX[0];
      if (lane === 0) {
        return `<line x1="${x}" y1="8" x2="${x}" y2="${Math.max(8, height - 8)}" stroke="${laneColor(0)}" stroke-width="18" opacity="0.13" />`;
      }
      return `<line x1="${x}" y1="8" x2="${x}" y2="${Math.max(8, height - 8)}" stroke="${laneColor(lane)}" stroke-width="1.6" opacity="${lane < 4 ? 0.3 : 0.18}" stroke-dasharray="2 8" />`;
    })
    .join("");
}

function node(x, y, color, selected, primary = false) {
  const radius = selected ? 7.4 : primary ? 6.9 : 6.4;
  return `
    <circle cx="${x}" cy="${y}" r="${selected ? 15 : primary ? 13 : 12}" fill="${color}" opacity="${selected ? 0.18 : primary ? 0.14 : 0.1}" />
    <circle cx="${x}" cy="${y}" r="${selected || primary ? 10 : 9}" fill="var(--graph-node-fill)" stroke="var(--graph-node-ring)" stroke-width="3.2" />
    <circle cx="${x}" cy="${y}" r="${radius}" fill="var(--graph-node-fill)" stroke="${color}" stroke-width="${selected ? 3.6 : primary ? 3.5 : 3.1}" />
    <circle cx="${x}" cy="${y}" r="2.3" fill="${color}" opacity="0.96" />
  `;
}

function graphLabel(x, y, label, color, selected) {
  const maxChars = selected ? 8 : 7;
  const text = escapeHtml(label.length > maxChars ? `${label.slice(0, maxChars)}...` : label);
  const width = Math.min(76, Math.max(42, [...text].length * 9 + 16));
  const labelX = Math.min(x + 12, 126 - width);
  const labelY = Math.max(7, y - 25);
  return `
    <g class="graph-label">
      <rect x="${labelX}" y="${labelY}" width="${width}" height="20" rx="7" fill="var(--graph-label-bg)" stroke="${color}" stroke-width="1.2" opacity="0.96" />
      <text x="${labelX + 8}" y="${labelY + 14}" fill="var(--graph-label-text)" font-size="10" font-weight="800" font-family="Microsoft YaHei UI, Segoe UI, sans-serif">${text}</text>
    </g>
  `;
}

function tipLabel(refs) {
  const names = String(refs || "")
    .split(",")
    .map((item) => item.trim().replace(/^HEAD -> /, ""))
    .filter((item) => item && item !== "origin/HEAD" && !item.includes("stash"));
  return names.find((name) => state.data?.branches?.includes(name)) || names.find((name) => !name.startsWith("origin/")) || names[0] || "";
}

function refColor(ref) {
  const localIndex = state.data?.branches?.indexOf(ref) ?? -1;
  if (localIndex >= 0) return laneColor(localIndex);
  const remoteIndex = state.data?.remotes?.indexOf(ref) ?? -1;
  if (remoteIndex >= 0) return laneColor(remoteIndex + 3);
  return laneColor(1);
}

async function loadCommit(sha) {
  if (!sha || state.commitDetails.has(sha)) return;
  const commit = state.data.commits.find((item) => item.sha === sha);
  if (commit?.files?.length || commit?.diff?.length) {
    state.commitDetails.set(sha, { files: commit.files || [], diff: commit.diff || [] });
    return;
  }
  try {
    const detail = await api(`/api/commit?sha=${encodeURIComponent(sha)}`);
    state.commitDetails.set(sha, detail);
  } catch (error) {
    toast(error.message);
  }
}

function renderInspector() {
  const commit = state.data?.commits.find((item) => item.sha === state.selectedSha);
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
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === state.selectedTab));
  if (state.selectedTab === "files") renderFilesTab(commit, detail);
  else if (state.selectedTab === "branches") renderBranchesTab(commit);
  else renderDetailsTab(commit, detail);
}

function renderDetailsTab(commit, detail) {
  const message = commitMessageParts(commit, detail);
  const isMergeCommit = (commit.parents || []).length > 1;
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
    <div class="detail-section-title">DIFF 预览</div>
    ${renderDiff(detail.diff)}
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
  if (files.length && !files.some((file) => file.file === state.selectedCommitFile)) {
    state.selectedCommitFile = files[0].file;
  }
  const selectedDiff = state.selectedCommitFile ? diffForFile(detail.diff || [], state.selectedCommitFile) : detail.diff || [];
  if (state.selectedCommitFile) renderHistoryDiffInWorkbench(commit, detail, state.selectedCommitFile);
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
          <button class="mini-btn diff-max-btn" data-open-diff-modal type="button" ${selectedDiff.length ? "" : "disabled"}>最大化</button>
        </div>
        ${renderSideDiff(selectedDiff, "没有可显示的历史改动")}
      </div>
    </div>
  `;
  bindFileTree(els.detailBody, { mode: "commit" });
  markCommitFile();
}

function renderBranchesTab(commit) {
  els.detailBody.innerHTML = `
    <div class="detail-section-title">分支图</div>
    <svg class="mini-graph" viewBox="0 0 320 220" role="img" aria-label="分支图">
      <path d="M 28 164 C 92 164, 116 74, 180 74 S 260 88, 292 58" fill="none" stroke="#23c7b7" stroke-width="6" stroke-linecap="round"/>
      <path d="M 28 164 C 112 164, 126 142, 188 142 S 250 152, 292 146" fill="none" stroke="#f0b85b" stroke-width="6" stroke-linecap="round"/>
      <path d="M 76 164 C 126 164, 128 112, 184 112 S 248 112, 292 98" fill="none" stroke="#ff7a67" stroke-width="6" stroke-linecap="round"/>
      <circle cx="178" cy="${commit.lane === 0 ? 74 : commit.lane === 1 ? 112 : 146}" r="12" fill="var(--graph-node-fill)" stroke="${commit.color}" stroke-width="6"/>
      <text x="18" y="28" fill="var(--quiet)" font-size="13" font-family="Consolas">${escapeHtml(commit.short)}</text>
      <text x="18" y="196" fill="var(--text)" font-size="13">${escapeHtml(commit.refs || state.data.repo.branch)}</text>
    </svg>
    <div class="detail-section-title">相关引用</div>
    ${(commit.refs || state.data.repo.branch)
      .split(",")
      .filter(Boolean)
      .map((ref, index) => `<button class="nav-item" type="button"><span class="branch-dot" style="--branch:${laneColor(index)}"></span><span>${escapeHtml(ref.trim())}</span></button>`)
      .join("")}
  `;
}

function renderDiff(diff) {
  if (!diff?.length) return `<div class="diff"><div class="diff-line"><span class="ln">1</span><code>没有可显示的 Diff</code></div></div>`;
  return `
    <div class="diff">
      ${diff
        .map(
          (line, index) => `
          <div class="diff-line ${line.type}">
            <span class="ln">${index + 1}</span>
            <code>${escapeHtml(line.text)}</code>
          </div>`
        )
        .join("")}
    </div>
  `;
}

function fileTreeHtml(files) {
  const root = { dirs: new Map(), files: [] };
  files.forEach((file) => addFileToTree(root, file));
  return `<div class="file-tree">${treeNodeHtml(root, 0)}</div>`;
}

function addFileToTree(root, file) {
  const raw = String(file.file || "");
  const normalized = raw.replaceAll("\\", "/");
  const parts = normalized.split("/").filter(Boolean);
  const leaf = parts.pop() || normalized || "未知文件";
  let node = root;
  parts.forEach((part) => {
    if (!node.dirs.has(part)) node.dirs.set(part, { name: part, dirs: new Map(), files: [] });
    node = node.dirs.get(part);
  });
  node.files.push({ ...file, raw, leaf });
}

function treeNodeHtml(node, depth) {
  const dirs = [...node.dirs.values()]
    .map(
      (dir) => `
        <div class="tree-group" style="--depth:${depth}">
          <button class="tree-head" type="button">
            <span class="tree-caret"></span>
            <span class="tree-folder" title="${escapeAttr(dir.name)}">${escapeHtml(dir.name)}</span>
            <span class="tree-count">${treeFileCount(dir)}</span>
          </button>
          <div class="tree-children">${treeNodeHtml(dir, depth + 1)}</div>
        </div>
      `
    )
    .join("");
  const rows = node.files.map((file) => fileLeafRowHtml(file, depth)).join("");
  return `${dirs}${rows}`;
}

function treeFileCount(node) {
  return [...node.dirs.values()].reduce((total, dir) => total + treeFileCount(dir), node.files.length);
}

function fileLeafRowHtml(file, depth) {
  return `
    <button class="file-row leaf-row" type="button" data-file="${escapeAttr(file.raw)}" style="--depth:${depth}" title="${escapeAttr(file.raw)}">
      <span class="badge ${file.state}">${file.state}</span>
      <span class="file-leaf">${escapeHtml(file.leaf)}</span>
      <span class="file-extra">${escapeHtml(file.extra || "")}</span>
    </button>
  `;
}

function bindFileTree(root, options = {}) {
  root.querySelectorAll(".tree-head").forEach((head) => {
    head.addEventListener("click", () => head.closest(".tree-group")?.classList.toggle("collapsed"));
  });
  if (options.mode === "worktree" || options.selectable) {
    root.querySelectorAll(".leaf-row[data-file]").forEach((row) => {
      row.addEventListener("click", () => selectWorkingFile(row.dataset.file || ""));
    });
    markSelectedFile();
    return;
  }
  if (options.mode === "commit") {
    root.querySelectorAll(".leaf-row[data-file]").forEach((row) => {
      row.addEventListener("click", () => selectCommitFile(row.dataset.file || ""));
    });
    markCommitFile();
  }
}

function selectWorkingFile(filePath) {
  if (!filePath || filePath === state.selectedFile) return;
  state.selectedFile = filePath;
  markSelectedFile();
  loadWorkingDiff(filePath);
}

function markSelectedFile() {
  document.querySelectorAll(".leaf-row[data-file]").forEach((row) => {
    row.classList.toggle("selected", row.dataset.file === state.selectedFile);
  });
}

function selectCommitFile(filePath) {
  if (!filePath || filePath === state.selectedCommitFile) return;
  state.selectedCommitFile = filePath;
  renderInspector();
}

function markCommitFile() {
  els.detailBody.querySelectorAll(".leaf-row[data-file]").forEach((row) => {
    row.classList.toggle("selected", row.dataset.file === state.selectedCommitFile);
  });
}

function renderWorkDiffEmpty(message) {
  setActiveDiff(null);
  els.workDiffTitle.textContent = "变更对照";
  els.workDiffPath.textContent = "";
  els.workDiffView.className = "work-diff-view empty";
  els.workDiffView.textContent = message;
}

async function loadWorkingDiff(filePath) {
  if (!filePath) {
    renderWorkDiffEmpty("未选择文件");
    return;
  }
  const requestId = ++state.diffRequestId;
  els.workDiffTitle.textContent = "变更对照";
  els.workDiffPath.textContent = filePath;
  els.workDiffView.className = "work-diff-view loading";
  els.workDiffView.textContent = "正在读取差异...";
  try {
    const data = await api(`/api/worktree-diff?file=${encodeURIComponent(filePath)}`);
    if (requestId !== state.diffRequestId) return;
    renderWorkDiff(data.file || filePath, data.diff || []);
  } catch (error) {
    if (requestId !== state.diffRequestId) return;
    els.workDiffView.className = "work-diff-view empty";
    els.workDiffView.textContent = error.message;
  }
}

function renderWorkDiff(filePath, diff) {
  const title = shortFileName(filePath);
  setActiveDiff({ source: "worktree", title, path: filePath, diff, emptyText: "没有可显示的差异" });
  els.workDiffTitle.textContent = title;
  els.workDiffPath.textContent = filePath;
  if (!diff.length) {
    els.workDiffView.className = "work-diff-view empty";
    els.workDiffView.textContent = "没有可显示的差异";
    return;
  }
  els.workDiffView.className = "work-diff-view";
  els.workDiffView.innerHTML = renderSideDiff(diff, "没有可显示的差异");
}

function renderHistoryDiffInWorkbench(commit, detail, filePath) {
  const diff = diffForFile(detail.diff || [], filePath);
  const title = `${shortFileName(filePath)} · 历史提交`;
  const path = `${commit.short} · ${filePath}`;
  setActiveDiff({ source: "history", title, path, diff, emptyText: "没有可显示的历史改动" });
  state.diffRequestId += 1;
  els.workDiffTitle.textContent = title;
  els.workDiffPath.textContent = path;
  els.workDiffView.className = "work-diff-view";
  els.workDiffView.innerHTML = renderSideDiff(diff, "没有可显示的历史改动");
}

function setActiveDiff(payload) {
  state.activeDiff = payload;
  if (els.maximizeDiff) els.maximizeDiff.disabled = !payload?.diff?.length;
}

function openDiffModal() {
  if (!state.activeDiff?.diff?.length) {
    toast("没有可最大化的对照内容");
    return;
  }
  els.diffModalTitle.textContent = state.activeDiff.title || "变更对照";
  els.diffModalPath.textContent = state.activeDiff.path || "";
  els.diffModalBody.innerHTML = renderSideDiff(state.activeDiff.diff, state.activeDiff.emptyText || "没有可显示的差异");
  els.diffModal.classList.add("show");
  els.diffModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

function closeDiffModal() {
  els.diffModal.classList.remove("show");
  els.diffModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

function renderSideDiff(diff, emptyText) {
  if (!diff?.length) return `<div class="diff-empty">${escapeHtml(emptyText)}</div>`;
  return `
    <div class="side-diff">
      <div class="side-diff-head"><span>旧版本</span><span>新版本</span></div>
      ${sideBySideRows(diff)}
    </div>
  `;
}

function diffForFile(diff, filePath) {
  const target = normalizeDiffPath(filePath);
  const blocks = [];
  let current = [];
  for (const line of diff || []) {
    const text = String(line.text || "");
    if (text.startsWith("diff --git ")) {
      if (current.length) blocks.push(current);
      current = [line];
      continue;
    }
    if (current.length) current.push(line);
  }
  if (current.length) blocks.push(current);
  const matched = blocks.find((block) => diffBlockMatchesFile(block, target));
  return matched || [];
}

function diffBlockMatchesFile(block, target) {
  return block.some((line) => {
    const text = String(line.text || "");
    const normalized = normalizeDiffPath(text);
    return normalized.includes(` a/${target}`) || normalized.includes(` b/${target}`) || normalized.endsWith(`a/${target}`) || normalized.endsWith(`b/${target}`);
  });
}

function normalizeDiffPath(value) {
  return String(value || "").replaceAll("\\", "/").replace(/^"|"$/g, "");
}

function sideBySideRows(diff) {
  const rows = [];
  let oldLine = 0;
  let newLine = 0;
  for (let index = 0; index < diff.length; index++) {
    const line = diff[index];
    const text = String(line.text || "");
    if (line.type === "meta") {
      const hunk = text.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (hunk) {
        oldLine = Number(hunk[1]) - 1;
        newLine = Number(hunk[2]) - 1;
      }
      rows.push(`<div class="side-row meta"><div class="side-meta">${escapeHtml(text)}</div></div>`);
      continue;
    }
    if (line.type === "del" && diff[index + 1]?.type === "add") {
      oldLine += 1;
      newLine += 1;
      rows.push(sideRow("mod", oldLine, trimDiffPrefix(text), "del", newLine, trimDiffPrefix(diff[index + 1].text), "add"));
      index += 1;
      continue;
    }
    if (line.type === "del") {
      oldLine += 1;
      rows.push(sideRow("del", oldLine, trimDiffPrefix(text), "del", "", "", "blank"));
      continue;
    }
    if (line.type === "add") {
      newLine += 1;
      rows.push(sideRow("add", "", "", "blank", newLine, trimDiffPrefix(text), "add"));
      continue;
    }
    oldLine += 1;
    newLine += 1;
    rows.push(sideRow("ctx", oldLine, trimDiffPrefix(text), "", newLine, trimDiffPrefix(text), ""));
  }
  return rows.join("");
}

function sideRow(type, oldNo, oldText, oldClass, newNo, newText, newClass) {
  return `
    <div class="side-row ${type}">
      <div class="side-cell old ${oldClass}">
        <span class="ln">${escapeHtml(oldNo)}</span><code>${escapeHtml(oldText)}</code>
      </div>
      <div class="side-cell new ${newClass}">
        <span class="ln">${escapeHtml(newNo)}</span><code>${escapeHtml(newText)}</code>
      </div>
    </div>
  `;
}

function trimDiffPrefix(text) {
  return String(text || "").replace(/^[-+ ]/, "");
}

function shortFileName(filePath) {
  return String(filePath || "").replaceAll("\\", "/").split("/").filter(Boolean).pop() || "变更对照";
}

function worktreeSignature(files) {
  return (files || []).map((file) => `${file.state}:${file.file}:${file.extra || ""}`).join("|");
}

async function refreshWorktree(silent = false) {
  if (!state.data || state.refreshingWorktree) return;
  state.refreshingWorktree = true;
  els.refreshChanges.disabled = true;
  try {
    const data = await api("/api/worktree");
    const nextFiles = data.workingFiles || [];
    const nextSignature = worktreeSignature(nextFiles);
    if (nextSignature !== state.worktreeSignature) {
      state.data.workingFiles = nextFiles;
      renderWorkingFiles();
      renderStage();
      if (!silent) toast("未提交修改已刷新");
    } else if (!silent) {
      toast("未提交修改已是最新");
    }
  } catch (error) {
    if (!silent) toast(error.message);
  } finally {
    state.refreshingWorktree = false;
    els.refreshChanges.disabled = false;
  }
}

function initWorktreeAutoRefresh() {
  window.addEventListener("focus", () => refreshWorktree(true));
  setInterval(() => {
    if (!document.hidden) refreshWorktree(true);
  }, 5000);
}

function applyFilter(value) {
  els.searchInput.value = value;
  renderCommits();
}

async function openRepo() {
  const repoPath = els.repoInput.value.trim();
  if (!repoPath) {
    toast("请输入仓库路径");
    return;
  }
  try {
    els.openRepo.disabled = true;
    state.commitDetails.clear();
    state.data = await api("/api/open", { method: "POST", body: JSON.stringify({ path: repoPath }) });
    state.selectedRef = state.data.repo.branch && state.data.repo.branch !== "detached HEAD" ? state.data.repo.branch : "";
    if (state.selectedRef) {
      state.data = await api(`/api/state?ref=${encodeURIComponent(state.selectedRef)}`);
      state.selectedRef = state.data.repo.selectedRef || state.selectedRef;
    }
    state.selectedSha = state.data.commits[0]?.sha || "";
    els.searchInput.value = "";
    renderAll();
    if (state.selectedSha) {
      await loadCommit(state.selectedSha);
      renderInspector();
    }
    toast(`已打开 ${state.data.repo.name}`);
  } catch (error) {
    toast(error.message);
  } finally {
    els.openRepo.disabled = false;
  }
}

async function selectRef(ref) {
  if (!state.data) return;
  try {
    state.selectedRef = ref;
    els.searchInput.value = "";
    state.commitDetails.clear();
    if (state.data.repo.isSample) {
      state.data.repo.selectedRef = ref;
    } else {
      state.data = await api(`/api/state?ref=${encodeURIComponent(ref)}`);
      state.selectedRef = state.data.repo.selectedRef || ref;
    }
    state.selectedSha = state.data.commits[0]?.sha || "";
    renderAll();
    if (state.selectedSha) {
      await loadCommit(state.selectedSha);
      renderInspector();
    }
    toast(ref ? `已切换到 ${ref}` : "已显示全部分支");
  } catch (error) {
    toast(error.message);
  }
}

async function runAction(action) {
  if (!state.data) return;
  const names = { fetch: "抓取", pull: "拉取", push: "推送", stageAll: "暂存全部", commit: "创建提交" };
  if (!state.data.repo.isSample && !confirm(`确认执行：${names[action]}？`)) return;
  try {
    const payload = { action };
    if (action === "commit") {
      payload.summary = els.commitSummary.value.trim();
      payload.body = els.commitBody.value.trim();
    }
    const result = await api("/api/action", { method: "POST", body: JSON.stringify(payload) });
    toast(result.output || `${names[action]}完成`);
    state.commitDetails.clear();
    state.data = await api(`/api/state?ref=${encodeURIComponent(state.selectedRef)}`);
    state.selectedRef = state.data.repo.selectedRef || state.selectedRef;
    state.selectedSha = state.data.commits[0]?.sha || state.selectedSha;
    renderAll();
    if (state.selectedSha) {
      await loadCommit(state.selectedSha);
      renderInspector();
    }
  } catch (error) {
    toast(error.message);
  }
}

async function rewordSelectedCommit(form) {
  if (!state.data) return;
  const sha = form.dataset.sha || state.selectedSha;
  const commit = state.data.commits.find((item) => item.sha === sha);
  if (!commit) return;
  const summary = form.elements.summary.value.trim();
  const body = form.elements.body.value.trim();
  if (!summary) {
    toast("请填写新的提交摘要");
    return;
  }
  const previousIndex = state.data.commits.findIndex((item) => item.sha === sha);
  const targetName = sha === state.data.commits[0]?.sha ? "最新提交" : "历史提交";
  if (!state.data.repo.isSample && !confirm(`确认修改 ${targetName} ${commit.short} 的提交信息？这会重写相关历史 SHA。`)) return;
  const button = form.querySelector("button[type='submit']");
  button.disabled = true;
  try {
    const result = await api("/api/action", {
      method: "POST",
      body: JSON.stringify({ action: "rewordCommit", sha, summary, body }),
    });
    toast(result.output || "提交信息已修改");
    state.commitDetails.clear();
    state.data = await api(`/api/state?ref=${encodeURIComponent(state.selectedRef)}`);
    state.selectedRef = state.data.repo.selectedRef || state.selectedRef;
    const sameCommit = state.data.commits.find((item) => item.sha === sha);
    state.selectedSha = sameCommit?.sha || state.data.commits[previousIndex]?.sha || state.data.commits[0]?.sha || "";
    renderAll();
    if (state.selectedSha) {
      await loadCommit(state.selectedSha);
      renderInspector();
    }
  } catch (error) {
    toast(error.message);
  } finally {
    button.disabled = false;
  }
}

function countFiles(files) {
  return files.reduce(
    (acc, file) => {
      acc[file.state] = (acc[file.state] || 0) + 1;
      return acc;
    },
    { M: 0, A: 0, D: 0 }
  );
}

function laneColor(index) {
  return ["#23c7b7", "#ff7a67", "#f0b85b", "#5ca9ff", "#9c7cff", "#6bd58c", "#f071b8"][index % 7];
}

function initTheme() {
  const queryTheme = new URLSearchParams(window.location.search).get("theme");
  const storedTheme = localStorage.getItem("forkline-theme");
  const theme = normalizeTheme(queryTheme) || normalizeTheme(storedTheme) || "dark";
  applyTheme(theme, false);
}

function normalizeTheme(theme) {
  return theme === "light" || theme === "dark" ? theme : "";
}

function applyTheme(theme, persist = true) {
  state.theme = theme;
  document.documentElement.dataset.theme = theme;
  if (persist) localStorage.setItem("forkline-theme", theme);
  els.themeToggle.textContent = theme === "light" ? "深色" : "浅色";
  els.themeToggle.title = theme === "light" ? "切换到深色模式" : "切换到浅色模式";
}

function toggleTheme() {
  applyTheme(state.theme === "light" ? "dark" : "light");
}

function initLayoutResizers() {
  const root = document.documentElement;
  const configs = {
    sidebar: { varName: "--sidebar-w", store: "forkline-sidebar-w", min: 190, max: () => layoutMax("sidebar"), axis: "x", sign: 1 },
    inspector: { varName: "--inspector-w", store: "forkline-inspector-w", min: 260, max: () => layoutMax("inspector"), axis: "x", sign: -1 },
    changes: { varName: "--changes-w", store: "forkline-changes-w", min: 240, max: () => layoutMax("changes"), axis: "x", sign: 1 },
    stage: { varName: "--stage-h", store: "forkline-stage-h", min: 220, max: () => layoutMax("stage"), axis: "y", sign: -1 },
    commitForm: { varName: "--commit-form-h", store: "forkline-commit-form-h", min: 90, max: () => layoutMax("commitForm"), axis: "y", sign: -1 },
  };
  Object.values(configs).forEach((config) => {
    const stored = Number(localStorage.getItem(config.store));
    if (Number.isFinite(stored)) root.style.setProperty(config.varName, `${clamp(stored, config.min, configMax(config))}px`);
  });
  document.querySelectorAll("[data-resizer]").forEach((handle) => {
    const config = configs[handle.dataset.resizer];
    if (!config) return;
    handle.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      handle.setPointerCapture?.(event.pointerId);
      const startPoint = config.axis === "x" ? event.clientX : event.clientY;
      const startSize = numericCssVar(config.varName);
      document.body.classList.add("resizing");
      const onMove = (moveEvent) => {
        const point = config.axis === "x" ? moveEvent.clientX : moveEvent.clientY;
        const next = clamp(startSize + (point - startPoint) * config.sign, config.min, configMax(config));
        root.style.setProperty(config.varName, `${next}px`);
        if (config.varName === "--stage-h") {
          const commitConfig = configs.commitForm;
          const currentCommit = numericCssVar(commitConfig.varName);
          root.style.setProperty(commitConfig.varName, `${clamp(currentCommit, commitConfig.min, configMax(commitConfig))}px`);
        }
      };
      const onUp = () => {
        const current = numericCssVar(config.varName);
        localStorage.setItem(config.store, String(current));
        document.body.classList.remove("resizing");
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
      };
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp, { once: true });
    });
  });
  window.addEventListener("resize", () => clampLayoutVars(configs));
  clampLayoutVars(configs);
}

function clampLayoutVars(configs) {
  Object.values(configs).forEach((config) => {
    const current = numericCssVar(config.varName);
    const next = clamp(current, config.min, configMax(config));
    document.documentElement.style.setProperty(config.varName, `${next}px`);
  });
}

function layoutMax(kind) {
  const width = window.innerWidth || 1160;
  const height = window.innerHeight || 760;
  const sidebar = numericCssVar("--sidebar-w") || 240;
  const inspector = numericCssVar("--inspector-w") || 340;
  const resizers = 14;
  const mainMin = 560;
  if (kind === "sidebar") return Math.max(220, Math.min(420, width - inspector - resizers - mainMin));
  if (kind === "inspector") return Math.max(280, Math.min(560, width - sidebar - resizers - mainMin));
  if (kind === "changes") return Math.max(280, Math.min(620, width - sidebar - inspector - resizers - 360));
  if (kind === "stage") return Math.max(240, Math.min(500, height - 260));
  if (kind === "commitForm") {
    const stageHeight = numericCssVar("--stage-h") || 300;
    return Math.max(110, Math.min(320, stageHeight - 90));
  }
  return 520;
}

function configMax(config) {
  return typeof config.max === "function" ? config.max() : config.max;
}

function numericCssVar(name) {
  return Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || 0;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function initials(name) {
  const parts = String(name || "?").trim().split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) return escapeHtml((parts[0][0] + parts[1][0]).toUpperCase());
  return escapeHtml(parts[0]?.slice(0, 2).toUpperCase() || "?");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("\n", " ");
}

function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => els.toast.classList.remove("show"), 2600);
}

els.openRepo.addEventListener("click", openRepo);
els.repoInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") openRepo();
});
els.searchInput.addEventListener("input", renderCommits);
els.themeToggle.addEventListener("click", toggleTheme);
els.refreshChanges.addEventListener("click", () => refreshWorktree(false));
els.maximizeDiff.addEventListener("click", openDiffModal);
els.closeDiffModal.addEventListener("click", closeDiffModal);
els.diffModal.addEventListener("click", (event) => {
  if (event.target === els.diffModal) closeDiffModal();
});
els.stageAll.addEventListener("click", () => runAction("stageAll"));
els.commitForm.addEventListener("submit", (event) => {
  event.preventDefault();
  runAction("commit");
});
els.detailBody.addEventListener("submit", (event) => {
  const form = event.target.closest("[data-reword-form]");
  if (!form) return;
  event.preventDefault();
  rewordSelectedCommit(form);
});
document.querySelectorAll("[data-action]").forEach((button) => {
  button.addEventListener("click", () => runAction(button.dataset.action));
});
document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    state.selectedTab = tab.dataset.tab;
    renderInspector();
  });
});
document.addEventListener("click", (event) => {
  if (event.target.closest("[data-open-diff-modal]")) openDiffModal();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && els.diffModal.classList.contains("show")) closeDiffModal();
});

initTheme();
initLayoutResizers();
initWorktreeAutoRefresh();
init();
