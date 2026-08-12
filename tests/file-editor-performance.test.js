"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { createFileEditorService } = require("../server/file-editor-service");

const COMMIT = "1".repeat(40);
const PARENT = "2".repeat(40);

test("historical file reads reuse a cached first parent", async () => {
  const gitCalls = [];
  const blobCalls = [];
  const service = createFileEditorService({
    git: async (_repo, args) => {
      gitCalls.push(args);
      return `${COMMIT} ${PARENT}`;
    },
    gitBuffer: async (_repo, args) => {
      blobCalls.push(args);
      return Buffer.from(args.at(-1).startsWith(`${COMMIT}:`) ? "current\n" : "parent\n", "utf8");
    },
    getCurrentRepo: () => "C:\\repo",
    readCachedCommitParent: () => PARENT,
    rememberCommitParent: () => {},
    readStatusFileForDiff: async () => null,
    readWorktreeDiffOutput: async () => "",
    readNewFileDiff: async () => "",
    parseDiff: () => [],
    normalizeRepoFile: (value) => String(value || ""),
    normalizeSha: (value) => String(value || ""),
    isPathInside: () => true,
    decodeUtf8Strict: (buffer) => buffer.toString("utf8"),
  });

  const result = await service.readEditableCommitFile(COMMIT, "src/main.c");
  assert.equal(result.commit, COMMIT);
  assert.equal(result.parent, PARENT);
  assert.equal(result.content, "current\n");
  assert.equal(result.oldContent, "parent\n");
  assert.equal(gitCalls.length, 0);
  assert.deepEqual(blobCalls.map((args) => args.at(-1)), [`${COMMIT}:src/main.c`, `${PARENT}:src/main.c`]);
});

test("historical file reads resolve and remember a missing first parent once", async () => {
  const gitCalls = [];
  const rememberedParents = [];
  let cachedParent;
  const service = createFileEditorService({
    git: async (_repo, args) => {
      gitCalls.push(args);
      return `${COMMIT} ${PARENT}`;
    },
    gitBuffer: async (_repo, args) => Buffer.from(args.at(-1).startsWith(`${COMMIT}:`) ? "current\n" : "parent\n", "utf8"),
    getCurrentRepo: () => "C:\\repo",
    readCachedCommitParent: () => cachedParent,
    rememberCommitParent: (commit, parent, repoPath) => {
      rememberedParents.push({ commit, parent, repoPath });
      cachedParent = parent;
    },
    readStatusFileForDiff: async () => null,
    readWorktreeDiffOutput: async () => "",
    readNewFileDiff: async () => "",
    parseDiff: () => [],
    normalizeRepoFile: (value) => String(value || ""),
    normalizeSha: (value) => String(value || ""),
    isPathInside: () => true,
    decodeUtf8Strict: (buffer) => buffer.toString("utf8"),
  });

  await service.readEditableCommitFile(COMMIT, "src/main.c");
  await service.readEditableCommitFile(COMMIT, "src/main.c");

  assert.deepEqual(gitCalls, [["rev-list", "--parents", "-n", "1", `${COMMIT}^{commit}`]]);
  assert.deepEqual(rememberedParents, [{ commit: COMMIT, parent: PARENT, repoPath: "C:\\repo" }]);
});
