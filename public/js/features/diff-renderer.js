// Side-by-side diff rendering and patch parsing helpers.
const SIDE_DIFF_INITIAL_RENDER_LINES = 1000;

function renderSideDiff(diff, emptyText, options = {}) {
  const feedback = renderWorkDiffFeedback(options);
  if (!diff?.length) return `${feedback}<div class="diff-empty">${escapeHtml(t(emptyText))}</div>`;
  const visibleCount = sideDiffVisibleCount(diff.length, options.maxLines);
  const visibleDiff = visibleCount < diff.length ? diff.slice(0, visibleCount) : diff;
  const lineAction = options.lineAction && diffHasSelectableLines(visibleDiff) ? options.lineAction : null;
  const targetHunks = highlightedWorkDiffHunks(visibleDiff, workDiffFeedbackForFile(options.filePath || ""));
  const columnWidths = diffColumnCharacterWidths(visibleDiff);
  return `
    <div class="side-diff ${lineAction ? "line-selectable" : ""} ${feedback ? "has-work-feedback" : ""}" style="--diff-old-ch:${columnWidths.old};--diff-new-ch:${columnWidths.new}">
      ${feedback}
      ${lineAction ? renderDiffLineToolbar(lineAction) : ""}
      <div class="side-diff-head"><span>${t("旧版本")}</span><span>${t("新版本")}</span></div>
      ${sideBySideRows(visibleDiff, { ...options, lineAction, targetHunks })}
      ${renderSideDiffLoadMore(diff.length, visibleCount, options.loadMoreTarget)}
    </div>
  `;
}

function sideDiffVisibleCount(total, requested) {
  if (!Number.isInteger(requested) || requested <= 0) return total;
  return Math.min(total, requested);
}

function renderSideDiffLoadMore(total, shown, target) {
  if (!target || shown >= total) return "";
  const nextLimit = Math.min(total, Math.max(SIDE_DIFF_INITIAL_RENDER_LINES, shown * 2));
  return `
    <div class="side-diff-more">
      <span>${escapeHtml(t("大差异已分批显示：{shown} / {total} 行", { shown, total }))}</span>
      <button class="mini-btn" data-side-diff-more="${escapeAttr(target)}" data-next-limit="${nextLimit}" type="button">${escapeHtml(t("继续加载到 {count} 行", { count: nextLimit }))}</button>
    </div>
  `;
}

function expandSideDiff(button) {
  const target = button?.dataset?.sideDiffMore || "";
  const nextLimit = Number.parseInt(button?.dataset?.nextLimit || "", 10);
  if (!Number.isInteger(nextLimit) || nextLimit <= 0) return;
  if (target === "modal") {
    const scrollTop = els.diffModalBody?.scrollTop;
    state.diffModalRenderLimit = nextLimit;
    renderDiffModalBody();
    if (Number.isFinite(scrollTop)) els.diffModalBody.scrollTop = scrollTop;
  }
}

function diffColumnCharacterWidths(diff) {
  let old = 0;
  let next = 0;
  for (const line of diff || []) {
    if (line?.type === "meta") continue;
    const width = diffTextVisualWidth(trimDiffPrefix(line?.text));
    if (line?.type !== "add") old = Math.max(old, width);
    if (line?.type !== "del") next = Math.max(next, width);
  }
  return { old: Math.max(48, old), new: Math.max(48, next) };
}

function diffTextVisualWidth(text) {
  let width = 0;
  for (const char of String(text || "")) {
    if (char === "\t") {
      width += 4 - (width % 4);
      continue;
    }
    width += char.codePointAt(0) > 0xff ? 2 : 1;
  }
  return width;
}

function diffHasSelectableLines(diff) {
  return (diff || []).some((line) => (line.type === "add" || line.type === "del") && Number.isInteger(line.hunkIndex));
}

function diffModalOptions() {
  const active = state.activeDiff || {};
  if (active.source !== "worktree") return {};
  return {
    hunkActions: true,
    lineAction: selectedDiffLineAction(active.path, active.scope),
    filePath: active.path,
    scope: active.scope,
  };
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
  return block.some((line) => diffLinePaths(line).some((filePath) => filePath === target));
}

function diffLinePaths(line) {
  const text = String(line?.text || "");
  if (text.startsWith("diff --git ")) return diffHeaderPaths(text);
  if (text.startsWith("--- ") || text.startsWith("+++ ")) return [normalizeDiffPathToken(text.slice(4))].filter(Boolean);
  if (text.startsWith("rename from ")) return [normalizeDiffPath(text.slice("rename from ".length))].filter(Boolean);
  if (text.startsWith("rename to ")) return [normalizeDiffPath(text.slice("rename to ".length))].filter(Boolean);
  if (text.startsWith("copy from ")) return [normalizeDiffPath(text.slice("copy from ".length))].filter(Boolean);
  if (text.startsWith("copy to ")) return [normalizeDiffPath(text.slice("copy to ".length))].filter(Boolean);
  return [];
}

function diffHeaderPaths(text) {
  const match = String(text || "").match(/^diff --git a\/(.+) b\/\1$/);
  return match ? [normalizeDiffPath(match[1])] : [];
}

