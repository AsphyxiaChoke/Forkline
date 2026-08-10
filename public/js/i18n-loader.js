// Keeps the default Chinese UI lightweight and loads the English catalog on demand.
(function initializeForklineI18nLoader(root) {
  const defaultLocale = "zh-CN";
  const catalogResource = "./js/i18n-catalog.js";
  let catalogLoadPromise = null;

  function normalizeLocale(locale) {
    const value = String(locale || "").trim().toLowerCase();
    if (!value || value.startsWith("zh")) return defaultLocale;
    if (value.startsWith("en")) return "en";
    return "";
  }

  function interpolate(source, params = {}) {
    return String(source ?? "").replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) => Object.hasOwn(params, key) ? String(params[key]) : match);
  }

  const fallbackCatalog = Object.freeze({
    defaultLocale,
    normalizeLocale,
    translate(locale, source, params) {
      return interpolate(source, params);
    },
    translateFragment(locale, source) {
      return String(source ?? "");
    },
    translateKnown(locale, source) {
      return String(source ?? "");
    },
  });

  root.ForklineI18nCatalog = fallbackCatalog;

  function englishCatalogLoaded() {
    const catalog = root.ForklineI18nCatalog;
    return catalog !== fallbackCatalog && catalog?.translateKnown?.("en", "打开") === "Open";
  }

  function loadEnglishCatalog() {
    if (englishCatalogLoaded()) return Promise.resolve(root.ForklineI18nCatalog);
    const existing = document.querySelector(`[data-i18n-catalog-resource="${catalogResource}"]`);
    return new Promise((resolve, reject) => {
      const script = existing || document.createElement("script");
      script.src = catalogResource;
      script.async = false;
      script.dataset.i18nCatalogResource = catalogResource;
      script.onload = () => {
        script.dataset.loaded = "true";
        if (englishCatalogLoaded()) resolve(root.ForklineI18nCatalog);
        else {
          script.remove();
          reject(new Error("英文语言包加载失败，请重试。"));
        }
      };
      script.onerror = () => {
        script.remove();
        reject(new Error("英文语言包加载失败，请重试。"));
      };
      if (!existing) document.head.appendChild(script);
    });
  }

  async function ensure(locale) {
    const normalized = normalizeLocale(locale) || defaultLocale;
    if (normalized !== "en") return root.ForklineI18nCatalog;
    if (englishCatalogLoaded()) return root.ForklineI18nCatalog;
    if (!catalogLoadPromise) catalogLoadPromise = loadEnglishCatalog();
    try {
      return await catalogLoadPromise;
    } catch (error) {
      catalogLoadPromise = null;
      throw error;
    }
  }

  root.ForklineI18nLoader = {
    ensure,
    englishCatalogLoaded,
  };
})(window);
