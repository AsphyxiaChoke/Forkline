"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const styles = fs.readFileSync(path.join(root, "public", "styles.css"), "utf8");
const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
const designSystem = fs.readFileSync(path.join(root, "docs", "DESIGN_SYSTEM.md"), "utf8");

const themeTokens = [
  "--bg", "--panel", "--panel-2", "--panel-3", "--line", "--line-soft", "--text", "--muted", "--quiet",
  "--teal", "--teal-rgb", "--green", "--amber", "--coral", "--blue", "--blue-rgb", "--violet", "--danger",
  "--topbar", "--field", "--surface", "--card", "--primary", "--row", "--row-alt", "--row-hover", "--row-selected",
  "--scroll", "--badge-text", "--line-strong", "--surface-raised", "--focus-ring", "--shadow-soft", "--shadow-panel",
  "--glow-teal", "--graph-all-bg", "--graph-focus-bg", "--graph-node-fill", "--graph-node-ring", "--graph-label-bg",
  "--graph-label-text", "--diff-add-bg", "--diff-add-text", "--diff-del-bg", "--diff-del-text", "--toast-bg",
];

test("design system is discoverable and identifies the code sources of truth", () => {
  assert.match(readme, /\[界面设计系统\]\(docs\/DESIGN_SYSTEM\.md\)/);
  assert.match(designSystem, /public\/styles\.css/);
  assert.match(designSystem, /public\/js\/app\/layout-utils\.js/);
  assert.match(designSystem, /tests\/browser-performance\.test\.js/);
});

test("every theme implements the same semantic color contract", () => {
  const blocks = new Map([["dark", cssBlock(/:root\s*\{([\s\S]*?)\r?\n\}/)]]);
  for (const theme of ["light", "graphite", "forest", "rose", "contrast"]) {
    blocks.set(theme, cssBlock(new RegExp(`html\\[data-theme="${theme}"\\]\\s*\\{([\\s\\S]*?)\\r?\\n\\}`)));
  }

  for (const [theme, block] of blocks) {
    for (const token of themeTokens) {
      assert.match(block, new RegExp(`${escapeRegExp(token)}\\s*:`), `${theme} is missing ${token}`);
    }
  }
});

test("shared component primitives remain available", () => {
  for (const selector of [
    ".btn.primary", ".mini-btn.danger", ".icon-btn", ".checkout-choice",
    ".tab.active", ".nav-item", ".context-menu", ".checkout-modal", ".checkout-dialog",
    ".edit-field", ".status-dot", ".state-pill", ".settings-card", ".panel-title",
  ]) {
    assert.ok(styles.includes(selector), `missing shared component selector ${selector}`);
  }
});

test("semantic CSS colors are declared as tokens before use", () => {
  const violations = styles
    .split(/\r?\n/)
    .map((line, index) => ({ line: index + 1, text: line.trim() }))
    .filter(({ text }) => /#[0-9a-fA-F]{3,8}\b/.test(text) && !/^--[a-zA-Z0-9_-]+\s*:/.test(text));

  assert.deepEqual(violations, []);
});

function cssBlock(pattern) {
  const match = styles.match(pattern);
  assert.ok(match, `missing CSS block ${pattern}`);
  return match[1];
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
