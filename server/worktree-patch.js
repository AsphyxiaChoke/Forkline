"use strict";



function normalizeHunkIndex(value) {
  const index = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isInteger(index) || index < 0 || index > 200) throw new Error("改动块序号不合法，请刷新后再试。");
  return index;
}

function normalizeDiffLineSelections(value) {
  if (!Array.isArray(value) || !value.length) throw new Error("请选择要暂存的 Diff 行。");
  if (value.length > 300) throw new Error("一次最多暂存 300 行，请分批操作。");
  const seen = new Set();
  const lines = [];
  for (const item of value) {
    const hunkIndex = normalizeHunkIndex(item?.hunkIndex);
    const lineIndex = Number.parseInt(String(item?.lineIndex ?? ""), 10);
    if (!Number.isInteger(lineIndex) || lineIndex < 0 || lineIndex > 10000) throw new Error("Diff 行号不合法，请刷新后再试。");
    const key = `${hunkIndex}:${lineIndex}`;
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push({ hunkIndex, lineIndex, key });
  }
  if (!lines.length) throw new Error("请选择要暂存的 Diff 行。");
  return lines;
}

function extractSelectedLinePatch(diffOutput, selectedLines, mode = "stage") {
  const text = String(diffOutput || "");
  if (!text.trim()) throw new Error("没有可操作的 Diff 行。");
  const selectedKeys = new Set(selectedLines.map((line) => line.key));
  const matchedKeys = new Set();
  const lines = text.split("\n");
  if (lines[lines.length - 1] === "") lines.pop();
  const header = [];
  const hunks = [];
  let current = null;
  let hunkIndex = -1;
  for (const line of lines) {
    if (line.startsWith("@@ ")) {
      if (current) hunks.push(current);
      hunkIndex += 1;
      current = { ...parseUnifiedHunkHeader(line), index: hunkIndex, lines: [] };
      continue;
    }
    if (current) {
      current.lines.push(line);
      continue;
    }
    if (line) header.push(line);
  }
  if (current) hunks.push(current);
  if (!header.length || !hunks.length) throw new Error("没有可操作的 Diff 行。");
  if (mode === "stage-deleted-file") {
    return extractDeletedFileStageLinePatch(header, hunks, selectedKeys, matchedKeys);
  }
  if (mode === "unstage-new-file") {
    return extractNewFileUnstageLinePatch(header, hunks, selectedKeys, matchedKeys);
  }
  if (mode === "unstage-moved-file") {
    return extractMovedFileUnstageLinePatch(header, hunks, selectedKeys, matchedKeys);
  }
  const selectedHunks = hunks
    .map((hunk) => buildSelectedLineHunk(hunk, selectedKeys, matchedKeys, mode))
    .filter(Boolean);
  if (!selectedHunks.length) throw new Error("请选择新增或删除行，普通上下文行不能单独暂存。");
  if (matchedKeys.size !== selectedKeys.size) throw new Error("部分 Diff 行已经变化，请刷新后再试。");
  return [...header, ...selectedHunks].join("\n").replace(/\n*$/, "\n");
}

function parseUnifiedHunkHeader(line) {
  const match = String(line || "").match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
  if (!match) throw new Error("Diff 块头不合法，请刷新后再试。");
  return {
    oldStart: Number(match[1]),
    oldCount: match[2] === undefined ? 1 : Number(match[2]),
    newStart: Number(match[3]),
    newCount: match[4] === undefined ? 1 : Number(match[4]),
  };
}

function isNewFileDiffOutput(diffOutput) {
  return /(?:^|\n)--- \/dev\/null\n\+\+\+ /.test(String(diffOutput || "").replace(/\r\n/g, "\n"));
}

function isDeletedFileDiffOutput(diffOutput) {
  return /(?:^|\n)--- .+\n\+\+\+ \/dev\/null/.test(String(diffOutput || "").replace(/\r\n/g, "\n"));
}

