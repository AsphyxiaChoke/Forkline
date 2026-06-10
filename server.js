const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");

const PORT = Number(process.env.PORT || 5177);
const PUBLIC_DIR = path.join(__dirname, "public");

let currentRepo = null;

const laneColors = ["#23c7b7", "#ff7a67", "#f0b85b", "#5ca9ff", "#9c7cff", "#6bd58c", "#f071b8"];

function git(repoPath, args, options = {}) {
  return new Promise((resolve, reject) => {
    const fullArgs = ["-C", repoPath, ...args];
    execFile(
      "git",
      fullArgs,
      {
        windowsHide: true,
        timeout: options.timeout || 15000,
        maxBuffer: options.maxBuffer || 1024 * 1024 * 8,
        encoding: "utf8",
        env: options.env ? { ...process.env, ...options.env } : process.env,
      },
      (error, stdout, stderr) => {
        const output = [stdout, stderr].filter(Boolean).join("\n");
        if (error) {
          reject(new Error(output.trim() || error.message));
          return;
        }
        resolve(output);
      }
    );
  });
}

async function openRepo(repoPath) {
  if (!repoPath || typeof repoPath !== "string") {
    throw new Error("请输入仓库路径");
  }
  const root = (await git(repoPath, ["rev-parse", "--show-toplevel"])).trim();
  currentRepo = root;
  return readState();
}

