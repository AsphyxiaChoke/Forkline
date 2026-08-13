// Locale state and translation helpers shared by browser feature scripts.
const staticLocaleEntries = [];
let staticLocaleCaptured = false;

function forklineI18nCatalog() {
  return window.ForklineI18nCatalog;
}

function normalizeLocale(locale) {
  return forklineI18nCatalog().normalizeLocale(locale);
}

function currentLocale() {
  return normalizeLocale(state.locale) || forklineI18nCatalog().defaultLocale;
}

function t(source, params) {
  return forklineI18nCatalog().translate(currentLocale(), source, params);
}

function tt(strings, ...values) {
  return strings.reduce((output, part, index) => {
    const translated = forklineI18nCatalog().translateFragment(currentLocale(), part);
    return `${output}${translated}${index < values.length ? values[index] : ""}`;
  }, "");
}

async function initLocale() {
  captureStaticLocaleEntries();
  const storedLocale = (window.ForklinePreferenceStorage?.storage || localStorage).getItem(localeStorageKey);
  const normalized = normalizeLocale(storedLocale) || forklineI18nCatalog().defaultLocale;
  try {
    await ensureLocaleCatalog(normalized);
    applyLocale(normalized, false);
  } catch (error) {
    applyLocale(forklineI18nCatalog().defaultLocale, false);
    setTimeout(() => toast(error.message), 0);
  }
}

async function setLocale(locale, persist = true) {
  const normalized = normalizeLocale(locale) || forklineI18nCatalog().defaultLocale;
  await ensureLocaleCatalog(normalized);
  return applyLocale(normalized, persist);
}

async function ensureLocaleCatalog(locale) {
  const ensure = window.ForklineI18nLoader?.ensure;
  if (typeof ensure === "function") await ensure(locale);
}

function applyLocale(locale, persist = true) {
  const normalized = normalizeLocale(locale) || forklineI18nCatalog().defaultLocale;
  state.locale = normalized;
  document.documentElement.lang = normalized;
  document.documentElement.dataset.locale = normalized;
  if (persist) (window.ForklinePreferenceStorage?.storage || localStorage).setItem(localeStorageKey, normalized);
  applyStaticLocaleEntries();
  return normalized;
}

function captureStaticLocaleEntries() {
  if (staticLocaleCaptured) return;
  staticLocaleCaptured = true;
  const root = document.body;
  if (!root) return;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const parentTag = node.parentElement?.tagName || "";
    if (!/^(SCRIPT|STYLE|NOSCRIPT)$/.test(parentTag) && /[\u3400-\u9fff]/.test(node.nodeValue || "")) {
      staticLocaleEntries.push({ node, source: node.nodeValue, attribute: "" });
    }
    node = walker.nextNode();
  }

  root.querySelectorAll("*").forEach((element) => {
    ["title", "aria-label", "placeholder"].forEach((attribute) => {
      const source = element.getAttribute(attribute);
      if (source && /[\u3400-\u9fff]/.test(source)) staticLocaleEntries.push({ node: element, source, attribute });
    });
  });
}

function applyStaticLocaleEntries() {
  staticLocaleEntries.forEach((entry) => {
    const translated = forklineI18nCatalog().translateFragment(currentLocale(), entry.source);
    if (entry.attribute) entry.node.setAttribute(entry.attribute, translated);
    else entry.node.nodeValue = translated;
  });
}

window.Forkline.i18n = {
  applyLocale,
  currentLocale,
  normalizeLocale,
  setLocale,
  t,
  tt,
};