function normalizeDiffPathToken(value) {
  const normalized = normalizeDiffPath(value).replace(/\t.*$/, "");
  if (!normalized || normalized === "/dev/null") return "";
  return normalized.replace(/^[ab]\//, "");
}

function normalizeDiffPath(value) {
  return String(value || "").replaceAll("\\", "/").replace(/^"|"$/g, "");
}

function sideBySideRows(diff, options = {}) {
  const rows = [];
  let oldLine = 0;
  let newLine = 0;
  let hunkLineIndex = -1;
  for (let index = 0; index < diff.length; index++) {
    const line = diff[index];
    const text = String(line.text || "");
    if (line.type === "meta") {
      const hunk = text.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (hunk) {
        oldLine = Number(hunk[1]) - 1;
        newLine = Number(hunk[2]) - 1;
        hunkLineIndex = -1;
      }
      rows.push(renderSideMetaRow(line, text, options));
      continue;
    }
    const pairedAddIndex = pairedAddLineIndex(diff, index);
    if (line.type === "del" && pairedAddIndex > index) {
      const addLine = diff[pairedAddIndex];
      const delLineIndex = nextHunkLineIndex(line, hunkLineIndex);
      hunkLineIndex = delLineIndex;
      const addLineIndex = nextHunkLineIndex(addLine, hunkLineIndex);
      hunkLineIndex = addLineIndex;
      oldLine += 1;
      newLine += 1;
      rows.push(sideRow("mod", oldLine, trimDiffPrefix(text), "del", newLine, trimDiffPrefix(addLine.text), "add", {
        lineKeys: diffLineKeys(options, [
          { hunkIndex: line.hunkIndex, lineIndex: delLineIndex },
          { hunkIndex: addLine.hunkIndex, lineIndex: addLineIndex },
        ]),
      }));
      for (let metaIndex = index + 1; metaIndex < pairedAddIndex; metaIndex += 1) {
        rows.push(renderSideMetaRow(diff[metaIndex], String(diff[metaIndex].text || ""), options));
      }
      if (diff[pairedAddIndex + 1] && isNoNewlineMeta(diff[pairedAddIndex + 1])) {
        rows.push(renderSideMetaRow(diff[pairedAddIndex + 1], String(diff[pairedAddIndex + 1].text || ""), options));
        index = pairedAddIndex + 1;
      } else {
        index = pairedAddIndex;
      }
      continue;
    }
    if (line.type === "del") {
      hunkLineIndex = nextHunkLineIndex(line, hunkLineIndex);
      oldLine += 1;
      rows.push(sideRow("del", oldLine, trimDiffPrefix(text), "del", "", "", "blank", {
        lineKeys: diffLineKeys(options, [{ hunkIndex: line.hunkIndex, lineIndex: hunkLineIndex }]),
      }));
      continue;
    }
    if (line.type === "add") {
      hunkLineIndex = nextHunkLineIndex(line, hunkLineIndex);
      newLine += 1;
      rows.push(sideRow("add", "", "", "blank", newLine, trimDiffPrefix(text), "add", {
        lineKeys: diffLineKeys(options, [{ hunkIndex: line.hunkIndex, lineIndex: hunkLineIndex }]),
      }));
      continue;
    }
    hunkLineIndex = nextHunkLineIndex(line, hunkLineIndex);
    oldLine += 1;
    newLine += 1;
    rows.push(sideRow("ctx", oldLine, trimDiffPrefix(text), "", newLine, trimDiffPrefix(text), ""));
  }
  return rows.join("");
}

function pairedAddLineIndex(diff, delIndex) {
  if (diff[delIndex]?.type !== "del") return -1;
  if (diff[delIndex + 1]?.type === "add") return delIndex + 1;
  if (isNoNewlineMeta(diff[delIndex + 1]) && diff[delIndex + 2]?.type === "add") return delIndex + 2;
  return -1;
}

function isNoNewlineMeta(line) {
  return line?.type === "meta" && String(line.text || "").startsWith("\\ No newline at end of file");
}

function nextHunkLineIndex(line, current) {
  return Number.isInteger(line?.hunkIndex) ? current + 1 : current;
}

function diffLineKeys(options, lines) {
  if (!options.lineAction) return [];
  return lines
    .filter((line) => Number.isInteger(line.hunkIndex) && Number.isInteger(line.lineIndex) && line.lineIndex >= 0)
    .map((line) => diffLineKey(line.hunkIndex, line.lineIndex));
}

function diffLineKey(hunkIndex, lineIndex) {
  return `${hunkIndex}:${lineIndex}`;
}

function renderDiffLineToolbar(action) {
  return `
    <div class="diff-line-toolbar">
      <span data-selected-line-count>${t("未选择行")}</span>
      <button class="mini-btn" data-line-action="${escapeAttr(action.action)}" type="button" disabled title="${escapeAttr(action.title)}">${escapeHtml(action.label)}</button>
    </div>
  `;
}

function renderSideMetaRow(line, text, options = {}) {
  const actions = options.hunkActions && text.startsWith("@@ ") ? workDiffHunkActionButtons(options.filePath, options.scope, line.hunkIndex) : "";
  const hunkSummary = readableHunkHeader(text);
  const target = options.targetHunks?.has(line.hunkIndex);
  return `
    <div class="side-row meta ${actions ? "has-actions" : ""} ${target ? "work-diff-target" : ""}">
      <div class="side-meta">
        <span class="side-meta-text ${hunkSummary ? "hunk-summary" : ""}" title="${escapeAttr(text)}">${escapeHtml(hunkSummary || text)}</span>
        ${actions}
      </div>
    </div>
  `;
}

function readableHunkHeader(text) {
  const range = parseDiffHunkRange(text);
  if (!range) return "";
  const { oldStart, oldCount, newStart, newCount } = range;
  return t("改动位置：旧版第 {oldStart} 行，新版第 {newStart} 行；范围：旧 {oldCount} 行，新 {newCount} 行", {
    oldStart,
    newStart,
    oldCount,
    newCount,
  });
}

function parseDiffHunkRange(text) {
  const match = String(text || "").match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
  if (!match) return null;
  return {
    oldStart: Number(match[1]),
    oldCount: Number(match[2] || 1),
    newStart: Number(match[3]),
    newCount: Number(match[4] || 1),
  };
}

function workDiffHunkActionButtons(filePath, scope, hunkIndex) {
  if (!Number.isInteger(hunkIndex)) return "";
  const fileInfo = selectedWorkingFileInfo(filePath, scope);
  if (!fileInfo || fileInfo.conflict) return "";
  const untracked = isUntrackedFile(fileInfo);
  const normalizedScope = scope === "staged" ? "staged" : scope === "untracked" ? "untracked" : scope === "unstaged" ? "unstaged" : "";
  if (normalizedScope === "untracked" && untracked && fileInfo.unstaged) {
    return `
      <span class="hunk-actions">
        <button class="mini-btn" data-hunk-action="stageHunk" data-hunk-index="${escapeAttr(String(hunkIndex))}" data-hunk-scope="untracked" type="button" title="${t("把这个未跟踪文件片段加入暂存区")}">${t("暂存这段")}</button>
      </span>
    `;
  }
  if (untracked) return "";
  if (normalizedScope === "unstaged" && fileInfo.unstaged) {
    return `
      <span class="hunk-actions">
        <button class="mini-btn" data-hunk-action="stageHunk" data-hunk-index="${escapeAttr(String(hunkIndex))}" data-hunk-scope="unstaged" type="button">${t("暂存这段")}</button>
        <button class="mini-btn danger" data-hunk-action="discardWorktreeHunk" data-hunk-index="${escapeAttr(String(hunkIndex))}" data-hunk-scope="unstaged" type="button">${t("丢弃这段")}</button>
      </span>
    `;
  }
  if (normalizedScope === "staged" && fileInfo.staged) {
    return `
      <span class="hunk-actions">
        <button class="mini-btn" data-hunk-action="unstageHunk" data-hunk-index="${escapeAttr(String(hunkIndex))}" data-hunk-scope="staged" type="button">${t("取消暂存这段")}</button>
      </span>
    `;
  }
  return "";
}

function workDiffScopeLabel(scope) {
  if (scope === "staged") return t("已暂存");
  if (scope === "untracked") return t("未跟踪");
  return t("未暂存");
}

function sideRow(type, oldNo, oldText, oldClass, newNo, newText, newClass, options = {}) {
  const lineKeys = options.lineKeys || [];
  const selected = lineKeys.some((key) => state.selectedDiffLines.has(key));
  const attrs = lineKeys.length
    ? ` data-diff-line-key="${escapeAttr(lineKeys[0])}" data-diff-line-keys="${escapeAttr(lineKeys.join(","))}"`
    : "";
  return `
    <div class="side-row ${type} ${lineKeys.length ? "diff-line-selectable" : ""} ${selected ? "selected" : ""}"${attrs}>
      <div class="side-cell old ${oldClass}">
        <span class="ln">${escapeHtml(oldNo)}</span><code>${escapeHtml(oldText)}</code>
      </div>
      <div class="side-cell new ${newClass}">
        <span class="ln">${escapeHtml(newNo)}</span><code>${escapeHtml(newText)}</code>
      </div>
    </div>
  `;
}

function selectedDiffLineAction(filePath, scope) {
  const fileInfo = selectedWorkingFileInfo(filePath, scope);
  if (!fileInfo || fileInfo.conflict) return null;
  if ((scope === "unstaged" || (scope === "untracked" && isUntrackedFile(fileInfo))) && fileInfo.unstaged) {
    return { action: "stageSelectedLines", label: t("暂存所选行"), title: t("暂存当前 Diff 中选中的行") };
  }
  if (scope === "staged" && fileInfo.staged) {
    return { action: "unstageSelectedLines", label: t("取消暂存所选行"), title: t("把已暂存 Diff 中选中的行退回工作区") };
  }
  return null;
}

function trimDiffPrefix(text) {
  return String(text || "").replace(/^[-+ ]/, "");
}
