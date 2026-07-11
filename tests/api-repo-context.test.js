"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.resolve(__dirname, "..", "public", "js", "api.js"), "utf8");

test("API encodes non-Latin repository paths before creating request headers", async () => {
  const repoPath = "D:\\桌面\\GitTest";
  let requestHeaders = null;
  const state = {
    data: {
      repo: { path: repoPath, isSample: false },
    },
  };
  const context = vm.createContext({
    Headers,
    state,
    window: { Forkline: {} },
    repoPathSnapshot: () => repoPath,
    isCurrentRepoPath: (candidate) => candidate === repoPath,
    fetch: async (_pathname, options) => {
      requestHeaders = new Headers(options.headers);
      return {
        ok: true,
        json: async () => ({}),
      };
    },
  });

  vm.runInContext(source, context);
  await context.api("/api/worktree");

  assert.equal(requestHeaders.get("X-Forkline-Repo-Path"), `v1:${encodeURIComponent(repoPath)}`);
});
