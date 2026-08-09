"use strict";

const GIT_LOG_FIELD_SEPARATOR = "\0";
const BASIC_COMMIT_LOG_FORMAT = "%H%x00%h%x00%an%x00%ar%x00%s%x00%P";

function createRepositoryHistoryService(options) {
  const {
    git,
    getCurrentRepo,
    sampleState,
    normalizeRepoFile,
    normalizeSha,
    normalizeRefName,
    readBranchDisplayName,
    hasHeadCommit,
    parseStatus,
    selectStatusFile,
    parseNameStatus,
    parseDiff,
    formatLocalTime,
  } = options;

  async function readCommit(sha, readOptions = {}) {
    const includeDiff = Boolean(readOptions.includeDiff);
    const currentRepo = getCurrentRepo();
    if (!currentRepo) {
      const sample = sampleState();
      const commit = sample.commits.find((item) => item.sha === sha) || sample.commits[0];
      return { ...commit, files: commit.files, diff: includeDiff ? commit.diff : [], diffLoaded: includeDiff };
    }
    const repoPath = currentRepo;
    const parentLine = (await git(repoPath, ["rev-list", "--parents", "-n", "1", sha]).catch(() => "")).trim();
    const parents = parentLine.split(/\s+/).slice(1).filter(Boolean);
    const diffBase = parents.length > 1 ? parents[0] : "";
    const diffPromise = includeDiff
      ? diffBase
        ? git(repoPath, ["diff", "--find-renames", "--unified=8", "--no-ext-diff", diffBase, sha], { maxBuffer: 1024 * 1024 * 5 })
        : git(repoPath, ["show", "--format=", "--unified=8", "--no-ext-diff", sha], { maxBuffer: 1024 * 1024 * 5 })
      : Promise.resolve("");
    const [filesOutput, messageOutput, basicCommit, diffOutput] = await Promise.all([
      diffBase
        ? git(repoPath, ["diff", "--name-status", "--find-renames", diffBase, sha], { maxBuffer: 1024 * 1024 * 2 })
        : git(repoPath, ["show", "--name-status", "--format=", "--find-renames", sha], { maxBuffer: 1024 * 1024 * 2 }),
      git(repoPath, ["show", "-s", "--format=%B", sha], { maxBuffer: 1024 * 256 }),
      readBasicCommit(sha, repoPath),
      diffPromise,
    ]);
    return {
      ...basicCommit,
      summary: basicCommit.message,
      files: parseNameStatus(filesOutput),
      diff: parseDiff(diffOutput),
      diffLoaded: includeDiff,
      message: messageOutput.trimEnd(),
    };
  }

  async function readCommitPatch(sha) {
    const currentRepo = getCurrentRepo();
    if (!currentRepo) {
      const sample = sampleState();
      const commit = sample.commits.find((item) => item.sha === sha) || sample.commits[0];
      return {
        ok: true,
        sha: commit.sha,
        short: commit.short,
        fileName: commitPatchFileName(commit.short || "sample", commit.message || "forkline-sample"),
        patch: [
          `From ${commit.sha} Mon Sep 17 00:00:00 2001`,
          `Subject: [PATCH] ${commit.message}`,
          "",
          "diff --git a/README.md b/README.md",
          "--- a/README.md",
          "+++ b/README.md",
          "@@ -1 +1 @@",
          "-Forkline 示例",
          "+Forkline 示例补丁",
          "",
        ].join("\n"),
        command: `git format-patch -1 ${commit.short} --stdout`,
      };
    }
    const repoPath = currentRepo;
    const target = await resolveCommit(sha, repoPath);
    const [patch, shortOutput, subjectOutput] = await Promise.all([
      git(repoPath, ["format-patch", "-1", "--stdout", target], { maxBuffer: 1024 * 1024 * 12 }),
      git(repoPath, ["rev-parse", "--short", target], { timeout: 60000 }),
      git(repoPath, ["show", "-s", "--format=%s", target], { maxBuffer: 1024 * 256 }),
    ]);
    const short = shortOutput.trim();
    return {
      ok: true,
      sha: target,
      short,
      fileName: commitPatchFileName(short, subjectOutput.trim()),
      patch,
      command: `git format-patch -1 ${short} --stdout`,
    };
  }

  async function readFileHistory(filePath, refInput = "") {
    const file = normalizeRepoFile(filePath);
    const currentRepo = getCurrentRepo();
    if (!currentRepo) {
      const sample = sampleState();
      return {
        ok: true,
        file,
        ref: refInput || "HEAD",
        commits: sample.commits
          .filter((commit) => (commit.files || []).some((item) => item.file === file))
          .map((commit) => ({ ...commit, files: commit.files || [] }))
          .slice(0, 20),
        command: `git log --follow -- ${file}`,
      };
    }
    const repoPath = currentRepo;
    const ref = refInput ? normalizeCompareRef(refInput, "文件历史引用") : "HEAD";
    const [, historyFile] = await Promise.all([
      resolveFileReadRef(
        ref,
        "文件历史引用",
        `当前分支还没有任何提交，不能在 ${ref} 上查看文件历史。请先创建首个提交，或选择已有分支、Tag 或提交 SHA。`,
        repoPath
      ),
      resolveRefFileForWorktreePath(file, ref, repoPath),
    ]);
    const output = await git(
      repoPath,
      [
        "log",
        "--follow",
        "--find-renames",
        "--max-count=80",
        "--date=relative",
        `--format=${BASIC_COMMIT_LOG_FORMAT}`,
        "--name-status",
        ref,
        "--",
        historyFile.file,
      ],
      { maxBuffer: 1024 * 1024 * 4 }
    );
    return {
      ok: true,
      file,
      historyFile: historyFile.file,
      previousFile: historyFile.previousFile,
      ref,
      commits: parseFileHistoryLog(output, historyFile.file),
      command: `git log --follow ${ref} -- ${historyFile.file}`,
    };
  }

  async function readFileBlame(filePath, refInput = "") {
    const file = normalizeRepoFile(filePath);
    const currentRepo = getCurrentRepo();
    if (!currentRepo) {
      const sampleCommit = sampleState().commits[0];
      return {
        ok: true,
        file,
        ref: refInput || "HEAD",
        lines: [
          {
            line: 1,
            text: "示例内容",
            sha: sampleCommit.sha,
            short: sampleCommit.short,
            author: sampleCommit.author,
            time: sampleCommit.time,
            summary: sampleCommit.message,
          },
        ],
        truncated: false,
        command: `git blame --line-porcelain ${file}`,
      };
    }
    const repoPath = currentRepo;
    const ref = refInput ? normalizeCompareRef(refInput, "逐行追踪引用") : "HEAD";
    const [, blameFile] = await Promise.all([
      resolveFileReadRef(
        ref,
        "逐行追踪引用",
        `当前分支还没有任何提交，不能在 ${ref} 上逐行追踪。请先创建首个提交，或选择已有分支、Tag 或提交 SHA。`,
        repoPath
      ),
      resolveBlameFileForRef(file, ref, repoPath),
    ]);
    const output = await git(repoPath, ["blame", "--line-porcelain", blameFile.ref, "--", blameFile.file], { maxBuffer: 1024 * 1024 * 10 });
    const parsed = parseBlamePorcelain(output, 600, formatLocalTime);
    return {
      ok: true,
      file,
      historyFile: blameFile.file,
      previousFile: blameFile.previousFile,
      ref,
      blameRef: blameFile.ref,
      lines: parsed.lines,
      truncated: parsed.truncated,
      command: `git blame --line-porcelain ${blameFile.ref} -- ${blameFile.file}`,
    };
  }

  async function resolveBlameFileForRef(file, ref, repoPath = getCurrentRepo()) {
    const resolved = await resolveRefFileForWorktreePath(file, ref, repoPath);
    if (await refContainsFile(ref, resolved.file, repoPath)) return { ...resolved, ref };
    const parentRef = await findParentRefContainingFile(ref, resolved.file, repoPath);
    if (parentRef) return { ...resolved, ref: parentRef };
    return { ...resolved, ref };
  }

  async function resolveRefFileForWorktreePath(file, ref, repoPath = getCurrentRepo()) {
    const currentFile = normalizeRepoFile(file);
    if (await refContainsFile(ref, currentFile, repoPath)) return { file: currentFile, previousFile: "" };
    const statusOutput = await git(repoPath, ["status", "--short", "-z", "--untracked-files=all"]).catch(() => "");
    const target = selectStatusFile(parseStatus(statusOutput), currentFile, "any");
    const previousFile = target?.previousFile ? normalizeRepoFile(target.previousFile) : "";
    if (previousFile && await refContainsFile(ref, previousFile, repoPath)) {
      return { file: previousFile, previousFile };
    }
    return { file: currentFile, previousFile: "" };
  }

  async function refContainsFile(ref, file, repoPath = getCurrentRepo()) {
    return Boolean(await git(repoPath, ["cat-file", "-e", `${ref}:${file}`], { timeout: 60000 }).then(() => "1").catch(() => ""));
  }

  async function findParentRefContainingFile(ref, file, repoPath = getCurrentRepo()) {
    const parentLine = (await git(repoPath, ["rev-list", "--parents", "-n", "1", ref]).catch(() => "")).trim();
    const parents = parentLine.split(/\s+/).slice(1).filter(Boolean);
    for (const parent of parents) {
      if (await refContainsFile(parent, file, repoPath)) return parent;
    }
    return "";
  }

  async function readCompare(baseInput, headInput) {
    const currentRepo = getCurrentRepo();
    if (!currentRepo) {
      const sample = sampleState();
      const base = baseInput || sample.repo.branch || "HEAD";
      const head = headInput || sample.branches[0] || "main";
      return {
        ok: true,
        base,
        head,
        baseShort: "f83a9c2",
        headShort: "d41c2ab",
        mergeBaseShort: "4ab612e",
        baseOnlyCount: 1,
        headOnlyCount: 2,
        baseOnlyCommits: sample.commits.slice(0, 1),
        headOnlyCommits: sample.commits.slice(1, 3),
        files: sample.commits[0]?.files || [],
        diff: sample.commits[0]?.diff || [],
        command: `git diff ${base}...${head}`,
      };
    }
    const repoPath = currentRepo;
    const currentBranch = (await readBranchDisplayName(repoPath).catch(() => "HEAD")).trim() || "HEAD";
    const unborn = currentBranch !== "detached HEAD" && !(await hasHeadCommit(repoPath));
    if (unborn && !baseInput) {
      throw new Error(`当前分支 ${currentBranch} 还没有任何提交，不能作为比较基准。请先创建首个提交，或手动选择一个已有提交的分支作为基准。`);
    }
    const base = normalizeCompareRef(baseInput || (currentBranch === "detached HEAD" ? "HEAD" : currentBranch), "比较基准");
    const head = normalizeCompareRef(headInput, "比较目标");
    if (unborn && (base === currentBranch || base === "HEAD" || head === currentBranch || head === "HEAD")) {
      throw new Error("当前分支还没有任何提交，不能参与分支比较。请先创建首个提交，或选择两个已有提交的引用。");
    }
    const [baseSha, headSha] = await Promise.all([resolveCommitRef(base, "比较基准", repoPath), resolveCommitRef(head, "比较目标", repoPath)]);
    const mergeBase = (await git(repoPath, ["merge-base", base, head]).catch(() => "")).trim();
    const counts = (await git(repoPath, ["rev-list", "--left-right", "--count", `${base}...${head}`]).catch(() => "0\t0")).trim().split(/\s+/);
    const baseOnlyCount = Number(counts[0] || 0);
    const headOnlyCount = Number(counts[1] || 0);
    const [baseOnlyOutput, headOnlyOutput, filesOutput, diffOutput] = await Promise.all([
      baseOnlyCount ? git(repoPath, compareLogArgs(`${head}..${base}`), { maxBuffer: 1024 * 1024 * 2 }).catch(() => "") : "",
      headOnlyCount ? git(repoPath, compareLogArgs(`${base}..${head}`), { maxBuffer: 1024 * 1024 * 2 }).catch(() => "") : "",
      git(repoPath, ["diff", "--name-status", "--find-renames", compareDiffRange(base, head, mergeBase)], { maxBuffer: 1024 * 1024 * 2 }).catch(() => ""),
      git(repoPath, ["diff", "--unified=8", "--no-ext-diff", compareDiffRange(base, head, mergeBase)], { maxBuffer: 1024 * 1024 * 8 }).catch(() => ""),
    ]);
    return {
      ok: true,
      base,
      head,
      baseSha,
      headSha,
      baseShort: baseSha.slice(0, 7),
      headShort: headSha.slice(0, 7),
      mergeBase,
      mergeBaseShort: mergeBase ? mergeBase.slice(0, 7) : "",
      baseOnlyCount,
      headOnlyCount,
      baseOnlyCommits: parseBasicCommits(baseOnlyOutput).slice(0, 40),
      headOnlyCommits: parseBasicCommits(headOnlyOutput).slice(0, 40),
      files: parseNameStatus(filesOutput),
      diff: parseDiff(diffOutput),
      command: `git diff ${compareDiffRange(base, head, mergeBase)}`,
    };
  }

  function normalizeCompareRef(value, label) {
    const ref = normalizeRefName(value, label);
    return ref === "detached" || ref === "detached HEAD" ? "HEAD" : ref;
  }

  async function isCurrentUnbornRef(ref, repoPath = getCurrentRepo()) {
    const currentBranch = (await readBranchDisplayName(repoPath).catch(() => "")).trim();
    if (!currentBranch || currentBranch === "detached HEAD" || await hasHeadCommit(repoPath)) return false;
    return ref === "HEAD" || ref === "@" || ref === currentBranch || ref === `refs/heads/${currentBranch}`;
  }

  async function resolveFileReadRef(ref, label, unbornMessage, repoPath = getCurrentRepo()) {
    try {
      return await resolveCommitRef(ref, label, repoPath);
    } catch (error) {
      if (await isCurrentUnbornRef(ref, repoPath)) throw new Error(unbornMessage);
      throw error;
    }
  }

  async function resolveCommitRef(ref, label, repoPath = getCurrentRepo()) {
    return (await git(repoPath, ["rev-parse", "--verify", `${ref}^{commit}`], { timeout: 60000 }).catch(() => {
      throw new Error(`${label} ${ref} 不是有效提交引用。请刷新分支列表后再试。`);
    })).trim();
  }

  function compareLogArgs(range) {
    return ["log", "--max-count=40", "--date=relative", `--format=${BASIC_COMMIT_LOG_FORMAT}`, range];
  }

  function compareDiffRange(base, head, mergeBase) {
    return mergeBase ? `${base}...${head}` : `${base}..${head}`;
  }

  async function resolveCommit(value, repoPath = getCurrentRepo()) {
    const sha = normalizeSha(value);
    return (await git(repoPath, ["rev-parse", "--verify", `${sha}^{commit}`])).trim();
  }

  async function readBasicCommit(sha, repoPath = getCurrentRepo()) {
    const output = await git(repoPath, ["show", "-s", "--date=relative", `--format=${BASIC_COMMIT_LOG_FORMAT}`, sha], { maxBuffer: 1024 * 256 });
    return parseBasicCommits(output)[0] || { sha, short: sha.slice(0, 7), author: "", time: "", message: "", parents: [] };
  }

  return {
    readCommit,
    readCommitPatch,
    readFileHistory,
    readFileBlame,
    readCompare,
    readBasicCommit,
    parseBasicCommits,
  };
}

