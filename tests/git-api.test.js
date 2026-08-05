"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { execFile, spawn } = require("node:child_process");
const { once } = require("node:events");
const { promisify } = require("node:util");
const iconv = require("../vendor/iconv-lite");

const execFileAsync = promisify(execFile);
const projectRoot = path.resolve(__dirname, "..");
const serverPath = path.join(projectRoot, "server.js");
const nullConfig = process.platform === "win32" ? "NUL" : "/dev/null";
const gitEnv = {
  ...process.env,
  GIT_CONFIG_GLOBAL: nullConfig,
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_TERMINAL_PROMPT: "0",
  GCM_INTERACTIVE: "never",
  LC_ALL: "C",
  LANG: "C",
};

let baseUrl = "";
let serverProcess = null;
let serverLog = "";

test.before(async () => {
  const port = await freePort();
  baseUrl = `http://127.0.0.1:${port}`;
  serverProcess = spawn(process.execPath, [serverPath], {
    cwd: projectRoot,
    env: {
      ...gitEnv,
      PORT: String(port),
      FORKLINE_NO_OPEN: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  serverProcess.stdout.on("data", (chunk) => appendServerLog(chunk));
  serverProcess.stderr.on("data", (chunk) => appendServerLog(chunk));
  await waitForServer();
});

test.after(async () => {
  await stopServer();
});

test("sample state localizes display metadata without translating commit data", async () => {
  const response = await request("/api/state", { locale: "en" });
  assertStatus(response, 200);
  assert.equal(response.body.repo.isSample, true);
  assert.equal(response.body.commits[0].time, "12 minutes ago");
  assert.equal(response.body.commits[0].message, "打磨提交图连线动画");
  assert.equal(response.body.branchCleanup[0].lastUpdated, "12 minutes ago");
  assert.match(response.body.sync.auth.summary, /SSH remote/);
  assert.doesNotMatch(response.body.sync.auth.summary, /[\u3400-\u9fff]/);
});

test("repository context headers support non-Latin paths and legacy ASCII values", { timeout: 120000 }, async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "forkline-repo-context-"));
  t.after(() => removeFixture(root));

  const unicodeRepo = path.join(root, "中文仓库");
  await initRepository(unicodeRepo);
  await openRepo(unicodeRepo);

  const encoded = await request("/api/state", { repoPath: unicodeRepo });
  assertStatus(encoded, 200);
  assert.equal(path.resolve(encoded.body.repo.path), path.resolve(unicodeRepo));

  const malformed = await request("/api/state", { repoPathHeader: "v1:%E0%A4%A" });
  assertStatus(malformed, 400);
  assert.match(malformed.body.error, /仓库上下文编码无效/);

  const legacyRepo = path.join(root, "legacy-repo");
  await initRepository(legacyRepo);
  await openRepo(legacyRepo);
  const legacy = await request("/api/state", { repoPathHeader: legacyRepo });
  assertStatus(legacy, 200);
  assert.equal(path.resolve(legacy.body.repo.path), path.resolve(legacyRepo));
});

test("backend locale follows the request without translating Git data", { timeout: 120000 }, async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "forkline-i18n-"));
  t.after(() => removeFixture(root));

  const repo = path.join(root, "中文仓库");
  await initRepository(repo);
  await fs.writeFile(path.join(repo, "说明.txt"), "base\n", "utf8");
  await git(repo, ["add", "说明.txt"]);
  await git(repo, ["commit", "-m", "设置 分支 桌面"]);
  const state = await openRepo(repo);

  const englishState = await request("/api/state", { repoPath: repo, locale: "en-US" });
  assertStatus(englishState, 200);
  assert.equal(path.resolve(englishState.body.repo.path), path.resolve(repo));
  assert.equal(englishState.body.commits[0].message, "设置 分支 桌面");

  const englishError = await request("/api/state", { repoPathHeader: "v1:%E0%A4%A", locale: "en" });
  assertStatus(englishError, 400);
  assert.match(englishError.body.error, /repository context encoding is invalid/i);
  assert.doesNotMatch(englishError.body.error, /[\u3400-\u9fff]/);

  const unsupportedLocale = await request("/api/state", { repoPathHeader: "v1:%E0%A4%A", locale: "fr" });
  assertStatus(unsupportedLocale, 400);
  assert.match(unsupportedLocale.body.error, /仓库上下文编码无效/);

  const branch = "功能/保留中文";
  const created = await request("/api/action", {
    method: "POST",
    repoPath: repo,
    locale: "en",
    body: {
      action: "createBranch",
      branch,
      checkout: true,
      expectedBranch: state.repo.branch,
      expectedHead: state.repo.headSha,
      expectedWorktreeSnapshot: state.worktreeSnapshot,
    },
  });
  assertStatus(created, 200);
  assert.equal(created.body.output, `Created and switched to ${branch}`);
  const afterCreate = await request("/api/state", { repoPath: repo, locale: "en" });
  assertStatus(afterCreate, 200);
  assert.equal(afterCreate.body.repo.branch, branch);
});

test("commit history loads older pages beyond the default 120 commits", { timeout: 120000 }, async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "forkline-history-page-"));
  t.after(() => removeFixture(root));

  const repo = path.join(root, "repo");
  await initRepository(repo);
  await createFastLinearHistory(repo, 150);

  const initial = await openRepo(repo);
  assert.equal(initial.commits.length, 120);
  assert.equal(initial.history.limit, 120);
  assert.equal(initial.history.hasMore, true);

  const expanded = await request("/api/ref-state?limit=240", { repoPath: repo });
  assertStatus(expanded, 200);
  assert.equal(expanded.body.commits.length, 150);
  assert.equal(expanded.body.history.limit, 240);
  assert.equal(expanded.body.history.hasMore, false);
  assert.equal(expanded.body.commits[0].message, "history 150");
  assert.equal(expanded.body.commits.at(-1).message, "history 001");
});

test("worktree file editor reads and saves UTF-8 text with stale-content protection", { timeout: 120000 }, async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "forkline-file-editor-"));
  t.after(() => removeFixture(root));

  const repo = path.join(root, "repo");
  const notePath = path.join(repo, "note.txt");
  const binaryPath = path.join(repo, "binary.bin");
  const largePath = path.join(repo, "large.txt");
  const indexedLargePath = path.join(repo, "indexed-large.txt");
  const tooLargePath = path.join(repo, "too-large.txt");
  await initRepository(repo);
  await fs.writeFile(notePath, Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from("base\r\nlocal\r\n", "utf8")]));
  await git(repo, ["add", "note.txt"]);
  await git(repo, ["commit", "-m", "base"]);
  await fs.appendFile(notePath, "staged\r\n", "utf8");
  await git(repo, ["add", "note.txt"]);
  await fs.appendFile(notePath, "change\r\n", "utf8");
  await fs.writeFile(binaryPath, Buffer.from([0x00, 0x01, 0x02, 0xff]));
  await fs.writeFile(largePath, Buffer.alloc(1024 * 1024 + 1, 0x61));
  await fs.writeFile(indexedLargePath, Buffer.alloc(1024 * 1024 + 1, 0x62));
  await git(repo, ["add", "indexed-large.txt"]);
  await fs.writeFile(indexedLargePath, "small worktree version\n", "utf8");
  await fs.writeFile(tooLargePath, Buffer.alloc(16 * 1024 * 1024 + 1, 0x63));
  await openRepo(repo);

  const opened = await request("/api/worktree-file?file=note.txt", { repoPath: repo });
  assertStatus(opened, 200);
  assert.equal(opened.body.file, "note.txt");
  assert.equal(opened.body.content, "base\r\nlocal\r\nstaged\r\nchange\r\n");
  assert.equal(opened.body.bom, true);
  assert.equal(opened.body.lineEnding, "crlf");
  assert.equal(opened.body.oldExists, true);
  assert.equal(opened.body.oldContent, "base\r\nlocal\r\nstaged\r\n");
  assert.equal(opened.body.oldEncoding, "utf-8");
  assert.equal(opened.body.oldSource, "index");
  assert.equal(opened.body.conflict, false);
  assert.equal(opened.body.diffScope, "unstaged");
  assert.ok(opened.body.diff.some((line) => line.type === "add" && line.text === "+change"));
  assert.match(opened.body.snapshot, /^[a-f0-9]{64}$/);

  const saved = await request("/api/worktree-file", {
    method: "POST",
    repoPath: repo,
    body: {
      file: "note.txt",
      content: "base\nlocal\nedited\n",
      expectedSnapshot: opened.body.snapshot,
    },
  });
  assertStatus(saved, 200);
  assert.equal(saved.body.output, "文件已保存");
  assert.equal(saved.body.lineEnding, "crlf");
  assert.equal(saved.body.bom, true);
  const savedBuffer = await fs.readFile(notePath);
  assert.deepEqual(Array.from(savedBuffer.subarray(0, 3)), [0xef, 0xbb, 0xbf]);
  assert.equal(savedBuffer.subarray(3).toString("utf8"), "base\r\nlocal\r\nedited\r\n");

  await fs.appendFile(notePath, "outside\r\n", "utf8");
  const stale = await request("/api/worktree-file", {
    method: "POST",
    repoPath: repo,
    body: {
      file: "note.txt",
      content: "must not overwrite\n",
      expectedSnapshot: saved.body.snapshot,
    },
  });
  assertStatus(stale, 400);
  assert.match(stale.body.error, /其他程序修改|重新打开/);
  assert.match((await fs.readFile(notePath)).toString("utf8"), /outside\r\n$/);

  const traversal = await request("/api/worktree-file?file=../outside.txt", { repoPath: repo });
  assertStatus(traversal, 400);
  assert.match(traversal.body.error, /路径不合法/);

  const binary = await request("/api/worktree-file?file=binary.bin", { repoPath: repo });
  assertStatus(binary, 400);
  assert.match(binary.body.error, /二进制/);

  const large = await request("/api/worktree-file?file=large.txt", { repoPath: repo });
  assertStatus(large, 200);
  assert.equal(large.body.largeFile, true);
  assert.equal(large.body.readOnly, true);
  assert.equal(large.body.canStage, false);
  assert.equal(large.body.content.length, 1024 * 1024 + 1);

  const indexedLarge = await request("/api/worktree-file?file=indexed-large.txt", { repoPath: repo });
  assertStatus(indexedLarge, 200);
  assert.equal(indexedLarge.body.largeFile, true);
  assert.equal(indexedLarge.body.readOnly, true);
  assert.equal(indexedLarge.body.oldContent.length, 1024 * 1024 + 1);
  assert.equal(indexedLarge.body.content, "small worktree version\n");

  const tooLarge = await request("/api/worktree-file?file=too-large.txt", { repoPath: repo });
  assertStatus(tooLarge, 400);
  assert.match(tooLarge.body.error, /超过 16 MiB/);
});

