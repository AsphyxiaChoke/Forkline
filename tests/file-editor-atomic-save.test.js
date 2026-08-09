"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const fsPromises = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { createFileEditorService } = require("../server/file-editor-service");

test("file editor keeps the original file when writing the replacement is interrupted", async (t) => {
  const root = await fsPromises.mkdtemp(path.join(os.tmpdir(), "forkline-atomic-save-"));
  t.after(() => fsPromises.rm(root, { recursive: true, force: true }));
  const filePath = path.join(root, "note.txt");
  const originalContent = Buffer.from("original content\n", "utf8");
  await fsPromises.writeFile(filePath, originalContent);
  const service = createSaveService(root);
  const originalWriteFileSync = fs.writeFileSync;

  fs.writeFileSync = function interruptedWrite(target, content, options) {
    originalWriteFileSync(target, Buffer.from(content).subarray(0, 4), options);
    const error = new Error("injected replacement write failure");
    error.code = "EIO";
    throw error;
  };
  try {
    assert.throws(
      () => service.saveEditableWorktreeFile({
        file: "note.txt",
        content: "replacement content\n",
        expectedSnapshot: snapshot(originalContent),
      }),
      /injected replacement write failure/
    );
  } finally {
    fs.writeFileSync = originalWriteFileSync;
  }

  assert.deepEqual(await fsPromises.readFile(filePath), originalContent);
  assert.deepEqual((await fsPromises.readdir(root)).filter((name) => name.startsWith(".forkline-save-")), []);
});

test("file editor rechecks the source snapshot before replacing it", async (t) => {
  const root = await fsPromises.mkdtemp(path.join(os.tmpdir(), "forkline-atomic-stale-"));
  t.after(() => fsPromises.rm(root, { recursive: true, force: true }));
  const filePath = path.join(root, "note.txt");
  const originalContent = Buffer.from("original content\n", "utf8");
  const externalContent = Buffer.from("external update\n", "utf8");
  await fsPromises.writeFile(filePath, originalContent);
  const service = createSaveService(root);
  const originalReadFileSync = fs.readFileSync;
  let readCount = 0;

  fs.readFileSync = function updateBeforeReplace(target, options) {
    readCount += 1;
    if (readCount === 2) fs.writeFileSync(filePath, externalContent);
    return originalReadFileSync(target, options);
  };
  try {
    assert.throws(
      () => service.saveEditableWorktreeFile({
        file: "note.txt",
        content: "replacement content\n",
        expectedSnapshot: snapshot(originalContent),
      }),
      /其他程序修改|重新打开/
    );
  } finally {
    fs.readFileSync = originalReadFileSync;
  }

  assert.deepEqual(await fsPromises.readFile(filePath), externalContent);
  assert.deepEqual((await fsPromises.readdir(root)).filter((name) => name.startsWith(".forkline-save-")), []);
});

function createSaveService(repoPath) {
  return createFileEditorService({
    getCurrentRepo: () => repoPath,
    normalizeRepoFile(value) {
      const file = String(value || "").replaceAll("\\", "/");
      if (!file || path.isAbsolute(file) || file.split("/").includes("..")) throw new Error("文件路径不合法");
      return file;
    },
    isPathInside(parentPath, candidatePath) {
      const relative = path.relative(parentPath, candidatePath);
      return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
    },
    decodeUtf8Strict(buffer) {
      try {
        return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
      } catch {
        return null;
      }
    },
  });
}

function snapshot(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}
