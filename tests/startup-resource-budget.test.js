"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const publicRoot = path.join(root, "public");
const indexPath = path.join(publicRoot, "index.html");
const indexHtml = fs.readFileSync(indexPath, "utf8");
const maxInitialResourceCount = 37;
const maxInitialResourceBytes = 750 * 1024;

test("default page keeps startup resources within the performance budget", (t) => {
  const resources = initialResources();
  const duplicates = resources.filter((resource, index) => resources.indexOf(resource) !== index);
  const inlineScripts = Array.from(indexHtml.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi))
    .filter((match) => !attribute(match[1], "src") && match[2].trim())
    .map((match) => match[2].trim().slice(0, 80));
  assert.deepEqual(duplicates, [], `duplicate startup resources: ${duplicates.join(", ")}`);
  assert.deepEqual(inlineScripts, [], `inline startup scripts bypass the resource budget: ${inlineScripts.join(", ")}`);

  const entries = resources.map((resource) => {
    assert.match(resource, /^\.\/[a-zA-Z0-9_./-]+$/, `startup resource must stay local: ${resource}`);
    const filePath = path.resolve(publicRoot, resource.slice(2));
    assert.ok(filePath.startsWith(`${publicRoot}${path.sep}`), `startup resource escaped public/: ${resource}`);
    const stats = fs.statSync(filePath);
    assert.ok(stats.isFile(), `startup resource is not a file: ${resource}`);
    return { resource, bytes: stats.size };
  });
  const totalBytes = entries.reduce((total, entry) => total + entry.bytes, 0);
  const largest = [...entries]
    .sort((left, right) => right.bytes - left.bytes)
    .slice(0, 5)
    .map((entry) => `${entry.resource} ${formatBytes(entry.bytes)}`)
    .join(", ");

  assert.ok(
    entries.length <= maxInitialResourceCount,
    `startup resource count ${entries.length} exceeds ${maxInitialResourceCount}: ${resources.join(", ")}`
  );
  assert.ok(
    totalBytes <= maxInitialResourceBytes,
    `startup resources ${formatBytes(totalBytes)} exceed ${formatBytes(maxInitialResourceBytes)}; largest: ${largest}`
  );
  t.diagnostic(`startup resources ${entries.length}, ${formatBytes(totalBytes)}`);
});

test("lazy editor and English catalog resources stay out of the default page", () => {
  const resources = initialResources();
  const eagerHeavyResources = resources.filter((resource) => (
    resource === "./js/i18n-catalog.js"
    || resource.startsWith("./lib/codemirror/")
    || /^\.\/js\/features\/file-editor-(?!loader\.js$)/.test(resource)
  ));

  assert.deepEqual(eagerHeavyResources, []);
  assert.ok(resources.includes("./js/i18n-loader.js"));
  assert.ok(resources.includes("./js/features/file-editor-loader.js"));
});

function initialResources() {
  return Array.from(indexHtml.matchAll(/<(link|script)\b[^>]*>/gi))
    .flatMap((match) => {
      const tag = match[0];
      if (match[1].toLowerCase() === "link") {
        const rel = attribute(tag, "rel").toLowerCase();
        return rel?.split(/\s+/).includes("stylesheet") ? [attribute(tag, "href")] : [];
      }
      return [attribute(tag, "src")];
    })
    .filter(Boolean);
}

function attribute(tag, name) {
  return tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, "i"))?.[1] || "";
}

function formatBytes(bytes) {
  return `${bytes.toLocaleString("en-US")} bytes`;
}