function isMovedFileDiffOutput(diffOutput) {
  return /(?:^|\n)(rename|copy) (from|to) /.test(String(diffOutput || "").replace(/\r\n/g, "\n"));
}

function extractDeletedFileStageLinePatch(header, hunks, selectedKeys, matchedKeys) {
  const delKeys = collectSelectableDelLineKeys(hunks);
  const selectedDelKeys = delKeys.filter((key) => selectedKeys.has(key));
  if (!selectedDelKeys.length) throw new Error("请选择删除行，普通上下文行不能单独暂存。");
  const allDeletedLinesSelected = selectedDelKeys.length === delKeys.length;
  const patchHeader = deletedFileStagePatchHeader(header, allDeletedLinesSelected);
  const selectedHunks = hunks
    .map((hunk) => buildDeletedFileStageLineHunk(hunk, selectedKeys, matchedKeys, allDeletedLinesSelected))
    .filter(Boolean);
  if (!selectedHunks.length) throw new Error("请选择删除行，普通上下文行不能单独暂存。");
  if (matchedKeys.size !== selectedKeys.size) throw new Error("部分 Diff 行已经变化，请刷新后再试。");
  return [...patchHeader, ...selectedHunks].join("\n").replace(/\n*$/, "\n");
}

function extractNewFileUnstageLinePatch(header, hunks, selectedKeys, matchedKeys) {
  const addKeys = collectSelectableAddLineKeys(hunks);
  const selectedAddKeys = addKeys.filter((key) => selectedKeys.has(key));
  if (!selectedAddKeys.length) throw new Error("请选择新增行，普通上下文行不能单独取消暂存。");
  const allAddedLinesSelected = selectedAddKeys.length === addKeys.length;
  const patchHeader = newFileUnstagePatchHeader(header, allAddedLinesSelected);
  const selectedHunks = hunks
    .map((hunk) => buildNewFileUnstageLineHunk(hunk, selectedKeys, matchedKeys, allAddedLinesSelected))
    .filter(Boolean);
  if (!selectedHunks.length) throw new Error("请选择新增行，普通上下文行不能单独取消暂存。");
  if (matchedKeys.size !== selectedKeys.size) throw new Error("部分 Diff 行已经变化，请刷新后再试。");
  return [...patchHeader, ...selectedHunks].join("\n").replace(/\n*$/, "\n");
}

function extractMovedFileUnstageLinePatch(header, hunks, selectedKeys, matchedKeys) {
  const selectedChangeKeys = collectSelectableAddLineKeys(hunks)
    .concat(collectSelectableDelLineKeys(hunks))
    .filter((key) => selectedKeys.has(key));
  if (!selectedChangeKeys.length) throw new Error("请选择新增或删除行，普通上下文行不能单独取消暂存。");
  const patchHeader = movedFileUnstagePatchHeader(header);
  const selectedHunks = hunks
    .map((hunk) => buildMovedFileUnstageLineHunk(hunk, selectedKeys, matchedKeys))
    .filter(Boolean);
  if (!selectedHunks.length) throw new Error("请选择新增或删除行，普通上下文行不能单独取消暂存。");
  if (matchedKeys.size !== selectedKeys.size) throw new Error("部分 Diff 行已经变化，请刷新后再试。");
  return [...patchHeader, ...selectedHunks].join("\n").replace(/\n*$/, "\n");
}

function collectSelectableAddLineKeys(hunks) {
  const keys = [];
  hunks.forEach((hunk) => {
    let selectableLineIndex = -1;
    hunk.lines.forEach((line) => {
      if (line.startsWith("\\")) return;
      selectableLineIndex += 1;
      if (line.startsWith("+")) keys.push(`${hunk.index}:${selectableLineIndex}`);
    });
  });
  return keys;
}

function collectSelectableDelLineKeys(hunks) {
  const keys = [];
  hunks.forEach((hunk) => {
    let selectableLineIndex = -1;
    hunk.lines.forEach((line) => {
      if (line.startsWith("\\")) return;
      selectableLineIndex += 1;
      if (line.startsWith("-")) keys.push(`${hunk.index}:${selectableLineIndex}`);
    });
  });
  return keys;
}

