"use strict";

const { EventEmitter } = require("node:events");
const test = require("node:test");
const assert = require("node:assert/strict");
const { createGitRuntime, terminateOperationProcess } = require("../server/git-runtime");

test("runtime shutdown terminates every owned Git process and rejects later commands", async () => {
  const children = [];
  const callbacks = new Map();
  const terminated = [];
  const runtime = createGitRuntime({
    gitBin: "git-test",
    execFile(_file, _args, _options, callback) {
      const child = new EventEmitter();
      child.pid = 5000 + children.length;
      child.exitCode = null;
      child.signalCode = null;
      child.killed = false;
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();
      child.stdin = { destroy() {} };
      child.kill = () => {
        child.killed = true;
        return true;
      };
      children.push(child);
      callbacks.set(child, callback);
      return child;
    },
    async terminateProcess(child) {
      terminated.push(child.pid);
      child.exitCode = 1;
      callbacks.get(child)(new Error("terminated"), Buffer.alloc(0), Buffer.alloc(0));
      child.emit("close", 1, null);
    },
  });

  const textCommand = runtime.git("D:\\repo", ["status"]).catch(() => "stopped");
  const bufferCommand = runtime.gitBuffer("D:\\repo", ["show", "HEAD:file"]).catch(() => "stopped");
  const probe = new EventEmitter();
  probe.pid = 5900;
  probe.exitCode = null;
  probe.signalCode = null;
  probe.killed = false;
  probe.stdout = new EventEmitter();
  probe.stderr = new EventEmitter();
  probe.stdin = { destroy() {} };
  probe.kill = () => true;
  callbacks.set(probe, () => {});
  runtime.registerOwnedProcess(probe);

  await runtime.shutdown();
  assert.deepEqual(terminated, [5000, 5001, 5900]);
  assert.deepEqual(await Promise.all([textCommand, bufferCommand]), ["stopped", "stopped"]);
  await assert.rejects(runtime.git("D:\\repo", ["status"]), /正在关闭/);
  assert.equal(children.length, 2);
});

test("Windows cancellation falls back to the owned child handle when taskkill is denied", {
  skip: process.platform !== "win32",
}, async () => {
  const calls = [];
  const stream = (name) => ({
    destroy() {
      calls.push(["destroy", name]);
    },
  });
  const child = {
    pid: 424242,
    exitCode: null,
    killed: false,
    stdin: stream("stdin"),
    stdout: stream("stdout"),
    stderr: stream("stderr"),
    kill(signal) {
      calls.push(["kill", signal]);
      this.killed = true;
      return true;
    },
  };
  const deniedTaskkill = (file, args, options, callback) => {
    calls.push(["taskkill", file, args, options]);
    queueMicrotask(() => callback(new Error("access denied"), "", ""));
  };

  await terminateOperationProcess(child, deniedTaskkill);

  assert.deepEqual(calls, [
    ["taskkill", "taskkill.exe", ["/PID", "424242", "/T", "/F"], { windowsHide: true }],
    ["kill", "SIGTERM"],
    ["destroy", "stdin"],
    ["destroy", "stdout"],
    ["destroy", "stderr"],
  ]);
});

test("successful Windows taskkill does not close the child streams manually", {
  skip: process.platform !== "win32",
}, async () => {
  let fallbackUsed = false;
  const child = {
    pid: 434343,
    exitCode: null,
    killed: false,
    stdin: { destroy: () => { fallbackUsed = true; } },
    stdout: { destroy: () => { fallbackUsed = true; } },
    stderr: { destroy: () => { fallbackUsed = true; } },
    kill: () => {
      fallbackUsed = true;
      return true;
    },
  };
  const successfulTaskkill = (_file, _args, _options, callback) => {
    queueMicrotask(() => callback(null, "", ""));
  };

  await terminateOperationProcess(child, successfulTaskkill);

  assert.equal(fallbackUsed, false);
});
