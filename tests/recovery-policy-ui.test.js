"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "public", "js", "panels", "recovery-settings.js"), "utf8");
const initSource = fs.readFileSync(path.join(root, "public", "js", "app", "init.js"), "utf8");
const repositoriesSource = fs.readFileSync(path.join(root, "public", "js", "features", "repositories.js"), "utf8");

test("startup and repository switching load retention preferences before rendering", () => {
  assert.match(initSource, /state\.data = await loadInitialRepoState\(initialRef\);\s*loadRecoveryPolicyForRepo\(state\.data\.repo\);[\s\S]*?renderAll\(\);/);
  assert.match(repositoriesSource, /loadRecoveryPolicyForRepo\(state\.data\.repo\);\s*state\.selectedSha[\s\S]*?renderAll\(\);/);
  assert.match(source, /data-recovery-policy="autoPrune" type="checkbox"/);
});

test("recovery retention preferences migrate once and remain isolated by repository", () => {
  const harness = createHarness({
    stored: { keepDays: "30", maxPerBranch: "7" },
    repoPath: "C:\\Work\\Repo\\",
  });

  harness.context.loadRecoveryPolicyForRepo(harness.state.data.repo);
  assert.deepEqual(plain(harness.state.recoveryPolicy), { keepDays: "30", maxPerBranch: "7", autoPrune: false });

  let stored = JSON.parse(harness.storage.get("forkline-recovery-policy"));
  assert.equal(stored.version, 2);
  assert.deepEqual(stored.repositories["c:/work/repo"], { keepDays: "30", maxPerBranch: "7", autoPrune: false });

  harness.state.data.repo = { path: "D:\\Other", name: "Other", isSample: false };
  harness.context.loadRecoveryPolicyForRepo(harness.state.data.repo);
  assert.deepEqual(plain(harness.state.recoveryPolicy), { keepDays: "90", maxPerBranch: "50", autoPrune: false });

  harness.state.recoveryPolicy = { keepDays: "14", maxPerBranch: "4", autoPrune: true };
  assert.equal(harness.context.saveRecoveryPolicyPreference(), true);

  harness.state.data.repo = { path: "c:/WORK/repo", name: "Repo", isSample: false };
  harness.context.loadRecoveryPolicyForRepo(harness.state.data.repo);
  assert.deepEqual(plain(harness.state.recoveryPolicy), { keepDays: "30", maxPerBranch: "7", autoPrune: false });

  harness.state.data.repo = { path: "D:/Other/", name: "Other", isSample: false };
  harness.context.loadRecoveryPolicyForRepo(harness.state.data.repo);
  assert.deepEqual(plain(harness.state.recoveryPolicy), { keepDays: "14", maxPerBranch: "4", autoPrune: true });

  stored = JSON.parse(harness.storage.get("forkline-recovery-policy"));
  assert.equal(Object.keys(stored.repositories).length, 2);
});

test("operation-triggered cleanup previews candidates and never deletes without confirmation", async () => {
  const points = [
    recoveryPoint("old", "old0001", "20260801-100000"),
    recoveryPoint("new", "new0001", "20260806-100000"),
  ];
  const harness = createHarness({ repoPath: "C:\\Repo", recoveryPoints: points });
  harness.state.recoveryPolicy = { keepDays: "0", maxPerBranch: "1", autoPrune: true };

  const result = { recovery: { ref: points[1].ref, sha: points[1].sha } };
  assert.equal(await harness.context.maybeOfferRecoveryPolicyCleanup(result), false);
  assert.equal(harness.calls.api.length, 0);
  assert.equal(harness.calls.confirm.length, 1);
  assert.match(harness.calls.confirm[0], /old0001/);
  assert.match(harness.calls.confirm[0], /不会静默|确认清理|删除后不能/);

  harness.control.allowConfirm = true;
  assert.equal(await harness.context.maybeOfferRecoveryPolicyCleanup(result), true);
  assert.equal(harness.calls.api.length, 2);
  const action = JSON.parse(harness.calls.api[0].options.body);
  assert.deepEqual(action, {
    action: "pruneRecoveryPoints",
    keepDays: 0,
    maxPerBranch: 1,
    deleteRefs: [{ ref: points[0].ref, sha: points[0].sha }],
  });
  assert.equal(harness.calls.renderAll, 1);
  assert.deepEqual(plain(harness.state.data.recoveryPoints), [points[1]]);
});

test("operation-triggered cleanup stays disabled for sample repositories and unchecked policies", async () => {
  const point = recoveryPoint("new", "new0001", "20260806-100000");
  const harness = createHarness({ repoPath: "C:\\Repo", recoveryPoints: [point] });
  harness.state.recoveryPolicy = { keepDays: "1", maxPerBranch: "1", autoPrune: false };

  assert.equal(await harness.context.maybeOfferRecoveryPolicyCleanup({ recovery: { ref: point.ref, sha: point.sha } }), false);
  harness.state.recoveryPolicy.autoPrune = true;
  harness.state.data.repo.isSample = true;
  assert.equal(await harness.context.maybeOfferRecoveryPolicyCleanup({ recovery: { ref: point.ref, sha: point.sha } }), false);
  assert.equal(harness.calls.confirm.length, 0);
  assert.equal(harness.calls.api.length, 0);
});

function createHarness(options = {}) {
  const storage = new Map();
  if (options.stored) storage.set("forkline-recovery-policy", JSON.stringify(options.stored));
  const repo = { path: options.repoPath || "C:\\Repo", name: "Repo", branch: "main", selectedRef: "main", isSample: false };
  const state = {
    data: { repo, recoveryPoints: options.recoveryPoints || [] },
    recoveryPolicy: { keepDays: "90", maxPerBranch: "50", autoPrune: false },
    recoveryPolicyRepoPath: "",
    recoveryFilter: { query: "", branch: "", action: "" },
    selectedRef: "main",
    selectedRecoveryRef: "",
  };
  const calls = { api: [], confirm: [], toast: [], renderAll: 0 };
  const control = { allowConfirm: false };
  const localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
  };
  const context = vm.createContext({
    state,
    localStorage,
    recoveryPolicyStorageKey: "forkline-recovery-policy",
    repoPathSnapshot: () => state.data.repo.path,
    isCurrentRepoPath: (repoPath) => repoPath === state.data.repo.path,
    currentLocale: () => "zh-CN",
    t: (message, values = {}) => String(message).replace(/\{(\w+)\}/g, (_match, key) => String(values[key] ?? "")),
    confirm: (message) => {
      calls.confirm.push(message);
      return control.allowConfirm;
    },
    api: async (requestPath, requestOptions) => {
      calls.api.push({ path: requestPath, options: requestOptions });
      if (requestPath === "/api/action") return { output: "恢复点清理完成" };
      return {
        repo: { ...state.data.repo },
        recoveryPoints: (state.data.recoveryPoints || []).slice(-1),
      };
    },
    toast: (message) => calls.toast.push(message),
    renderAll: () => {
      calls.renderAll += 1;
    },
  });
  vm.runInContext(source, context);
  return { calls, context, control, state, storage };
}

function recoveryPoint(name, sha, timestamp) {
  return {
    ref: `refs/forkline/recovery/${timestamp}/main/${name}`,
    shortRef: `${timestamp}/main/${name}`,
    timestamp,
    sha,
    short: sha,
    branch: "main",
    action: "reset-hard",
    actionLabel: "硬重置前",
    time: timestamp,
  };
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}
