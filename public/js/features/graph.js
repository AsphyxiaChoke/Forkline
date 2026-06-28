// Commit graph layout and SVG rendering.
function renderGraphSvg(commits, height, selectedRef) {
  return selectedRef ? renderBranchGraphSvg(commits, height, selectedRef) : renderOverviewGraphSvg(commits, height);
}

function renderOverviewGraphSvg(commits, height) {
  const bySha = new Map(commits.map((commit, index) => [commit.sha, { commit, index }]));
  const byShort = new Map(commits.map((commit, index) => [commit.short, { commit, index }]));
  const guides = overviewLaneGuides(commits, height);
  let paths = "";
  let nodes = "";
  let labels = "";
  commits.forEach((commit, index) => {
    const x1 = laneX[commit.lane] || laneX[0];
    const y1 = index * rowH + rowH / 2;
    const color = commit.color || laneColor(commit.lane);
    const isPrimaryNode = commit.lane === 0;
    const parents = commit.parents || [];
    const isMerge = parents.length > 1;
    nodes += graphNode(x1, y1, color, { primary: isPrimaryNode, merge: isMerge });
    const label = tipLabel(commit.refs);
    if (label) labels += graphLabel(x1, y1, label, color, false);
    if (!parents.length && index < commits.length - 1) {
      const next = commits[index + 1];
      paths += overviewCurve(x1, y1, laneX[next.lane] || laneX[0], (index + 1) * rowH + rowH / 2, color, { primary: isPrimaryNode && next.lane === 0 });
    }
    parents.forEach((parentSha, parentIndex) => {
      const parent = bySha.get(parentSha) || byShort.get(parentSha.slice(0, 7));
      if (!parent) {
        paths += overviewCurve(x1, y1, x1, Math.min(y1 + rowH, height), color, { primary: isPrimaryNode, secondary: parentIndex > 0 });
        return;
      }
      if (parent.index <= index) return;
      const parentColor = parent.commit.color || laneColor(parent.commit.lane);
      paths += overviewCurve(x1, y1, laneX[parent.commit.lane] || laneX[0], parent.index * rowH + rowH / 2, parentIndex > 0 ? parentColor : color, { primary: isPrimaryNode && parent.commit.lane === 0, secondary: parentIndex > 0 });
    });
  });
  return `
    <svg class="graph-lines overview" height="${height}" viewBox="0 0 ${graphWidth} ${height}" preserveAspectRatio="none" aria-hidden="true">
      <g class="lane-guides" fill="none" stroke-linecap="round">${guides}</g>
      <g fill="none" stroke-linecap="round" stroke-linejoin="round">${paths}</g>
      <g>${labels}</g>
      <g>${nodes}</g>
    </svg>
  `;
}

function renderBranchGraphSvg(commits, height, selectedRef) {
  const color = refColor(selectedRef);
  const x = laneX[0];
  let paths = "";
  let nodes = "";
  let labels = "";
  commits.forEach((commit, index) => {
    const y = index * rowH + rowH / 2;
    const parents = commit.parents || [];
    const isMerge = parents.length > 1;
    if (index < commits.length - 1) {
      const nextY = (index + 1) * rowH + rowH / 2;
      paths += branchMainLine(x, y, nextY, color);
    }
    if (isMerge) {
      const mergeX = laneX[2];
      paths += branchMergeHint(x, y, mergeX, color);
    }
    nodes += graphNode(x, y, color, { focused: true, merge: isMerge });
    if (index === 0) labels += graphLabel(x, y, selectedRef, color, true);
  });
  return `
    <svg class="graph-lines focus" height="${height}" viewBox="0 0 ${graphWidth} ${height}" preserveAspectRatio="none" aria-hidden="true">
      <g class="lane-guides" fill="none" stroke-linecap="round">${branchLaneGuide(x, height, color)}</g>
      <g fill="none" stroke-linecap="round" stroke-linejoin="round">${paths}</g>
      <g>${labels}</g>
      <g>${nodes}</g>
    </svg>
  `;
}