function deletedFileStagePatchHeader(header, deleteFile = false) {
  const diffLine = header.find((line) => line.startsWith("diff --git ")) || header[0];
  const oldPathLine = header.find((line) => line.startsWith("--- "));
  if (!oldPathLine || oldPathLine === "--- /dev/null") throw new Error("删除文件 Diff 头不完整，请刷新后再试。");
  const oldPath = oldPathLine.slice(4);
  const newPath = oldPath.startsWith("a/") ? `b/${oldPath.slice(2)}` : oldPath;
  const modeLine = header.find((line) => line.startsWith("deleted file mode "));
  if (deleteFile) {
    return [diffLine, modeLine || "", oldPathLine, "+++ /dev/null"].filter(Boolean);
  }
  return [diffLine, oldPathLine, `+++ ${newPath}`];
}

function newFileUnstagePatchHeader(header, deleteFile = false) {
  const diffLine = header.find((line) => line.startsWith("diff --git ")) || header[0];
  const newPathLine = header.find((line) => line.startsWith("+++ "));
  if (!newPathLine || newPathLine === "+++ /dev/null") throw new Error("新文件 Diff 头不完整，请刷新后再试。");
  const newPath = newPathLine.slice(4);
  const oldPath = newPath.startsWith("b/") ? `a/${newPath.slice(2)}` : newPath;
  const modeLine = header.find((line) => line.startsWith("new file mode "));
  if (deleteFile) {
    return [diffLine, modeLine ? `deleted file mode ${modeLine.slice("new file mode ".length)}` : "", `--- ${oldPath}`, "+++ /dev/null"].filter(Boolean);
  }
  return [diffLine, `--- ${oldPath}`, newPathLine];
}

function movedFileUnstagePatchHeader(header) {
  const newPathLine = header.find((line) => line.startsWith("+++ "));
  if (!newPathLine || newPathLine === "+++ /dev/null") throw new Error("重命名文件 Diff 头不完整，请刷新后再试。");
  const newPath = stripDiffPathSuffix(newPathLine.slice(4));
  const oldPath = newPath.startsWith("b/") ? `a/${newPath.slice(2)}` : newPath;
  return [`diff --git ${oldPath} ${newPath}`, `--- ${oldPath}`, `+++ ${newPath}`];
}

function stripDiffPathSuffix(value) {
  return String(value || "").replace(/\t.*$/, "");
}

function buildDeletedFileStageLineHunk(hunk, selectedKeys, matchedKeys, deleteFile = false) {
  const lines = [];
  let changed = false;
  let selectableLineIndex = -1;
  hunk.lines.forEach((line) => {
    const selectable = !line.startsWith("\\");
    if (selectable) selectableLineIndex += 1;
    const key = selectable ? `${hunk.index}:${selectableLineIndex}` : "";
    const selected = selectedKeys.has(key);
    if (line.startsWith("-")) {
      if (selected || deleteFile) {
        lines.push(line);
        if (selected) matchedKeys.add(key);
        changed = true;
      } else {
        lines.push(` ${line.slice(1)}`);
      }
      return;
    }
    if (line.startsWith("\\")) lines.push(line);
  });
  if (!changed) return "";
  const counts = countUnifiedHunkLines(lines);
  const newStart = deleteFile ? 0 : hunk.oldStart;
  const newCount = deleteFile ? 0 : counts.newCount;
  return [
    `@@ -${formatUnifiedRange(hunk.oldStart, counts.oldCount)} +${formatUnifiedRange(newStart, newCount)} @@`,
    ...lines,
  ].join("\n");
}

