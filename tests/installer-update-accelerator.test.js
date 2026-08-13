"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { CancellationToken } = require("builder-util-runtime");
const {
  ACCELERATOR_PREFIX,
  ForklineNsisUpdater,
  acceleratedReleaseUrl,
  createAcceleratedUpdateInfoAndProvider,
  downloadWithOfficialFallback,
  officialReleaseUrl,
} = require("../electron/installer-update-accelerator");

const officialInstaller = "https://github.com/AsphyxiaChoke/Forkline/releases/download/v0.4.2/Forkline-Setup-0.4.2-windows-x64.exe";

function updateOptions(provider) {
  return {
    updateInfoAndProvider: {
      info: {
        version: "0.4.2",
        files: [{ url: "Forkline-Setup-0.4.2-windows-x64.exe", sha512: "trusted-official-sha512" }],
      },
      provider,
    },
    disableDifferentialDownload: false,
  };
}

function fakeProvider(url = officialInstaller) {
  return {
    isUseMultipleRangeRequest: false,
    resolveFiles(info) {
      return [{ url: new URL(url), info: info.files[0] }];
    },
    async getBlockMapFiles() {
      return [new URL(officialInstaller.replaceAll("0.4.2", "0.4.1") + ".blockmap"), new URL(officialInstaller + ".blockmap")];
    },
  };
}

test("installer accelerator rewrites only fixed Forkline GitHub release assets", () => {
  assert.equal(officialReleaseUrl(officialInstaller), officialInstaller);
  assert.equal(acceleratedReleaseUrl(officialInstaller), `${ACCELERATOR_PREFIX}${officialInstaller}`);
  assert.equal(acceleratedReleaseUrl(officialInstaller + ".blockmap"), `${ACCELERATOR_PREFIX}${officialInstaller}.blockmap`);
  assert.equal(acceleratedReleaseUrl("https://github.com/other/Forkline/releases/download/v0.4.2/Forkline-Setup-0.4.2-windows-x64.exe"), "");
  assert.equal(acceleratedReleaseUrl("http://github.com/AsphyxiaChoke/Forkline/releases/download/v0.4.2/Forkline-Setup-0.4.2-windows-x64.exe"), "");
  assert.equal(acceleratedReleaseUrl("https://github.com/AsphyxiaChoke/Forkline/releases/download/v0.4.2/other.exe"), "");
  assert.equal(acceleratedReleaseUrl("https://github.com/AsphyxiaChoke/Forkline/releases/download/v0.4.2/Forkline-Setup-0.4.3-windows-x64.exe"), "");
});

test("installer accelerator preserves official checksums for installer and blockmap downloads", async () => {
  const original = updateOptions(fakeProvider());
  const accelerated = createAcceleratedUpdateInfoAndProvider(original.updateInfoAndProvider);
  const files = accelerated.provider.resolveFiles(accelerated.info);
  const blockmaps = await accelerated.provider.getBlockMapFiles();

  assert.equal(files[0].url.href, `${ACCELERATOR_PREFIX}${officialInstaller}`);
  assert.equal(files[0].info.sha512, "trusted-official-sha512");
  assert.ok(blockmaps.every((url) => url.href.startsWith(ACCELERATOR_PREFIX)));
  assert.equal(accelerated.info, original.updateInfoAndProvider.info);
});

test("installer accelerator retries the official release after a failed accelerated download", async () => {
  const calls = [];
  const result = await downloadWithOfficialFallback(updateOptions(fakeProvider()), {
    downloadAccelerated: async (options) => {
      calls.push({ source: "accelerated", options });
      throw new Error("accelerator unavailable");
    },
    downloadOfficial: async (options) => {
      calls.push({ source: "official", options });
      return ["official-installer.exe"];
    },
  });

  assert.deepEqual(result, ["official-installer.exe"]);
  assert.equal(calls[0].options.updateInfoAndProvider.provider.resolveFiles(calls[0].options.updateInfoAndProvider.info)[0].url.href, `${ACCELERATOR_PREFIX}${officialInstaller}`);
  assert.equal(calls[1].options.updateInfoAndProvider.provider.resolveFiles(calls[1].options.updateInfoAndProvider.info)[0].url.href, officialInstaller);
  assert.equal(calls[1].options.disableDifferentialDownload, true);
});

test("Forkline NSIS updater cleans a failed accelerated download and completes the official fallback", async (t) => {
  const cacheRoot = fs.mkdtempSync(path.join(os.tmpdir(), "forkline-updater-accelerator-"));
  t.after(() => fs.rmSync(cacheRoot, { recursive: true, force: true }));
  const payload = Buffer.from("verified Forkline updater payload");
  const sha512 = crypto.createHash("sha512").update(payload).digest("base64");
  const updater = new ForklineNsisUpdater(undefined, {
    version: "0.4.1",
    name: "ForklineUpdaterTest",
    baseCachePath: cacheRoot,
    isPackaged: true,
    appUpdateConfigPath: path.join(cacheRoot, "unused.yml"),
    onQuit() {},
    quit() {},
  });
  updater.configOnDisk = { value: Promise.resolve({ updaterCacheDirName: "cache" }) };
  const calls = [];
  updater.httpExecutor = {
    async download(url, destination) {
      calls.push(url.href);
      if (url.href.startsWith(ACCELERATOR_PREFIX)) {
        fs.writeFileSync(destination, "failed accelerated payload");
        throw new Error("accelerator unavailable");
      }
      fs.writeFileSync(destination, payload);
    },
  };

  const result = await updater.doDownloadUpdate({
    ...updateOptions(fakeProvider()),
    updateInfoAndProvider: {
      info: {
        version: "0.4.2",
        files: [{ url: path.basename(officialInstaller), sha512 }],
      },
      provider: fakeProvider(),
    },
    requestHeaders: null,
    cancellationToken: new CancellationToken(),
    disableWebInstaller: true,
    disableDifferentialDownload: true,
  });

  assert.deepEqual(calls, [`${ACCELERATOR_PREFIX}${officialInstaller}`, officialInstaller]);
  assert.equal(fs.readFileSync(result[0]).equals(payload), true);
  assert.equal(path.basename(result[0]), "Forkline-Setup-0.4.2-windows-x64.exe");
});

test("installer accelerator does not retry cancelled downloads or unrelated URLs", async () => {
  let officialDownloads = 0;
  await assert.rejects(downloadWithOfficialFallback(updateOptions(fakeProvider()), {
    downloadAccelerated: async () => {
      const error = new Error("cancelled");
      error.name = "CancellationError";
      throw error;
    },
    downloadOfficial: async () => { officialDownloads += 1; },
  }), /cancelled/);
  assert.equal(officialDownloads, 0);

  let acceleratedDownloads = 0;
  await downloadWithOfficialFallback(updateOptions(fakeProvider("https://example.com/Forkline-Setup-0.4.2-windows-x64.exe")), {
    downloadAccelerated: async () => { acceleratedDownloads += 1; },
    downloadOfficial: async () => { officialDownloads += 1; },
  });
  assert.equal(acceleratedDownloads, 0);
  assert.equal(officialDownloads, 1);
});