test("commit file viewer returns complete parent and commit versions for changed paths", { timeout: 120000 }, async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "forkline-commit-file-"));
  t.after(() => removeFixture(root));

  const repo = path.join(root, "repo");
  const changedPath = path.join(repo, "changed.txt");
  const addedPath = path.join(repo, "added.txt");
  const deletedPath = path.join(repo, "deleted.txt");
  const renamedOldPath = path.join(repo, "rename-old.txt");
  const renamedNewPath = path.join(repo, "rename-new.txt");
  const gbkPath = path.join(repo, "说明.txt");
  const binaryPath = path.join(repo, "binary.bin");
  const largePath = path.join(repo, "large.txt");
  const tooLargePath = path.join(repo, "too-large.txt");
  await initRepository(repo);
  await fs.writeFile(changedPath, "before\nkeep\n", "utf8");
  await fs.writeFile(deletedPath, "deleted from next commit\n", "utf8");
  await fs.writeFile(renamedOldPath, "one\ntwo\nthree\nfour\nfive\nsix\n", "utf8");
  await fs.writeFile(gbkPath, iconv.encode("旧版本\r\n", "gbk"));
  await fs.writeFile(binaryPath, Buffer.from([0x00, 0x01, 0xff]));
  await fs.writeFile(largePath, Buffer.alloc(1024 * 1024 + 1, 0x61));
  await fs.writeFile(tooLargePath, Buffer.alloc(16 * 1024 * 1024 + 1, 0x62));
  await git(repo, ["add", "."]);
  await git(repo, ["commit", "-m", "base files"]);
  const baseSha = await git(repo, ["rev-parse", "HEAD"]);

  await fs.writeFile(changedPath, "after\nkeep\nadded line\n", "utf8");
  await fs.writeFile(addedPath, "created in commit\n", "utf8");
  await fs.rm(deletedPath);
  await fs.rename(renamedOldPath, renamedNewPath);
  await fs.writeFile(renamedNewPath, "one\ntwo\nthree changed\nfour\nfive\nsix\n", "utf8");
  await fs.writeFile(gbkPath, iconv.encode("新版本\r\n提交内容\r\n", "gbk"));
  await git(repo, ["add", "-A"]);
  await git(repo, ["commit", "-m", "change files"]);
  const commitSha = await git(repo, ["rev-parse", "HEAD"]);
  await openRepo(repo);

  const detail = await request(`/api/commit?sha=${commitSha}`, { repoPath: repo });
  assertStatus(detail, 200);
  assert.equal(detail.body.diffLoaded, false);
  assert.deepEqual(detail.body.diff, []);
  const renamedFile = detail.body.files.find((file) => file.file === "rename-new.txt");
  assert.equal(renamedFile?.previousFile, "rename-old.txt");

  const detailWithDiff = await request(`/api/commit?sha=${commitSha}&diff=1`, { repoPath: repo });
  assertStatus(detailWithDiff, 200);
  assert.equal(detailWithDiff.body.diffLoaded, true);
  assert.ok(detailWithDiff.body.diff.some((line) => String(line.text || "").includes("added line")));

  const changed = await request(`/api/commit-file?sha=${commitSha}&file=changed.txt`, { repoPath: repo });
  assertStatus(changed, 200);
  assert.equal(changed.body.commit, commitSha);
  assert.equal(changed.body.parent, baseSha);
  assert.equal(changed.body.exists, true);
  assert.equal(changed.body.content, "after\nkeep\nadded line\n");
  assert.equal(changed.body.oldExists, true);
  assert.equal(changed.body.oldContent, "before\nkeep\n");

  const added = await request(`/api/commit-file?sha=${commitSha}&file=added.txt`, { repoPath: repo });
  assertStatus(added, 200);
  assert.equal(added.body.exists, true);
  assert.equal(added.body.oldExists, false);
  assert.equal(added.body.oldContent, "");

  const deleted = await request(`/api/commit-file?sha=${commitSha}&file=deleted.txt`, { repoPath: repo });
  assertStatus(deleted, 200);
  assert.equal(deleted.body.exists, false);
  assert.equal(deleted.body.content, "");
  assert.equal(deleted.body.oldExists, true);
  assert.equal(deleted.body.oldContent, "deleted from next commit\n");

  const renamed = await request(`/api/commit-file?sha=${commitSha}&file=rename-new.txt&previousFile=rename-old.txt`, { repoPath: repo });
  assertStatus(renamed, 200);
  assert.equal(renamed.body.file, "rename-new.txt");
  assert.equal(renamed.body.oldFile, "rename-old.txt");
  assert.equal(renamed.body.content, "one\ntwo\nthree changed\nfour\nfive\nsix\n");
  assert.equal(renamed.body.oldContent, "one\ntwo\nthree\nfour\nfive\nsix\n");

  const gbk = await request(`/api/commit-file?sha=${commitSha}&file=${encodeURIComponent("说明.txt")}`, { repoPath: repo });
  assertStatus(gbk, 200);
  assert.equal(gbk.body.encoding, "gbk");
  assert.equal(gbk.body.oldEncoding, "gbk");
  assert.equal(gbk.body.content, "新版本\r\n提交内容\r\n");
  assert.equal(gbk.body.oldContent, "旧版本\r\n");

  const rootVersion = await request(`/api/commit-file?sha=${baseSha}&file=changed.txt`, { repoPath: repo });
  assertStatus(rootVersion, 200);
  assert.equal(rootVersion.body.parent, "");
  assert.equal(rootVersion.body.exists, true);
  assert.equal(rootVersion.body.oldExists, false);

  const traversal = await request(`/api/commit-file?sha=${commitSha}&file=${encodeURIComponent("../outside.txt")}`, { repoPath: repo });
  assertStatus(traversal, 400);
  assert.match(traversal.body.error, /路径不合法/);

  const binary = await request(`/api/commit-file?sha=${baseSha}&file=binary.bin`, { repoPath: repo });
  assertStatus(binary, 400);
  assert.match(binary.body.error, /二进制/);

  const large = await request(`/api/commit-file?sha=${baseSha}&file=large.txt`, { repoPath: repo });
  assertStatus(large, 200);
  assert.equal(large.body.largeFile, true);
  assert.equal(large.body.readOnly, true);
  assert.equal(large.body.content.length, 1024 * 1024 + 1);

  const tooLarge = await request(`/api/commit-file?sha=${baseSha}&file=too-large.txt`, { repoPath: repo });
  assertStatus(tooLarge, 400);
  assert.match(tooLarge.body.error, /超过 16 MiB/);
});

test("file history and blame keep valid refs fast while preserving unborn branch guidance", { timeout: 120000 }, async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "forkline-file-read-ref-"));
  t.after(() => removeFixture(root));

  const repo = path.join(root, "repo");
  const filePath = path.join(repo, "note.txt");
  await initRepository(repo);
  await fs.writeFile(filePath, "line one\nline two\n", "utf8");
  await git(repo, ["add", "note.txt"]);
  await git(repo, ["commit", "-m", "add note"]);
  await openRepo(repo);

  const history = await request("/api/file-history?file=note.txt&ref=main", { repoPath: repo });
  assertStatus(history, 200);
  assert.equal(history.body.commits[0]?.message, "add note");

  const blame = await request("/api/file-blame?file=note.txt&ref=main", { repoPath: repo });
  assertStatus(blame, 200);
  assert.equal(blame.body.lines.length, 2);

  await git(repo, ["switch", "--orphan", "empty"]);

  const unbornHistory = await request("/api/file-history?file=note.txt&ref=empty", { repoPath: repo });
  assertStatus(unbornHistory, 400);
  assert.match(unbornHistory.body.error, /还没有任何提交.*查看文件历史/);

  const unbornBlame = await request("/api/file-blame?file=note.txt&ref=empty", { repoPath: repo });
  assertStatus(unbornBlame, 400);
  assert.match(unbornBlame.body.error, /还没有任何提交.*逐行追踪/);
});

test("file editor stages only the selected visual chunk when nearby changes share the normal diff context", { timeout: 120000 }, async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "forkline-file-editor-chunk-"));
  t.after(() => removeFixture(root));

  const repo = path.join(root, "repo");
  const filePath = path.join(repo, "nearby.txt");
  const baseLines = Array.from({ length: 20 }, (_, index) => `line ${String(index + 1).padStart(2, "0")} baseline`);
  await initRepository(repo);
  await fs.writeFile(filePath, `${baseLines.join("\n")}\n`, "utf8");
  await git(repo, ["add", "nearby.txt"]);
  await git(repo, ["commit", "-m", "base"]);

  const changedLines = [...baseLines];
  changedLines[4] = "line 05 first change";
  changedLines[9] = "line 10 second change";
  await fs.writeFile(filePath, `${changedLines.join("\n")}\n`, "utf8");
  const state = await openRepo(repo);

  const opened = await request("/api/worktree-file?file=nearby.txt", { repoPath: repo });
  assertStatus(opened, 200);
  assert.equal(opened.body.diffContext, 0);
  const hunks = opened.body.diff.filter((line) => line.type === "meta" && String(line.text || "").startsWith("@@ "));
  assert.equal(hunks.length, 2);

  const file = state.workingFiles.find((item) => item.file === "nearby.txt");
  assert.ok(file?.snapshot);
  const staged = await action(repo, state, {
    action: "stageHunk",
    file: "nearby.txt",
    scope: opened.body.diffScope,
    hunkIndex: hunks[0].hunkIndex,
    diffContext: opened.body.diffContext,
    expectedFileSnapshot: file.snapshot,
  });
  assertStatus(staged, 200);

  const cachedDiff = await git(repo, ["diff", "--cached", "--", "nearby.txt"]);
  const worktreeDiff = await git(repo, ["diff", "--", "nearby.txt"]);
  assert.match(cachedDiff, /line 05 first change/);
  assert.doesNotMatch(cachedDiff, /line 10 second change/);
  assert.doesNotMatch(worktreeDiff, /line 05 first change/);
  assert.match(worktreeDiff, /line 10 second change/);
});

