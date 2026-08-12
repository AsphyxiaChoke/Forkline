"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const serverSource = read("server.js");
const operationsSource = read("server/git-operations-service.js");
const branchSource = read("server/git-branch-service.js");
const worktreeOperationsSource = read("server/git-worktree-service.js");
const historyOperationsSource = read("server/git-history-service.js");
const recoverySource = read("server/git-recovery-service.js");
const runtimeSource = read("server/git-runtime.js");
const repositorySource = read("server/repository-service.js");
const repositoryBrowseSource = read("server/repository-browse-service.js");
const repositoryAuthSource = read("server/repository-auth-service.js");
const repositorySubmoduleSource = read("server/repository-submodule-service.js");
const repositoryWorktreeSource = read("server/repository-worktree-service.js");
const repositoryStateSource = read("server/repository-state-service.js");
const historySource = read("server/repository-history.js");
const editorSource = read("server/file-editor-service.js");
const updateSource = read("server/update-service.js");
const serverModuleSources = fs.readdirSync(path.join(root, "server"))
  .filter((name) => name.endsWith(".js"))
  .map((name) => ({ name: `server/${name}`, source: read(`server/${name}`) }));

test("backend routes delegate Git domains to service modules", () => {
  assert.match(serverSource, /createGitOperationsService\(/);
  assert.match(serverSource, /createRepositoryService\(/);
  assert.match(serverSource, /createRepositoryHistoryService\(/);
  assert.match(serverSource, /createFileEditorService\(/);
  assert.match(serverSource, /createUpdateService\(/);

  assert.doesNotMatch(serverSource, /^async function (?:runAction|readState|readCommit|readEditableWorktreeFile)\b/m);
  assert.match(operationsSource, /async function runAction\(/);
  assert.match(repositoryStateSource, /async function readState\(/);
  assert.match(historySource, /async function readCommit\(/);
  assert.match(editorSource, /async function readEditableWorktreeFile\(/);
  assert.match(updateSource, /async function handleRequest\(/);
});

test("Git operation and repository facades delegate their subdomains", () => {
  assert.match(operationsSource, /createGitBranchService\(/);
  assert.match(operationsSource, /createGitWorktreeService\(/);
  assert.match(operationsSource, /createGitHistoryService\(/);
  assert.match(operationsSource, /createGitRecoveryService\(/);
  assert.doesNotMatch(operationsSource, /^  async function (?:checkoutBranch|createStash|rewriteHistoryCommit|createRecoveryPoint)\b/m);
  assert.match(branchSource, /async function checkoutBranch\(/);
  assert.match(worktreeOperationsSource, /async function createStash\(/);
  assert.match(historyOperationsSource, /async function rewriteHistoryCommit\(/);
  assert.match(recoverySource, /async function createRecoveryPoint\(/);

  assert.match(repositorySource, /createRepositoryBrowseService\(/);
  assert.match(repositorySource, /createRepositoryAuthService\(/);
  assert.match(repositorySource, /createRepositorySubmoduleService\(/);
  assert.match(repositorySource, /createRepositoryWorktreeService\(/);
  assert.match(repositorySource, /createRepositoryStateService\(/);
  assert.doesNotMatch(repositorySource, /^  async function (?:readState|readWorktree|readCachedAuthDiagnostics)\b/m);
  assert.match(repositoryBrowseSource, /function readDirectory\(/);
  assert.match(repositoryAuthSource, /async function readCachedAuthDiagnostics\(/);
  assert.match(repositorySubmoduleSource, /function parseSubmodules\(/);
  assert.match(repositoryWorktreeSource, /async function readWorktree\(/);
  assert.match(repositoryStateSource, /async function readState\(/);
  assert.match(repositoryStateSource, /async function readSyncState\(/);
});

test("machine-readable git status calls ignore successful stderr warnings", () => {
  const statusCalls = serverModuleSources.flatMap(({ name, source }) => Array.from(
    source.matchAll(/\bgit\([^)]*,\s*\["status"[\s\S]*?\]\s*,\s*\{[\s\S]*?\}\s*\)/g),
    (match) => ({ name, call: match[0].replace(/\s+/g, " ").trim() })
  ));

  assert.ok(statusCalls.length > 0, "expected direct git status calls in server modules");
  for (const call of statusCalls) {
    assert.match(call.call, /stdoutOnly:\s*true/, `${call.name} must keep Git warnings out of status data: ${call.call}`);
  }
});

test("authentication probes join the owned-process shutdown registry", () => {
  assert.match(runtimeSource, /registerOwnedProcess/);
  assert.match(serverSource, /registerOwnedProcess/);
  assert.match(repositorySource, /registerOwnedProcess/);
  assert.match(repositoryAuthSource, /registerOwnedProcess\(child\)/);
});

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}