async function readState(ref = "") {
  if (!currentRepo) return sampleState();
  const [branch, branchOutput, statusOutput, logOutput] = await Promise.all([
    git(currentRepo, ["rev-parse", "--abbrev-ref", "HEAD"]).catch(() => "detached HEAD"),
    git(currentRepo, ["branch", "--all", "--format=%(refname:short)"]).catch(() => ""),
    git(currentRepo, ["status", "--short", "--untracked-files=all"]).catch(() => ""),
    git(currentRepo, logArgs(ref)),
  ]);

  const branches = [];
  const remotes = [];
  for (const raw of branchOutput.split(/\r?\n/)) {
    const name = raw.trim();
    if (!name || name.endsWith("/HEAD")) continue;
    if (name === "origin" || name === "upstream") continue;
    if (name.startsWith("remotes/")) remotes.push(name.replace(/^remotes\//, ""));
    else if (/^(origin|upstream)\//.test(name)) remotes.push(name);
    else branches.push(name);
  }

  return {
    repo: {
      name: path.basename(currentRepo),
      path: currentRepo,
      branch: branch.trim() || "detached HEAD",
      selectedRef: ref,
      isSample: false,
    },
    branches: branches.slice(0, 32),
    remotes: remotes.slice(0, 32),
    workingFiles: parseStatus(statusOutput),
    commits: parseLog(logOutput),
  };
}

function logArgs(ref) {
  const args = [
    "log",
    "--graph",
    "--max-count=120",
    "--date=relative",
    "--pretty=format:%x1f%H%x1f%h%x1f%an%x1f%ar%x1f%s%x1f%D%x1f%P",
  ];
  if (ref) {
    args.splice(1, 0, ref);
  } else {
    args.splice(1, 0, "--branches", "--remotes");
  }
  return args;
}

async function readCommit(sha) {
  if (!currentRepo) {
    const sample = sampleState();
    const commit = sample.commits.find((item) => item.sha === sha) || sample.commits[0];
    return { files: commit.files, diff: commit.diff };
  }
  const [filesOutput, diffOutput, messageOutput] = await Promise.all([
    git(currentRepo, ["show", "--name-status", "--format=", "--find-renames", sha], { maxBuffer: 1024 * 1024 * 2 }),
    git(currentRepo, ["show", "--format=", "--unified=8", "--no-ext-diff", sha], { maxBuffer: 1024 * 1024 * 5 }),
    git(currentRepo, ["show", "-s", "--format=%B", sha], { maxBuffer: 1024 * 256 }),
  ]);
  return {
    files: parseNameStatus(filesOutput),
    diff: parseDiff(diffOutput),
    message: messageOutput.trimEnd(),
  };
}

async function readWorktree() {
  if (!currentRepo) {
    return { workingFiles: sampleState().workingFiles };
  }
  const statusOutput = await git(currentRepo, ["status", "--short", "--untracked-files=all"]).catch(() => "");
  return { workingFiles: parseStatus(statusOutput) };
}

async function readWorkingDiff(filePath) {
  if (!currentRepo) {
    const sample = sampleState();
    return { file: filePath || sample.workingFiles[0]?.file || "", diff: sample.commits[0]?.diff || [] };
  }
  const file = normalizeRepoFile(filePath);
  let output = await git(currentRepo, ["diff", "--no-ext-diff", "--unified=80", "--", file], { maxBuffer: 1024 * 1024 * 8 }).catch(() => "");
  if (!output) {
    output = await git(currentRepo, ["diff", "--cached", "--no-ext-diff", "--unified=80", "--", file], { maxBuffer: 1024 * 1024 * 8 }).catch(() => "");
  }
  if (!output) {
    output = readNewFileDiff(file);
  }
  return { file, diff: parseDiff(output) };
}

async function runAction(body) {
  if (!currentRepo) {
    return { ok: true, sample: true, output: "示例模式不会执行真实 Git 命令" };
  }
  const action = body.action;
  if (action === "fetch") {
    return commandResult(await git(currentRepo, ["fetch", "--all", "--prune"], { timeout: 120000 }));
  }
  if (action === "pull") {
    return commandResult(await git(currentRepo, ["pull", "--ff-only"], { timeout: 120000 }));
  }
  if (action === "push") {
    return commandResult(await git(currentRepo, ["push"], { timeout: 120000 }));
  }
  if (action === "stageAll") {
    return commandResult(await git(currentRepo, ["add", "-A"], { timeout: 60000 }));
  }
  if (action === "commit") {
    const summary = String(body.summary || "").trim();
    const detail = String(body.body || "").trim();
    if (!summary) throw new Error("请填写提交摘要");
    const args = ["commit", "-m", summary];
    if (detail) args.push("-m", detail);
    return commandResult(await git(currentRepo, args, { timeout: 120000 }));
  }
  if (action === "rewordCommit") {
    return commandResult(await rewordCommit(body));
  }
  throw new Error("未知操作");
}

async function rewordCommit(body) {
  const sha = normalizeSha(body.sha);
  const summary = String(body.summary || "").trim();
  const detail = String(body.body || "").trim();
  if (!summary) throw new Error("请填写新的提交摘要");
  const statusOutput = await git(currentRepo, ["status", "--porcelain", "--untracked-files=all"]);
  if (statusOutput.trim()) throw new Error("修改历史提交信息前，请先提交、暂存或还原工作区改动");
  const target = (await git(currentRepo, ["rev-parse", "--verify", `${sha}^{commit}`])).trim();
  await git(currentRepo, ["merge-base", "--is-ancestor", target, "HEAD"]).catch(() => {
    throw new Error("只能修改当前分支历史中的提交信息");
  });
  const parentLine = (await git(currentRepo, ["rev-list", "--parents", "-n", "1", target])).trim();
  const parents = parentLine.split(/\s+/).slice(1);
  if (parents.length > 1) throw new Error("暂不支持自动修改 merge 提交信息");
  const messageFile = writeTempFile("forkline-message-", `${summary}${detail ? `\n\n${detail}` : ""}\n`);
  try {
    if ((await git(currentRepo, ["rev-parse", "HEAD"])).trim() === target) {
      await git(currentRepo, ["commit", "--amend", "-F", messageFile], { timeout: 120000 });
    } else {
      const editorFile = writeTempFile("forkline-sequence-", sequenceEditorScript(target), ".cjs");
      const messageEditorFile = writeTempFile("forkline-message-editor-", messageEditorScript(messageFile), ".cjs");
      try {
        const args = parents.length ? ["rebase", "-i", `${target}^`] : ["rebase", "-i", "--root"];
        await git(currentRepo, args, {
          timeout: 180000,
          env: {
            GIT_SEQUENCE_EDITOR: `"${process.execPath}" "${editorFile}"`,
            GIT_EDITOR: `"${process.execPath}" "${messageEditorFile}"`,
          },
        });
      } finally {
        removeQuietly(editorFile);
        removeQuietly(messageEditorFile);
      }
    }
  } catch (error) {
    await git(currentRepo, ["rebase", "--abort"], { timeout: 60000 }).catch(() => "");
    throw error;
  } finally {
    removeQuietly(messageFile);
  }
  return "提交信息已修改，历史 SHA 已重写";
}

function normalizeSha(value) {
  const sha = String(value || "").trim();
  if (!/^[0-9a-f]{7,40}$/i.test(sha)) throw new Error("提交 SHA 不合法");
  return sha;
}

function writeTempFile(prefix, content, extension = ".tmp") {
  const name = `${prefix}${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}${extension}`;
  const filePath = path.join(os.tmpdir(), name);
  fs.writeFileSync(filePath, content, "utf8");
  return filePath;
}

function sequenceEditorScript(targetSha) {
  return `
const fs = require("fs");
const todoPath = process.argv[2];
const target = ${JSON.stringify(targetSha)};
const text = fs.readFileSync(todoPath, "utf8");
const lines = text.split(/\\r?\\n/).map((line) => {
  const trimmed = line.trimStart();
  if (!trimmed.startsWith("pick ")) return line;
  const hash = trimmed.split(/\\s+/)[1] || "";
  return target.startsWith(hash) ? line.replace(/^(\\s*)pick(\\s+)/, "$1reword$2") : line;
});
fs.writeFileSync(todoPath, lines.join("\\n"), "utf8");
`;
}

function messageEditorScript(messageFile) {
  return `
const fs = require("fs");
fs.copyFileSync(${JSON.stringify(messageFile)}, process.argv[2]);
`;
}

function removeQuietly(filePath) {
  try {
    fs.unlinkSync(filePath);
  } catch {
  }
}

function normalizeRepoFile(filePath) {
  const value = String(filePath || "").replaceAll("\\", "/").trim();
  if (!value || value.includes("\0")) throw new Error("请选择要对照的文件");
  if (path.isAbsolute(value) || value.split("/").includes("..")) throw new Error("文件路径不合法");
  return value;
}

function readNewFileDiff(file) {
  const repoRoot = path.resolve(currentRepo);
  const fullPath = path.resolve(repoRoot, file);
  if (!fullPath.startsWith(repoRoot + path.sep)) throw new Error("文件路径不合法");
  if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) return "";
  const buffer = fs.readFileSync(fullPath);
  if (buffer.includes(0)) return "";
  const lines = buffer.toString("utf8").replace(/\r\n/g, "\n").split("\n").slice(0, 420);
  return [
    `diff --git a/${file} b/${file}`,
    "new file mode 100644",
    "--- /dev/null",
    `+++ b/${file}`,
    `@@ -0,0 +1,${lines.length} @@`,
    ...lines.map((line) => `+${line}`),
  ].join("\n");
}

function commandResult(output) {
  return { ok: true, output: output || "命令已完成" };
}

function parseStatus(output) {
  return output
    .split(/\r?\n/)
    .filter(Boolean)
    .slice(0, 120)
    .map((line) => {
      const normalized = line.length >= 3 && line[2] === " " ? line : ` ${line}`;
      const status = normalized.slice(0, 2).trim() || "M";
      const file = normalized.slice(3).trim().split(" -> ").pop();
      const state = status.includes("A") || status.includes("?") ? "A" : status.includes("D") ? "D" : "M";
      return { state, file, extra: status };
    });
}

function parseNameStatus(output) {
  return output
    .split(/\r?\n/)
    .filter(Boolean)
    .slice(0, 160)
    .map((line) => {
      const parts = line.split("\t");
      const status = (parts[0] || "M").slice(0, 1);
      const state = status === "A" ? "A" : status === "D" ? "D" : "M";
      return { state, file: parts[parts.length - 1] || line, extra: status };
    });
}

function parseDiff(output) {
  if (!String(output || "").trim()) return [];
  return output
    .split(/\r?\n/)
    .slice(0, 320)
    .map((line) => {
      let type = "ctx";
      if (/^(diff --git|@@|\+\+\+|---)/.test(line)) type = "meta";
      else if (line.startsWith("+")) type = "add";
      else if (line.startsWith("-")) type = "del";
      return { type, text: line.slice(0, 280) };
    });
}

function parseLog(output) {
  const commits = [];
  for (const line of output.split(/\r?\n/)) {
    if (!line.includes("\x1f")) continue;
    const marker = line.indexOf("\x1f");
    const graph = line.slice(0, marker);
    const parts = line.slice(marker + 1).split("\x1f");
    if (parts.length < 7) continue;
    const lane = Math.max(0, Math.min(laneColors.length - 1, Math.floor(Math.max(0, graph.indexOf("*")) / 2)));
    commits.push({
      sha: parts[0],
      short: parts[1],
      author: parts[2] || "unknown",
      time: parts[3] || "",
      message: parts[4] || "(无提交信息)",
      refs: parts[5] || "",
      parents: parts[6] ? parts[6].split(" ").filter(Boolean) : [],
      lane,
      color: laneColors[lane],
      files: [],
      diff: [],
    });
  }
  return commits;
}

function sampleState() {
  const files = [
    { state: "M", file: "src/views/HistoryPanel.tsx", extra: "+28 -6" },
    { state: "A", file: "src/git/graphLayout.ts", extra: "+61" },
    { state: "M", file: "src/styles/workbench.css", extra: "+44 -12" },
    { state: "D", file: "docs/old-flow.md", extra: "-18" },
    { state: "M", file: "package.json", extra: "+2 -1" },
  ];
  const diff = [
    { type: "meta", text: "diff --git a/src/views/HistoryPanel.tsx b/src/views/HistoryPanel.tsx" },
    { type: "ctx", text: "function HistoryPanel({ commits, selectedSha }) {" },
    { type: "del", text: "  const lanes = commits.map((commit) => commit.lane);" },
    { type: "add", text: "  const lanes = graphLayout(commits, selectedSha);" },
    { type: "ctx", text: "  return (" },
    { type: "add", text: "    <GraphCanvas lanes={lanes} focus={selectedSha} />" },
    { type: "ctx", text: "    <CommitRows commits={commits} />" },
    { type: "del", text: "    <CommitDetails sha={selectedSha} />" },
    { type: "add", text: "    <CommitDetails sha={selectedSha} mode=\"inspector\" />" },
    { type: "ctx", text: "  );" },
    { type: "ctx", text: "}" },
  ];
  const data = [
    ["f83a9c2b0177", "Mina", "12 分钟前", "打磨提交图连线动画", "feature/visual-history", 0, ["d41c2ab91020"]],
    ["d41c2ab91020", "Leon", "38 分钟前", "添加语义化 Diff 分组", "review-ready", 0, ["ad9ef73774af", "7ca12dd48211"]],
    ["7ca12dd48211", "Rae", "1 小时前", "修复 Diff 面板拖拽尺寸", "fix/diff-pane-resize", 1, ["91b2a10552dd"]],
    ["ad9ef73774af", "Mina", "2 小时前", "接入分支操作菜单", "", 0, ["3cb8ffe030e4"]],
    ["91b2a10552dd", "Rae", "2 小时前", "完善检查器空状态", "", 1, ["3cb8ffe030e4"]],
    ["3cb8ffe030e4", "Nora", "5 小时前", "合并 release/2.9 到可视化历史", "merge", 0, ["6bb990ef4afd", "4ab612e810db"]],
    ["4ab612e810db", "Owen", "昨天", "发布候选版本构建", "release/2.9", 2, ["fa51203b0921"]],
    ["6bb990ef4afd", "Leon", "昨天", "持久化历史列宽", "", 0, ["fa51203b0921"]],
    ["fa51203b0921", "Nora", "周一", "添加命令面板动作", "main", 0, ["0be81f4189de"]],
    ["0be81f4189de", "Mina", "周一", "规范化提交图泳道数据", "", 0, ["8e3ab9017ed2"]],
    ["8e3ab9017ed2", "Owen", "周五", "初始化可视化历史外壳", "origin/main", 3, []],
  ];
  return {
    repo: {
      name: "atlas-dashboard",
      path: "示例仓库",
      branch: "feature/visual-history",
      isSample: true,
    },
    branches: ["feature/visual-history", "main", "release/2.9", "fix/diff-pane-resize", "experiment/ai-summary", "chore/design-tokens"],
    remotes: ["origin/main", "origin/feature/visual-history", "upstream/release/2.9"],
    workingFiles: files,
    commits: data.map(([sha, author, time, message, refs, lane, parents], index) => ({
      sha,
      short: sha.slice(0, 7),
      author,
      time,
      message,
      refs,
      parents,
      lane,
      color: laneColors[lane],
      files: [files[index % files.length], files[(index + 1) % files.length]],
      diff,
    })),
  };
}

async function readJson(req) {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function sendError(res, error) {
  sendJson(res, 400, { error: error.message || String(error) });
}

function serveStatic(req, res) {
  const urlPath = decodeURIComponent(new URL(req.url, `http://localhost:${PORT}`).pathname);
  const relative = urlPath === "/" ? "index.html" : urlPath.replace(/^\/+/, "");
  const filePath = path.normalize(path.join(PUBLIC_DIR, relative));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": mime(filePath) });
    res.end(data);
  });
}

function mime(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
  }[ext] || "application/octet-stream";
}