test("untracked line staging keeps the remaining CRLF content in the worktree", { timeout: 120000 }, async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "forkline-untracked-lines-"));
  t.after(() => removeFixture(root));

  const repo = path.join(root, "repo");
  const fileName = "部分暂存.txt";
  const filePath = path.join(repo, fileName);
  const worktreeContent = Buffer.from("第一行\r\n第二行\r\n第三行", "utf8");
  await initRepository(repo);
  await fs.writeFile(path.join(repo, "base.txt"), "base\n", "utf8");
  await git(repo, ["add", "base.txt"]);
  await git(repo, ["commit", "-m", "base"]);
  await fs.writeFile(filePath, worktreeContent);
  const state = await openRepo(repo);
  const file = state.workingFiles.find((item) => item.file === fileName);
  assert.ok(file?.snapshot);

  const opened = await request(`/api/worktree-diff?file=${encodeURIComponent(fileName)}&scope=unstaged`, { repoPath: repo });
  assertStatus(opened, 200);
  assert.equal(opened.body.scope, "untracked");
  const selectedLine = diffSelectionForText(opened.body.diff, "+第三行");
  assert.ok(selectedLine);

  const staged = await action(repo, state, {
    action: "stageSelectedLines",
    file: fileName,
    scope: opened.body.scope,
    lines: [selectedLine],
    expectedFileSnapshot: file.snapshot,
  });
  assertStatus(staged, 200);
  assert.match(staged.body.output, /已暂存所选 1 行/);

  const after = await request("/api/worktree", { repoPath: repo });
  assertStatus(after, 200);
  const afterFile = after.body.workingFiles.find((item) => item.file === fileName);
  assert.equal(afterFile?.indexStatus, "A");
  assert.equal(afterFile?.worktreeStatus, "M");
  assert.equal(afterFile?.staged, true);
  assert.equal(afterFile?.unstaged, true);

  const { stdout: stagedBlob } = await execFileAsync("git", ["-C", repo, "show", `:${fileName}`], {
    env: gitEnv,
    encoding: null,
    maxBuffer: 16 * 1024 * 1024,
    windowsHide: true,
  });
  assert.deepEqual(Buffer.from(stagedBlob), Buffer.from("第三行", "utf8"));
  assert.deepEqual(await fs.readFile(filePath), worktreeContent);

  const cachedDiff = await git(repo, ["diff", "--cached", "--", fileName]);
  const worktreeDiff = await git(repo, ["diff", "--", fileName]);
  assert.match(cachedDiff, /第三行/);
  assert.doesNotMatch(cachedDiff, /第一行|第二行/);
  assert.match(worktreeDiff, /第一行|第二行/);
});

test("worktree file editor compares the index and preserves GBK or GB18030 encoding", { timeout: 120000 }, async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "forkline-file-editor-gbk-"));
  t.after(() => removeFixture(root));

  const repo = path.join(root, "repo");
  const gbkPath = path.join(repo, "说明.txt");
  const gb18030Path = path.join(repo, "扩展字符.txt");
  await initRepository(repo);
  await fs.writeFile(gbkPath, iconv.encode("旧版本\r\n", "gbk"));
  await fs.writeFile(gb18030Path, iconv.encode("旧字符𠀀\n", "gb18030"));
  await git(repo, ["add", "说明.txt", "扩展字符.txt"]);
  await git(repo, ["commit", "-m", "add encoded files"]);
  await fs.writeFile(gbkPath, iconv.encode("旧版本\r\n工作区修改\r\n", "gbk"));
  await fs.writeFile(gb18030Path, iconv.encode("旧字符𠀀\n工作区𠀁\n", "gb18030"));
  await openRepo(repo);

  const openedGbk = await request(`/api/worktree-file?file=${encodeURIComponent("说明.txt")}`, { repoPath: repo });
  assertStatus(openedGbk, 200);
  assert.equal(openedGbk.body.encoding, "gbk");
  assert.equal(openedGbk.body.content, "旧版本\r\n工作区修改\r\n");
  assert.equal(openedGbk.body.oldExists, true);
  assert.equal(openedGbk.body.oldContent, "旧版本\r\n");
  assert.equal(openedGbk.body.oldEncoding, "gbk");

  const savedGbk = await request("/api/worktree-file", {
    method: "POST",
    repoPath: repo,
    body: {
      file: "说明.txt",
      content: "旧版本\n编辑器保存中文\n",
      expectedSnapshot: openedGbk.body.snapshot,
    },
  });
  assertStatus(savedGbk, 200);
  assert.equal(savedGbk.body.encoding, "gbk");
  assert.equal(savedGbk.body.lineEnding, "crlf");
  const savedGbkBuffer = await fs.readFile(gbkPath);
  assert.equal(iconv.decode(savedGbkBuffer, "gbk"), "旧版本\r\n编辑器保存中文\r\n");
  assert.throws(() => new TextDecoder("utf-8", { fatal: true }).decode(savedGbkBuffer));

  const openedGb18030 = await request(`/api/worktree-file?file=${encodeURIComponent("扩展字符.txt")}`, { repoPath: repo });
  assertStatus(openedGb18030, 200);
  assert.equal(openedGb18030.body.encoding, "gb18030");
  assert.equal(openedGb18030.body.content, "旧字符𠀀\n工作区𠀁\n");
  assert.equal(openedGb18030.body.oldContent, "旧字符𠀀\n");
});

test("worktree file editor marks conflicts without inventing an index comparison", { timeout: 120000 }, async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "forkline-file-editor-conflict-"));
  t.after(() => removeFixture(root));

  const repo = path.join(root, "repo");
  const conflictPath = path.join(repo, "conflict.txt");
  await initRepository(repo);
  await fs.writeFile(conflictPath, "base\n", "utf8");
  await git(repo, ["add", "conflict.txt"]);
  await git(repo, ["commit", "-m", "base"]);
  await git(repo, ["checkout", "-b", "conflict-side"]);
  await fs.writeFile(conflictPath, "side\n", "utf8");
  await git(repo, ["commit", "-am", "side"]);
  await git(repo, ["checkout", "main"]);
  await fs.writeFile(conflictPath, "main\n", "utf8");
  await git(repo, ["commit", "-am", "main"]);
  await assert.rejects(git(repo, ["merge", "conflict-side", "--no-edit"]), /CONFLICT|failed/i);
  await openRepo(repo);

  const opened = await request("/api/worktree-file?file=conflict.txt", { repoPath: repo });
  assertStatus(opened, 200);
  assert.equal(opened.body.conflict, true);
  assert.equal(opened.body.oldExists, false);
  assert.equal(opened.body.oldContent, "");
  assert.match(opened.body.oldUnavailable, /没有单一版本/);
  assert.equal(opened.body.diffScope, "");
  assert.equal(opened.body.canStage, false);
  assert.match(opened.body.content, /<<<<<<< HEAD/);
});

test("ordinary parent stash still creates, applies, and pops", { timeout: 120000 }, async (t) => {
  const fixture = await createSubmoduleFixture("ordinary-stash");
  t.after(() => removeFixture(fixture.root));

  await fs.appendFile(fixture.notePath, "ordinary change\n", "utf8");
  let state = await openRepo(fixture.parent);
  assert.deepEqual(state.workingFiles.map((item) => item.file), ["note.txt"]);

  const created = await action(fixture.parent, state, {
    action: "createStash",
    message: "ordinary-control",
    files: [],
  });
  assertStatus(created, 200);

  let worktree = await request("/api/worktree?stashes=1", { repoPath: fixture.parent });
  assertStatus(worktree, 200);
  assert.equal(worktree.body.workingFiles.length, 0);
  assert.equal(worktree.body.commits, undefined);
  assert.equal(worktree.body.branches, undefined);
  const stash = worktree.body.stashes.find((item) => item.message === "ordinary-control");
  assert.ok(stash, "ordinary stash should appear in state");
  assert.equal(await fs.readFile(fixture.notePath, "utf8"), "base\n");

  state = await readState(fixture.parent);
  const applied = await action(fixture.parent, state, {
    action: "applyStash",
    ref: stash.ref,
    sha: stash.sha,
  });
  assertStatus(applied, 200);
  assert.match(await fs.readFile(fixture.notePath, "utf8"), /ordinary change/);

  worktree = await request("/api/worktree?stashes=1", { repoPath: fixture.parent });
  assertStatus(worktree, 200);
  assert.ok(worktree.body.stashes.some((item) => item.sha === stash.sha), "apply should keep the stash");
  assert.deepEqual(worktree.body.workingFiles.map((item) => item.file), ["note.txt"]);
  await git(fixture.parent, ["restore", "--source=HEAD", "--", "note.txt"]);

  state = await readState(fixture.parent);
  const popped = await action(fixture.parent, state, {
    action: "popStash",
    ref: stash.ref,
    sha: stash.sha,
  });
  assertStatus(popped, 200);
  assert.match(await fs.readFile(fixture.notePath, "utf8"), /ordinary change/);

  worktree = await request("/api/worktree?stashes=1", { repoPath: fixture.parent });
  assertStatus(worktree, 200);
  assert.ok(!worktree.body.stashes.some((item) => item.sha === stash.sha), "pop should remove only the applied stash");
});

