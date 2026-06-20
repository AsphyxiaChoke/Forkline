## 2026-06-20 - Task: highlight current branch and HEAD commit
### What was done
- Added current repository HEAD SHA to the full state and lightweight ref state API so the UI can identify the real HEAD independently from the selected commit.
- Highlighted the checked-out branch in the left branch list and top branch strip, and added a `HEAD` badge plus row highlight for the current HEAD commit.
- Kept branch/Tag view switching on the lightweight `/api/ref-state` path so changing the viewed ref does not reload unrelated repository state.
- Updated the continuation document so another Codex session can see this feature is already complete.
### Testing
- Pending: run JavaScript syntax checks, API checks, and browser UI verification after implementation.
### Notes
- `server.js`: exposes `repo.headSha` from both `/api/state` and `/api/ref-state`, and serves the lightweight ref state endpoint.
- `public/app.js`: adds current branch/current HEAD detection and related classes/badges during rendering; `selectRef` now refreshes only repo/commit data through `/api/ref-state`.
- `public/styles.css`: styles current branch rows/chips and current HEAD commit rows without replacing the selected state.
- `docs/CONTINUE.md`: records the completed current branch and HEAD commit highlight feature.
- Rollback: revert this task's edits in the files above, or reset this working tree to the commit before this task once the changes are committed.

## 2026-06-20 - Task: verify current branch and HEAD commit highlight
### What was done
- Verified the implementation against the real `D:\桌面\forkline-web` worktree on branch `codex/remote-latest`.
- Restarted the local Forkline service on `http://127.0.0.1:5177` so the running app uses the updated code.
### Testing
- `node --check server.js` passed with the Codex runtime Node.
- `node --check public/app.js` passed with the Codex runtime Node.
- `git diff --check` passed; Git only reported existing LF-to-CRLF conversion warnings.
- `/api/state` and `/api/ref-state?ref=` on `http://127.0.0.1:5177` both returned `repo.headSha = f83a9c2b0177`, and the commit list contained that SHA.
- Browser verification on `http://127.0.0.1:5177` confirmed one `.branch-row.current-branch`, one `.branch-chip.current-branch`, and one `.commit-row.current-head` with a `.head-badge`; console errors/warnings were empty.
- Screenshot capture timed out in the browser automation layer, but DOM and console checks passed on the live page.
### Notes
- `server.js`: verified `repo.headSha` and `/api/ref-state` on the live service.
- `public/app.js`: verified current branch/current HEAD render classes and badge markup in the live page.
- `public/styles.css`: verified the live page applies the current branch and HEAD classes.
- `docs/CONTINUE.md`: verified the handoff note includes this feature.
- `progress.md`: appended this verification record.
- Rollback: revert this task's edits in `server.js`, `public/app.js`, `public/styles.css`, `docs/CONTINUE.md`, and `progress.md`; the live service can then be restarted on port 5177.

## 2026-06-20 - Task: auto-open browser on Windows server start
### What was done
- Added Windows-only automatic browser opening after the local server starts.
- Reused `execFile` through `cmd /c start` and kept non-Windows startup behavior unchanged.
- Documented the startup behavior in the continuation notes.
### Testing
- Pending: run server syntax check and verify the server still starts.
### Notes
- `server.js`: opens `http://127.0.0.1:<PORT>` automatically on Windows after `server.listen` succeeds.
- `docs/CONTINUE.md`: records that Windows startup now opens the local app URL automatically.
- `progress.md`: appended this implementation record.
- Rollback: remove `openLocalAppInBrowser` and its call in `server.js`, then remove this startup note from `docs/CONTINUE.md`.

## 2026-06-20 - Task: verify auto-open browser startup
### What was done
- Verified the Windows startup change with syntax checks and a temporary service start.
### Testing
- `node --check server.js` passed with the Codex runtime Node.
- `git diff --check` passed; Git only reported existing LF-to-CRLF conversion warnings.
- Temporary service `http://127.0.0.1:5290` started successfully, listened on port 5290, and `/api/state` returned sample repo state with `repo.headSha`.
- Existing service `http://127.0.0.1:5177` remained running while the temporary service was verified.
### Notes
- `server.js`: verified the server still starts after adding Windows auto-open.
- `docs/CONTINUE.md`: startup behavior remains documented.
- `progress.md`: appended this verification record.
- Rollback: revert the `server.js`, `docs/CONTINUE.md`, and `progress.md` edits from this task; the temporary 5290 service was stopped.

