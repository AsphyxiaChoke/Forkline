"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const serverSource = read("server.js");
const operationsSource = read("server/git-operations-service.js");
const repositorySource = read("server/repository-service.js");
const historySource = read("server/repository-history.js");
const editorSource = read("server/file-editor-service.js");
const updateSource = read("server/update-service.js");

test("backend routes delegate Git domains to service modules", () => {
  assert.match(serverSource, /createGitOperationsService\(/);
  assert.match(serverSource, /createRepositoryService\(/);
  assert.match(serverSource, /createRepositoryHistoryService\(/);
  assert.match(serverSource, /createFileEditorService\(/);
  assert.match(serverSource, /createUpdateService\(/);

  assert.doesNotMatch(serverSource, /^async function (?:runAction|readState|readCommit|readEditableWorktreeFile)\b/m);
  assert.match(operationsSource, /async function runAction\(/);
  assert.match(repositorySource, /async function readState\(/);
  assert.match(historySource, /async function readCommit\(/);
  assert.match(editorSource, /async function readEditableWorktreeFile\(/);
  assert.match(updateSource, /async function handleRequest\(/);
});

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}
