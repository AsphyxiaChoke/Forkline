"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const iconv = require("../vendor/iconv-lite");

const FILE_EDITOR_DIFF_CONTEXT = 0;
const FILE_EDITOR_MAX_BYTES = 1024 * 1024;
const FILE_VIEWER_MAX_BYTES = 16 * 1024 * 1024;

function createFileEditorService(options) {
  const {
    git,
    gitBuffer,
    getCurrentRepo,
    readStatusFileForDiff,
    readWorktreeDiffOutput,
    readNewFileDiff,
    parseDiff,
    normalizeRepoFile,
    normalizeSha,
    isPathInside,
    decodeUtf8Strict,
  } = options;

  async function readEditableCommitFile(sha, filePath, previousFilePath = "", repoPath = getCurrentRepo()) {
    const file = validateEditableRepoFile(filePath);
    const oldFile = previousFilePath ? validateEditableRepoFile(previousFilePath) : file;
    const target = normalizeSha(sha);
    const [commit, parent = ""] = (await git(repoPath, ["rev-list", "--parents", "-n", "1", `${target}^{commit}`])).trim().split(/\s+/);
    const [current, old] = await Promise.all([
      readEditableCommitBlob(commit, file, "此提交", repoPath),
      parent ? readEditableCommitBlob(parent, oldFile, "父提交", repoPath) : emptyEditableCommitBlob(),
    ]);
    return {
      file,
      oldFile,
      previousFile: oldFile === file ? "" : oldFile,
      commit,
      parent,
      exists: current.exists,
      content: current.content,
      encoding: current.encoding,
      bom: current.bom,
      lineEnding: current.lineEnding,
      byteLength: current.byteLength,
      oldExists: old.exists,
      oldContent: old.content,
      oldEncoding: old.encoding,
      oldBom: old.bom,
      oldLineEnding: old.lineEnding,
      oldByteLength: old.byteLength,
      readOnly: true,
      largeFile: Boolean(current.largeFile || old.largeFile),
    };
  }

  async function readEditableCommitBlob(ref, file, label, repoPath) {
    const object = `${ref}:${file}`;
    let buffer;
    try {
      buffer = await gitBuffer(repoPath, ["cat-file", "blob", object], {
        timeout: 60000,
        maxBuffer: FILE_VIEWER_MAX_BYTES + 1024,
      });
    } catch {
      const type = (await git(repoPath, ["cat-file", "-t", object], { timeout: 60000 }).catch(() => "")).trim();
      if (!type) return emptyEditableCommitBlob();
      if (type !== "blob") throw new Error(`${label}中的 ${file} 不是普通文件，无法显示。`);
      const size = Number((await git(repoPath, ["cat-file", "-s", object], { timeout: 60000 })).trim());
      if (!Number.isFinite(size)) throw new Error(`${label}中的 ${file} 无法读取。`);
      if (size > FILE_VIEWER_MAX_BYTES) throw new Error(`${label}中的文件超过 16 MiB，当前对照窗口暂不支持打开。`);
      throw new Error(`${label}中的 ${file} 无法读取。`);
    }
    if (buffer.length > FILE_VIEWER_MAX_BYTES) {
      throw new Error(`${label}中的文件超过 16 MiB，当前对照窗口暂不支持打开。`);
    }
    try {
      const payload = editableWorktreeFilePayload(file, buffer);
      return {
        exists: true,
        content: payload.content,
        encoding: payload.encoding,
        bom: payload.bom,
        lineEnding: payload.lineEnding,
        byteLength: payload.byteLength,
        largeFile: buffer.length > FILE_EDITOR_MAX_BYTES,
      };
    } catch (error) {
      throw new Error(`${label}版本无法显示：${error.message}`);
    }
  }

  function emptyEditableCommitBlob() {
    return { exists: false, content: "", encoding: "", bom: false, lineEnding: "", byteLength: 0, largeFile: false };
  }

  async function readEditableWorktreeFile(filePath, previousFilePath = "", repoPath = getCurrentRepo()) {
    const target = resolveReadableWorktreeFile(filePath, repoPath);
    const buffer = fs.readFileSync(target.fullPath);
    const current = editableWorktreeFilePayload(target.file, buffer);
    const largeFile = current.byteLength > FILE_EDITOR_MAX_BYTES;
    const status = await readStatusFileForDiff(target.file, "any", repoPath);
    const old = status?.conflict
      ? { oldExists: false, oldContent: "", oldEncoding: "", oldLineEnding: "", oldUnavailable: "冲突文件的暂存区没有单一版本，请先解决冲突。", largeFile: false }
      : await readIndexEditableWorktreeFile(target.file, repoPath);
    const readOnly = Boolean(largeFile || old.largeFile);
    let diffScope = "";
    let diffOutput = "";
    const diffContext = FILE_EDITOR_DIFF_CONTEXT;
    if (!readOnly && status?.unstaged && !status.conflict) {
      if (status.indexStatus === "?") {
        diffScope = "untracked";
        diffOutput = readNewFileDiff(target.file, repoPath);
      } else {
        diffScope = "unstaged";
        diffOutput = await readWorktreeDiffOutput(target.file, diffScope, status, repoPath, diffContext);
      }
    }
    const diff = parseDiff(diffOutput);
    return {
      ...current,
      oldFile: target.file,
      oldSource: "index",
      conflict: Boolean(status?.conflict),
      previousFile: previousFilePath ? validateEditableRepoFile(previousFilePath) : status?.previousFile || "",
      diffScope,
      diffContext,
      diff,
      ...old,
      canStage: Boolean(!readOnly && diffScope && diff.length),
      readOnly,
      largeFile: readOnly,
    };
  }

  async function readIndexEditableWorktreeFile(file, repoPath) {
    let buffer;
    try {
      buffer = await gitBuffer(repoPath, ["show", `:${file}`], { maxBuffer: FILE_VIEWER_MAX_BYTES + 1024 });
    } catch {
      const size = Number((await git(repoPath, ["cat-file", "-s", `:${file}`]).catch(() => "")).trim());
      if (Number.isFinite(size) && size > FILE_VIEWER_MAX_BYTES) {
        return {
          oldExists: true,
          oldContent: "",
          oldEncoding: "",
          oldLineEnding: "",
          oldUnavailable: "暂存区版本超过 16 MiB，无法在对照窗口中显示。",
          largeFile: true,
        };
      }
      return { oldExists: false, oldContent: "", oldEncoding: "", oldLineEnding: "", oldUnavailable: "", largeFile: false };
    }
    if (buffer.length > FILE_VIEWER_MAX_BYTES) {
      return {
        oldExists: true,
        oldContent: "",
        oldEncoding: "",
        oldLineEnding: "",
        oldUnavailable: "暂存区版本超过 16 MiB，无法在对照窗口中显示。",
        largeFile: true,
      };
    }
    try {
      const payload = editableWorktreeFilePayload(file, buffer);
      return {
        oldExists: true,
        oldContent: payload.content,
        oldEncoding: payload.encoding,
        oldLineEnding: payload.lineEnding,
        oldUnavailable: "",
        largeFile: buffer.length > FILE_EDITOR_MAX_BYTES,
      };
    } catch (error) {
      return {
        oldExists: true,
        oldContent: "",
        oldEncoding: "",
        oldLineEnding: "",
        oldUnavailable: `暂存区版本无法显示：${error.message}`,
        largeFile: false,
      };
    }
  }

  function saveEditableWorktreeFile(body, repoPath = getCurrentRepo()) {
    const target = resolveEditableWorktreeFile(body.file, repoPath);
    const expectedSnapshot = String(body.expectedSnapshot || "").trim().toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(expectedSnapshot)) {
      throw new Error("编辑器状态已失效，请重新打开文件后再保存。");
    }
    if (typeof body.content !== "string") throw new Error("文件内容不合法，请重新打开文件后再试。");

    const currentBuffer = fs.readFileSync(target.fullPath);
    const current = editableWorktreeFilePayload(target.file, currentBuffer);
    if (current.snapshot !== expectedSnapshot) {
      throw new Error("文件已被其他程序修改，本次内容尚未保存。请重新打开文件，确认最新内容后再编辑。");
    }

    const normalized = normalizeEditableLineEndings(body.content, current.lineEnding);
    const contentBuffer = encodeEditableContent(normalized, current.encoding);
    const nextBuffer = current.bom
      ? Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), contentBuffer])
      : contentBuffer;
    if (nextBuffer.length > FILE_EDITOR_MAX_BYTES) {
      throw new Error("文件保存后超过 1 MiB，当前编辑器暂不支持这么大的文件。");
    }

    fs.writeFileSync(target.fullPath, nextBuffer);
    return {
      ...editableWorktreeFilePayload(target.file, nextBuffer),
      output: "文件已保存",
    };
  }

  function resolveEditableWorktreeFile(filePath, repoPath = getCurrentRepo()) {
    return resolveReadableWorktreeFile(filePath, repoPath, FILE_EDITOR_MAX_BYTES, "文件超过 1 MiB，当前编辑器暂不支持直接编辑。请使用大文件只读模式查看。");
  }

  function resolveReadableWorktreeFile(filePath, repoPath = getCurrentRepo(), maxBytes = FILE_VIEWER_MAX_BYTES, tooLargeMessage = "文件超过 16 MiB，当前对照窗口暂不支持打开。") {
    const file = validateEditableRepoFile(filePath);
    const repoRoot = path.resolve(repoPath);
    const fullPath = path.resolve(repoRoot, file);
    if (!isPathInside(repoRoot, fullPath)) throw new Error("文件路径不合法");

    let stat;
    try {
      stat = fs.lstatSync(fullPath);
    } catch (error) {
      if (error?.code === "ENOENT") throw new Error("文件不存在，可能已经被删除或移动。请刷新工作区后再试。");
      throw error;
    }
    if (stat.isSymbolicLink()) throw new Error("符号链接文件暂不支持直接编辑。");
    if (!stat.isFile()) throw new Error("只能编辑普通文本文件。");
    if (stat.size > maxBytes) throw new Error(tooLargeMessage.trim());

    const realRepoRoot = fs.realpathSync(repoRoot);
    const realFilePath = fs.realpathSync(fullPath);
    if (!isPathInside(realRepoRoot, realFilePath)) throw new Error("文件路径不合法");
    return { file, fullPath };
  }

  function validateEditableRepoFile(filePath) {
    const file = normalizeRepoFile(filePath);
    if (file.split("/").some((part) => part.toLowerCase() === ".git")) throw new Error("不能编辑 Git 内部文件。");
    return file;
  }

  function editableWorktreeFilePayload(file, buffer) {
    const decoded = decodeEditableBuffer(buffer);
    return {
      file,
      content: decoded.content,
      encoding: decoded.encoding,
      bom: decoded.bom,
      lineEnding: editableLineEnding(decoded.content),
      byteLength: buffer.length,
      snapshot: crypto.createHash("sha256").update(buffer).digest("hex"),
    };
  }

  function decodeEditableBuffer(buffer) {
    const hasBom = buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf;
    const contentBuffer = hasBom ? buffer.subarray(3) : buffer;
    if (containsBinaryControlByte(contentBuffer)) throw new Error("这是二进制文件，不能使用文本编辑器打开。");

    const utf8Content = decodeUtf8Strict(contentBuffer);
    if (utf8Content !== null) return { content: utf8Content, encoding: "utf-8", bom: hasBom };
    if (!hasBom) {
      const encodings = containsGb18030FourByteSequence(contentBuffer) ? ["gb18030", "gbk"] : ["gbk", "gb18030"];
      for (const encoding of encodings) {
        const content = iconv.decode(contentBuffer, encoding);
        if (iconv.encode(content, encoding).equals(contentBuffer)) return { content, encoding, bom: false };
      }
    }
    throw new Error("文件不是有效的 UTF-8、GBK 或 GB18030 文本，当前编辑器无法打开。");
  }

  function containsGb18030FourByteSequence(buffer) {
    for (let index = 0; index <= buffer.length - 4; index += 1) {
      if (
        buffer[index] >= 0x81 &&
        buffer[index] <= 0xfe &&
        buffer[index + 1] >= 0x30 &&
        buffer[index + 1] <= 0x39 &&
        buffer[index + 2] >= 0x81 &&
        buffer[index + 2] <= 0xfe &&
        buffer[index + 3] >= 0x30 &&
        buffer[index + 3] <= 0x39
      ) {
        return true;
      }
    }
    return false;
  }

  function encodeEditableContent(content, encoding) {
    if (encoding === "gbk" || encoding === "gb18030") return iconv.encode(content, encoding);
    return Buffer.from(content, "utf8");
  }

  function containsBinaryControlByte(buffer) {
    for (const byte of buffer) {
      if (byte === 0 || byte === 0x7f || byte < 0x09 || (byte > 0x0d && byte < 0x20)) return true;
    }
    return false;
  }

  function editableLineEnding(content) {
    const first = String(content || "").match(/\r\n|\n|\r/);
    if (first?.[0] === "\r\n") return "crlf";
    if (first?.[0] === "\r") return "cr";
    return "lf";
  }

  function normalizeEditableLineEndings(content, lineEnding) {
    const normalized = String(content || "").replace(/\r\n|\r/g, "\n");
    if (lineEnding === "crlf") return normalized.replaceAll("\n", "\r\n");
    if (lineEnding === "cr") return normalized.replaceAll("\n", "\r");
    return normalized;
  }

  return {
    readEditableCommitFile,
    readEditableWorktreeFile,
    saveEditableWorktreeFile,
  };
}

module.exports = {
  FILE_EDITOR_MAX_BYTES,
  FILE_VIEWER_MAX_BYTES,
  createFileEditorService,
};