const server = http.createServer(async (req, res) => {
  const parsed = new URL(req.url, `http://localhost:${PORT}`);
  try {
    if (req.method === "GET" && parsed.pathname === "/api/state") {
      sendJson(res, 200, await readState(parsed.searchParams.get("ref") || ""));
      return;
    }
    if (req.method === "POST" && parsed.pathname === "/api/open") {
      const body = await readJson(req);
      sendJson(res, 200, await openRepo(body.path));
      return;
    }
    if (req.method === "GET" && parsed.pathname === "/api/commit") {
      sendJson(res, 200, await readCommit(parsed.searchParams.get("sha") || ""));
      return;
    }
    if (req.method === "GET" && parsed.pathname === "/api/worktree") {
      sendJson(res, 200, await readWorktree());
      return;
    }
    if (req.method === "GET" && parsed.pathname === "/api/worktree-diff") {
      sendJson(res, 200, await readWorkingDiff(parsed.searchParams.get("file") || ""));
      return;
    }
    if (req.method === "POST" && parsed.pathname === "/api/action") {
      const body = await readJson(req);
      sendJson(res, 200, await runAction(body));
      return;
    }
    serveStatic(req, res);
  } catch (error) {
    sendError(res, error);
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Forkline Web running at http://127.0.0.1:${PORT}`);
});