## 2026-06-20 - Task: restore folder picker and improve merge graph readability
### What was done
- Restored the top-bar "选择" folder picker beside the repository path input.
- Fixed the path bar grid so the newly restored "选择" button does not force the "打开" button into a hidden second row.
- Added an internal directory browser modal with path jump, parent navigation, drive roots, and common shortcuts for desktop, downloads, documents, and user home.
- Added `/api/browse` so the UI can list local directories, identify Git repositories, and hide `.git` from the visible folder list.
- Widened the commit graph lane area and made merge commits easier to read with larger merge nodes, `M2` / `M3` parent-count labels, and dashed secondary-parent lines.
- Updated the continuation document so the restored picker and merge graph change are visible to future sessions.
### Testing
- `node --check server.js` passed with the Codex runtime Node.
- `node --check public/app.js` passed with the Codex runtime Node.
- `git diff --check` passed; Git only reported existing LF-to-CRLF conversion warnings.
- Temporary HTTP/API verification returned `/api/browse` for `D:\桌面\forkline-web` with `isGit = true`, shortcuts `桌面,下载,文档,用户目录`, no `.git` entry, and the expected modal/button HTML.
- Browser preview verification on `http://127.0.0.1:5290/` confirmed the "选择" button opens the folder modal, shortcuts render, `.git` is hidden, and the merge graph contains `M2`, a dashed secondary-parent path, and `viewBox = 0 0 156 ...`.
- Browser layout verification on `http://127.0.0.1:5291/` confirmed `repoInput`, recent repo select, clear, "选择", "克隆", "初始化", and "打开" all remain on one row with no overlapping boxes at desktop width and at 1180px viewport width.
- Browser console errors/warnings were empty during the preview verification.
### Notes
- `server.js`: added the local directory browser helpers and `/api/browse`.
- `public/index.html`: restored the "选择" button and folder picker modal markup.
- `public/app.js`: wired folder picker state/events and enhanced merge graph rendering.
- `public/styles.css`: styled the folder picker and widened the graph column.
- `docs/CONTINUE.md`: documented the restored folder picker and merge graph readability change.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `public/index.html`, `public/app.js`, `public/styles.css`, `docs/CONTINUE.md`, and `progress.md`; no persistent test data was created.

## 2026-06-20 - Task: simplify workspace changes panel
### What was done
- Removed the duplicate left-sidebar workspace file list.
- Renamed the bottom unstaged changes area to "工作区" and moved the workspace file filter into that panel.
- Kept the existing workspace filtering behavior, including path/status matching, count display, and clear action.
- Updated the continuation document so future sessions know the workspace filter now lives in the bottom changes panel.
### Testing
- `node --check public/app.js` passed with the Codex runtime Node.
- `node --check server.js` passed with the Codex runtime Node.
- `git diff --check` passed; Git only reported existing LF-to-CRLF conversion warnings.
- Static checks confirmed `worktreeList`, the old left `<section class="worktree">`, and `file-stack` are no longer referenced in `public/`.
- Live `http://127.0.0.1:5177/` verification confirmed the left sidebar only shows local and remote branches, the bottom panel title is "工作区", and the filter input is inside the bottom changes panel with no console errors.
- Temporary in-memory preview `http://127.0.0.1:5293/` verified sample workspace filtering: entering `workbench` reduced the change list to `src/styles/workbench.css`, showed `1/5`, and the clear button restored all 5 rows with no console errors. The preview server was stopped after testing.
### Notes
- `public/index.html`: removed the old sidebar workspace block and placed the workspace filter in the bottom changes panel.
- `public/app.js`: removed the old sidebar list rendering path, renamed the unstaged section to "工作区", and keeps filter metadata synchronized during stage rendering.
- `public/styles.css`: removed obsolete sidebar workspace/file-stack styles and sized the bottom changes grid for the new filter row.
- `docs/CONTINUE.md`: updated the current feature note to say the workspace filter now lives in the bottom changes panel.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `public/index.html`, `public/app.js`, `public/styles.css`, `docs/CONTINUE.md`, and `progress.md`.

## 2026-06-20 - Task: redesign branch graph modes
### What was done
- Split the commit graph into two clearer modes: all-branch overview and single-branch focus.
- All-branch view keeps multiple lanes, branch labels, merge parent-count labels, and dashed secondary-parent merge lines so branch merge relationships are visible.
- Single-branch view now uses first-parent history and draws one main timeline; merge commits keep a side hint and "合并" label without expanding every merged side-branch commit into the branch view.
- Widened the graph column to make merge labels and branch lanes easier to read.
- Updated the continuation document with the new graph behavior.
### Testing
- `node --check public/app.js` passed with the Codex runtime Node.
- `node --check server.js` passed with the Codex runtime Node.
- `git diff --check` passed; Git only reported existing LF-to-CRLF conversion warnings.
- Real Git command verification on `D:\桌面\GitTest` confirmed `git log --first-parent main` returns the main branch timeline while retaining merge commits.
- Browser preview verification on `http://127.0.0.1:5295/` confirmed all-branch view uses `graph-lines overview`, 2 lane guides, `M2`, and a dashed secondary-parent path.
- Browser preview verification confirmed switching to `main` uses `graph-lines focus`, one lane guide, 3 first-parent commits (`Merge feature/login`, `main update`, `base commit`), a side merge hint, and no console errors. The preview server was stopped after testing.
### Notes
- `server.js`: single-ref log requests now use `--first-parent`, and sample ref-state returns a first-parent style commit list.
- `public/app.js`: separates overview and focused graph rendering, keeps side-branch lanes in all-branch mode, and draws focused branch history as a mainline graph.
- `public/styles.css`: widens the graph column to match the new SVG width.
- `docs/CONTINUE.md`: documents the new all-branch versus single-branch graph behavior.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `public/app.js`, `public/styles.css`, `docs/CONTINUE.md`, and `progress.md`.