function layoutGraphCommits(visibleCommits, selectedRef) {
  if (selectedRef) return visibleCommits.map((commit) => ({ ...commit, lane: 0, color: refColor(selectedRef) }));
  if (!state.data?.commits?.length) return visibleCommits;
  const allCommits = state.data.commits;
  const bySha = new Map(allCommits.map((commit) => [commit.sha, commit]));
  const primary = primaryBranchName();
  const primaryLine = primaryLineSet(allCommits, primary);
  if (!primaryLine.size) return visibleCommits;

  const inheritedLane = new Map();
  const inheritedName = new Map();
  const laneBySha = new Map();
  const laneNameBySha = new Map();
  const namedLanes = new Map([[primary, 0]]);
  const nameByLane = new Map([[0, primary]]);
  let nextLane = 1;

  const allocateLane = (name = "") => {
    if (name && namedLanes.has(name)) return namedLanes.get(name);
    const lane = Math.min(nextLane, laneX.length - 1);
    if (name) namedLanes.set(name, lane);
    if (name && !nameByLane.has(lane)) nameByLane.set(lane, name);
    nextLane = Math.min(laneX.length - 1, nextLane + 1);
    return lane;
  };

  allCommits.forEach((commit) => {
    let lane = 0;
    let branchName = primary;
    if (!primaryLine.has(commit.sha)) {
      const branch = sideBranchName(commit, primary);
      lane = inheritedLane.get(commit.sha) ?? allocateLane(branch);
      branchName = inheritedName.get(commit.sha) || branch || nameByLane.get(lane) || "";
      if (branchName && !nameByLane.has(lane)) nameByLane.set(lane, branchName);
    }
    laneBySha.set(commit.sha, lane);
    laneNameBySha.set(commit.sha, branchName);
    (commit.parents || []).forEach((parentSha, parentIndex) => {
      if (primaryLine.has(parentSha) || inheritedLane.has(parentSha)) return;
      const parentCommit = bySha.get(parentSha);
      const parentName = parentCommit ? sideBranchName(parentCommit, primary) : "";
      const nextName = parentIndex === 0 ? branchName : parentName;
      const parentLane = parentIndex === 0 ? lane : allocateLane(nextName);
      inheritedLane.set(parentSha, parentLane);
      if (nextName) inheritedName.set(parentSha, nextName);
    });
  });

  return visibleCommits.map((commit) => {
    const lane = laneBySha.has(commit.sha) ? laneBySha.get(commit.sha) : Number(commit.lane) || 0;
    const branchName = laneNameBySha.get(commit.sha) || "";
    return { ...commit, lane, color: branchName ? refColor(branchName) : laneColor(lane) };
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

function overviewCurve(x1, y1, x2, y2, color, options = {}) {
  const mid = (y1 + y2) / 2;
  const d = `M ${x1} ${y1} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}`;
  const secondary = Boolean(options.secondary);
  const primary = Boolean(options.primary);
  return `<path d="${d}" stroke="${color}" stroke-width="${secondary ? 4.2 : primary ? 5 : 3.2}" opacity="${secondary ? 0.8 : primary ? 0.92 : 0.7}" ${secondary ? 'stroke-dasharray="8 5"' : ""} />`;
}

function branchMainLine(x, y1, y2, color) {
  return `
    <path d="M ${x} ${y1} L ${x} ${y2}" stroke="${color}" stroke-width="14" opacity="0.14" />
    <path d="M ${x} ${y1} L ${x} ${y2}" stroke="${color}" stroke-width="5" opacity="0.95" />
  `;
}

function branchMergeHint(x, y, mergeX, color) {
  const controlX = (x + mergeX) / 2;
  return `
    <path d="M ${mergeX} ${y - 16} C ${controlX} ${y - 16}, ${controlX} ${y}, ${x} ${y}" stroke="${color}" stroke-width="9" opacity="0.12" />
    <path d="M ${mergeX} ${y - 16} C ${controlX} ${y - 16}, ${controlX} ${y}, ${x} ${y}" stroke="${color}" stroke-width="4" opacity="0.72" stroke-dasharray="7 5" />
  `;
}

function overviewLaneGuides(commits, height) {
  const lanes = [...new Set(commits.map((commit) => Number(commit.lane) || 0))].sort((a, b) => a - b);
  const colorByLane = new Map();
  commits.forEach((commit) => {
    const lane = Number(commit.lane) || 0;
    if (!colorByLane.has(lane) && commit.color) colorByLane.set(lane, commit.color);
  });
  return lanes
    .map((lane) => {
      const x = laneX[lane] || laneX[0];
      const color = colorByLane.get(lane) || laneColor(lane);
      if (lane === 0) {
        return `<line x1="${x}" y1="8" x2="${x}" y2="${Math.max(8, height - 8)}" stroke="${color}" stroke-width="18" opacity="0.13" />`;
      }
      return `<line x1="${x}" y1="8" x2="${x}" y2="${Math.max(8, height - 8)}" stroke="${color}" stroke-width="1.6" opacity="${lane < 4 ? 0.3 : 0.18}" stroke-dasharray="2 8" />`;
    })
    .join("");
}

function branchLaneGuide(x, height, color) {
  return `<line x1="${x}" y1="8" x2="${x}" y2="${Math.max(8, height - 8)}" stroke="${color}" stroke-width="22" opacity="0.13" />`;
}

function graphNode(x, y, color, options = {}) {
  const selected = Boolean(options.focused);
  const primary = Boolean(options.primary);
  const merge = Boolean(options.merge);
  const radius = merge ? 8.2 : selected ? 7.4 : primary ? 6.9 : 6.4;
  return `
    <circle cx="${x}" cy="${y}" r="${merge ? 17 : selected ? 15 : primary ? 13 : 12}" fill="${color}" opacity="${merge ? 0.22 : selected ? 0.18 : primary ? 0.14 : 0.1}" />
    <circle cx="${x}" cy="${y}" r="${merge ? 12 : selected || primary ? 10 : 9}" fill="var(--graph-node-fill)" stroke="var(--graph-node-ring)" stroke-width="3.2" />
    <circle cx="${x}" cy="${y}" r="${radius}" fill="var(--graph-node-fill)" stroke="${color}" stroke-width="${merge ? 4.1 : selected ? 3.6 : primary ? 3.5 : 3.1}" />
    ${merge ? `<circle cx="${x}" cy="${y}" r="3.1" fill="${color}" opacity="0.98" />` : `<circle cx="${x}" cy="${y}" r="2.3" fill="${color}" opacity="0.96" />`}
  `;
}

function graphLabel(x, y, label, color, selected) {
  const maxChars = selected ? 8 : 7;
  const text = escapeHtml(label.length > maxChars ? `${label.slice(0, maxChars)}...` : label);
  const width = Math.min(76, Math.max(42, [...text].length * 9 + 16));
  const labelX = Math.min(x + 12, graphWidth - 6 - width);
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
  if (!sha || state.commitDetails.has(sha) || state.loadingCommitDetails.has(sha)) return;
  const commit = state.data.commits.find((item) => item.sha === sha);
  if (commit?.files?.length || commit?.diff?.length) {
    state.commitDetails.set(sha, { files: commit.files || [], diff: commit.diff || [] });
    return;
  }
  state.loadingCommitDetails.add(sha);
  try {
    const detail = await api(`/api/commit?sha=${encodeURIComponent(sha)}`);
    state.commitDetails.set(sha, detail);
  } catch (error) {
    toast(error.message);
  } finally {
    state.loadingCommitDetails.delete(sha);
  }
}