test("gitlink stash is rejected before creation and existing stash is preserved", { timeout: 120000 }, async (t) => {
  const fixture = await createSubmoduleFixture("gitlink-stash");
  t.after(() => removeFixture(fixture.root));

  await git(fixture.submodule, ["checkout", "--detach", fixture.childSecond]);
  await git(fixture.parent, ["add", "modules/child"]);
  let state = await openRepo(fixture.parent);

  const blockedCreate = await action(fixture.parent, state, {
    action: "createStash",
    message: "blocked-gitlink",
    files: [],
  });
  assertStatus(blockedCreate, 400);
  assert.match(blockedCreate.body.error, /子模块/);
  assert.equal(await git(fixture.parent, ["stash", "list", "--format=%H"]), "");
  assert.match(await git(fixture.parent, ["diff", "--cached", "--name-only"]), /modules\/child/);

  await git(fixture.parent, ["stash", "push", "-m", "gitlink-repro"]);
  await git(fixture.parent, ["-c", "protocol.file.allow=always", "submodule", "update", "--init", "--recursive"]);
  state = await openRepo(fixture.parent);
  const stash = state.stashes.find((item) => item.message === "gitlink-repro");
  assert.ok(stash, "direct Git stash should create the legacy gitlink fixture");

  const blockedApply = await action(fixture.parent, state, {
    action: "applyStash",
    ref: stash.ref,
    sha: stash.sha,
  });
  assertStatus(blockedApply, 400);
  assert.match(blockedApply.body.error, /gitlink/);

  state = await readState(fixture.parent);
  assert.ok(state.stashes.some((item) => item.sha === stash.sha), "blocked apply must preserve the stash");
  const current = state.stashes.find((item) => item.sha === stash.sha);
  const blockedPop = await action(fixture.parent, state, {
    action: "popStash",
    ref: current.ref,
    sha: current.sha,
  });
  assertStatus(blockedPop, 400);

  state = await readState(fixture.parent);
  assert.ok(state.stashes.some((item) => item.sha === stash.sha), "blocked pop must preserve the stash");
  assert.equal(await git(fixture.parent, ["status", "--short"]), "");
});

test("stash checkout rejects hidden dirty submodule before partial mutation", { timeout: 120000 }, async (t) => {
  const fixture = await createSubmoduleFixture("checkout-stash");
  t.after(() => removeFixture(fixture.root));

  await fs.appendFile(fixture.notePath, "parent change\n", "utf8");
  await fs.appendFile(fixture.childFile, "child change\n", "utf8");
  const parentStatus = await git(fixture.parent, ["status", "--short"]);
  assert.equal(parentStatus, "M note.txt", "ignore=dirty should hide the child modification from parent status");

  const state = await openRepo(fixture.parent);
  assert.equal(state.submodules[0].dirtyCount, 1);
  const targetSha = state.branchInfo.target?.sha || "";
  assert.ok(targetSha, "target branch SHA should be available");

  const blocked = await action(fixture.parent, state, {
    action: "checkoutBranch",
    branch: "target",
    mode: "stash",
    expectedTargetSha: targetSha,
  });
  assertStatus(blocked, 400);
  assert.match(blocked.body.error, /子模块/);

  assert.equal(await git(fixture.parent, ["branch", "--show-current"]), "main");
  assert.match(await fs.readFile(fixture.notePath, "utf8"), /parent change/);
  assert.match(await git(fixture.submodule, ["status", "--short"]), /child\.txt/);
  assert.equal(await git(fixture.parent, ["stash", "list", "--format=%H"]), "");
});

test("authentication diagnostics load on demand and cache by remote configuration", { timeout: 120000 }, async (t) => {
  const fixture = await createRemoteFixture("auth-diagnostics");
  t.after(() => removeFixture(fixture.root));

  const state = await openRepo(fixture.repo);
  assert.equal(Object.hasOwn(state.sync, "auth"), false, "full state refresh should not probe local authentication tools");

  const missingContext = await request("/api/auth-diagnostics");
  assertStatus(missingContext, 400);
  assert.match(missingContext.body.error, /仓库上下文/);

  const first = await request("/api/auth-diagnostics", { repoPath: fixture.repo });
  assertStatus(first, 200);
  assert.equal(first.body.cached, false);
  assert.match(first.body.summary, /远端/);
  assert.ok(first.body.advice);
  assert.equal(first.body.remotes[0].kind, "https");
  assert.ok(first.body.ssh && first.body.agent && first.body.credentialManager);
  assert.ok(Array.isArray(first.body.commands));

  const second = await request("/api/auth-diagnostics", { repoPath: fixture.repo });
  assertStatus(second, 200);
  assert.equal(second.body.cached, true);
  assert.equal(second.body.checkedAt, first.body.checkedAt);

  const refreshed = await request("/api/auth-diagnostics?refresh=1", { repoPath: fixture.repo });
  assertStatus(refreshed, 200);
  assert.equal(refreshed.body.cached, false, "manual refresh must bypass the authentication diagnostics cache");

  await git(fixture.repo, ["remote", "set-url", "origin", "git@github.com:example/forkline-auth.git"]);
  const changedRemote = await request("/api/auth-diagnostics", { repoPath: fixture.repo });
  assertStatus(changedRemote, 200);
  assert.equal(changedRemote.body.cached, false, "changed remote URLs must not reuse stale authentication diagnostics");
  assert.equal(changedRemote.body.remotes[0].kind, "ssh");
});

test("optimized state reads preserve worktree and sync semantics", { timeout: 120000 }, async (t) => {
  const fixture = await createStateSnapshotFixture("state-snapshot");
  t.after(() => removeFixture(fixture.root));

  await fs.writeFile(fixture.draftPath, "untracked\n", "utf8");
  let state = await openRepo(fixture.repo);
  assert.equal(state.repo.branch, "main");
  assert.equal(state.sync.branch, "main");
  assert.equal(state.sync.detached, false);
  assert.equal(state.sync.unborn, false);
  assert.equal(state.sync.upstream, "origin/main");
  assert.equal(state.sync.upstreamSha, fixture.remoteSha);
  assert.equal(state.sync.ahead, 1);
  assert.equal(state.sync.behind, 0);
  assert.deepEqual(state.workingFiles.map((item) => item.file), ["draft.txt"]);
  const currentWorktree = state.worktrees.find((item) => path.resolve(item.path) === path.resolve(fixture.repo));
  assert.ok(currentWorktree, "current worktree should remain in the optimized state response");
  assert.equal(currentWorktree.status, "dirty");
  assert.equal(currentWorktree.dirtyCount, 1);
  assert.deepEqual(state.submodules, []);
  assert.equal(state.sync.remotes[0].name, "origin");
  assert.equal(Object.hasOwn(state, "reflogEntries"), false, "full state should not include recovery-tab reflog data");

  const missingReflogContext = await request("/api/reflog");
  assertStatus(missingReflogContext, 400);
  assert.match(missingReflogContext.body.error, /仓库上下文/);
  const reflog = await request("/api/reflog", { repoPath: fixture.repo });
  assertStatus(reflog, 200);
  assert.ok(reflog.body.reflogEntries.length > 0);
  assert.match(reflog.body.reflogEntries[0].selector, /^HEAD@\{.+\}$/);
  assert.equal(reflog.body.reflogEntries[0].sha, state.repo.headSha);

  await git(fixture.repo, ["switch", "--detach", "HEAD"]);
  state = await openRepo(fixture.repo);
  assert.equal(state.repo.branch, "detached HEAD");
  assert.equal(state.sync.branch, "HEAD");
  assert.equal(state.sync.detached, true);

  const unbornRepo = path.join(fixture.root, "unborn");
  await initRepository(unbornRepo);
  state = await openRepo(unbornRepo);
  assert.equal(state.repo.branch, "main");
  assert.equal(state.sync.branch, "main");
  assert.equal(state.sync.unborn, true);
  assert.equal(state.sync.detached, false);
  assert.equal(state.sync.upstream, "");
  const unbornReflog = await request("/api/reflog", { repoPath: unbornRepo });
  assertStatus(unbornReflog, 200);
  assert.deepEqual(unbornReflog.body.reflogEntries, []);
});

test("common worktree flow stages, unstages, commits, amends, and discards", { timeout: 120000 }, async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "forkline-common-worktree-"));
  t.after(() => removeFixture(root));

  const repo = path.join(root, "repo");
  const notePath = path.join(repo, "note.txt");
  const draftPath = path.join(repo, "draft.txt");
  await initRepository(repo);
  await fs.writeFile(notePath, "base\n", "utf8");
  await git(repo, ["add", "note.txt"]);
  await git(repo, ["commit", "-m", "base"]);

  await fs.appendFile(notePath, "first change\n", "utf8");
  await fs.writeFile(draftPath, "draft\n", "utf8");
  let state = await openRepo(repo);
  let note = state.workingFiles.find((item) => item.file === "note.txt");
  assert.ok(note?.snapshot);

  const stagedFile = await action(repo, state, {
    action: "stageFile",
    file: "note.txt",
    expectedFileSnapshot: note.snapshot,
  });
  assertStatus(stagedFile, 200);
  assert.match(await git(repo, ["diff", "--cached", "--", "note.txt"]), /first change/);

  state = await readState(repo);
  note = state.workingFiles.find((item) => item.file === "note.txt");
  assert.equal(note?.staged, true);
  assert.equal(note?.unstaged, false);
  const unstagedFile = await action(repo, state, {
    action: "unstageFile",
    file: "note.txt",
    expectedFileSnapshot: note.snapshot,
  });
  assertStatus(unstagedFile, 200);
  assert.equal(await git(repo, ["diff", "--cached", "--", "note.txt"]), "");
  assert.match(await git(repo, ["diff", "--", "note.txt"]), /first change/);

  state = await readState(repo);
  const stagedAll = await action(repo, state, { action: "stageAll" });
  assertStatus(stagedAll, 200);
  assert.match(await git(repo, ["diff", "--cached", "--name-only"]), /draft\.txt[\s\S]*note\.txt|note\.txt[\s\S]*draft\.txt/);

  state = await readState(repo);
  const committed = await action(repo, state, {
    action: "commit",
    summary: "common commit",
    body: "common body",
  });
  assertStatus(committed, 200);
  assert.equal(await git(repo, ["log", "-1", "--format=%s"]), "common commit");
  assert.equal(await git(repo, ["log", "-1", "--format=%b"]), "common body");
  assert.equal(await git(repo, ["status", "--short"]), "");

  const commitCount = Number(await git(repo, ["rev-list", "--count", "HEAD"]));
  await fs.appendFile(notePath, "amended change\n", "utf8");
  state = await readState(repo);
  const stagedAmend = await action(repo, state, { action: "stageAll" });
  assertStatus(stagedAmend, 200);
  state = await readState(repo);
  const amended = await action(repo, state, {
    action: "amendCommit",
    summary: "common amended",
    body: "amended body",
  });
  assertStatus(amended, 200);
  assert.equal(Number(await git(repo, ["rev-list", "--count", "HEAD"])), commitCount);
  assert.equal(await git(repo, ["log", "-1", "--format=%s"]), "common amended");
  assert.match(await git(repo, ["for-each-ref", "--format=%(refname)", "refs/forkline/recovery"]), /refs\/forkline\/recovery/);

  const committedContent = await fs.readFile(notePath, "utf8");
  await fs.appendFile(notePath, "discard file\n", "utf8");
  state = await readState(repo);
  note = state.workingFiles.find((item) => item.file === "note.txt");
  const discardedFile = await action(repo, state, {
    action: "discardWorktreeFile",
    file: "note.txt",
    expectedFileSnapshot: note.snapshot,
  });
  assertStatus(discardedFile, 200);
  assert.equal(await fs.readFile(notePath, "utf8"), committedContent);

  await fs.appendFile(notePath, "discard all\n", "utf8");
  const scratchPath = path.join(repo, "scratch.tmp");
  await fs.writeFile(scratchPath, "remove me\n", "utf8");
  state = await readState(repo);
  const discardedAll = await action(repo, state, { action: "discardAll" });
  assertStatus(discardedAll, 200);
  assert.equal(await git(repo, ["status", "--short"]), "");
  await assert.rejects(fs.stat(scratchPath), { code: "ENOENT" });
});