function buildNewFileUnstageLineHunk(hunk, selectedKeys, matchedKeys, deleteFile = false) {
  const lines = [];
  let changed = false;
  let selectableLineIndex = -1;
  hunk.lines.forEach((line) => {
    const selectable = !line.startsWith("\\");
    if (selectable) selectableLineIndex += 1;
    const key = selectable ? `${hunk.index}:${selectableLineIndex}` : "";
    const selected = selectedKeys.has(key);
    if (line.startsWith("+")) {
      if (selected || deleteFile) {
        lines.push(`-${line.slice(1)}`);
        if (selected) matchedKeys.add(key);
        changed = true;
      } else {
        lines.push(` ${line.slice(1)}`);
      }
      return;
    }
    if (line.startsWith("\\")) lines.push(line);
  });
  if (!changed) return "";
  const counts = countUnifiedHunkLines(lines);
  const newStart = deleteFile ? 0 : hunk.newStart;
  const newCount = deleteFile ? 0 : counts.newCount;
  return [
    `@@ -${formatUnifiedRange(hunk.newStart, counts.oldCount)} +${formatUnifiedRange(newStart, newCount)} @@`,
    ...lines,
  ].join("\n");
}

function buildMovedFileUnstageLineHunk(hunk, selectedKeys, matchedKeys) {
  const lines = [];
  let changed = false;
  let selectableLineIndex = -1;
  let previousDiffLineIncluded = false;
  hunk.lines.forEach((line) => {
    if (line.startsWith("\\")) {
      if (previousDiffLineIncluded) lines.push(line);
      return;
    }
    previousDiffLineIncluded = false;
    const selectable = !line.startsWith("\\");
    if (selectable) selectableLineIndex += 1;
    const key = selectable ? `${hunk.index}:${selectableLineIndex}` : "";
    const selected = selectedKeys.has(key);
    if (line.startsWith("+")) {
      if (selected) {
        lines.push(`-${line.slice(1)}`);
        matchedKeys.add(key);
        changed = true;
        previousDiffLineIncluded = true;
      } else {
        lines.push(` ${line.slice(1)}`);
        previousDiffLineIncluded = true;
      }
      return;
    }
    if (line.startsWith("-")) {
      if (selected) {
        lines.push(`+${line.slice(1)}`);
        matchedKeys.add(key);
        changed = true;
        previousDiffLineIncluded = true;
      }
      return;
    }
    if (selected) matchedKeys.add(key);
    lines.push(line);
    previousDiffLineIncluded = true;
  });
  if (!changed) return "";
  const counts = countUnifiedHunkLines(lines);
  return [
    `@@ -${formatUnifiedRange(hunk.newStart, counts.oldCount)} +${formatUnifiedRange(hunk.newStart, counts.newCount)} @@`,
    ...lines,
  ].join("\n");
}

function buildSelectedLineHunk(hunk, selectedKeys, matchedKeys, mode = "stage") {
  const lines = [];
  let changed = false;
  let selectableLineIndex = -1;
  let previousDiffLineIncluded = false;
  hunk.lines.forEach((line) => {
    if (line.startsWith("\\")) {
      if (previousDiffLineIncluded) lines.push(line);
      return;
    }
    previousDiffLineIncluded = false;
    const selectable = !line.startsWith("\\");
    if (selectable) selectableLineIndex += 1;
    const key = selectable ? `${hunk.index}:${selectableLineIndex}` : "";
    const selected = selectedKeys.has(key);
    if (line.startsWith("+")) {
      if (selected) {
        lines.push(line);
        matchedKeys.add(key);
        changed = true;
        previousDiffLineIncluded = true;
      } else if (mode === "unstage") {
        lines.push(` ${line.slice(1)}`);
        previousDiffLineIncluded = true;
      }
      return;
    }
    if (line.startsWith("-")) {
      if (selected) {
        lines.push(line);
        matchedKeys.add(key);
        changed = true;
        previousDiffLineIncluded = true;
      } else {
        if (mode === "stage") {
          lines.push(` ${line.slice(1)}`);
          previousDiffLineIncluded = true;
        }
      }
      return;
    }
    if (selected) matchedKeys.add(key);
    lines.push(line);
    previousDiffLineIncluded = true;
  });
  if (!changed) return "";
  const counts = countUnifiedHunkLines(lines);
  const newStart = hunk.oldStart === 0 ? hunk.newStart : hunk.oldStart;
  return [
    `@@ -${formatUnifiedRange(hunk.oldStart, counts.oldCount)} +${formatUnifiedRange(newStart, counts.newCount)} @@`,
    ...lines,
  ].join("\n");
}

