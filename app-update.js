"use strict";

const http = require("http");
const https = require("https");

const DEFAULT_RELEASE_API_URL = "https://api.github.com/repos/AsphyxiaChoke/Forkline/releases/latest";
const DEFAULT_RELEASE_PAGE_URL = "https://github.com/AsphyxiaChoke/Forkline/releases";
const DEFAULT_CACHE_TTL_MS = 10 * 60 * 1000;
const DEFAULT_TIMEOUT_MS = 8000;
const MAX_RESPONSE_BYTES = 512 * 1024;

function normalizeVersion(value) {
  const parsed = parseVersion(value);
  if (!parsed) return "";
  const prerelease = parsed.prerelease ? `-${parsed.prerelease}` : "";
  return `${parsed.major}.${parsed.minor}.${parsed.patch}${prerelease}`;
}

function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  if (!a || !b) return 0;
  for (const key of ["major", "minor", "patch"]) {
    if (a[key] !== b[key]) return a[key] > b[key] ? 1 : -1;
  }
  if (!a.prerelease && b.prerelease) return 1;
  if (a.prerelease && !b.prerelease) return -1;
  return String(a.prerelease || "").localeCompare(String(b.prerelease || ""), "en", { numeric: true });
}

function parseVersion(value) {
  const match = String(value || "").trim().match(/^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] || "",
  };
}

function createAppUpdateChecker(options = {}) {
  const currentVersion = normalizeVersion(options.currentVersion);
  const releaseApiUrl = options.releaseApiUrl || DEFAULT_RELEASE_API_URL;
  const requestJson = options.requestJson || requestJsonUrl;
  const cacheTtlMs = Number.isFinite(options.cacheTtlMs) ? options.cacheTtlMs : DEFAULT_CACHE_TTL_MS;
  const now = options.now || Date.now;
  let cached = null;
  let cachedAt = 0;
  let pending = null;

  return async function readAppUpdate() {
    const timestamp = now();
    if (cached && timestamp - cachedAt < cacheTtlMs) return cached;
    if (pending) return pending;
    pending = checkLatestRelease({ currentVersion, releaseApiUrl, requestJson })
      .catch(() => emptyUpdate(currentVersion))
      .then((result) => {
        cached = result;
        cachedAt = now();
        return result;
      })
      .finally(() => {
        pending = null;
      });
    return pending;
  };
}

async function checkLatestRelease({ currentVersion, releaseApiUrl, requestJson }) {
  if (!currentVersion) return emptyUpdate("");
  const release = await requestJson(releaseApiUrl);
  const latestVersion = normalizeVersion(release?.tag_name);
  if (!latestVersion) return emptyUpdate(currentVersion);
  const available = compareVersions(latestVersion, currentVersion) > 0;
  return {
    available,
    currentVersion,
    latestVersion,
    releaseName: String(release?.name || release?.tag_name || ""),
    publishedAt: String(release?.published_at || ""),
    url: available ? String(release?.html_url || DEFAULT_RELEASE_PAGE_URL) : "",
  };
}

function emptyUpdate(currentVersion) {
  return {
    available: false,
    currentVersion: currentVersion || "",
    latestVersion: "",
    releaseName: "",
    publishedAt: "",
    url: "",
  };
}

function requestJsonUrl(value) {
  const url = new URL(value);
  const transport = url.protocol === "https:" ? https : url.protocol === "http:" ? http : null;
  if (!transport) return Promise.reject(new Error("Unsupported release API protocol"));
  return new Promise((resolve, reject) => {
    const request = transport.get(
      url,
      {
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": "Forkline-update-check",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      },
      (response) => {
        const chunks = [];
        let size = 0;
        response.on("data", (chunk) => {
          size += chunk.length;
          if (size > MAX_RESPONSE_BYTES) {
            request.destroy(new Error("Release response is too large"));
            return;
          }
          chunks.push(chunk);
        });
        response.on("end", () => {
          if (response.statusCode < 200 || response.statusCode >= 300) {
            reject(new Error(`Release API returned ${response.statusCode}`));
            return;
          }
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
          } catch (error) {
            reject(error);
          }
        });
      }
    );
    request.setTimeout(DEFAULT_TIMEOUT_MS, () => request.destroy(new Error("Release API request timed out")));
    request.on("error", reject);
  });
}

module.exports = {
  compareVersions,
  createAppUpdateChecker,
  normalizeVersion,
};