test("repository setup and patch flow clones, initializes, and applies patches", { timeout: 120000 }, async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "forkline-repository-setup-"));
  t.after(() => removeFixture(root));

  const source = path.join(root, "source");
  const cloned = path.join(root, "cloned");
  const initialized = path.join(root, "initialized");
  await initRepository(source);
  await fs.writeFile(path.join(source, "base.txt"), "base\n", "utf8");
  await git(source, ["add", "base.txt"]);
  await git(source, ["commit", "-m", "base"]);
  let state = await openRepo(source);

  const clonedResult = await action(source, state, {
    action: "cloneRepository",
    url: source,
    targetPath: cloned,
    openAfter: false,
  });
  assertStatus(clonedResult, 200);
  assert.equal(await fs.readFile(path.join(cloned, "base.txt"), "utf8"), "base\n");
  assert.equal(await git(cloned, ["log", "-1", "--format=%s"]), "base");

  await fs.mkdir(initialized, { recursive: true });
  await fs.writeFile(path.join(initialized, "existing.txt"), "keep\n", "utf8");
  const initializedResult = await action(source, state, {
    action: "initRepository",
    targetPath: initialized,
    openAfter: false,
  });
  assertStatus(initializedResult, 200);
  assert.equal(await git(initialized, ["rev-parse", "--is-inside-work-tree"]), "true");
  assert.equal(await fs.readFile(path.join(initialized, "existing.txt"), "utf8"), "keep\n");

  await fs.writeFile(path.join(source, "patch.txt"), "patch content\n", "utf8");
  await git(source, ["add", "patch.txt"]);
  await git(source, ["commit", "-m", "patch commit"]);
  const patch = await git(source, ["format-patch", "-1", "--stdout"]);

  state = await openRepo(cloned);
  const applied = await action(cloned, state, {
    action: "applyPatch",
    patch,
    stage: false,
  });
  assertStatus(applied, 200);
  assert.equal(await fs.readFile(path.join(cloned, "patch.txt"), "utf8"), "patch content\n");
  assert.match(await git(cloned, ["status", "--short"]), /\?\? patch\.txt/);

  state = await readState(cloned);
  const discarded = await action(cloned, state, { action: "discardAll" });
  assertStatus(discarded, 200);
  state = await readState(cloned);
  const appliedStaged = await action(cloned, state, {
    action: "applyPatch",
    patch,
    stage: true,
  });
  assertStatus(appliedStaged, 200);
  assert.match(await git(cloned, ["diff", "--cached", "--", "patch.txt"]), /\+patch content/);
  assert.equal(await git(cloned, ["diff", "--", "patch.txt"]), "");
});

test("common history flow covers branches, merge, cherry-pick, revert, tags, and reset modes", { timeout: 120000 }, async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "forkline-common-history-"));
  t.after(() => removeFixture(root));

  const repo = path.join(root, "repo");
  await initRepository(repo);
  await fs.writeFile(path.join(repo, "base.txt"), "base\n", "utf8");
  await git(repo, ["add", "base.txt"]);
  await git(repo, ["commit", "-m", "base"]);
  const baseSha = await git(repo, ["rev-parse", "HEAD"]);

  let state = await openRepo(repo);
  const createdFeature = await action(repo, state, {
    action: "createBranch",
    branch: "feature-work",
    checkout: true,
  });
  assertStatus(createdFeature, 200);
  assert.equal(await git(repo, ["branch", "--show-current"]), "feature-work");

  await fs.writeFile(path.join(repo, "feature.txt"), "feature\n", "utf8");
  await git(repo, ["add", "feature.txt"]);
  await git(repo, ["commit", "-m", "feature commit"]);
  const featureSha = await git(repo, ["rev-parse", "HEAD"]);

  state = await readState(repo);
  const checkedOutMain = await action(repo, state, {
    action: "checkoutBranch",
    branch: "main",
    mode: "keep",
    expectedTargetSha: baseSha,
  });
  assertStatus(checkedOutMain, 200);
  assert.equal(await git(repo, ["branch", "--show-current"]), "main");

  state = await readState(repo);
  const merged = await action(repo, state, {
    action: "mergeRef",
    ref: "feature-work",
    expectedTargetSha: featureSha,
  });
  assertStatus(merged, 200);
  const mergeSha = await git(repo, ["rev-parse", "HEAD"]);
  assert.equal((await git(repo, ["rev-list", "--parents", "-n", "1", "HEAD"])).split(/\s+/).length, 3);
  assert.equal(await fs.readFile(path.join(repo, "feature.txt"), "utf8"), "feature\n");

  state = await readState(repo);
  const renamed = await action(repo, state, {
    action: "renameBranch",
    branch: "feature-work",
    newBranch: "feature-done",
    sha: featureSha,
  });
  assertStatus(renamed, 200);
  assert.equal(await git(repo, ["show-ref", "--verify", "--hash", "refs/heads/feature-done"]), featureSha);

  state = await readState(repo);
  const deleted = await action(repo, state, {
    action: "deleteBranch",
    branch: "feature-done",
    sha: featureSha,
  });
  assertStatus(deleted, 200);
  assert.equal(await git(repo, ["branch", "--list", "feature-done"]), "");

  state = await readState(repo);
  const createdPickSource = await action(repo, state, {
    action: "createBranch",
    branch: "pick-source",
    checkout: true,
  });
  assertStatus(createdPickSource, 200);
  await fs.writeFile(path.join(repo, "picked.txt"), "picked\n", "utf8");
  await git(repo, ["add", "picked.txt"]);
  await git(repo, ["commit", "-m", "pick source"]);
  const pickSourceSha = await git(repo, ["rev-parse", "HEAD"]);

  state = await readState(repo);
  const returnedMain = await action(repo, state, {
    action: "checkoutBranch",
    branch: "main",
    mode: "keep",
    expectedTargetSha: mergeSha,
  });
  assertStatus(returnedMain, 200);

  state = await readState(repo);
  const picked = await action(repo, state, {
    action: "cherryPickCommit",
    sha: pickSourceSha,
  });
  assertStatus(picked, 200);
  const pickedSha = await git(repo, ["rev-parse", "HEAD"]);
  assert.equal(await fs.readFile(path.join(repo, "picked.txt"), "utf8"), "picked\n");

  state = await readState(repo);
  const reverted = await action(repo, state, {
    action: "revertCommit",
    sha: pickedSha,
  });
  assertStatus(reverted, 200);
  await assert.rejects(fs.stat(path.join(repo, "picked.txt")), { code: "ENOENT" });

  state = await readState(repo);
  const tagged = await action(repo, state, {
    action: "createTag",
    name: "qa-local",
    target: state.repo.headSha,
    annotated: true,
    message: "QA local tag",
  });
  assertStatus(tagged, 200);
  const tagObject = await git(repo, ["rev-parse", "refs/tags/qa-local"]);
  assert.equal(await git(repo, ["cat-file", "-t", "refs/tags/qa-local"]), "tag");
  const removedTag = await action(repo, state, {
    action: "deleteTag",
    name: "qa-local",
    sha: tagObject,
  });
  assertStatus(removedTag, 200);
  assert.equal(await git(repo, ["tag", "--list", "qa-local"]), "");

  await fs.writeFile(path.join(repo, "reset.txt"), "one\n", "utf8");
  await git(repo, ["add", "reset.txt"]);
  await git(repo, ["commit", "-m", "reset one"]);
  const resetBase = await git(repo, ["rev-parse", "HEAD"]);
  await fs.writeFile(path.join(repo, "reset.txt"), "one\ntwo\n", "utf8");
  await git(repo, ["add", "reset.txt"]);
  await git(repo, ["commit", "-m", "reset two"]);
  const resetLatest = await git(repo, ["rev-parse", "HEAD"]);

  state = await readState(repo);
  const softReset = await action(repo, state, {
    action: "resetToCommit",
    sha: resetBase,
    mode: "soft",
  });
  assertStatus(softReset, 200);
  assert.equal(await git(repo, ["rev-parse", "HEAD"]), resetBase);
  assert.match(await git(repo, ["diff", "--cached", "--", "reset.txt"]), /\+two/);

  await git(repo, ["reset", "--hard", resetLatest]);
  state = await readState(repo);
  const mixedReset = await action(repo, state, {
    action: "resetToCommit",
    sha: resetBase,
    mode: "mixed",
  });
  assertStatus(mixedReset, 200);
  assert.equal(await git(repo, ["rev-parse", "HEAD"]), resetBase);
  assert.equal(await git(repo, ["diff", "--cached", "--", "reset.txt"]), "");
  assert.match(await git(repo, ["diff", "--", "reset.txt"]), /\+two/);

  await git(repo, ["reset", "--hard", resetLatest]);
  state = await readState(repo);
  const hardReset = await action(repo, state, {
    action: "resetToCommit",
    sha: resetBase,
    mode: "hard",
  });
  assertStatus(hardReset, 200);
  assert.equal(await git(repo, ["rev-parse", "HEAD"]), resetBase);
  assert.equal(await fs.readFile(path.join(repo, "reset.txt"), "utf8"), "one\n");
  assert.equal(await git(repo, ["status", "--short"]), "");
});

