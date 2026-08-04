"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

function writeTempFile(prefix, content, extension = ".tmp") {
  const name = `${prefix}${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}${extension}`;
  const filePath = path.join(os.tmpdir(), name);
  fs.writeFileSync(filePath, content, "utf8");
  return filePath;
}

function removeQuietly(filePath) {
  try {
    fs.unlinkSync(filePath);
  } catch {
  }
}

module.exports = { removeQuietly, writeTempFile };
