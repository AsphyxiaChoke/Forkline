// Uses stable desktop preferences for Electron while keeping browser localStorage unchanged.
(function initializeDesktopPreferenceStorage(root) {
  const browserStorage = root.localStorage;
  let desktopValues = null;

  function desktopBridge() {
    return root.forklineDesktop;
  }

  const storage = {
    getItem(key) {
      if (desktopValues === null) return browserStorage.getItem(key);
      return Object.hasOwn(desktopValues, key) ? desktopValues[key] : null;
    },
    setItem(key, value) {
      if (desktopValues === null) {
        browserStorage.setItem(key, value);
        return;
      }
      const storedValue = String(value);
      desktopValues[key] = storedValue;
      Promise.resolve(desktopBridge()?.writePreference?.(key, storedValue)).catch(() => {});
    },
    removeItem(key) {
      if (desktopValues === null) {
        browserStorage.removeItem(key);
        return;
      }
      delete desktopValues[key];
      Promise.resolve(desktopBridge()?.removePreference?.(key)).catch(() => {});
    },
  };

  async function init() {
    const readPreferences = desktopBridge()?.readPreferences;
    if (typeof readPreferences !== "function") return false;
    try {
      const value = await readPreferences();
      desktopValues = value && typeof value === "object" && !Array.isArray(value) ? { ...value } : {};
      return true;
    } catch {
      desktopValues = {};
      return false;
    }
  }

  root.ForklinePreferenceStorage = { init, storage };
})(window);