test("history editing rewords, fixups, squashes, and drops linear commits", { timeout: 120000 }, async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "forkline-history-editing-"));
  t.after(() => removeFixture(root));

  const repo = path.join(root, "repo");
  await initRepository(repo);
  await fs.writeFile(path.join(repo, "base.txt"), "base\n", "utf8");
  await git(repo, ["add", "base.txt"]);
  await git(repo, ["commit", "-m", "base"]);
  await fs.writeFile(path.join(repo, "first.txt"), "first\n", "utf8");
  await git(repo, ["add", "first.txt"]);
  await git(repo, ["commit", "-m", "first old"]);
  const firstSha = await git(repo, ["rev-parse", "HEAD"]);
  await fs.writeFile(path.join(repo, "second.txt"), "second\n", "utf8");
  await git(repo, ["add", "second.txt"]);
  await git(repo, ["commit", "-m", "second"]);

  let state = await openRepo(repo);
  const reworded = await action(repo, state, {
    action: "rewordCommit",
    sha: firstSha,
    summary: "first rewritten",
    body: "rewritten body",
  });
  assertStatus(reworded, 200);
  let subjects = (await git(repo, ["log", "--format=%s"])).split(/\r?\n/);
  assert.deepEqual(subjects, ["second", "first rewritten", "base"]);
  assert.equal(await fs.readFile(path.join(repo, "first.txt"), "utf8"), "first\n");
  assert.equal(await fs.readFile(path.join(repo, "second.txt"), "utf8"), "second\n");

  state = await readState(repo);
  const fixupTarget = state.repo.headSha;
  const fixedUp = await action(repo, state, {
    action: "rewriteHistoryCommit",
    sha: fixupTarget,
    mode: "fixup",
  });
  assertStatus(fixedUp, 200);
  assert.equal(Number(await git(repo, ["rev-list", "--count", "HEAD"])), 2);
  assert.equal(await fs.readFile(path.join(repo, "second.txt"), "utf8"), "second\n");

  await fs.writeFile(path.join(repo, "squash.txt"), "squash\n", "utf8");
  await git(repo, ["add", "squash.txt"]);
  await git(repo, ["commit", "-m", "squash me"]);
  state = await readState(repo);
  const squashed = await action(repo, state, {
    action: "rewriteHistoryCommit",
    sha: state.repo.headSha,
    mode: "squash",
  });
  assertStatus(squashed, 200);
  assert.equal(Number(await git(repo, ["rev-list", "--count", "HEAD"])), 2);
  assert.equal(await fs.readFile(path.join(repo, "squash.txt"), "utf8"), "squash\n");

  await fs.writeFile(path.join(repo, "drop.txt"), "drop\n", "utf8");
  await git(repo, ["add", "drop.txt"]);
  await git(repo, ["commit", "-m", "drop me"]);
  state = await readState(repo);
  const dropped = await action(repo, state, {
    action: "rewriteHistoryCommit",
    sha: state.repo.headSha,
    mode: "drop",
  });
  assertStatus(dropped, 200);
  assert.equal(Number(await git(repo, ["rev-list", "--count", "HEAD"])), 2);
  await assert.rejects(fs.stat(path.join(repo, "drop.txt")), { code: "ENOENT" });
  assert.match(await git(repo, ["for-each-ref", "--format=%(refname)", "refs/forkline/recovery"]), /refs\/forkline\/recovery/);
  assert.equal(await git(repo, ["status", "--short"]), "");
});

test("merge conflicts can be aborted or resolved and continued", { timeout: 120000 }, async (t) => {
  const fixture = await createConflictFixture("merge-conflict", "feature-conflict");
  t.after(() => removeFixture(fixture.root));

  let state = await openRepo(fixture.repo);
  let conflicted = await action(fixture.repo, state, {
    action: "mergeRef",
    ref: fixture.sourceBranch,
    expectedTargetSha: fixture.sourceSha,
  });
  assertStatus(conflicted, 400);
  assert.match(conflicted.body.error, /冲突|conflict/i);
  state = await readState(fixture.repo);
  assert.equal(state.repo.operation?.type, "merge");
  assert.equal(state.workingFiles.find((item) => item.file === "conflict.txt")?.conflict, true);

  const aborted = await action(fixture.repo, state, {
    action: "abortMerge",
    ...operationSnapshot(state),
  });
  assertStatus(aborted, 200);
  assert.equal(await fs.readFile(fixture.filePath, "utf8"), "main\n");
  assert.equal(await git(fixture.repo, ["status", "--short"]), "");

  state = await readState(fixture.repo);
  conflicted = await action(fixture.repo, state, {
    action: "mergeRef",
    ref: fixture.sourceBranch,
    expectedTargetSha: fixture.sourceSha,
  });
  assertStatus(conflicted, 400);
  state = await readState(fixture.repo);
  const conflictFile = state.workingFiles.find((item) => item.file === "conflict.txt");
  const resolved = await action(fixture.repo, state, {
    action: "resolveConflictFile",
    file: "conflict.txt",
    side: "theirs",
    expectedFileSnapshot: conflictFile.snapshot,
    ...operationSnapshot(state),
  });
  assertStatus(resolved, 200);
  assert.equal(await fs.readFile(fixture.filePath, "utf8"), "source\n");

  state = await readState(fixture.repo);
  assert.equal(state.repo.operation?.type, "merge");
  assert.equal(state.workingFiles.some((item) => item.conflict), false);
  const continued = await action(fixture.repo, state, {
    action: "continueMerge",
    ...operationSnapshot(state),
  });
  assertStatus(continued, 200);
  assert.equal((await git(fixture.repo, ["rev-list", "--parents", "-n", "1", "HEAD"])).split(/\s+/).length, 3);
  assert.equal(await git(fixture.repo, ["status", "--short"]), "");
});

test("cherry-pick conflicts can be aborted or resolved and continued", { timeout: 120000 }, async (t) => {
  const fixture = await createConflictFixture("cherry-conflict", "pick-conflict");
  t.after(() => removeFixture(fixture.root));

  let state = await openRepo(fixture.repo);
  let conflicted = await action(fixture.repo, state, {
    action: "cherryPickCommit",
    sha: fixture.sourceSha,
  });
  assertStatus(conflicted, 400);
  assert.match(conflicted.body.error, /冲突|conflict/i);
  state = await readState(fixture.repo);
  assert.equal(state.repo.operation?.type, "cherryPick");

  const aborted = await action(fixture.repo, state, {
    action: "abortCherryPick",
    ...operationSnapshot(state),
  });
  assertStatus(aborted, 200);
  assert.equal(await fs.readFile(fixture.filePath, "utf8"), "main\n");
  assert.equal(await git(fixture.repo, ["status", "--short"]), "");

  state = await readState(fixture.repo);
  conflicted = await action(fixture.repo, state, {
    action: "cherryPickCommit",
    sha: fixture.sourceSha,
  });
  assertStatus(conflicted, 400);
  state = await readState(fixture.repo);
  const conflictFile = state.workingFiles.find((item) => item.file === "conflict.txt");
  const resolved = await action(fixture.repo, state, {
    action: "resolveConflictFile",
    file: "conflict.txt",
    side: "theirs",
    expectedFileSnapshot: conflictFile.snapshot,
    ...operationSnapshot(state),
  });
  assertStatus(resolved, 200);
  assert.equal(await fs.readFile(fixture.filePath, "utf8"), "source\n");

  state = await readState(fixture.repo);
  const continued = await action(fixture.repo, state, {
    action: "continueCherryPick",
    ...operationSnapshot(state),
  });
  assertStatus(continued, 200);
  assert.equal(await git(fixture.repo, ["log", "-1", "--format=%s"]), "source conflict");
  assert.equal(await git(fixture.repo, ["status", "--short"]), "");
});

test("revert conflicts can be aborted or manually resolved and continued", { timeout: 120000 }, async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "forkline-revert-conflict-"));
  t.after(() => removeFixture(root));

  const repo = path.join(root, "repo");
  const filePath = path.join(repo, "conflict.txt");
  await initRepository(repo);
  await fs.writeFile(filePath, "base\n", "utf8");
  await git(repo, ["add", "conflict.txt"]);
  await git(repo, ["commit", "-m", "base"]);
  await fs.writeFile(filePath, "target\n", "utf8");
  await git(repo, ["add", "conflict.txt"]);
  await git(repo, ["commit", "-m", "target change"]);
  const targetSha = await git(repo, ["rev-parse", "HEAD"]);
  await fs.writeFile(filePath, "current\n", "utf8");
  await git(repo, ["add", "conflict.txt"]);
  await git(repo, ["commit", "-m", "current change"]);

  let state = await openRepo(repo);
  let conflicted = await action(repo, state, {
    action: "revertCommit",
    sha: targetSha,
  });
  assertStatus(conflicted, 400);
  assert.match(conflicted.body.error, /冲突|conflict/i);
  state = await readState(repo);
  assert.equal(state.repo.operation?.type, "revert");

  const aborted = await action(repo, state, {
    action: "abortRevert",
    ...operationSnapshot(state),
  });
  assertStatus(aborted, 200);
  assert.equal(await fs.readFile(filePath, "utf8"), "current\n");
  assert.equal(await git(repo, ["status", "--short"]), "");

  state = await readState(repo);
  conflicted = await action(repo, state, {
    action: "revertCommit",
    sha: targetSha,
  });
  assertStatus(conflicted, 400);
  await fs.writeFile(filePath, "base\n", "utf8");
  await git(repo, ["add", "conflict.txt"]);
  state = await readState(repo);
  const continued = await action(repo, state, {
    action: "continueRevert",
    ...operationSnapshot(state),
  });
  assertStatus(continued, 200);
  assert.equal(await fs.readFile(filePath, "utf8"), "base\n");
  assert.match(await git(repo, ["log", "-1", "--format=%s"]), /Revert/);
  assert.equal(await git(repo, ["status", "--short"]), "");
});

