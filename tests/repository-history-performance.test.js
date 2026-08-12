"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { createRepositoryHistoryService } = require("../server/repository-history");

const BASE_SHA = "1".repeat(40);
const HEAD_SHA = "2".repeat(40);
const MERGE_BASE_SHA = "3".repeat(40);

test("branch comparison overlaps independent reads and keeps a resolved commit snapshot", async () => {
  const calls = [];
  let releaseBranchName;
  let releaseCounts;
  const branchNameGate = new Promise((resolve) => { releaseBranchName = resolve; });
  const countsGate = new Promise((resolve) => { releaseCounts = resolve; });

  const service = createService({
    readBranchDisplayName: async () => {
      calls.push("branch-name");
      return branchNameGate;
    },
    hasHeadCommit: async () => {
      calls.push("head-state");
      return true;
    },
    git: async (_repo, args) => {
      calls.push(args.join(" "));
      if (args[0] === "rev-parse" && args.length > 3) return compareSnapshotOutput();
      if (args[0] === "rev-parse") return args.includes("main^{commit}") ? BASE_SHA : HEAD_SHA;
      if (args[0] === "merge-base") return MERGE_BASE_SHA;
      if (args[0] === "rev-list") return countsGate;
      return "";
    },
  });

  const comparisonPromise = service.readCompare("main", "feature/review");
  await nextTurn();
  const headStateStartedWithBranchName = calls.includes("head-state");
  releaseBranchName("main");

  await waitFor(() => calls.some((call) => call.startsWith("rev-list --left-right --count ")));
  await nextTurn();
  const resultReadsStartedWithCounts = [
    `log --max-count=40 --date=relative --format=%H%x00%h%x00%an%x00%ar%x00%s%x00%P ${HEAD_SHA}..${BASE_SHA}`,
    `log --max-count=40 --date=relative --format=%H%x00%h%x00%an%x00%ar%x00%s%x00%P ${BASE_SHA}..${HEAD_SHA}`,
    `diff --name-status --find-renames ${BASE_SHA}...${HEAD_SHA}`,
    `diff --unified=8 --no-ext-diff ${BASE_SHA}...${HEAD_SHA}`,
  ].every((command) => calls.includes(command));
  releaseCounts("1\t1");

  const comparison = await comparisonPromise;
  const snapshotCalls = calls.filter((call) => call === `rev-parse main^{commit} feature/review^{commit} main...feature/review`);
  assert.equal(headStateStartedWithBranchName, true);
  assert.equal(resultReadsStartedWithCounts, true);
  assert.equal(snapshotCalls.length, 1);
  assert.equal(calls.some((call) => call.startsWith("merge-base ")), false);
  assert.equal(comparison.baseSha, BASE_SHA);
  assert.equal(comparison.headSha, HEAD_SHA);
  assert.ok(calls.includes(`rev-list --left-right --count ${BASE_SHA}...${HEAD_SHA}`));
  assert.ok(calls.includes(`log --max-count=40 --date=relative --format=%H%x00%h%x00%an%x00%ar%x00%s%x00%P ${HEAD_SHA}..${BASE_SHA}`));
  assert.ok(calls.includes(`log --max-count=40 --date=relative --format=%H%x00%h%x00%an%x00%ar%x00%s%x00%P ${BASE_SHA}..${HEAD_SHA}`));
  assert.ok(calls.includes(`diff --name-status --find-renames ${BASE_SHA}...${HEAD_SHA}`));
  assert.ok(calls.includes(`diff --unified=8 --no-ext-diff ${BASE_SHA}...${HEAD_SHA}`));
});

test("branch comparison falls back to labelled validation when snapshot expansion fails", async () => {
  const calls = [];
  const service = createService({
    git: async (_repo, args) => {
      calls.push(args.join(" "));
      if (args[0] !== "rev-parse") return "";
      if (args.length > 3) throw new Error("range expansion failed");
      if (args.includes("main^{commit}")) return BASE_SHA;
      throw new Error("unknown revision");
    },
  });

  await assert.rejects(() => service.readCompare("main", "missing"), /比较目标 missing 不是有效提交引用/);
  assert.equal(calls[0], "rev-parse main^{commit} missing^{commit} main...missing");
  assert.ok(calls.includes("rev-parse --verify main^{commit}"));
  assert.ok(calls.includes("rev-parse --verify missing^{commit}"));
});

test("branch comparison without a common ancestor keeps the two-dot diff range", async () => {
  const calls = [];
  const service = createService({
    git: async (_repo, args) => {
      calls.push(args.join(" "));
      if (args[0] === "rev-parse") return [BASE_SHA, HEAD_SHA, HEAD_SHA, BASE_SHA].join("\n");
      if (args[0] === "rev-list") return "1\t1";
      return "";
    },
  });

  const comparison = await service.readCompare("main", "unrelated");
  assert.equal(comparison.mergeBase, "");
  assert.ok(calls.includes(`diff --name-status --find-renames ${BASE_SHA}..${HEAD_SHA}`));
  assert.ok(calls.includes(`diff --unified=8 --no-ext-diff ${BASE_SHA}..${HEAD_SHA}`));
});

