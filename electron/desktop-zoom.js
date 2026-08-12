const fs = require("node:fs");
const path = require("node:path");

const ZOOM_FACTORS = Object.freeze([0.75, 0.8, 0.9, 1, 1.1]);
const DEFAULT_ZOOM_FACTOR = 0.9;

function normalizeZoomFactor(value) {
  const requested = Number(value);
  if (!Number.isFinite(requested)) return DEFAULT_ZOOM_FACTOR;
  return ZOOM_FACTORS.reduce((closest, candidate) => (
    Math.abs(candidate - requested) < Math.abs(closest - requested) ? candidate : closest
  ), DEFAULT_ZOOM_FACTOR);
}

function stepZoomFactor(value, direction) {
  const current = normalizeZoomFactor(value);
  const index = ZOOM_FACTORS.indexOf(current);
  const nextIndex = Math.min(ZOOM_FACTORS.length - 1, Math.max(0, index + Math.sign(direction || 0)));
  return ZOOM_FACTORS[nextIndex];
}

function readZoomFactor(filePath) {
  try {
    const value = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return normalizeZoomFactor(value?.zoomFactor);
  } catch {
    return DEFAULT_ZOOM_FACTOR;
  }
}

function writeZoomFactor(filePath, zoomFactor) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify({ zoomFactor: normalizeZoomFactor(zoomFactor) }, null, 2)}\n`, "utf8");
}

module.exports = {
  DEFAULT_ZOOM_FACTOR,
  ZOOM_FACTORS,
  normalizeZoomFactor,
  readZoomFactor,
  stepZoomFactor,
  writeZoomFactor,
};