function parseBasicCommits(output) {
  return String(output || "")
    .split(/\r?\n/)
    .map((line) => {
      const parts = line.split(GIT_LOG_FIELD_SEPARATOR);
      if (parts.length < 6) return null;
      return {
        sha: parts[0],
        short: parts[1],
        author: parts[2] || "unknown",
        time: parts[3] || "",
        message: parts[4] || "(无提交信息)",
        parents: parts[5] ? parts[5].split(" ").filter(Boolean) : [],
      };
    })
    .filter(Boolean);
}

function parseFileHistoryLog(output, trackedFile) {
  const commits = [];
  let current = null;
  const pushCurrent = () => {
    if (!current) return;
    const files = parseHistoryNameStatus(current.fileLines);
    const primary = fileHistoryPrimaryChange(files, trackedFile);
    commits.push({
      sha: current.sha,
      short: current.short,
      author: current.author,
      time: current.time,
      message: current.message,
      parents: current.parents,
      files,
      change: primary?.state || "",
      previousFile: primary?.previousFile || "",
    });
  };

  for (const rawLine of String(output || "").split(/\r?\n/)) {
    if (!rawLine) continue;
    const header = parseFileHistoryHeader(rawLine);
    if (header) {
      pushCurrent();
      current = { ...header, fileLines: [] };
      continue;
    }
    if (current) current.fileLines.push(rawLine);
  }
  pushCurrent();
  return commits;
}