test("common sync flow covers rebase pull, push, fetch, fast-forward pull, and remote tags", { timeout: 120000 }, async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "forkline-common-sync-"));
  t.after(() => removeFixture(root));

  const repo = path.join(root, "repo");
  const remote = path.join(root, "origin.git");
  const peer = path.join(root, "peer");
  await initRepository(repo);
  await fs.writeFile(path.join(repo, "base.txt"), "base\n", "utf8");
  await git(repo, ["add", "base.txt"]);
  await git(repo, ["commit", "-m", "base"]);
  await git("", ["init", "--bare", "--initial-branch=main", remote]);
  await git(repo, ["remote", "add", "origin", remote]);
  await git(repo, ["push", "-u", "origin", "main"]);
  await git("", ["clone", remote, peer]);
  await git(peer, ["config", "user.name", "Forkline Peer"]);
  await git(peer, ["config", "user.email", "peer@example.invalid"]);
  await git(peer, ["config", "core.autocrlf", "false"]);

  await fs.writeFile(path.join(repo, "local.txt"), "local\n", "utf8");
  await git(repo, ["add", "local.txt"]);
  await git(repo, ["commit", "-m", "local ahead"]);
  const localBeforeRebase = await git(repo, ["rev-parse", "HEAD"]);

  await fs.writeFile(path.join(peer, "remote.txt"), "remote one\n", "utf8");
  await git(peer, ["add", "remote.txt"]);
  await git(peer, ["commit", "-m", "remote one"]);
  await git(peer, ["push", "origin", "main"]);

  let state = await openRepo(repo);
  let upstream = upstreamSnapshot(state);
  const rebased = await action(repo, state, {
    action: "pullRebase",
    ...upstream,
  });
  assertStatus(rebased, 200);
  assert.equal(await fs.readFile(path.join(repo, "local.txt"), "utf8"), "local\n");
  assert.equal(await fs.readFile(path.join(repo, "remote.txt"), "utf8"), "remote one\n");
  assert.notEqual(await git(repo, ["rev-parse", "HEAD"]), localBeforeRebase);

  state = await readState(repo);
  upstream = upstreamSnapshot(state);
  const pushed = await action(repo, state, {
    action: "push",
    ...upstream,
  });
  assertStatus(pushed, 200);
  assert.equal(await git(remote, ["rev-parse", "refs/heads/main"]), await git(repo, ["rev-parse", "HEAD"]));

  await git(peer, ["pull", "--ff-only"]);
  await fs.writeFile(path.join(peer, "remote-two.txt"), "remote two\n", "utf8");
  await git(peer, ["add", "remote-two.txt"]);
  await git(peer, ["commit", "-m", "remote two"]);
  await git(peer, ["push", "origin", "main"]);

  state = await readState(repo);
  const fetched = await action(repo, state, {
    action: "fetch",
    expectedRemotes: state.sync.remotes.map((item) => ({
      name: item.name,
      fetchUrl: item.fetchUrl,
      pushUrl: item.pushUrl,
      pushUrls: item.pushUrls,
    })),
  });
  assertStatus(fetched, 200);
  state = await readState(repo);
  assert.equal(state.sync.behind, 1);
  upstream = upstreamSnapshot(state);
  const pulled = await action(repo, state, {
    action: "pull",
    ...upstream,
  });
  assertStatus(pulled, 200);
  assert.equal(await fs.readFile(path.join(repo, "remote-two.txt"), "utf8"), "remote two\n");
  assert.equal(await git(repo, ["rev-parse", "HEAD"]), await git(remote, ["rev-parse", "refs/heads/main"]));

  state = await readState(repo);
  const createdTag = await action(repo, state, {
    action: "createTag",
    name: "qa-sync",
    target: state.repo.headSha,
    annotated: false,
  });
  assertStatus(createdTag, 200);
  const tagObject = await git(repo, ["rev-parse", "refs/tags/qa-sync"]);
  const remoteConfig = remoteSnapshot(state, "origin");
  const pushedTag = await action(repo, state, {
    action: "pushTag",
    name: "qa-sync",
    remote: "origin",
    sha: tagObject,
    ...remoteConfig,
  });
  assertStatus(pushedTag, 200);
  assert.equal(await git(remote, ["rev-parse", "refs/tags/qa-sync"]), tagObject);

  const deletedRemoteTag = await action(repo, state, {
    action: "deleteRemoteTag",
    name: "qa-sync",
    remote: "origin",
    sha: tagObject,
    ...remoteConfig,
  });
  assertStatus(deletedRemoteTag, 200);
  assert.equal(await git(remote, ["tag", "--list", "qa-sync"]), "");

  const deletedLocalTag = await action(repo, state, {
    action: "deleteTag",
    name: "qa-sync",
    sha: tagObject,
  });
  assertStatus(deletedLocalTag, 200);
  assert.equal(await git(repo, ["tag", "--list", "qa-sync"]), "");
});

test("long-running fetch streams progress and cancellation stops its process tree", { timeout: 120000, skip: process.platform !== "win32" }, async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "forkline-operation-cancel-"));
  const repo = path.join(root, "repo");
  const helperPath = path.join(root, "slow-ssh.js");
  const pidPath = path.join(root, "slow-ssh.pid");
  let helperPid = 0;
  t.after(async () => {
    await terminateTestProcess(helperPid);
    await removeFixture(root);
  });

  await initRepository(repo);
  await fs.writeFile(path.join(repo, "base.txt"), "base\n", "utf8");
  await git(repo, ["add", "base.txt"]);
  await git(repo, ["commit", "-m", "base"]);
  await fs.writeFile(helperPath, `
"use strict";
const fs = require("node:fs");
fs.writeFileSync(process.argv[2], String(process.pid));
process.stderr.write("forkline-progress-ready\\n");
setInterval(() => process.stderr.write("forkline-progress-tick\\n"), 100);
`, "utf8");
  const sshCommand = `node "${helperPath.replaceAll("\\", "/")}" "${pidPath.replaceAll("\\", "/")}"`;
  await git(repo, ["config", "core.sshCommand", sshCommand]);
  await git(repo, ["config", "ssh.variant", "ssh"]);
  await git(repo, ["remote", "add", "origin", "ssh://forkline.invalid/repo.git"]);

  const state = await openRepo(repo);
  const actionPromise = action(repo, state, {
    action: "fetch",
    expectedRemotes: state.sync.remotes.map((item) => ({
      name: item.name,
      fetchUrl: item.fetchUrl,
      pushUrl: item.pushUrl,
      pushUrls: item.pushUrls,
    })),
  });
  const running = await waitForRunningOperation("fetch", (item) => item.outputTail.includes("forkline-progress-ready"));
  assert.equal(running.cancellable, true);
  assert.equal(running.phase, "running");
  assert.match(running.command, /git -C .* fetch --progress --all --prune/);
  assert.match(running.outputTail, /forkline-progress-ready/);
  helperPid = Number(await waitForFile(pidPath));
  assert.equal(processExists(helperPid), true);

  const cancelled = await request("/api/operations/cancel", {
    method: "POST",
    body: { id: running.id },
  });
  assertStatus(cancelled, 200);
  assert.match(cancelled.body.output, /取消请求/);

  const actionResult = await withTimeout(actionPromise, 10000, "cancelled fetch response");
  assertStatus(actionResult, 400);
  assert.equal(actionResult.body.cancelled, true);
  assert.match(actionResult.body.error, /操作已取消/);
  await waitForProcessExit(helperPid);

  const operations = await waitForNoRunningOperations();
  const log = operations.operationLog.find((item) => item.action === "fetch" && item.status === "cancelled");
  assert.ok(log, "missing cancelled fetch log");
  assert.match(log.command, /fetch --progress --all --prune/);
  assert.match(log.outputTail, /forkline-progress-ready/);
  for (const lockName of ["index.lock", "FETCH_HEAD.lock", "packed-refs.lock", "shallow.lock"]) {
    assert.equal(await fileExists(path.join(repo, ".git", lockName)), false, `${lockName} should not remain after cancellation`);
  }
});

async function createStateSnapshotFixture(label) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), `forkline-${label}-`));
  const repo = path.join(root, "repo");
  const remote = path.join(root, "remote.git");
  const notePath = path.join(repo, "note.txt");
  const draftPath = path.join(repo, "draft.txt");
  await initRepository(repo);
  await fs.writeFile(notePath, "base\n", "utf8");
  await git(repo, ["add", "note.txt"]);
  await git(repo, ["commit", "-m", "base"]);
  const remoteSha = await git(repo, ["rev-parse", "HEAD"]);
  await git("", ["init", "--bare", "--initial-branch=main", remote]);
  await git(repo, ["remote", "add", "origin", remote]);
  await git(repo, ["push", "-u", "origin", "main"]);
  await fs.appendFile(notePath, "local ahead\n", "utf8");
  await git(repo, ["add", "note.txt"]);
  await git(repo, ["commit", "-m", "local-ahead"]);
  return { root, repo, remote, notePath, draftPath, remoteSha };
}

async function createRemoteFixture(label) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), `forkline-${label}-`));
  const repo = path.join(root, "repo");
  await initRepository(repo);
  await fs.writeFile(path.join(repo, "note.txt"), "base\n", "utf8");
  await git(repo, ["add", "note.txt"]);
  await git(repo, ["commit", "-m", "base"]);
  await git(repo, ["remote", "add", "origin", "https://github.com/example/forkline-auth.git"]);
  return { root, repo };
}

async function createConflictFixture(label, sourceBranch) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), `forkline-${label}-`));
  const repo = path.join(root, "repo");
  const filePath = path.join(repo, "conflict.txt");
  await initRepository(repo);
  await fs.writeFile(filePath, "base\n", "utf8");
  await git(repo, ["add", "conflict.txt"]);
  await git(repo, ["commit", "-m", "base"]);

  await git(repo, ["switch", "-c", sourceBranch]);
  await fs.writeFile(filePath, "source\n", "utf8");
  await git(repo, ["add", "conflict.txt"]);
  await git(repo, ["commit", "-m", "source conflict"]);
  const sourceSha = await git(repo, ["rev-parse", "HEAD"]);

  await git(repo, ["switch", "main"]);
  await fs.writeFile(filePath, "main\n", "utf8");
  await git(repo, ["add", "conflict.txt"]);
  await git(repo, ["commit", "-m", "main conflict"]);
  return { root, repo, filePath, sourceBranch, sourceSha };
}