test("normal file blame reuses the resolved file presence check", async () => {
  const calls = [];
  const service = createService({
    git: async (_repo, args) => {
      calls.push(args);
      if (args[0] === "rev-parse") return BASE_SHA;
      return "";
    },
  });

  const blame = await service.readFileBlame("src/main.c", "main");
  const presenceCalls = calls.filter((args) => args[0] === "cat-file" && args[1] === "-e");
  assert.equal(blame.blameRef, "main");
  assert.equal(presenceCalls.length, 1);
  assert.equal(calls.some((args) => args[0] === "status"), false);
});

test("commit details overlap metadata, file, and diff reads while remembering the first parent", async () => {
  const calls = [];
  let releaseMetadata;
  const metadataGate = new Promise((resolve) => { releaseMetadata = resolve; });
  const service = createService({
    git: async (_repo, args) => {
      calls.push(args.join(" "));
      if (args[0] === "rev-list") {
        await metadataGate;
        return `${BASE_SHA} ${HEAD_SHA}`;
      }
      if (args[0] === "show" && args.includes("-s") && !args.includes("--format=%B")) {
        await metadataGate;
        if (args.includes(`--format=${"%H%x00%h%x00%an%x00%ar%x00%s%x00%P"}`)) {
          return [BASE_SHA, BASE_SHA.slice(0, 7), "Author", "now", "summary", HEAD_SHA].join("\0");
        }
        return [BASE_SHA, BASE_SHA.slice(0, 7), "Author", "now", "summary", HEAD_SHA, "summary\n\nbody", ""].join("\0");
      }
      if (args[0] === "show" && args.includes(`--format=${"%H%x00%h%x00%an%x00%ar%x00%s%x00%P"}`)) {
        return [BASE_SHA, BASE_SHA.slice(0, 7), "Author", "now", "message", HEAD_SHA].join("\0");
      }
      if (args[0] === "show" && args.includes("--format=%B")) return "summary\n\nbody";
      if (args[0] === "show" && args.includes("--name-status")) return "M\tnote.txt";
      if (args[0] === "show" && args.includes("--unified=8")) return "diff --git a/note.txt b/note.txt";
      return "";
    },
    parseNameStatus: () => [{ state: "M", file: "note.txt" }],
    parseDiff: () => [{ type: "meta", text: "diff --git a/note.txt b/note.txt" }],
  });

  const detailPromise = service.readCommit(BASE_SHA, { includeDiff: true });
  await nextTurn();
  const readsStartedTogether = calls.some((call) => call.includes("--name-status")) && calls.some((call) => call.includes("--unified=8"));
  releaseMetadata();
  const detail = await detailPromise;

  assert.equal(readsStartedTogether, true);
  assert.equal(calls.some((call) => call.startsWith("rev-list ")), false);
  assert.equal(detail.summary, "summary");
  assert.equal(detail.message, "summary\n\nbody");
  assert.deepEqual(detail.parents, [HEAD_SHA]);
  assert.deepEqual(detail.files, [{ state: "M", file: "note.txt" }]);
  assert.equal(detail.diffLoaded, true);
  assert.equal(service.readCachedCommitParent(BASE_SHA, "C:\\repo"), HEAD_SHA);
});

function createService(overrides) {
  return createRepositoryHistoryService({
    git: overrides.git,
    getCurrentRepo: () => "C:\\repo",
    sampleState: () => ({ commits: [], branches: [], repo: {} }),
    normalizeRepoFile: (value) => String(value || ""),
    normalizeSha: (value) => String(value || ""),
    normalizeRefName: (value) => String(value || ""),
    readBranchDisplayName: overrides.readBranchDisplayName || (async () => "main"),
    hasHeadCommit: overrides.hasHeadCommit || (async () => true),
    parseStatus: () => [],
    selectStatusFile: () => null,
    parseNameStatus: overrides.parseNameStatus || (() => []),
    parseDiff: overrides.parseDiff || (() => []),
    formatLocalTime: () => "",
  });
}

function nextTurn() {
  return new Promise((resolve) => setImmediate(resolve));
}

async function waitFor(predicate) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (predicate()) return;
    await nextTurn();
  }
  throw new Error("等待比较命令启动超时");
}

function compareSnapshotOutput() {
  return [BASE_SHA, HEAD_SHA, HEAD_SHA, BASE_SHA, `^${MERGE_BASE_SHA}`].join("\n");
}