function parseFileHistoryHeader(line) {
  const parts = String(line || "").split(GIT_LOG_FIELD_SEPARATOR);
  if (parts.length < 6 || !/^[0-9a-f]{40}$/i.test(parts[0] || "")) return null;
  return {
    sha: parts[0],
    short: parts[1],
    author: parts[2] || "unknown",
    time: parts[3] || "",
    message: parts[4] || "(无提交信息)",
    parents: parts[5] ? parts[5].split(" ").filter(Boolean) : [],
  };
}

function parseHistoryNameStatus(lines) {
  return (lines || [])
    .map((line) => {
      const parts = String(line || "").split("\t");
      const status = parts[0] || "M";
      const code = status.slice(0, 1);
      const file = parts[parts.length - 1] || "";
      if (!file) return null;
      return {
        state: code === "A" ? "A" : code === "D" ? "D" : code === "R" ? "R" : code === "C" ? "C" : "M",
        file,
        previousFile: parts.length > 2 ? parts[1] : "",
        extra: status,
      };
    })
    .filter(Boolean)
    .slice(0, 40);
}

function fileHistoryPrimaryChange(files, trackedFile) {
  const normalized = normalizeHistoryPath(trackedFile);
  return (
    files.find((file) => normalizeHistoryPath(file.file) === normalized || normalizeHistoryPath(file.previousFile) === normalized) ||
    files[0] ||
    null
  );
}

