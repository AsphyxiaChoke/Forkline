"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { compareVersions, createAppUpdateChecker, normalizeVersion } = require("../app-update");

test("app update versions accept release tags and compare stable versions", () => {
  assert.equal(normalizeVersion("v0.2.0"), "0.2.0");
  assert.equal(normalizeVersion("0.2.0-beta.2+build.4"), "0.2.0-beta.2");
  assert.equal(compareVersions("0.2.0", "0.1.9"), 1);
  assert.equal(compareVersions("0.2.0", "0.2.0"), 0);
  assert.equal(compareVersions("0.2.0-beta.2", "0.2.0"), -1);
});

test("app update checker only reports a newer release and caches the result", async () => {
  let requests = 0;
  let time = 1000;
  const checker = createAppUpdateChecker({
    currentVersion: "0.1.0",
    cacheTtlMs: 100,
    now: () => time,
    requestJson: async () => {
      requests += 1;
      return {
        tag_name: "v0.2.0",
        name: "Forkline v0.2.0",
        html_url: "https://github.com/AsphyxiaChoke/Forkline/releases/tag/v0.2.0",
        published_at: "2026-08-03T00:00:00Z",
      };
    },
  });

  const first = await checker();
  assert.equal(first.available, true);
  assert.equal(first.currentVersion, "0.1.0");
  assert.equal(first.latestVersion, "0.2.0");
  assert.equal(first.tagName, "v0.2.0");
  assert.equal(requests, 1);

  time = 1050;
  await checker();
  assert.equal(requests, 1);

  time = 1200;
  await checker();
  assert.equal(requests, 2);
});

test("app update checker hides equal versions and network failures", async () => {
  const current = createAppUpdateChecker({
    currentVersion: "0.1.0",
    requestJson: async () => ({ tag_name: "v0.1.0", html_url: "https://example.test/release" }),
  });
  assert.equal((await current()).available, false);

  const offline = createAppUpdateChecker({
    currentVersion: "0.1.0",
    requestJson: async () => {
      throw new Error("offline");
    },
    requestLatestRelease: async () => {
      throw new Error("offline");
    },
  });
  assert.deepEqual(await offline(), {
    available: false,
    currentVersion: "0.1.0",
    latestVersion: "",
    tagName: "",
    releaseName: "",
    publishedAt: "",
    url: "",
  });
});

test("app update checker falls back to the releases/latest redirect when the API is rate limited", async () => {
  let fallbackRequests = 0;
  const checker = createAppUpdateChecker({
    currentVersion: "0.2.0",
    requestJson: async () => {
      throw new Error("API rate limit exceeded");
    },
    requestLatestRelease: async (url) => {
      fallbackRequests += 1;
      assert.match(url, /releases\/latest$/);
      return {
        tag_name: "v0.2.1",
        name: "v0.2.1",
        html_url: "https://github.com/AsphyxiaChoke/Forkline/releases/tag/v0.2.1",
        published_at: "",
      };
    },
  });

  const update = await checker();
  assert.equal(fallbackRequests, 1);
  assert.equal(update.available, true);
  assert.equal(update.latestVersion, "0.2.1");
  assert.equal(update.tagName, "v0.2.1");
});
