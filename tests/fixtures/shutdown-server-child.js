"use strict";

const { execFile } = require("node:child_process");
const http = require("node:http");
const { createGitRuntime } = require("../../server/git-runtime");
const { createServerShutdownController } = require("../../server/shutdown-controller");

const runtime = createGitRuntime({
  gitBin: "git-test",
  execFile(_file, _args, _options, callback) {
    const child = execFile(
      process.execPath,
      ["-e", "setInterval(() => {}, 1000)"],
      { windowsHide: true },
      callback
    );
    process.send?.({ type: "helper-started", pid: child.pid });
    return child;
  },
});

void runtime.git(process.cwd(), ["status"]).catch(() => {});

const server = http.createServer((_req, res) => res.end("ok"));
const shutdownController = createServerShutdownController({
  server,
  stopOwnedProcesses: runtime.shutdown,
});
shutdownController.attach();
server.listen(0, "127.0.0.1", () => {
  process.send?.({ type: "ready" });
});
