"use strict";

const { NsisUpdater } = require("electron-updater");

const OFFICIAL_RELEASE_PREFIX = "https://github.com/AsphyxiaChoke/Forkline/releases/download/";
const ACCELERATOR_PREFIX = "https://ghfast.top/";

function officialReleaseUrl(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  try {
    const url = new URL(text);
    if (url.protocol !== "https:" || url.hostname.toLowerCase() !== "github.com") return "";
    const match = url.pathname.match(/^\/AsphyxiaChoke\/Forkline\/releases\/download\/(v?([0-9]+\.[0-9]+\.[0-9]+(?:-[0-9a-z.-]+)?))\/(Forkline-Setup-\2-windows-x64\.exe(?:\.blockmap)?)$/i);
    if (!match) return "";
    return `${OFFICIAL_RELEASE_PREFIX}${match[1]}/${match[3]}`;
  } catch {
    return "";
  }
}

function acceleratedReleaseUrl(value) {
  const official = officialReleaseUrl(value);
  return official ? `${ACCELERATOR_PREFIX}${official}` : "";
}

function createAcceleratedProvider(provider) {
  if (!provider || typeof provider.resolveFiles !== "function") return provider;
  const originalResolveFiles = provider.resolveFiles.bind(provider);
  const originalGetBlockMapFiles = typeof provider.getBlockMapFiles === "function"
    ? provider.getBlockMapFiles.bind(provider)
    : null;
  return new Proxy(provider, {
    get(target, property, receiver) {
      if (property === "resolveFiles") {
        return (updateInfo) => originalResolveFiles(updateInfo).map((file) => {
          const url = acceleratedReleaseUrl(file?.url?.href);
          return url ? { ...file, url: new URL(url) } : file;
        });
      }
      if (property === "getBlockMapFiles" && originalGetBlockMapFiles) {
        return async (...args) => {
          const urls = await originalGetBlockMapFiles(...args);
          return urls.map((url) => {
            const accelerated = acceleratedReleaseUrl(url?.href);
            return accelerated ? new URL(accelerated) : url;
          });
        };
      }
      return Reflect.get(target, property, receiver);
    },
  });
}

function createAcceleratedUpdateInfoAndProvider(value) {
  if (!value?.provider) return value;
  return {
    ...value,
    provider: createAcceleratedProvider(value.provider),
  };
}

function isCancellation(error) {
  return error?.name === "CancellationError" || error?.message === "cancelled";
}

async function downloadWithOfficialFallback(options, handlers = {}) {
  const accelerated = createAcceleratedUpdateInfoAndProvider(options.updateInfoAndProvider);
  const files = accelerated?.provider?.resolveFiles(accelerated.info) || [];
  const usesAccelerator = files.some((file) => String(file?.url?.href || "").startsWith(ACCELERATOR_PREFIX));
  if (!usesAccelerator) return handlers.downloadOfficial(options);
  try {
    return await handlers.downloadAccelerated({
      ...options,
      updateInfoAndProvider: accelerated,
    });
  } catch (error) {
    if (isCancellation(error)) throw error;
    handlers.log?.(`Forkline update accelerator failed; retrying official GitHub release: ${error?.message || error}`);
    return handlers.downloadOfficial({
      ...options,
      disableDifferentialDownload: true,
    });
  }
}

class ForklineNsisUpdater extends NsisUpdater {
  async doDownloadUpdate(options) {
    return downloadWithOfficialFallback(options, {
      downloadAccelerated: (value) => super.doDownloadUpdate(value),
      downloadOfficial: (value) => super.doDownloadUpdate(value),
      log: (message) => this._logger.warn(message),
    });
  }
}

function createForklineAutoUpdater() {
  return new ForklineNsisUpdater();
}

module.exports = {
  ACCELERATOR_PREFIX,
  OFFICIAL_RELEASE_PREFIX,
  ForklineNsisUpdater,
  acceleratedReleaseUrl,
  createAcceleratedProvider,
  createAcceleratedUpdateInfoAndProvider,
  createForklineAutoUpdater,
  downloadWithOfficialFallback,
  officialReleaseUrl,
};
