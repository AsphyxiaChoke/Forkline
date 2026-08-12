const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_WINDOW_STATE = Object.freeze({ bounds: null, isMaximized: true });
const MIN_WINDOW_WIDTH = 800;
const MIN_WINDOW_HEIGHT = 640;

function createDefaultWindowState() {
  return { ...DEFAULT_WINDOW_STATE };
}

function normalizeBounds(value) {
  if (!value || ![value.x, value.y, value.width, value.height].every(Number.isFinite)) return null;
  if (value.width <= 0 || value.height <= 0) return null;
  return {
    x: Math.round(value.x),
    y: Math.round(value.y),
    width: Math.round(value.width),
    height: Math.round(value.height),
  };
}

function intersectionArea(first, second) {
  const width = Math.max(0, Math.min(first.x + first.width, second.x + second.width) - Math.max(first.x, second.x));
  const height = Math.max(0, Math.min(first.y + first.height, second.y + second.height) - Math.max(first.y, second.y));
  return width * height;
}

function fitBoundsToWorkArea(bounds, workArea) {
  const minWidth = Math.min(MIN_WINDOW_WIDTH, workArea.width);
  const minHeight = Math.min(MIN_WINDOW_HEIGHT, workArea.height);
  const width = Math.min(workArea.width, Math.max(minWidth, bounds.width));
  const height = Math.min(workArea.height, Math.max(minHeight, bounds.height));
  const x = Math.max(workArea.x, Math.min(bounds.x, workArea.x + workArea.width - width));
  const y = Math.max(workArea.y, Math.min(bounds.y, workArea.y + workArea.height - height));
  return { x, y, width, height };
}

function normalizeWindowState(value, displays) {
  const bounds = normalizeBounds(value?.bounds);
  if (!bounds || !Array.isArray(displays) || displays.length === 0) {
    return createDefaultWindowState();
  }

  const match = displays
    .map((display) => ({ workArea: normalizeBounds(display?.workArea) }))
    .filter(({ workArea }) => workArea)
    .map(({ workArea }) => ({
      workArea,
      overlap: intersectionArea(bounds, workArea),
    }))
    .sort((left, right) => right.overlap - left.overlap)[0];

  if (!match || match.overlap === 0) return createDefaultWindowState();
  return {
    bounds: fitBoundsToWorkArea(bounds, match.workArea),
    isMaximized: value?.isMaximized !== false,
  };
}

function readWindowState(filePath, displays) {
  try {
    return normalizeWindowState(JSON.parse(fs.readFileSync(filePath, "utf8")), displays);
  } catch {
    return createDefaultWindowState();
  }
}

function writeWindowState(filePath, state) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify({
    bounds: normalizeBounds(state?.bounds),
    isMaximized: state?.isMaximized !== false,
  }, null, 2)}\n`, "utf8");
}

module.exports = {
  DEFAULT_WINDOW_STATE,
  MIN_WINDOW_HEIGHT,
  MIN_WINDOW_WIDTH,
  fitBoundsToWorkArea,
  normalizeWindowState,
  readWindowState,
  writeWindowState,
};
