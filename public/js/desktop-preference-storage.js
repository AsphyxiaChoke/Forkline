// Uses stable desktop preferences for Electron while keeping browser localStorage unchanged.
(function initializeDesktopPreferenceStorage(root) {
  const browserStorage = root.localStorage;
  let desktopValues = null;
  let confirmedDesktopValues = null;
  const desktopMutationVersions = new Map();
  const desktopMutationQueues = new Map();
  const persistenceFailureHandlers = new Set();

  function desktopBridge() {
    return root.forklineDesktop;
  }

  function persistDesktopMutation(key, operationName, operation, nextValue) {
    const version = (desktopMutationVersions.get(key) || 0) + 1;
    desktopMutationVersions.set(key, version);
    const pending = (desktopMutationQueues.get(key) || Promise.resolve()).then(async () => {
      let saved = false;
      try {
        saved = await operation();
      } catch {}
      if (saved === true) {
        confirmDesktopValue(key, nextValue);
        return;
      }
      if (desktopMutationVersions.get(key) !== version) return;
      restoreDesktopValue(key, confirmedDesktopValue(key));
      reportPersistenceFailure(key, operationName);
    });
    desktopMutationQueues.set(key, pending);
  }

  function confirmDesktopValue(key, value) {
    if (value === null) delete confirmedDesktopValues[key];
    else confirmedDesktopValues[key] = value;
  }

  function confirmedDesktopValue(key) {
    return Object.hasOwn(confirmedDesktopValues, key) ? confirmedDesktopValues[key] : null;
  }

  function restoreDesktopValue(key, value) {
    if (value === null) delete desktopValues[key];
    else desktopValues[key] = value;
  }

  function reportPersistenceFailure(key, operation) {
    for (const handler of persistenceFailureHandlers) {
      try {
        handler({ key, operation });
      } catch {}
    }
  }

  function onPersistenceFailure(handler) {
    if (typeof handler !== "function") return () => {};
    persistenceFailureHandlers.add(handler);
    return () => persistenceFailureHandlers.delete(handler);
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
      persistDesktopMutation(key, "write", () => desktopBridge()?.writePreference?.(key, storedValue), storedValue);
    },
    removeItem(key) {
      if (desktopValues === null) {
        browserStorage.removeItem(key);
        return;
      }
      delete desktopValues[key];
      persistDesktopMutation(key, "remove", () => desktopBridge()?.removePreference?.(key), null);
    },
  };

  async function init() {
    const readPreferences = desktopBridge()?.readPreferences;
    if (typeof readPreferences !== "function") return false;
    try {
      const value = await readPreferences();
      desktopValues = value && typeof value === "object" && !Array.isArray(value) ? { ...value } : {};
      confirmedDesktopValues = { ...desktopValues };
      return true;
    } catch {
      desktopValues = {};
      confirmedDesktopValues = {};
      return false;
    }
  }

  root.ForklinePreferenceStorage = { init, onPersistenceFailure, storage };
})(window);