function countUnifiedHunkLines(lines) {
  return lines.reduce((counts, line) => {
    if (line.startsWith("\\")) return counts;
    if (line.startsWith("+")) counts.newCount += 1;
    else if (line.startsWith("-")) counts.oldCount += 1;
    else {
      counts.oldCount += 1;
      counts.newCount += 1;
    }
    return counts;
  }, { oldCount: 0, newCount: 0 });
}

function formatUnifiedRange(start, count) {
  return count === 1 ? String(start) : `${start},${count}`;
}

function extractSingleHunkPatch(diffOutput, targetHunkIndex) {
  const lines = String(diffOutput || "").split("\n");
  if (!lines.length || !String(diffOutput || "").trim()) throw new Error("没有可操作的 Diff 块。");
  const header = [];
  const hunk = [];
  let currentHunk = -1;
  let collecting = false;
  for (const line of lines) {
    if (line.startsWith("diff --git ") && currentHunk >= 0) break;
    if (line.startsWith("@@ ")) {
      currentHunk += 1;
      collecting = currentHunk === targetHunkIndex;
      if (collecting) hunk.push(line);
      continue;
    }
    if (currentHunk < 0) {
      if (line !== "") header.push(line);
      continue;
    }
    if (collecting) hunk.push(line);
  }
  if (!hunk.length) throw new Error("找不到这个改动块，请刷新后再试。");
  return [...header, ...hunk].join("\n").replace(/\n*$/, "\n");
}

function extractMovedFileUnstageHunkPatch(diffOutput, targetHunkIndex) {
  const lines = String(diffOutput || "").split("\n");
  if (lines[lines.length - 1] === "") lines.pop();
  if (!lines.length || !String(diffOutput || "").trim()) throw new Error("没有可操作的 Diff 块。");
  const header = [];
  const hunk = [];
  let hunkHeader = "";
  let currentHunk = -1;
  let collecting = false;
  for (const line of lines) {
    if (line.startsWith("diff --git ") && currentHunk >= 0) break;
    if (line.startsWith("@@ ")) {
      currentHunk += 1;
      collecting = currentHunk === targetHunkIndex;
      if (collecting) hunkHeader = line;
      continue;
    }
    if (currentHunk < 0) {
      if (line !== "") header.push(line);
      continue;
    }
    if (collecting) hunk.push(line);
  }
  if (!hunkHeader) throw new Error("找不到这个改动块，请刷新后再试。");
  const parsed = parseUnifiedHunkHeader(hunkHeader);
  const linesForNewPath = [];
  let changed = false;
  hunk.forEach((line) => {
    if (line.startsWith("+")) {
      linesForNewPath.push(`-${line.slice(1)}`);
      changed = true;
      return;
    }
    if (line.startsWith("-")) {
      linesForNewPath.push(`+${line.slice(1)}`);
      changed = true;
      return;
    }
    linesForNewPath.push(line);
  });
  if (!changed) throw new Error("这个改动块没有可取消暂存的内容行。");
  const counts = countUnifiedHunkLines(linesForNewPath);
  return [
    ...movedFileUnstagePatchHeader(header),
    `@@ -${formatUnifiedRange(parsed.newStart, counts.oldCount)} +${formatUnifiedRange(parsed.newStart, counts.newCount)} @@`,
    ...linesForNewPath,
  ].join("\n").replace(/\n*$/, "\n");
}



module.exports = {

  extractMovedFileUnstageHunkPatch,

  extractSelectedLinePatch,

  extractSingleHunkPatch,

  isDeletedFileDiffOutput,

  isMovedFileDiffOutput,

  isNewFileDiffOutput,

  normalizeDiffLineSelections,

};