## 2026-06-20 - Task: remove merge text labels from graph
### What was done
- Removed the visible merge text labels from both all-branch and single-branch graph modes, so merge commits no longer show `M2`, `M3`, or "合并" next to the node.
- Kept merge commit nodes, overview merge curves, dashed secondary-parent lines, and single-branch side merge hints so merge relationships remain visible without extra text.
- Updated the continuation document to describe that merge commits are represented by nodes and lines instead of text labels.
### Testing
- `node --check public/app.js` passed with the Codex runtime Node.
- `node --check server.js` passed with the Codex runtime Node.
- `git diff --check` passed; Git only reported existing LF-to-CRLF conversion warnings.
- Static assertion confirmed `mergeLabel`, `graph-merge-label`, and merge-label calls are gone from `public/app.js`, while merge nodes and branch merge hints remain.
- Browser validation was attempted through the in-app browser on `http://127.0.0.1:5296/` and `http://localhost:5296/`, but the browser client blocked localhost navigation with `net::ERR_BLOCKED_BY_CLIENT`; this was not counted as a visual pass.
### Notes
- `public/app.js`: removed merge text label rendering and the now-unused helper.
- `docs/CONTINUE.md`: updated the graph behavior note to say merge commits use nodes and lines rather than text labels.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `public/app.js`, `docs/CONTINUE.md`, and `progress.md`.

## 2026-06-20 - Task: align all-branch graph colors with branch colors
### What was done
- Updated all-branch graph layout so each lane keeps the branch name it represents and uses that branch's existing color instead of the lane index color.
- Updated overview lane guides and secondary merge-parent lines to use the represented branch color, keeping graph nodes, labels, and helper lines visually consistent with the branch list.
- Updated the continuation document so future sessions know graph colors are branch-color based.
### Testing
- `node --check public/app.js` passed with the Codex runtime Node.
- `node --check server.js` passed with the Codex runtime Node.
- `git diff --check` passed; Git only reported existing LF-to-CRLF conversion warnings.
- Logic verification with a constructed branch order confirmed `main` uses `refColor("main")` even when it is rendered on lane 0, and no longer falls back to `laneColor(0)`.
- Browser verification on `http://127.0.0.1:5301/` confirmed the app renders, the overview graph is present, `main` branch color is `#ff7a67`, the graph `main` label stroke is `#ff7a67`, overview lane guides include `#ff7a67`, and browser console errors/warnings are empty.
### Notes
- `public/app.js`: records branch names during all-branch graph layout and derives overview graph colors from branch colors.
- `docs/CONTINUE.md`: documents that all-branch graph colors now match branch list colors.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `public/app.js`, `docs/CONTINUE.md`, and `progress.md`; stop any temporary verification service on port 5301 if still running.

## 2026-06-21 - Task: keep top bar fixed and switch inspector tabs by selection context
### What was done
- Decoupled the top bar grid from the right inspector width so dragging the inspector only resizes the lower workspace and does not move the repository path area or top-right controls.
- Added a top-right "更多" selector for worktrees, submodules, stashes, recovery points, and operation logs.
- Updated the inspector tab rules so commit selection shows only "详情 / 文件 / 标签列表", worktree or staged file selection shows only "历史 / 逐行", and branch selection shows only "分支整理 / 同步情况 / 分支比较".
- Updated the continuation document with the new top-bar and inspector navigation behavior.
### Testing
- `node --check public/app.js` passed with the Codex runtime Node.
- `node --check server.js` passed with the Codex runtime Node.
- `git diff --check` passed; Git only reported existing LF-to-CRLF conversion warnings.
- Browser verification on `http://127.0.0.1:5303/` confirmed dragging the right inspector changed the workspace grid from `190px 7px 816px 7px 260px` to `190px 7px 666px 7px 410px`, while topbar, repo bar, and actions coordinates stayed stable.
- Browser verification confirmed commit tabs show `详情, 文件, 标签列表`; file selection shows `历史, 逐行` with "文件历史" active; branch selection shows `分支整理, 同步情况, 分支比较`; selecting `操作日志` from "更多" hides the inspector tab row and opens the operation log panel.
- Browser page console errors/warnings were empty; the Browser plugin emitted unrelated Statsig network timeout messages outside the app page.
### Notes
- `public/index.html`: added the top-right "更多" inspector selector and renamed visible inspector tab labels.
- `public/app.js`: added inspector context rules, context-aware tab filtering, file/branch/commit selection switching, and "更多" selection handling.
- `public/styles.css`: fixed the topbar grid, styled the "更多" selector, and hid inspector tabs in more-context panels.
- `docs/CONTINUE.md`: documented fixed topbar and context-based inspector tabs.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `public/index.html`, `public/app.js`, `public/styles.css`, `docs/CONTINUE.md`, and `progress.md`; stop any temporary verification service on port 5303 if still running.