function normalizeHistoryPath(value) {
  return String(value || "").replaceAll("\\", "/").toLowerCase();
}

function parseBlamePorcelain(output, maxLines = 600, formatLocalTime) {
  const lines = [];
  const commits = new Map();
  let current = null;
  let truncated = false;
  for (const rawLine of String(output || "").split(/\r?\n/)) {
    if (!rawLine) continue;
    const header = rawLine.match(/^([0-9a-f]{40})\s+\d+\s+(\d+)(?:\s+\d+)?$/i);
    if (header) {
      const sha = header[1];
      current = {
        sha,
        line: Number(header[2] || lines.length + 1),
        ...(commits.get(sha) || {}),
      };
      continue;
    }
    if (!current) continue;
    if (rawLine.startsWith("\t")) {
      if (lines.length >= maxLines) {
        truncated = true;
        continue;
      }
      const meta = commits.get(current.sha) || {};
      lines.push({
        line: current.line || lines.length + 1,
        text: rawLine.slice(1),
        sha: current.sha,
        short: (current.sha || "").slice(0, 7),
        author: current.author || meta.author || "unknown",
        time: current.time || meta.time || "",
        summary: current.summary || meta.summary || "(无提交信息)",
      });
      current = null;
      continue;
    }
    const index = rawLine.indexOf(" ");
    const key = index >= 0 ? rawLine.slice(0, index) : rawLine;
    const value = index >= 0 ? rawLine.slice(index + 1) : "";
    if (key === "author") current.author = value || "unknown";
    else if (key === "author-time") current.time = formatBlameTime(value, formatLocalTime);
    else if (key === "summary") current.summary = value || "(无提交信息)";
    commits.set(current.sha, { ...(commits.get(current.sha) || {}), author: current.author, time: current.time, summary: current.summary });
  }
  return { lines, truncated };
}

function formatBlameTime(value, formatLocalTime) {
  const seconds = Number(value || 0);
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  return formatLocalTime ? formatLocalTime(new Date(seconds * 1000)) : new Date(seconds * 1000).toLocaleString();
}

function commitPatchFileName(shortSha, subject) {
  const slug = String(subject || "commit")
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "commit";
  return `${String(shortSha || "commit").slice(0, 12)}-${slug}.patch`;
}

module.exports = { createRepositoryHistoryService };