async function createSubmoduleFixture(label) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), `forkline-${label}-`));
  const childSource = path.join(root, "child-source");
  const parent = path.join(root, "parent");
  const submodule = path.join(parent, "modules", "child");
  const childFile = path.join(submodule, "child.txt");
  const notePath = path.join(parent, "note.txt");

  await initRepository(childSource);
  await fs.writeFile(path.join(childSource, "child.txt"), "one\n", "utf8");
  await git(childSource, ["add", "child.txt"]);
  await git(childSource, ["commit", "-m", "child-one"]);
  const childFirst = await git(childSource, ["rev-parse", "HEAD"]);
  await fs.writeFile(path.join(childSource, "child.txt"), "two\n", "utf8");
  await git(childSource, ["add", "child.txt"]);
  await git(childSource, ["commit", "-m", "child-two"]);
  const childSecond = await git(childSource, ["rev-parse", "HEAD"]);

  await initRepository(parent);
  await fs.writeFile(notePath, "base\n", "utf8");
  await git(parent, ["-c", "protocol.file.allow=always", "submodule", "add", childSource, "modules/child"]);
  await git(submodule, ["checkout", "--detach", childFirst]);
  await git(parent, ["add", "."]);
  await git(parent, ["commit", "-m", "parent-base"]);

  await git(parent, ["switch", "-c", "target"]);
  await git(submodule, ["checkout", "--detach", childSecond]);
  await git(parent, ["add", "modules/child"]);
  await git(parent, ["commit", "-m", "target-gitlink"]);
  await git(parent, ["-c", "submodule.recurse=false", "switch", "main"]);
  await git(submodule, ["checkout", "--detach", childFirst]);
  await git(parent, ["config", "submodule.recurse", "true"]);
  await git(parent, ["config", "submodule.modules/child.ignore", "dirty"]);
  assert.equal(await git(parent, ["status", "--short"]), "");

  return { root, parent, submodule, childFile, notePath, childFirst, childSecond };
}

async function initRepository(repoPath) {
  await fs.mkdir(repoPath, { recursive: true });
  await git("", ["init", "--initial-branch=main", repoPath]);
  await git(repoPath, ["config", "user.name", "Forkline Test"]);
  await git(repoPath, ["config", "user.email", "forkline@example.invalid"]);
  await git(repoPath, ["config", "core.autocrlf", "false"]);
}

async function createFastLinearHistory(repoPath, count) {
  const lines = ["blob", "mark :1", "data 5", "base", ""];
  const timestamp = 1700000000;
  for (let index = 1; index <= count; index += 1) {
    const message = `history ${String(index).padStart(3, "0")}`;
    lines.push(
      "commit refs/heads/main",
      `mark :${index + 1}`,
      `author Forkline Test <forkline@example.invalid> ${timestamp + index} +0000`,
      `committer Forkline Test <forkline@example.invalid> ${timestamp + index} +0000`,
      `data ${Buffer.byteLength(message)}`,
      message
    );
    if (index === 1) lines.push("M 100644 :1 history.txt");
    lines.push("");
  }
  lines.push("done", "");

  await new Promise((resolve, reject) => {
    const child = spawn("git", ["-C", repoPath, "fast-import", "--quiet"], {
      env: gitEnv,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`git fast-import failed (${code}): ${stderr}`));
    });
    child.stdin.end(lines.join("\n"));
  });
  await git(repoPath, ["reset", "--hard", "main"]);
}

function diffSelectionForText(diff, targetText) {
  let hunkIndex = -1;
  let lineIndex = -1;
  for (const line of diff || []) {
    if (line.type === "meta") {
      if (String(line.text || "").startsWith("@@ ")) {
        hunkIndex = line.hunkIndex;
        lineIndex = -1;
      }
      continue;
    }
    if (!Number.isInteger(hunkIndex)) continue;
    lineIndex += 1;
    if (line.text === targetText) return { hunkIndex, lineIndex };
  }
  return null;
}

async function git(repoPath, args) {
  const fullArgs = repoPath ? ["-C", repoPath, ...args] : args;
  try {
    const { stdout } = await execFileAsync("git", fullArgs, {
      env: gitEnv,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
      windowsHide: true,
    });
    return String(stdout || "").trim();
  } catch (error) {
    const detail = [error.stdout, error.stderr, error.message].filter(Boolean).join("\n");
    throw new Error(`git ${fullArgs.join(" ")} failed:\n${detail}`);
  }
}

async function openRepo(repoPath) {
  const response = await request("/api/open", {
    method: "POST",
    body: { path: repoPath },
  });
  assertStatus(response, 200);
  return response.body;
}

async function readState(repoPath) {
  const response = await request("/api/state", { repoPath });
  assertStatus(response, 200);
  return response.body;
}

async function action(repoPath, state, payload) {
  return request("/api/action", {
    method: "POST",
    repoPath,
    body: {
      expectedBranch: state.repo.branch,
      expectedHead: state.repo.headSha,
      expectedWorktreeSnapshot: state.worktreeSnapshot,
      ...payload,
    },
  });
}

function upstreamSnapshot(state) {
  const upstream = String(state.sync.upstream || "");
  const remoteName = String(state.sync.remote || upstream.split("/")[0] || "");
  const remote = state.sync.remotes.find((item) => item.name === remoteName);
  assert.ok(remote, `missing remote snapshot for ${remoteName || upstream}`);
  return {
    expectedUpstream: upstream,
    expectedUpstreamRemote: remoteName,
    expectedUpstreamFetchUrl: remote.fetchUrl,
    expectedUpstreamPushUrl: remote.pushUrl,
    expectedUpstreamPushUrls: remote.pushUrls,
  };
}

function remoteSnapshot(state, name) {
  const remote = state.sync.remotes.find((item) => item.name === name);
  assert.ok(remote, `missing remote snapshot for ${name}`);
  return {
    expectedFetchUrl: remote.fetchUrl,
    expectedPushUrl: remote.pushUrl,
    expectedPushUrls: remote.pushUrls,
  };
}

function operationSnapshot(state) {
  const operation = state.repo.operation;
  assert.ok(operation?.type && operation?.snapshot, "missing repository operation snapshot");
  return {
    expectedOperationType: operation.type,
    expectedOperationSnapshot: operation.snapshot,
  };
}

async function request(pathname, options = {}) {
  const headers = { "Content-Type": "application/json" };
  if (options.locale) headers["X-Forkline-Locale"] = options.locale;
  if (Object.hasOwn(options, "repoPathHeader")) {
    headers["X-Forkline-Repo-Path"] = options.repoPathHeader;
  } else if (options.repoPath) {
    headers["X-Forkline-Repo-Path"] = `v1:${encodeURIComponent(options.repoPath)}`;
  }
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: options.method || "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const raw = await response.text();
  let body = {};
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    body = { error: raw || "响应不是 JSON" };
  }
  return { status: response.status, body };
}

function assertStatus(response, expected) {
  assert.equal(
    response.status,
    expected,
    `HTTP ${response.status}, expected ${expected}\n${JSON.stringify(response.body, null, 2)}\nServer log:\n${serverLog}`
  );
}

async function freePort() {
  const socket = net.createServer();
  socket.unref();
  await new Promise((resolve, reject) => {
    socket.once("error", reject);
    socket.listen(0, "127.0.0.1", resolve);
  });
  const address = socket.address();
  const port = typeof address === "object" && address ? address.port : 0;
  await new Promise((resolve) => socket.close(resolve));
  return port;
}

async function waitForServer() {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (serverProcess.exitCode !== null) throw new Error(`Forkline server exited early:\n${serverLog}`);
    try {
      const response = await fetch(`${baseUrl}/api/state`);
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }
    await delay(100);
  }
  throw new Error(`Timed out waiting for Forkline server:\n${serverLog}`);
}

async function stopServer() {
  if (!serverProcess || serverProcess.exitCode !== null) return;
  const exited = once(serverProcess, "exit");
  serverProcess.kill();
  await Promise.race([exited, delay(5000)]);
  if (serverProcess.exitCode === null) serverProcess.kill("SIGKILL");
}

async function waitForRunningOperation(actionName, predicate = () => true) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    const response = await request("/api/operations");
    assertStatus(response, 200);
    const operation = response.body.runningOperations.find((item) => item.action === actionName);
    if (operation && predicate(operation)) return operation;
    await delay(100);
  }
  throw new Error(`Timed out waiting for running operation ${actionName}\nServer log:\n${serverLog}`);
}

async function waitForNoRunningOperations() {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    const response = await request("/api/operations");
    assertStatus(response, 200);
    if (!response.body.runningOperations.length) return response.body;
    await delay(100);
  }
  throw new Error(`Timed out waiting for operations to finish\nServer log:\n${serverLog}`);
}

async function waitForFile(filePath) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    try {
      return await fs.readFile(filePath, "utf8");
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    await delay(50);
  }
  throw new Error(`Timed out waiting for file ${filePath}`);
}

async function waitForProcessExit(pid) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (!processExists(pid)) return;
    await delay(50);
  }
  throw new Error(`Process ${pid} is still running after cancellation`);
}

function processExists(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function terminateTestProcess(pid) {
  if (!processExists(pid)) return;
  if (process.platform === "win32") {
    await execFileAsync("taskkill.exe", ["/PID", String(pid), "/T", "/F"], { windowsHide: true }).catch(() => {});
    return;
  }
  try {
    process.kill(pid, "SIGKILL");
  } catch {
    // The process already exited.
  }
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function withTimeout(promise, timeoutMs, label) {
  return Promise.race([
    promise,
    delay(timeoutMs).then(() => {
      throw new Error(`Timed out waiting for ${label}`);
    }),
  ]);
}

async function removeFixture(root) {
  await fs.rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

function appendServerLog(chunk) {
  serverLog = `${serverLog}${String(chunk || "")}`.slice(-12000);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
