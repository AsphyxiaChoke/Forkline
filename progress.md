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

## 2026-06-21 - Task: improve dark dropdown readability
### What was done
- Updated the top-right "更多" selector so the closed select and its native options use the dark panel background and light text in dark mode.
- Kept light mode on the browser's light color scheme so the same control remains readable there.
### Testing
- Browser verification on `http://127.0.0.1:5304/` confirmed the app loads in dark mode, the "更多" selector can switch to "操作日志", and the right panel changes to the operation log view.
- Computed style verification confirmed both the select and the "操作日志" option use `rgb(29, 34, 43)` background, `rgb(231, 236, 243)` text, and dark `color-scheme`.
- Browser page console errors/warnings were empty.
### Notes
- `public/styles.css`: changed the "更多" selector and option colors for readable dark-mode dropdown text.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `public/styles.css` and `progress.md`; stop any temporary verification service on port 5304 if still running.

## 2026-06-21 - Task: fix more panel clipping in inspector
### What was done
- Fixed the right inspector content area so panels opened from the top-right "更多" selector occupy the full remaining inspector height instead of collapsing into the hidden tab row.
- Kept long "更多" panels scrollable inside the right sidebar, while normal commit detail tabs continue to show their tab row.
### Testing
- Browser verification on `http://127.0.0.1:5305/` reproduced the issue before the fix: after selecting "操作日志", `#detailBody` was only `28px` high while the inspector had `588px` of available content space.
- Browser verification after the fix confirmed "操作日志" and "恢复点" both render with `#detailBody` at `588px` high, with long content scrolling inside the right sidebar.
- Browser verification confirmed the normal commit detail view still renders the tab row and `#detailBody` at `548px` high.
- Browser page console errors/warnings were empty.
### Notes
- `public/styles.css`: pins the inspector detail body to the third grid row so hiding the tab row does not collapse the content viewport.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `public/styles.css` and `progress.md`; stop any temporary verification service on port 5305 if still running.

## 2026-06-21 - Task: remove default worktree file highlight
### What was done
- Removed the automatic selection of the first worktree file when rendering the workspace change list.
- The work diff panel now stays in the "未选择文件" state until the user explicitly clicks a file.
- Manual file selection still highlights the clicked row, loads its diff, and switches the inspector to file history/blame tabs.
### Testing
- Browser verification on `http://127.0.0.1:5306/` confirmed the initial workspace change list has no `.selected` or `.multi-selected` file row.
- Browser verification confirmed the diff panel initially shows "未选择文件".
- Browser verification confirmed clicking `src/views/HistoryPanel.tsx` selects only that row, loads `HistoryPanel.tsx · 未暂存`, and opens the file-history inspector tabs.
- Browser page console errors/warnings were empty.
### Notes
- `public/app.js`: stops auto-selecting the first visible worktree file during stage rendering and only loads worktree diff after an explicit selection.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `public/app.js` and `progress.md`; stop any temporary verification service on port 5306 if still running.

## 2026-06-21 - Task: clear worktree highlight on deselect
### What was done
- Updated worktree file selection so Ctrl-clicking an already selected file clears both the multi-select state and the focused file highlight.
- When the last selected worktree file is deselected, the work diff panel returns to "未选择文件" instead of keeping the previous file highlighted.
### Testing
- Browser verification on `http://127.0.0.1:5307/` confirmed the initial worktree list has no selected rows and the diff panel shows "未选择文件".
- Browser verification confirmed clicking `src/views/HistoryPanel.tsx` selects and highlights that row, loads `HistoryPanel.tsx · 未暂存`, and opens file history.
- Browser verification confirmed Ctrl-clicking the same row clears both `.selected` and `.multi-selected`, empties the diff path, and restores the diff text to "未选择文件".
- Browser page console errors/warnings were empty.
### Notes
- `public/app.js`: derives the focused worktree file from the current selection after each click, so deselection clears the visual highlight.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `public/app.js` and `progress.md`; stop any temporary verification service on port 5307 if still running.

## 2026-06-21 - Task: move conflict choice buttons into conflict prompt
### What was done
- Removed all bottom Diff panel buttons except "最大化".
- Moved per-file conflict choice actions into the workspace conflict prompt, showing "当前 --ours" and "对方 --theirs" for each unresolved conflict file.
- Kept the existing file right-click conflict actions intact.
### Testing
- `node --check public/app.js` passed.
- `node --check server.js` passed.
- `git diff --check` passed.
- Search confirmed no visible bottom Diff action/scope selectors remain: `data-work-diff-action`, `data-work-diff-scope`, and `.work-diff-scope` are absent from `public/`.
- Browser verification on `http://127.0.0.1:5177/` confirmed the bottom Diff panel only has "最大化" and no console warnings/errors.
- Browser verification with a temporary merge-conflict repo confirmed the workspace conflict prompt renders `conflict.txt` with "当前 --ours" and "对方 --theirs" buttons, while the bottom Diff panel still only has "最大化".
- The temporary conflict repo was removed, and `http://127.0.0.1:5177/` was restored to `D:/桌面/GitTest` after verification.
### Notes
- `public/index.html`: removed the old bottom Diff panel action/scope buttons and kept only the maximize button.
- `public/app.js`: renders conflict choice buttons inside the conflict prompt and routes them to the existing single-file conflict resolution action.
- `public/styles.css`: adds compact conflict choice row styling and removes unused bottom scope-button styling.
- `docs/CONTINUE.md`: updates the conflict-resolution usage note so future work looks for the buttons in the conflict prompt instead of the bottom Diff panel.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `public/index.html`, `public/app.js`, `public/styles.css`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-21 - Task: optimize render performance and UI colors
### What was done
- Debounced commit search rendering so rapid typing no longer redraws the commit list and SVG graph on every keypress.
- Batched commit row insertion with a document fragment to reduce DOM append work on large histories.
- Refined the dark and light palettes, with clearer panel separation, selected commit rows, current HEAD rows, active branch chips, search focus state, active tabs, and hover states.
### Testing
- `node --check public/app.js` passed using the bundled Node executable.
- `node --check server.js` passed using the bundled Node executable.
- `git diff --check` passed.
- HTTP verification confirmed `http://127.0.0.1:5177/` returns 200 after starting the local service.
- API verification confirmed `http://127.0.0.1:5177/api/state` returns repository state successfully.
- In-app Browser visual verification was intentionally skipped after repeated 5177 page opens made the Codex session unstable; this task used static checks plus local HTTP/API verification instead.
### Notes
- `public/app.js`: adds cancellable delayed commit search rendering and batches commit row DOM insertion.
- `public/styles.css`: updates color tokens and key active/selected/focus styles for clearer UI hierarchy.
- `docs/CONTINUE.md`: records the search performance and palette updates for future continuation.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `public/app.js`, `public/styles.css`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-21 - Task: continue performance and UI color polish
### What was done
- Reduced redundant inspector rendering during commit list refreshes: full refresh and commit clicks now avoid double-rendering the right panel, and search refreshes only update the inspector when the selected commit actually changes.
- Reused one compiled commit-search highlight pattern per render instead of rebuilding the same regular expression for every highlighted commit field.
- Strengthened worktree file-row colors so hover, current file, multi-selected file, current multi-selected file, and conflict states are easier to distinguish.
### Testing
- `node --check public/app.js` passed using the bundled Node executable.
- `node --check server.js` passed using the bundled Node executable.
- `git diff --check` passed.
- HTTP verification confirmed `http://127.0.0.1:5177/` returns 200.
- API verification confirmed `http://127.0.0.1:5177/api/state` returns 200.
- HTTP static resource verification confirmed `/app.js` contains `renderCommitInspector` and `commitSearchPattern`.
- HTTP static resource verification confirmed `/styles.css` contains the updated multi-selected and conflict file-row color rules.
- In-app Browser visual verification was intentionally skipped because repeated localhost opens can destabilize the Codex session; this task used static checks plus local HTTP/API verification instead.
### Notes
- `public/app.js`: avoids redundant inspector refreshes on commit renders and reuses the commit-search highlight regex for each render.
- `public/styles.css`: updates worktree file-row hover, selected, multi-selected, selected-multi, and conflict color states.
- `docs/CONTINUE.md`: documents the additional render-performance and worktree color refinements.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `public/app.js`, `public/styles.css`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-21 - Task: refine top-right toolbar UI
### What was done
- Grouped the top-right actions into compact utility, sync, and more-panel controls instead of leaving every button as a separate loose item.
- Changed the "more" panel selector into a single button-like select with "更多" as the default label, removing the old "更多 + 选择" double-label layout.
- Restyled the top-right toolbar area with quieter grouped backgrounds, tighter inner button spacing, clearer hover states, and a softer danger state for force push.
### Testing
- `node --check public/app.js` passed using the bundled Node executable.
- `node --check server.js` passed using the bundled Node executable.
- `git diff --check` passed.
- HTTP verification confirmed `http://127.0.0.1:5177/` returns 200 and includes `topbar-action-group` plus the new "更多" default option.
- HTTP static resource verification confirmed `/styles.css` returns the new `.topbar-action-group`, `.topbar-sync-actions`, `.topbar-more::after`, and scoped top-right danger-hover styles.
- API verification confirmed `http://127.0.0.1:5177/api/state` returns 200.
- In-app Browser visual verification was intentionally skipped because repeated localhost opens can destabilize the Codex session; this task used static checks plus local HTTP/API verification instead.
### Notes
- `public/index.html`: wraps right-top actions into grouped toolbar sections and simplifies the more-panel select label.
- `public/styles.css`: adds grouped toolbar styling, compact nested button states, and polished more-select styling.
- `docs/CONTINUE.md`: records the right-top toolbar UI cleanup for future continuation.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `public/index.html`, `public/styles.css`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-21 - Task: keep repository path chooser visible
### What was done
- Reworked the top path opener so the path input, recent repository selector, and repository action buttons are separate layout groups.
- Kept the "选择" directory button as a fixed-width action inside the path button group, so it is not squeezed out by the input or recent repository dropdown.
- Moved the medium-width topbar breakpoint earlier and added narrower topbar layouts so the path area and top-right actions do not overlap or deform each other.
### Testing
- `node --check public/app.js` passed using the bundled Node executable.
- `node --check server.js` passed using the bundled Node executable.
- `git diff --check` passed.
- HTTP verification confirmed `http://127.0.0.1:5177/` returns 200 and includes `recent-repo-group`, `path-actions`, and `id="browseRepo"`.
- HTTP static resource verification confirmed `/styles.css` returns `.path-actions`, `.recent-repo-group`, and the earlier responsive topbar breakpoints.
- API verification confirmed `http://127.0.0.1:5177/api/state` returns 200.
- Headless browser screenshot verification was unavailable because no browser executable was exposed as `msedge`, `chrome`, or `chromium`; in-app Browser visual verification was intentionally skipped because repeated localhost opens can destabilize the Codex session.
### Notes
- `public/index.html`: groups the recent repository controls and path action buttons so the directory chooser remains an explicit button.
- `public/styles.css`: updates path opener grid columns, button sizing, and topbar responsive breakpoints to prevent overlap and deformation.
- `docs/CONTINUE.md`: updates the path selector note with the fixed visible chooser and responsive layout behavior.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `public/index.html`, `public/styles.css`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-21 - Task: add settings panel
### What was done
- Added a "设置" entry to the top-right "更多" selector and command palette.
- Added a right-side settings panel for browser-local preferences: theme selection, recent repository cleanup, repository directory chooser shortcut, recovery retention policy, and layout width/height reset.
- Wired settings controls to the existing localStorage-backed theme, recent repository, recovery policy, and layout preferences without adding new backend configuration.
### Testing
- `node --check public/app.js` passed using the bundled Node executable.
- `node --check server.js` passed using the bundled Node executable.
- `git diff --check` passed.
- HTTP verification confirmed `http://127.0.0.1:5177/` returns 200 and includes the `settings` option.
- HTTP static resource verification confirmed `/app.js` returns `renderSettingsTab`, `data-settings-action`, and `tabSettings`.
- HTTP static resource verification confirmed `/styles.css` returns `.settings-layout`, `.settings-card`, and `.settings-choice`.
- API verification confirmed `http://127.0.0.1:5177/api/state` returns 200.
- In-app Browser visual verification was intentionally skipped because repeated localhost opens can destabilize the Codex session; this task used static checks plus local HTTP/API verification instead.
### Notes
- `public/index.html`: adds the settings option to the top-right more selector.
- `public/app.js`: registers the settings tab, renders the settings panel, and handles settings actions.
- `public/styles.css`: adds compact settings panel layout and row styles.
- `docs/CONTINUE.md`: documents the settings panel and its current browser-local scope.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `public/index.html`, `public/app.js`, `public/styles.css`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-28 - Task: split frontend framework files
### What was done
- Split the previous single frontend script into ordered framework layers: `public/js/core.js`, `public/js/api.js`, existing `public/app.js`, and `public/js/bootstrap.js`.
- Moved shared state, DOM handles, constants, API wrapper, and startup sequence out of the legacy feature file while keeping existing feature behavior in place.
- Added the `window.Forkline` namespace so later modules can depend on a stable framework object instead of adding new globals.
- Added `docs/ARCHITECTURE.md` to document the loading order and next split targets.
### Testing
- `node --check public/js/core.js` passed using the bundled Node executable.
- `node --check public/js/api.js` passed using the bundled Node executable.
- `node --check public/app.js` passed using the bundled Node executable.
- `node --check public/js/bootstrap.js` passed using the bundled Node executable.
- `node --check server.js` passed using the bundled Node executable.
- `git diff --check` passed.
- Started the local service and confirmed `http://127.0.0.1:5177/` returns 200 with the new `core.js`, `api.js`, and `bootstrap.js` script order.
- HTTP static resource checks confirmed `/js/core.js`, `/js/api.js`, and `/js/bootstrap.js` return the expected framework markers.
- API verification confirmed `http://127.0.0.1:5177/api/state` returns 200.
### Notes
- `public/index.html`: now loads frontend scripts in framework order before startup.
- `public/js/core.js`: contains shared state, constants, DOM handles, and `window.Forkline`.
- `public/js/api.js`: contains the shared API wrapper and exposes `Forkline.api`.
- `public/app.js`: keeps the existing feature implementation and no longer owns shared state, API setup, or startup calls.
- `public/js/bootstrap.js`: owns the startup sequence and exposes `Forkline.start`.
- `docs/ARCHITECTURE.md`: documents the frontend layers, loading order, and next migration targets.
- `docs/CONTINUE.md`: records the framework split for future continuation.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `public/index.html`, `public/app.js`, `public/js/core.js`, `public/js/api.js`, `public/js/bootstrap.js`, `docs/ARCHITECTURE.md`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-28 - Task: complete frontend module split
### What was done
- Split the remaining legacy frontend feature code out of `public/app.js` into ordered `public/js/app/`, `public/js/features/`, and `public/js/panels/` modules.
- Updated `public/index.html` so the direct browser loading model now loads all feature and panel modules before the compatibility placeholder and bootstrap script.
- Kept `public/app.js` as a small compatibility file only, so new feature work has clear module locations.
- Updated architecture and continuation notes to describe the final split, loading order, and future file placement rules.
### Testing
- `node --check` passed for all 21 frontend JavaScript files under `public/` using the bundled Node executable.
- `git diff --check` passed; Git only reported CRLF normalization warnings for touched text files.
- Static entry verification confirmed all 21 `<script>` paths in `public/index.html` exist on disk.
- HTTP verification confirmed `http://127.0.0.1:5177/` returns 200 and includes the new module script paths.
- HTTP static resource checks confirmed `/js/app/init.js`, `/js/features/branches.js`, `/js/panels/recovery-settings.js`, `/js/features/diff-workbench.js`, `/js/app/events.js`, and `/js/bootstrap.js` return 200.
- API verification confirmed `http://127.0.0.1:5177/api/state` returns 200.
- In-app Browser visual verification was intentionally skipped because repeated localhost opens can destabilize the Codex session; this task used syntax, static entry, local HTTP, and API verification instead.
### Notes
- `public/index.html`: loads all split frontend modules in dependency order before startup.
- `public/app.js`: now only documents legacy compatibility and no longer contains feature code.
- `public/js/app/init.js`: contains initial data loading and top-level render orchestration.
- `public/js/app/layout-utils.js`: contains theme, layout resizing, escaping, initials, and toast helpers.
- `public/js/app/events.js`: contains DOM event binding and top-level delegated handlers.
- `public/js/features/branches.js`: contains branch list rendering and branch create/rename/delete helpers.
- `public/js/features/worktree-changes.js`: contains worktree, stage, conflict banner, and change-list rendering.
- `public/js/features/history-list.js`: contains commit list rendering and commit search helpers.
- `public/js/features/folder-command.js`: contains directory picker, command palette, and inspector-tab switching helpers.
- `public/js/features/context-menus.js`: contains commit, branch, file, tag, remote, and reflog context menus.
- `public/js/features/commit-actions.js`: contains commit tools, history rewrite queue, cherry-pick, revert, reset, tag, patch, and remote-link actions.
- `public/js/features/graph.js`: contains commit graph rendering and commit-detail loading.
- `public/js/features/diff-workbench.js`: contains file tree, diff selection, workbench diff rendering, hunk actions, and worktree auto-refresh.
- `public/js/features/repositories.js`: contains recent repositories, clone, init, patch, and repository-open workflows.
- `public/js/features/git-actions.js`: contains ref checkout, merge, rebase, topbar Git actions, stash creation, file actions, and commit submit flows.
- `public/js/panels/inspector.js`: contains commit details, files, file history, file blame, and history rewrite panel rendering.
- `public/js/panels/workspaces.js`: contains branch cleanup, worktree, and submodule panels.
- `public/js/panels/sync.js`: contains stash, sync, compare, remote, auth, and diagnosis panels.
- `public/js/panels/recovery-settings.js`: contains tags, recovery points, reflog, logs, settings, and recovery-policy flows.
- `docs/ARCHITECTURE.md`: documents the final frontend layers, script order, and module placement rules.
- `docs/CONTINUE.md`: records that the frontend feature split is complete.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `public/index.html`, `public/app.js`, `public/js/app/`, `public/js/features/`, `public/js/panels/`, `docs/ARCHITECTURE.md`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-28 - Task: stage selected diff lines
### What was done
- Added line selection to the bottom worktree Diff so added/deleted Diff rows can be selected without checkboxes.
- Added a "暂存所选行" action that stages only selected unstaged Diff rows; paired modification rows stage the delete/add pair together.
- Added a backend `stageSelectedLines` action that rereads the real repository Diff and builds a minimal patch for selected lines before applying it to the index.
- Added `FORKLINE_NO_OPEN=1` for local verification runs that should restart the service without opening a browser automatically.
### Testing
- `node --check server.js` passed using the bundled Node executable.
- `node --check` passed for all 21 frontend JavaScript files under `public/` using the bundled Node executable.
- `git diff --check` passed; Git only reported CRLF normalization warnings for touched text files.
- Temporary Git repository API verification passed: selected only the added `line5 added` row and confirmed the cached diff contained that addition while the `line2 changed` modification remained unstaged.
- Temporary Git repository API verification passed: selected the paired delete/add rows for `line2 changed` and confirmed both remaining selected lines moved into the cached diff, leaving no unstaged diff.
- Temporary Git repository API verification passed for an untracked file: selected only the `three` row and confirmed the index contained that selected line without staging the other new-file rows.
- Restarted `http://127.0.0.1:5177/` with `FORKLINE_NO_OPEN=1`; HTTP verification confirmed the page returns 200 without opening a browser automatically.
- HTTP static resource checks confirmed `/js/features/diff-workbench.js`, `/js/app/events.js`, and `/styles.css` return the new line-selection markers.
- API verification confirmed `http://127.0.0.1:5177/api/state` returns 200.
- In-app Browser visual verification was intentionally skipped because repeated localhost opens can destabilize the Codex session; this task used syntax, local HTTP/API, and temporary Git repository behavior verification instead.
### Notes
- `server.js`: adds `stageSelectedLines`, selected-line patch generation, operation labeling, and the `FORKLINE_NO_OPEN=1` local startup guard.
- `public/js/core.js`: stores selected Diff line state.
- `public/js/features/diff-workbench.js`: renders the selected-line toolbar, selectable Diff rows, selection state, and selected-line staging request.
- `public/js/app/events.js`: routes Diff row clicks and selected-line staging button clicks.
- `public/styles.css`: styles the selected-line toolbar, hover state, and selected Diff rows.
- `docs/ARCHITECTURE.md`: documents the local no-auto-open verification environment variable.
- `docs/CONTINUE.md`: records that Diff selected-line staging is available and content editing remains out of scope.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `public/js/core.js`, `public/js/features/diff-workbench.js`, `public/js/app/events.js`, `public/styles.css`, `docs/ARCHITECTURE.md`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-28 - Task: enable selected-line staging in maximized diff
### What was done
- Added selected-line staging controls to the maximized Diff modal for worktree diffs.
- Reused the same selected-line state between the bottom Diff and maximized Diff so row highlights stay in sync.
- Updated the maximized Diff after a selected-line staging action; if no diff remains, the modal closes instead of showing stale content.
### Testing
- `node --check public/js/features/diff-workbench.js` passed using the bundled Node executable.
- `node --check public/js/app/events.js` passed using the bundled Node executable.
- `node --check server.js` passed using the bundled Node executable.
- HTTP static resource verification confirmed `/js/features/diff-workbench.js` contains `diffModalOptions`, `syncDiffLineSelectionRows`, and `stageSelectedLines`.
- HTTP static resource verification confirmed `/js/app/events.js` contains the `diffModalBody` selected-line click handler.
- In-app Browser visual verification was intentionally skipped because repeated localhost opens can destabilize the Codex session; this task used syntax and local HTTP static verification instead.
### Notes
- `public/js/features/diff-workbench.js`: passes line-selection options into the maximized worktree Diff and synchronizes selected rows across both Diff containers.
- `public/js/app/events.js`: handles selected-line clicks and "暂存所选行" inside the maximized Diff body.
- `docs/CONTINUE.md`: records that both bottom and maximized Diff support selected-line staging.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `public/js/features/diff-workbench.js`, `public/js/app/events.js`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-28 - Task: unstage selected diff lines
### What was done
- Added selected-line unstaging for the staged Diff view, using the same bottom and maximized Diff selection behavior.
- Changed the selected-line toolbar so unstaged Diff shows "暂存所选行" and staged Diff shows "取消暂存所选行".
- After selected-line staging, the workbench now switches to the staged Diff when staged content exists, making the newly staged lines visible immediately.
- After selected-line unstaging, the workbench switches back to the unstaged Diff when worktree content exists.
### Testing
- `node --check server.js` passed using the bundled Node executable.
- `node --check public/js/features/diff-workbench.js` passed using the bundled Node executable.
- `node --check public/js/app/events.js` passed using the bundled Node executable.
- Temporary Git repository API verification passed: selected only the staged `line5 added` row and confirmed it moved back to the worktree while the staged `line2 changed` modification remained staged.
- Temporary Git repository API verification passed: selected the staged delete/add pair for `line2 changed` and confirmed the cached diff became empty while both changes were present in the worktree diff.
- Restarted `http://127.0.0.1:5177/` with `FORKLINE_NO_OPEN=1`; HTTP static verification confirmed `/js/features/diff-workbench.js` contains `unstageSelectedLines`, `取消暂存所选行`, and `selectedDiffLineAction`.
- API verification confirmed `http://127.0.0.1:5177/api/state` returns 200.
### Notes
- `server.js`: adds `unstageSelectedLines` and selected-line patch generation mode for reversing staged lines safely.
- `public/js/features/diff-workbench.js`: chooses the correct selected-line action by Diff scope and switches views after staging or unstaging.
- `docs/CONTINUE.md`: records the staged selected-line unstaging behavior and automatic view switch.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `public/js/features/diff-workbench.js`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-29 - Task: pull remote and keep right detail order
### What was done
- Pulled `origin/main` from `d87f396` to `e32a801`.
- Preserved the local right detail panel layout intent after the remote frontend module split by moving the selected commit message section above the operation section in the new inspector module.
- Kept the existing operation buttons, history editing area, edit queue, and diff preview behavior unchanged.
### Testing
- `node --check public/js/panels/inspector.js` passed.
- `node --check public/app.js` passed.
- `git diff --check` passed, with only Windows LF/CRLF notices.
### Notes
- `public/js/panels/inspector.js`: reorders the detail tab markup so commit information appears before commit operations.
- `public/app.js`: kept the remote compatibility placeholder from the module split.
- `progress.md`: resolved the pull/stash conflict and appended this implementation and verification record.
- Rollback: revert this task's edits in `public/js/panels/inspector.js` and `progress.md`, or reset back to the pre-pull commit `d87f396` if the remote pull itself must be undone.

## 2026-06-29 - Task: keep selected-line diff view after action
### What was done
- Changed selected-line staging and unstaging so the bottom or maximized Diff stays in the user's current view after the action.
- Kept the automatic fallback to the other Diff side when the current side has no remaining changes.
### Testing
- `node --check public/js/features/diff-workbench.js` passed.
- Browser verification on a temporary repository confirmed staging one selected line kept the bottom Diff at `view-stay.txt · 未暂存` while unselected lines remained visible.
- Browser verification on a temporary repository confirmed cancelling one selected staged line kept the bottom Diff at `staged-view.txt · 已暂存` while the remaining staged line stayed visible.
### Notes
- `public/js/features/diff-workbench.js`: preserves the active Diff scope after selected-line staging or unstaging instead of jumping to the result side.
- `docs/CONTINUE.md`: records the current selected-line view retention behavior.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `public/js/features/diff-workbench.js`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-29 - Task: avoid empty diff after staging a hunk
### What was done
- Added a fallback when loading a worktree Diff: if the requested side returns no lines but the same file still has changes on the other side, Forkline now loads that other side instead.
- This fixes staging the last visible hunk showing "没有可显示的差异" while the file is still present in the change list.
### Testing
- `node --check public/js/features/diff-workbench.js` passed.
- API verification on a temporary repository confirmed staging the only unstaged hunk makes `scope=unstaged` return 0 Diff lines while `scope=staged` returns the staged Diff with the selected change.
- HTTP verification confirmed the local service still returns 200 for `/` and `/api/state`.
- In-app Browser verification was attempted, but the Browser control connection timed out while loading localhost; API/HTTP verification covered the bug condition directly.
### Notes
- `public/js/features/diff-workbench.js`: retries the opposite worktree Diff scope when the requested scope is empty and the file still has changes there.
- `docs/CONTINUE.md`: records the empty-Diff fallback behavior after hunk operations.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `public/js/features/diff-workbench.js`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-29 - Task: refresh staged and unstaged file state accurately
### What was done
- Updated the worktree refresh signature so it distinguishes index status, worktree status, and staged/unstaged flags instead of only the combined display status.
- Changed change-list rows to render scope-specific status text, so a partially staged file can show `工作区 M` in the worktree section and `暂存区 A` or `暂存区 M` in the staged section.
### Testing
- `node --check public/js/features/diff-workbench.js` passed.
- Frontend function regression check confirmed an unstaged `M` file and staged `M` file now produce different refresh signatures.
- Frontend function regression check confirmed an `AM` file renders as `工作区 M` in the unstaged section and `暂存区 A` in the staged section.
- `git diff --check` passed, with only Windows LF/CRLF notices.
### Notes
- `public/js/features/diff-workbench.js`: includes index/worktree status in refresh signatures and renders scope-specific file row status.
- `docs/CONTINUE.md`: records the more accurate staged/unstaged refresh and display behavior.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `public/js/features/diff-workbench.js`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-29 - Task: prevent stale diff fallback without file state
### What was done
- Fixed `fileChangeFlags` so a missing selected file no longer defaults to `hasUnstaged = true`.
- This prevents stale Diff fallback from switching to an unstaged view after the selected file disappears from the working file list.
### Testing
- Boundary regression check confirmed missing file state now returns `hasUnstaged = false`, `hasStaged = false`, and no fallback scope.
- `node --check` passed for all 21 frontend JavaScript files under `public/`.
- Frontend diff-state regression checks confirmed `AM` files still render differently by section and staged/unstaged `M` files still produce different refresh signatures.
- `git diff --check` passed, with only Windows LF/CRLF notices.
### Notes
- `public/js/features/diff-workbench.js`: guards `fileChangeFlags` against missing file state.
- `docs/CONTINUE.md`: records the missing-file fallback guard.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `public/js/features/diff-workbench.js`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-29 - Task: keep file selection aligned after staging
### What was done
- Changed file-row status text to show the section identity directly as `未暂存`, `已暂存`, or `未跟踪`, so the same path in both change sections no longer looks identical.
- Added post-action selection sync for single-file and multi-file staging actions: after staging, unstaging, or discarding, Forkline reselects the file in the latest valid section.
- Kept the existing backend Git state behavior unchanged; this change only fixes the frontend selection and display after refresh.
### Testing
- `node --check public/js/features/diff-workbench.js` passed.
- `node --check public/js/features/git-actions.js` passed.
- `node --check server.js` passed.
- Frontend logic regression check passed: `stageFile` moves selection from `unstaged:<file>` to `staged:<file>`, `unstageFile` moves it back to `unstaged:<file>`, and `MM` status renders different `未暂存` / `已暂存` labels.
- `node --check` passed for all 21 frontend JavaScript files under `public/`.
- `git diff --check` passed, with only Windows LF/CRLF notices.
### Notes
- `public/js/features/diff-workbench.js`: changed scoped file-row labels from raw status text to clearer section labels.
- `public/js/features/git-actions.js`: added selection synchronization after single and batch file actions.
- `public/styles.css`: makes scoped file-row labels visually distinct by section.
- `README.md`: documents that staging actions keep the selected file aligned with its latest section.
- `docs/CONTINUE.md`: records the current staged/unstaged display and selection behavior.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `public/js/features/diff-workbench.js`, `public/js/features/git-actions.js`, `public/styles.css`, `README.md`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-29 - Task: keep selected row after stage all refresh
### What was done
- Found a remaining selection bug in the top-level "暂存全部" path: the selected file's Diff scope changed to staged, but the change-list selection key was pruned and not recreated.
- Added a render-layer guard so any still-visible `selectedFile` is reattached to the current valid change section after refresh.
- This makes full refreshes, including "暂存全部", keep the list highlight aligned with the bottom Diff.
### Testing
- Reproduction check failed before the fix: rendering a file that moved from `unstaged:a.txt` to staged-only left `selectedChanges = []`.
- Regression check passed after the fix: the same render now leaves `workDiffScope = staged` and `selectedChanges = ['staged:a.txt']`.
- `node --check public/js/features/worktree-changes.js` passed.
- `node --check public/js/features/diff-workbench.js` passed.
- `node --check public/js/features/git-actions.js` passed.
- `node --check` passed for all 21 frontend JavaScript files under `public/`.
- `node --check server.js` passed.
- `git diff --check` passed, with only Windows LF/CRLF notices.
- HTTP static verification confirmed `/js/features/worktree-changes.js` contains `ensureSelectedFileChangeKey`.
### Notes
- `public/js/features/worktree-changes.js`: reattaches the selected file to the current valid staged/unstaged section after pruning stale selection keys.
- `docs/CONTINUE.md`: records that single-file, batch, and stage-all paths keep selection aligned.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `public/js/features/worktree-changes.js`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-29 - Task: scope file context menu for duplicate paths
### What was done
- Found a right-click menu bug for the Git state where the same path appears twice, such as staged deletion plus untracked recreation.
- Changed the file context menu to choose the working-file record that matches the row scope, instead of always taking the first record with the same path.
- This keeps "暂存 / 丢弃" enabled on the worktree row and "取消暂存 / 丢弃已暂存" enabled on the staged row for the duplicate-path case.
### Testing
- Reproduction check failed before the fix: right-clicking the `unstaged` row for duplicate `same.txt` left "暂存" disabled because the menu used the staged deletion record.
- Regression check passed after the fix: the `unstaged` row enables stage/discard worktree and ignore-file actions, while the `staged` row enables unstage/discard-staged and does not expose the untracked ignore action.
- API verification on a temporary Git repository confirmed Git/Forkline returns two `same.txt` records for staged deletion plus untracked recreation.
- `node --check public/js/features/context-menus.js` passed.
- `node --check` passed for all 21 frontend JavaScript files under `public/`.
- `node --check server.js` passed.
- `git diff --check` passed, with only Windows LF/CRLF notices.
- HTTP static verification confirmed `/js/features/context-menus.js` contains `contextWorkingFileInfo`.
### Notes
- `public/js/features/context-menus.js`: resolves file information by the row scope before enabling file-menu actions.
- `docs/CONTINUE.md`: records duplicate-path context-menu behavior.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `public/js/features/context-menus.js`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-30 - Task: open context diff in the clicked file section
### What was done
- Found a right-click "查看对照" bug for files that have both unstaged and staged changes.
- The context menu previously selected the file but kept the old Diff scope, so right-clicking an already-staged row could still open the unstaged Diff.
- Updated the file context menu Diff action to inherit the clicked row scope before loading the worktree Diff.
### Testing
- Reproduction check failed before the fix: `runFileContextAction('diff')` with `context.scope = staged` loaded `scope = unstaged`.
- Regression check passed after the fix: the staged context row loads `scope = staged`.
- Regression check also passed for the reverse case: the unstaged context row loads `scope = unstaged` even if the previous Diff scope was staged.
- `node --check public/js/features/context-menus.js` passed.
- `node --check` passed for all 21 frontend JavaScript files under `public/`.
- `node --check server.js` passed.
- `git diff --check` passed, with only Windows LF/CRLF notices.
- HTTP static verification confirmed `/js/features/context-menus.js` contains the scope handoff for context Diff.
### Notes
- `public/js/features/context-menus.js`: sets `state.workDiffScope` from the clicked row scope before loading file Diff from the context menu.
- `docs/CONTINUE.md`: records that right-click "查看对照" opens the corresponding staged or unstaged Diff.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `public/js/features/context-menus.js`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-30 - Task: enable hunk actions in maximized diff
### What was done
- Found that maximized worktree Diff reused selected-line controls but did not expose the same hunk actions shown in the bottom Diff.
- Added hunk actions to maximized worktree Diff rendering.
- Routed hunk-action clicks inside the maximized Diff body through the existing hunk operation flow, and refreshes or closes the modal after the action.
### Testing
- Reproduction check failed before the fix: `diffModalOptions()` for a worktree Diff did not include `hunkActions`.
- Regression check passed after the fix: maximized worktree Diff options include `hunkActions = true`.
- Render regression check passed: maximized unstaged Diff HTML contains `data-hunk-action="stageHunk"` and `暂存此块`.
- `node --check public/js/features/diff-workbench.js` passed.
- `node --check public/js/app/events.js` passed.
- `node --check` passed for all 21 frontend JavaScript files under `public/`.
- `node --check server.js` passed.
- `git diff --check` passed, with only Windows LF/CRLF notices.
- HTTP static verification confirmed `/js/features/diff-workbench.js` contains `hunkActions: true` and `/js/app/events.js` handles modal hunk-action clicks.
### Notes
- `public/js/features/diff-workbench.js`: adds hunk actions to maximized worktree Diff and refreshes the modal after hunk operations.
- `public/js/app/events.js`: handles hunk-action clicks inside the maximized Diff body.
- `docs/CONTINUE.md`: records that maximized Diff supports both hunk and selected-line operations.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `public/js/features/diff-workbench.js`, `public/js/app/events.js`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-30 - Task: use modal file for maximized diff operations
### What was done
- Found a follow-up edge case in maximized Diff operations: hunk and selected-line actions depended on global `selectedFile`.
- Added a shared file resolver that prefers the current worktree `activeDiff.path`, then falls back to `selectedFile`.
- The operation now reselects the modal file before calling the existing hunk or selected-line action flow.
### Testing
- Reproduction check failed before the fix: maximized hunk action with `activeDiff.path = modal-file.txt` and empty `selectedFile` did not send `modal-file.txt` to the API.
- Regression check passed after the fix: maximized hunk action sends `file = modal-file.txt` and updates `selectedFile`.
- Regression check passed for maximized selected-line action: it sends `file = modal-lines.txt` and updates `selectedFile`.
- `node --check public/js/features/diff-workbench.js` passed.
- `node --check` passed for all 21 frontend JavaScript files under `public/`.
- `node --check server.js` passed.
- `git diff --check` passed, with only Windows LF/CRLF notices.
- HTTP static verification confirmed `/js/features/diff-workbench.js` contains `activeWorktreeDiffFile`.
### Notes
- `public/js/features/diff-workbench.js`: resolves maximized hunk and selected-line operations from the active worktree Diff path before falling back to the selected file.
- `docs/CONTINUE.md`: records that maximized Diff operations use the current modal file.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `public/js/features/diff-workbench.js`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-30 - Task: render diff actions by current scope
### What was done
- Found a duplicate-path rendering bug for staged deletion plus untracked recreation.
- Hunk and selected-line buttons were looking up file state through the global `workDiffScope`, so rendering a staged Diff while the global scope was unstaged could hide `取消暂存此块`.
- Changed hunk and selected-line action rendering to resolve file state using the Diff scope currently being rendered.
### Testing
- Reproduction check failed before the fix: `workDiffHunkActionButtons('same.txt', 'staged', 0)` returned no staged hunk action when global scope was unstaged.
- Regression check passed after the fix: staged Diff renders `data-hunk-action="unstageHunk"` and untracked Diff renders `data-hunk-action="stageHunk"`.
- Regression check passed for selected-line actions: staged Diff returns `unstageSelectedLines`, untracked Diff returns `stageSelectedLines`.
- `node --check public/js/features/diff-workbench.js` passed.
- `node --check` passed for all 21 frontend JavaScript files under `public/`.
- `node --check server.js` passed.
- `git diff --check` passed, with only Windows LF/CRLF notices.
- HTTP static verification confirmed `/js/features/diff-workbench.js` resolves selected file info with the current render scope.
### Notes
- `public/js/features/diff-workbench.js`: renders hunk and selected-line actions from the current Diff scope instead of the global worktree scope.
- `docs/CONTINUE.md`: records that duplicate-path Diff buttons follow the active Diff section.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `public/js/features/diff-workbench.js`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-30 - Task: fix duplicate-path worktree diff backend
### What was done
- Found a backend bug where the same path could appear as both a staged deletion and an untracked recreation.
- The worktree Diff API and block/line operations previously selected the first status record for the path, so the unstaged side could show an empty Diff or operate on the wrong side.
- Added scope-aware status selection for worktree Diff, ignore, discard, conflict resolution, hunk actions, and selected-line actions.
- Fixed virtual untracked-file Diff generation so a file ending with a newline no longer creates an extra blank added line.
### Testing
- Reproduced the failure on `C:\tmp\forkline-duplicate-path-diff-20260630`: `/api/worktree-diff?file=same.txt&scope=unstaged` returned `scope = unstaged` with `diff = []` while the staged side returned the deletion Diff.
- Regression check passed after the fix: the same unstaged request returns `scope = untracked`, one `+recreated` line, and no extra blank added line; the staged request still returns `scope = staged` with `-original`.
- Hunk action verification passed on `C:\tmp\forkline-duplicate-path-action2-20260630`: `stageHunk` with `scope = untracked` returned “已暂存此未跟踪文件改动块”, `git status --short` became `M  same.txt`, and `git diff -- same.txt` was empty.
- Selected-line verification passed on `C:\tmp\forkline-duplicate-path-lines-20260630`: `stageSelectedLines` with `scope = untracked` returned “已暂存所选 1 行”, `git status --short` became `M  same.txt`, and `git diff -- same.txt` was empty.
- `node --check server.js` passed.
### Notes
- `server.js`: selects status records by requested worktree scope and fixes trailing-newline handling in virtual untracked-file Diff generation.
- `docs/CONTINUE.md`: records the backend duplicate-path and trailing-newline behavior for worktree Diff operations.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-30 - Task: preserve duplicate-path recreation when discarding staged side
### What was done
- Found a follow-up data-loss bug in the duplicate-path state: staged deletion plus untracked recreation.
- `discardStagedFile` restored both index and worktree, so clicking "丢弃已暂存" on the staged deletion overwrote the untracked recreated file with the HEAD version.
- Changed the duplicate-path branch to restore only the staged index entry when an untracked twin exists, preserving the worktree recreation.
### Testing
- Reproduction check failed before the fix: `discardStagedFile` on duplicate `same.txt` left the repo clean and changed the file content back to `original`.
- Regression check passed after the fix: `discardStagedFile` on duplicate `same.txt` returns “已暂存改动已丢弃”, leaves `git status --short` as `M same.txt`, preserves file content `recreated`, and leaves cached diff empty.
- Control check passed for a plain staged deletion without untracked twin: `discardStagedFile` still restores the file to `original` and leaves the repo clean.
- Adjacent duplicate-path check passed for `ignoreWorktreePath`: it appends `/same.txt` to `.gitignore` and keeps the staged deletion.
- `node --check server.js` passed.
### Notes
- `server.js`: protects duplicate-path staged discard from overwriting the untracked recreation.
- `docs/CONTINUE.md`: records the staged-discard behavior for duplicate-path recreation.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-30 - Task: preserve unstaged content when discarding staged added files
### What was done
- Found another staged-discard data-loss case: a new file staged as `A` and then edited in the worktree as `AM`.
- `discardStagedFile` used `git rm -f` for every staged add, which deleted the worktree file and lost the unstaged edit.
- Changed staged-add discard to use `git rm --cached -f` when the same file also has a worktree status, preserving the worktree file as untracked.
### Testing
- Reproduction check failed before the fix: `AM new.txt` with content `worktree` became clean and the file was deleted after `discardStagedFile`.
- Regression check passed after the fix: `AM new.txt` becomes `?? new.txt`, keeps content `worktree`, and has no cached diff.
- Control check passed for plain staged add `A new.txt`: `discardStagedFile` still deletes the file and leaves the repo clean.
- Control check passed for staged add then worktree delete `AD new.txt`: `discardStagedFile` removes the staged entry and leaves the repo clean.
- Duplicate-path stage checks passed: `stageFile` and `stageAll` both convert staged deletion plus untracked recreation into one staged modification with no worktree diff.
- `node --check server.js` passed.
### Notes
- `server.js`: preserves worktree-side edits when discarding the staged side of an added file.
- `docs/CONTINUE.md`: records the staged-add discard behavior.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-30 - Task: clarify staged discard confirmation
### What was done
- Found that the frontend confirmation for "丢弃已暂存" still claimed the operation would also discard related worktree content.
- That message no longer matched the backend behavior for duplicate-path recreation or staged-add-plus-worktree-edit cases, where Forkline preserves unstaged content.
- Updated the confirmation copy to say staged content is discarded, unstaged content is kept when present, and only files without unstaged content may be restored to HEAD or deleted.
### Testing
- `node --check public/js/features/git-actions.js` passed.
- HTTP static verification confirmed `/js/features/git-actions.js` contains the updated confirmation text "如果同一文件还有未暂存内容，会保留在工作区".
- `node --check server.js` passed.
- `git diff --check` passed, with only Windows LF/CRLF notices.
### Notes
- `public/js/features/git-actions.js`: updates the staged-discard confirmation message to match the protected backend behavior.
- `docs/CONTINUE.md`: records that the confirmation explains unstaged content preservation.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `public/js/features/git-actions.js`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-30 - Task: keep git diff metadata out of content rows
### What was done
- Found a side-by-side Diff rendering bug during browser verification: Git metadata such as `index ...` and `\ No newline at end of file` was treated as file content, so it appeared with line numbers like normal code.
- Classified common Git patch metadata lines as Diff metadata in the backend parser.
- Limited hunk action buttons to actual `@@` hunk header rows so metadata rows do not gain block-operation buttons.
- Removed trailing empty split rows from parsed Diff output so the side-by-side view no longer renders a fake blank content row.
### Testing
- Playwright UI verification on `C:\tmp\forkline-ui-stage-all-selection-20260630` reproduced the issue before the fix: the staged Diff rendered metadata in content rows and produced an extra blank content row.
- API verification after the fix confirmed `/api/worktree-diff?file=file.txt&scope=staged` returns `index ...` and `\ No newline at end of file` as `type = meta`, with no empty `ctx` row.
- Playwright UI verification after the fix confirmed content rows only contain the real `before` and `after` file lines; `index ...` and `\ No newline at end of file` appear only in metadata rows; hunk actions appear only on the `@@` row.
- Playwright UI hunk-flow verification passed: bottom Diff kept `unstaged:file.txt` selected after staging one hunk, and maximized Diff switched to `staged:file.txt` after staging the final hunk.
- Playwright UI stage-all verification passed: selecting an unstaged file and clicking "暂存全部" moved selection to `staged:file.txt` and kept the bottom Diff on the staged view.
- `node --check server.js` passed.
- `node --check public/js/features/diff-workbench.js` passed.
### Notes
- `server.js`: classifies Git patch metadata and removes trailing empty parsed Diff rows.
- `public/js/features/diff-workbench.js`: shows hunk action buttons only on real hunk headers.
- `docs/CONTINUE.md`: records that Git metadata stays out of line-numbered content rows.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `public/js/features/diff-workbench.js`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-30 - Task: render binary diff as metadata only
### What was done
- Found a follow-up Diff rendering bug for binary files: `Binary files ... differ` was still parsed as a normal content row.
- Classified binary patch lines such as `Binary files ... differ`, `GIT binary patch`, `literal`, and `delta` as Diff metadata.
- Hid the selected-line toolbar when the current Diff has no selectable added/deleted lines, so binary and metadata-only Diff views do not show unusable "暂存所选行" actions.
### Testing
- Reproduced the issue on `C:\tmp\forkline-binary-diff-20260630`: `/api/worktree-diff?file=blob.bin&scope=unstaged` returned `Binary files a/blob.bin and b/blob.bin differ` as `type = ctx`.
- API regression passed after the fix: the same line is returned as `type = meta`.
- Playwright UI verification passed: the binary Diff renders no content rows, shows `Binary files ... differ` only in metadata rows, shows no hunk actions, and hides the selected-line toolbar.
- `node --check server.js` passed.
- `node --check public/js/features/diff-workbench.js` passed.
### Notes
- `server.js`: classifies binary patch output as Diff metadata.
- `public/js/features/diff-workbench.js`: renders selected-line controls only when a Diff contains selectable add/delete lines.
- `docs/CONTINUE.md`: records binary and metadata-only Diff behavior.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `public/js/features/diff-workbench.js`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-30 - Task: align no-newline selected-line indexes
### What was done
- Found a selected-line staging bug for files without trailing newlines.
- The frontend skipped `\ No newline at end of file` metadata when assigning selectable line keys, but the backend counted those metadata lines when matching selected line indexes.
- This made clicking the visible added line send an index that the backend interpreted as metadata; after a partial fix it could produce an invalid staged patch such as `beforeafter`.
- Updated backend selected-line matching to skip backslash metadata lines, and updated side-by-side rendering to pair delete/add lines even when `No newline` metadata sits between them.
### Testing
- Reproduction check failed before the fix: selecting the visible `+after` line in a no-newline diff returned “请选择新增或删除行”.
- Follow-up reproduction confirmed the unsafe partial behavior: staging only the shifted add index produced `beforeafter` in the index.
- API regression passed after the fix: selecting line indexes `0` and `1` for `before -> after` stages the correct patch, leaves no worktree diff, and keeps file content `after`.
- Playwright UI regression passed: the no-newline modification row exposes one selectable row with keys `0:0,0:1`; clicking it selects both sides; “暂存所选行” succeeds and moves the selected file to the staged view.
- `node --check server.js` passed.
- `node --check public/js/features/diff-workbench.js` passed.
### Notes
- `server.js`: ignores `\ No newline at end of file` metadata when matching selected line indexes.
- `public/js/features/diff-workbench.js`: pairs modified lines across no-newline metadata so a replacement is selected as one row.
- `docs/CONTINUE.md`: records no-newline selected-line behavior.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `public/js/features/diff-workbench.js`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-30 - Task: clear false dirty state after discarding a hunk
### What was done
- Found a worktree Diff bug where `discardWorktreeHunk` could report success but leave the file visible as modified while `git diff` was already empty.
- The reproduced case was a tracked text file without a trailing newline on Windows with `core.autocrlf=true`; after reverse-applying the hunk, Git's index stat remained stale.
- Updated the hunk discard path to refresh the file's index stat after a successful worktree hunk discard, without changing stage or unstage behavior.
### Testing
- Reproduced on `D:\桌面\GitTest` using temporary branch `forkline/no-newline-discard-status-20260630`: before the fix, `discardWorktreeHunk` returned success, `git diff -- <file>` was empty, but `git status --short -- <file>` still returned ` M ...`; running `git update-index --refresh -- <file>` cleared it.
- Regression passed after the fix on temporary branch `forkline/no-newline-discard-fixed-20260630`: `discardWorktreeHunk` returned `工作区改动块已丢弃`, `statusAfterAction` was empty, and `diffEmpty = true`.
- `node --check server.js` passed.
- Confirmed `D:\桌面\GitTest` returned to branch `123` with a clean worktree.
- Confirmed the restarted local service is open on `D:/桌面/GitTest`, branch `123`, dirty count `0`.
### Notes
- `server.js`: refreshes index stat for the affected file after successful worktree hunk discard.
- `docs/CONTINUE.md`: records that hunk discard now clears the false modified/no-diff state.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-30 - Task: support selected-line unstage for staged new files
### What was done
- Found a selected-line unstage bug for staged new files: selecting one line in the staged Diff and running `unstageSelectedLines` returned `error: new file ... depends on old contents`.
- Added a dedicated patch generation path for staged new-file diffs so selected lines are removed from the index as normal file edits instead of reverse-applying a `/dev/null -> file` new-file patch.
- Preserved the full-file behavior: if every added line is selected, the file is removed from the index and returns to untracked status.
### Testing
- Reproduced on `D:\桌面\GitTest` using temporary branch `forkline/unstage-lines-new-file-error-20260630`: a staged three-line new file failed with HTTP 400 and `new file ... depends on old contents`.
- Regression passed on temporary branch `forkline/unstage-lines-new-file-fixed-20260630`: selecting only line 2 returned `已取消暂存所选 1 行`, left status `AM`, kept `line 1` and `line 3` staged, and moved `line 2` to the worktree Diff.
- Batch regression passed on temporary branch `forkline/unstage-lines-regression-20260630`: partial new-file unstage, all-line new-file unstage, and normal modified-file unstage all produced the expected index/worktree split.
- No-trailing-newline regression passed on temporary branch `forkline/unstage-new-file-no-newline-20260630`: selected line was removed from the index, unselected line stayed staged, and the worktree Diff retained the `No newline` metadata.
- `node --check server.js` passed.
### Notes
- `server.js`: detects staged new-file diffs and generates file-to-file or file-to-null cached patches for selected-line unstage.
- `docs/CONTINUE.md`: records that staged new files support selected-line unstage.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-30 - Task: support selected-line stage for worktree deleted files
### What was done
- Found a selected-line staging bug for files deleted in the worktree: selecting one deleted line and running `stageSelectedLines` returned `error: deleted file ... still has contents`.
- Added a dedicated patch generation path for deleted-file diffs so selected deleted lines are staged as normal file edits; selecting every deleted line still stages the full file deletion.
- Found and fixed a related patch contamination bug: successful `git diff` commands could append stderr CRLF warnings into the generated patch, producing `corrupt patch` during selected-line staging.
### Testing
- Reproduced on `D:\桌面\GitTest` using temporary branch `forkline/stage-lines-deleted-file-scan-20260630`: deleting a three-line file and staging only line 2 failed with HTTP 400 and `deleted file ... still has contents`.
- Regression passed on temporary branch `forkline/stage-lines-deleted-file-fixed-20260630`: staging only line 2 returned `已暂存所选 1 行`, left status `MD`, put `-line 2` in cached Diff, and left `-line 1` / `-line 3` in worktree Diff.
- Batch regression passed on temporary branch `forkline/stage-lines-deleted-regression-20260630b`: all-line deleted-file staging produced `D`, no-trailing-newline deleted-file staging produced the expected `MD` split, and normal modified-file selected-line staging still produced a clean cached change.
- Confirmed adjacent cases: staged deleted-file selected-line unstage, staged new-file hunk unstage, and untracked all-line selected staging behaved correctly.
- `node --check server.js` passed.
### Notes
- `server.js`: detects deleted-file diffs and generates file-to-file or file-to-null cached patches for selected-line stage; diff-reading for worktree/staged patches now uses stdout only on successful Git commands.
- `docs/CONTINUE.md`: records selected-line support for deleted files and the stdout-only Diff patch behavior.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-30 - Task: preserve rename metadata in worktree Diff
### What was done
- Found a worktree Diff bug for staged renames: Forkline parsed `git status -z` as only the new path, so `/api/worktree-diff` queried Git with only that path.
- Git then returned a `new file mode` patch for the renamed file instead of rename metadata, making the UI look like a new file was added.
- Updated status parsing to keep the old path as `previousFile` for rename/copy records, and updated worktree Diff reads to pass both old and new paths with rename/copy detection enabled.
### Testing
- Reproduced on `D:\桌面\GitTest` using temporary branch `forkline/rename-diff-repro-20260630`: `git mv forkline-fixtures/rename old.txt forkline-fixtures/rename new.txt` produced raw status `R  new\0old\0`, but Forkline returned no `previousFile` and showed `new file mode`.
- Regression passed after the fix: `/api/worktree` returned `previousFile: "forkline-fixtures/rename old.txt"`, and `/api/worktree-diff?scope=auto` plus `scope=staged` returned `rename from` / `rename to` metadata instead of a new-file patch.
- Ordinary modified-file Diff regression passed by opening the Forkline repo in the local service and reading `/api/worktree-diff?file=server.js&scope=unstaged`; it returned a normal `diff --git a/server.js b/server.js` patch with no `previousFile`.
- `node --check server.js` passed.
- `git diff --check` passed with only the existing LF/CRLF warning.
- Confirmed `D:\桌面\GitTest` returned to branch `123` with a clean worktree, and the restarted local service is pointed back to `D:/桌面/GitTest`.
### Notes
- `server.js`: keeps rename/copy previous paths in status objects and uses both paths when reading worktree Diff for renamed/copied files.
- `docs/CONTINUE.md`: records the rename/copy worktree Diff behavior.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-30 - Task: discard staged rename without losing the old file
### What was done
- Found a destructive edge case in `discardStagedFile`: staged renames were looked up with a path-limited `git status`, which made Git report the new path as `A` instead of `R`.
- The old behavior ran the staged-new-file discard path, deleted the new file, and left the old file staged as deleted.
- Updated staged discard to use full status parsing and, when `previousFile` exists, restore both old and new paths from `HEAD` in one operation.
### Testing
- Reproduced on `D:\桌面\GitTest` using temporary branch `forkline/discard-staged-rename-repro-20260630`: after `git mv old new`, calling `/api/action` with `discardStagedFile` returned success but left status `D  old` and both old/new files missing.
- Regression passed after the fix: the same action returned `已暂存改动已丢弃`, left `git status --short` empty, restored the old file, and removed the new path.
- Ordinary staged-new-file discard regression passed: a staged new file was removed and status stayed clean.
- Ordinary staged-modified-file discard regression passed: the tracked file content returned to the committed version and status stayed clean.
- `node --check server.js` passed.
### Notes
- `server.js`: uses full status for staged discard and restores rename/copy pairs with both `previousFile` and current file path.
- `docs/CONTINUE.md`: records the staged rename discard behavior.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-30 - Task: keep rename metadata when unstaging
### What was done
- Found a staged rename unstage bug: `unstageFile` reset only the new path, which left the old path as a staged deletion and the new path as untracked.
- Updated full-file unstage to read full status and reset both `previousFile` and current file when the selected file is a staged rename/copy.
- Found a related selected-line bug: unstaging one staged content line from a rename+edit diff also unstaged the whole rename.
- Added a rename/copy-aware selected-line unstage patch path that applies a file-to-file cached patch against the new path, so only selected content lines move back to the worktree.
### Testing
- Reproduced on `D:\桌面\GitTest` using temporary branch `forkline/unstage-rename-repro-20260630`: after `git mv old new`, calling `/api/action` with `unstageFile` returned success but left `D  old` staged and `?? new` untracked.
- Regression passed after the fix: full-file unstage returned success and left ` D old` plus `?? new`, meaning the rename was fully moved out of the index and kept in the worktree.
- Ordinary staged-new-file and staged-modified-file unstage regressions passed: the new file became untracked, and the modified file became an unstaged modification.
- Reproduced the selected-line issue on the same branch with staged rename+content: unstaging only the content line previously removed the whole rename from the index.
- Regression passed for selected added and deleted lines: staged Diff stayed as pure `rename from` / `rename to`, while the selected content change moved back to the unstaged Diff.
- `node --check server.js` passed.
### Notes
- `server.js`: full-file unstage now handles rename/copy path pairs; selected-line unstage now preserves rename/copy metadata while moving only selected content lines.
- `docs/CONTINUE.md`: records full-file and selected-line unstage behavior for staged renames.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-30 - Task: follow uncommitted renames in file history and blame
### What was done
- Found that the right-side “历史 / 逐行” views could not follow a staged-but-uncommitted rename.
- `/api/file-history` for the new path returned zero commits because `HEAD` still only contained the old path.
- `/api/file-blame` for the new path returned a 400 “文件 ... 在 HEAD 中不存在” error even though the status row had `previousFile`.
- Added a shared ref-file resolver for history and blame: if the selected path is not present at the requested ref, Forkline checks the current worktree status and falls back to `previousFile` when that old path exists at the ref.
### Testing
- Reproduced on `D:\桌面\GitTest` using temporary branch `forkline/worktree-rename-copy-scan-20260630`: a staged rename from `forkline-fixtures/worktree old.txt` to `forkline-fixtures/worktree new.txt` made `/api/file-history?file=new` return `0` commits, while `/api/file-history?file=old` returned the fixture commit.
- Reproduced the matching blame failure: `/api/file-blame?file=new` returned HTTP 400 before the fix.
- Regression passed after the fix: `/api/file-history?file=new` returned `historyFile: "forkline-fixtures/worktree old.txt"`, `previousFile: "forkline-fixtures/worktree old.txt"`, and one historical commit.
- Blame regression passed after the fix: `/api/file-blame?file=new` returned two lines from the old path with `historyFile` and `previousFile` populated.
- Ordinary old-path history/blame regression passed with `historyFile` equal to the requested file and no `previousFile`.
- `node --check server.js` passed.
### Notes
- `server.js`: history and blame now resolve staged rename/copy previous paths when the selected path does not exist in the requested ref.
- `docs/CONTINUE.md`: records the uncommitted rename fallback for “历史 / 逐行”.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-30 - Task: keep rename metadata when unstaging hunks
### What was done
- Found that `unstageHunk` still treated staged rename+content diffs as one full reverse patch.
- Unstaging only one content hunk from a staged rename removed the entire rename from the index, leaving the old file as a worktree deletion and the new file untracked.
- Added a rename/copy-aware hunk unstage patch path that rewrites the selected hunk as a file-to-file cached patch against the new path, so only the selected content hunk moves back to the worktree.
- Normalized moved-file patch path headers and skipped the split trailing blank line so paths with spaces do not produce corrupt patches.
### Testing
- Reproduced on `D:\桌面\GitTest` using temporary branch `forkline/unstage-hunk-rename-repro-20260630`: after staging a rename+content hunk, `/api/action` `unstageHunk` returned success but left `D old` plus `?? new`.
- Regression passed for an added-line hunk: after `stageHunk` then `unstageHunk`, status stayed `RM`, staged Diff contained only `rename from` / `rename to`, and the added line moved to the unstaged Diff.
- Regression passed for a deleted-line hunk with the same expected split: staged Diff stayed pure rename and the deleted line moved to unstaged Diff.
- Ordinary modified-file hunk staging/unstaging regression passed: the final status was a normal unstaged modification.
- `node --check server.js` passed.
### Notes
- `server.js`: `unstageHunk` now preserves rename/copy metadata while moving only selected content hunks back to the worktree.
- `docs/CONTINUE.md`: records that staged rename content can be cancelled by line or hunk without cancelling the rename.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-30 - Task: blame deleted files from their parent commit
### What was done
- Found that commit-detail “逐行追踪” failed for files deleted by the selected commit.
- `/api/file-history` correctly showed the delete commit and earlier add commit, but `/api/file-blame` used the delete commit itself, where the file no longer exists, and returned HTTP 400.
- Added a blame-only fallback: if the requested ref does not contain the selected file and no worktree rename fallback applies, Forkline checks the commit parents and uses the first parent that still contains the file for `git blame`.
- The response now keeps `ref` as the user-requested commit and adds `blameRef` for the actual commit used by the blame command.
### Testing
- Reproduced on `D:\桌面\GitTest` using temporary branch `forkline/deleted-file-blame-repro-20260630`: after adding and then deleting `forkline-fixtures/deleted blame.txt`, `/api/file-blame?file=...&ref=<deleteSha>` returned HTTP 400 before the fix.
- Regression passed after the fix: the same request returned two blame lines, kept `ref` as the delete commit, and reported `blameRef` as the parent add commit.
- Existing-file blame regression passed: requesting the parent add commit returned `blameRef` equal to the requested `ref`.
- Committed-rename blame regression passed on temporary branch `forkline/committed-rename-blame-regression-20260630`: a renamed file still blamed at the rename commit itself and did not incorrectly fall back to a parent.
- `node --check server.js` passed.
### Notes
- `server.js`: `readFileBlame` now resolves a parent blame ref for deleted files while preserving the requested ref in the response.
- `docs/CONTINUE.md`: records the deleted-file blame fallback.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-30 - Task: show committed renames as renames in file lists
### What was done
- Found that `/api/commit` parsed `git show --name-status --find-renames` too coarsely.
- A committed rename such as `R100 old -> new` was returned as `{ state: "M", file: "new", extra: "R" }`, so the right-side commit file list could label it as a normal modification and had no old path.
- Updated name-status parsing to preserve R/C states, `previousFile`, and the full status text such as `R100`.
- Updated the shared file tree status mapping to render R/C badges and Chinese labels instead of collapsing them to M.
### Testing
- Reproduced on `D:\桌面\GitTest` using temporary branch `forkline/commit-rename-status-repro-20260630`: a rename commit returned `state: "M"` and no `previousFile` before the fix.
- Regression passed after the fix: `/api/commit?sha=<renameSha>` returned `state: "R"`, `file: "forkline-fixtures/commit new.txt"`, `previousFile: "forkline-fixtures/commit old.txt"`, and `extra: "R100"`.
- Add/delete commit parsing regressions passed: add still returned `A`, delete still returned `D`.
- `node --check server.js` passed.
- `node --check public/js/features/diff-workbench.js` passed.
### Notes
- `server.js`: `parseNameStatus` now preserves rename/copy metadata from Git name-status output.
- `public/js/features/diff-workbench.js`: file tree status mapping now recognizes rename/copy rows.
- `public/styles.css`: adds a badge color for rename/copy rows.
- `docs/CONTINUE.md`: records committed rename/copy file list behavior.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `public/js/features/diff-workbench.js`, `public/styles.css`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-30 - Task: count worktree renames as renames
### What was done
- Found that staged worktree renames were still reported as `state: "M"` even though `indexStatus` and `extra` were `R`.
- This made the bottom worktree summary count a rename as a normal modification and omitted it from rename-specific status labels.
- Updated status parsing to return `state: "R"` for rename rows, and updated the frontend worktree summary/count helpers to include a rename count.
### Testing
- Reproduced on `D:\桌面\GitTest` using temporary branch `forkline/worktree-rename-state-repro-20260630`: after `git mv old new`, `/api/worktree` returned `state: "M"`, `extra: "R"`, and `previousFile`.
- Regression passed after the fix: the same staged rename returned `state: "R"` with the same `previousFile`.
- Ordinary worktree state regressions passed: modified files returned `M`, untracked files returned `A`, and deleted files returned `D`.
- `node --check server.js` passed.
- `node --check public/js/features/git-actions.js` passed.
- `node --check public/js/features/worktree-changes.js` passed.
### Notes
- `server.js`: returns rename state for worktree status rows.
- `public/js/features/git-actions.js`: initializes rename counts in file state summaries.
- `public/js/features/worktree-changes.js`: includes rename count and rename search labels in the worktree summary/filter data.
- `docs/CONTINUE.md`: records worktree rename counting behavior.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `public/js/features/git-actions.js`, `public/js/features/worktree-changes.js`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-30 - Task: block selected stash for staged renames
### What was done
- Found that “储藏所选” on a staged rename passed only the selected new path to `git stash push`.
- Git then created a stash for the new path but left the old path deletion behind, or produced a half-success pathspec error when both old and new paths were passed.
- Added a backend preflight for selected stashes: if the selected path belongs to a staged rename/copy pair, Forkline now stops before running Git and returns a Chinese explanation telling the user to use “储藏全部” or unstage first.
### Testing
- Reproduced on `D:\桌面\GitTest` using temporary branch `forkline/stash-selected-rename-repro-20260630`: selecting only `forkline-fixtures/stash new.txt` and running `createStash` left `D  forkline-fixtures/stash old.txt` in the worktree.
- Verified Git's native behavior: `git stash push -- old new` can create a stash and still report a pathspec error, so automatic path expansion is unsafe.
- Regression passed after the fix: the same API call returned HTTP 400 with a Chinese staged-rename explanation, stash count stayed unchanged, and status remained the original staged rename.
- Full stash regression passed: `createStash` without selected files saved the staged rename as `R100 old -> new` and left the worktree clean.
- Ordinary selected-file stash regression passed: a normal modified file could still be stashed by selected path and left the worktree clean.
- `node --check server.js` passed.
### Notes
- `server.js`: selected stash requests now reject staged rename/copy pairs before invoking `git stash push`.
- `docs/CONTINUE.md`: records the selected-stash staged rename protection.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-30 - Task: preserve worktree content when discarding staged changes
### What was done
- Found a broader data-loss bug in `discardStagedFile`: a normal file with both staged and unstaged edits (`MM`) lost the worktree edit when discarding the staged side.
- This contradicted the existing confirmation text and previous protections for staged-add plus worktree-edit and staged-delete plus untracked recreation.
- Updated staged discard so files with a worktree-side status clear only the index side and leave the current worktree content untouched.
- Applied the same rule to staged renames with additional worktree edits: the staged rename is moved back to the worktree instead of deleting the new file content.
### Testing
- Reproduced on `D:\桌面\GitTest` using temporary branch `forkline/discard-staged-preserve-worktree-repro-20260630`: an `MM` file with staged `one -> ONE` and unstaged `two -> TWO` became clean and reverted to `one/two/three` after `discardStagedFile`.
- Regression passed after the fix: the same action leaves status ` M`, clears cached diff, and preserves current worktree content `ONE/TWO/three`.
- Rename+worktree-edit regression passed: staged rename plus unstaged added line becomes worktree `D old` plus `?? new`, preserving the new file content.
- Control checks passed: pure staged modification still restores the HEAD content and leaves the repo clean; pure staged rename still restores the old path, removes the new path, and leaves the repo clean.
- `node --check server.js` passed.
### Notes
- `server.js`: `discardStagedFile` now preserves worktree-side content when the same file also has unstaged changes, including staged rename rows with worktree edits.
- `docs/CONTINUE.md`: records the mixed staged/unstaged discard behavior.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-30 - Task: block stash duplicate path states
### What was done
- Found that Git can create an unusable stash when the same path has both a staged deletion and an untracked recreation.
- `git stash push -u` reported success, but `git stash show --include-untracked` failed with `worktree and untracked commit have duplicate entries`.
- Added a backend stash preflight that rejects full stash and selected stash before invoking Git when that duplicate-path state is present.
- Kept the existing selected staged-rename guard intact.
### Testing
- Reproduced on `D:\桌面\GitTest` using temporary branch `forkline/bughunt-rename-worktree-20260630`: staged deletion plus untracked recreation of `forkline-fixtures/rename-old.txt` created a stash that `git stash show --include-untracked` could not unpack.
- Regression passed on temporary service `http://127.0.0.1:5281`: full `createStash` returned a Chinese duplicate-path error, status stayed `D` plus `??`, and no stash was created.
- Selected stash regression passed: `createStash` with `files = ["forkline-fixtures/rename-old.txt"]` returned the same Chinese duplicate-path error without creating a stash.
- Normal stash regression passed: a regular modified tracked file still created a stash, `git stash show --name-status` could read it, and the temporary stash was dropped.
- Existing selected staged-rename regression passed: selecting only the new path of a staged rename still returns the staged-rename explanation and leaves the status unchanged.
### Notes
- `server.js`: `createStash` now parses status once and rejects stash requests that would create duplicate untracked/worktree entries.
- `docs/CONTINUE.md`: records the duplicate-path stash protection.
- `README.md`: documents why Forkline refuses that stash state and what the user should do.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `docs/CONTINUE.md`, `README.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-30 - Task: explain existing duplicate-entry stashes
### What was done
- Found that a duplicate-entry stash created by an older Forkline build or manual `git stash -u` still appears in the stash list, but opening its detail returned raw English Git output.
- Added a unified friendly error translation for `duplicate entries` plus `failed to unpack trees`, so stash detail, apply, and pop failures explain the problem in Chinese.
- The message explains that Git cannot expand the stash because the same path exists as both worktree and untracked records, and suggests deleting the stash after confirming it is no longer needed.
### Testing
- Reproduced on `D:\桌面\GitTest` using temporary branch `forkline/bughunt-bad-stash-detail-20260630`: created a duplicate-entry stash and `/api/stash?ref=stash@{0}` returned raw `worktree and untracked commit have duplicate entries`.
- Regression passed after restarting local service `http://127.0.0.1:5177`: the same `/api/stash` request returned a Chinese duplicate-entry explanation naming `forkline-fixtures/bad-stash.txt`.
- Normal stash detail regression passed: a regular modified tracked file stash returned `files = 1`, non-empty diff, and `ref = stash@{0}`.
### Notes
- `server.js`: translates existing duplicate-entry stash unpack failures into Chinese guidance.
- `docs/CONTINUE.md`: records the existing bad-stash explanation behavior.
- `README.md`: documents what happens when a repository already contains this kind of bad stash.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `docs/CONTINUE.md`, `README.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-30 - Task: protect stash-and-checkout from duplicate path stashes
### What was done
- Found that the earlier duplicate-path stash protection only covered the explicit stash action.
- The “储藏并签出” paths for local and remote branch checkout still called `git stash push -u` directly, so they could create the same unusable duplicate-entry stash and then report checkout success.
- Updated both checkout paths to parse the current status and run the same stash preflight before invoking Git.
### Testing
- Reproduced on `D:\桌面\GitTest` using temporary branch `forkline/bughunt-checkout-stash-20260630`: `checkoutBranch` with `mode = stash` created a stash, switched to `123`, and `git stash show --include-untracked` failed with duplicate entries.
- Local checkout regression passed after the fix: the same `checkoutBranch` request returned the Chinese duplicate-path error, stash count stayed `0`, and the current branch stayed on the temporary source branch.
- Remote checkout regression passed: `checkoutRemoteBranch` with `ref = origin/main` and `mode = stash` returned the same Chinese duplicate-path error, stash count stayed `0`, and the branch did not switch.
- Normal checkout stash regression passed: a regular tracked-file modification still created one readable stash, switched to `123`, and the temporary stash was dropped afterward.
### Notes
- `server.js`: local and remote stash-and-checkout now share the duplicate-path stash preflight before running `git stash push -u`.
- `docs/CONTINUE.md`: records that stash-and-checkout uses the same duplicate-path protection.
- `README.md`: documents that this protection also applies to stash-and-checkout.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `docs/CONTINUE.md`, `README.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-30 - Task: prefer duplicate-path stash warning for selected rename targets
### What was done
- Found a misleading message in the staged-rename plus old-path recreation case.
- Selecting the renamed new path for “储藏所选” was blocked as a partial staged rename and told the user to try “储藏全部”, but full stash is also unsafe in this exact state.
- Updated the duplicate-path preflight so a selected staged-rename target is treated as related to its old path. Forkline now shows the same duplicate-path warning when the old path was recreated.
### Testing
- Reproduced on `D:\桌面\GitTest` using temporary branch `forkline/bughunt-rename-old-recreate-20260630`: staged rename `rename-old-path.txt -> rename-new-path.txt` plus untracked `rename-old-path.txt`.
- Full stash returned the duplicate-path warning and did not create a stash.
- Selected old path returned the duplicate-path warning and did not create a stash.
- Selected new path regression passed after the fix: it also returned the duplicate-path warning instead of the partial-rename “use full stash” suggestion, and stash count stayed `0`.
- Unrelated selected path was not blocked by the duplicate-path preflight.
### Notes
- `server.js`: duplicate-path stash detection now treats a selected staged-rename target and its old path as related.
- `docs/CONTINUE.md`: records the selected renamed-path warning behavior.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-30 - Task: clarify stash apply overwrite errors
### What was done
- Found that applying or popping a stash over local worktree modifications reused the generic overwrite warning.
- The old text mentioned branch switching and force checkout, which is not useful when the user is restoring a stash.
- Added a stash-specific friendly error for `applyStash`, `popStash`, and `restoreCheckoutStash` when Git reports local changes would be overwritten.
### Testing
- Reproduced on `D:\桌面\GitTest` using temporary branch `forkline/bughunt-stash-apply-conflict-20260630`: `applyStash` over a local edit returned the generic “这个操作会覆盖本地修改...如果是切换分支...” message.
- Regression passed after restarting `http://127.0.0.1:5177`: both `applyStash` and `popStash` returned the stash-specific Chinese warning and stash count stayed `1`.
- Normal flow regression passed: on a clean worktree, `applyStash` applied the change and kept the stash, while `popStash` applied the change and dropped the stash.
### Notes
- `server.js`: stash apply/pop/checkout-stash restore overwrite errors now use a stash-specific Chinese message.
- `docs/CONTINUE.md`: records the stash overwrite warning behavior.
- `README.md`: documents the user-facing warning.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `docs/CONTINUE.md`, `README.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-30 - Task: reject selected stash when selected files are unchanged
### What was done
- Found that “储藏所选” could report success when the selected files had no actual changes, as long as some other file in the worktree was dirty.
- Git returned `No local changes to save`, Forkline marked the operation as success, and no stash was created.
- Added a backend preflight for selected stashes: at least one selected path, or its rename counterpart, must appear in the current Git status before Forkline runs `git stash push`.
### Testing
- Reproduced on `D:\桌面\GitTest` using temporary branch `forkline/bughunt-selected-stash-empty-20260630`: only `stash-dirty.txt` was modified, but `createStash` selected unchanged `stash-clean.txt`.
- Before the fix, the API returned `ok = true` with `No local changes to save`, stash count stayed `0`, and the dirty file remained modified.
- Regression passed after restarting `http://127.0.0.1:5177`: selecting unchanged `stash-clean.txt` returned the Chinese “所选文件没有可储藏的改动” error and stash count stayed `0`.
- Normal selected stash regression passed: selecting modified `stash-dirty.txt` created one readable stash, then the temporary stash was dropped.
### Notes
- `server.js`: selected stash requests now reject stale or unchanged selected paths before invoking Git.
- `docs/CONTINUE.md`: records the selected-stash stale-selection behavior.
- `README.md`: documents the user-facing message.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `docs/CONTINUE.md`, `README.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-30 - Task: clear stale checkout-stash restore reminders
### What was done
- Found that the browser can keep a stale `forkline-checkout-stashes` record after the underlying stash was deleted manually or by another path.
- When the user returned to the original branch, Forkline still prompted to restore that stash; clicking restore failed with “没有找到可恢复的 Forkline 储藏”, but the stale record stayed in localStorage and would prompt again later.
- Updated the frontend restore error path to forget the remembered checkout stash and ignore it for the current session when the missing-stash error is returned.
### Testing
- Reproduced in the in-app browser on `http://127.0.0.1:5177`: injected a stale checkout-stash record for `D:/桌面/GitTest` and branch `123`, triggered `maybeRestoreCheckoutStash("123")`, and clicked “恢复更改”.
- Before the fix, localStorage still contained the stale record after the missing-stash error.
- Regression passed after reloading the page: the same flow showed the restore modal, returned the missing-stash toast, and `forkline-checkout-stashes` became `[]`.
- `node --check public/js/features/git-actions.js` passed.
### Notes
- `public/js/features/git-actions.js`: missing checkout-stash restore errors now clear the stale remembered record.
- `docs/CONTINUE.md`: records stale checkout-stash reminder cleanup.
- `README.md`: documents the user-facing behavior.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `public/js/features/git-actions.js`, `docs/CONTINUE.md`, `README.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-30 - Task: translate missing stash references
### What was done
- Found that stale stash references returned raw English Git errors such as `stash@{0} is not a valid reference`.
- Added a friendly Chinese error for missing stash references, covering stale stash detail, apply, pop, and branch-from-stash flows.
- Documented that users should refresh the stash list and reselect when a stash has already been popped, deleted, or cleared externally.
### Testing
- `node --check server.js` passed.
- `node --check public/js/features/git-actions.js` passed.
- `git diff --check` passed.
- Verified on temporary service `http://127.0.0.1:5283` with `D:\桌面\GitTest` open and an empty stash list: `applyStash`, `popStash`, `branchFromStash`, and `/api/stash?ref=stash@{0}` all returned the Chinese missing-stash message.
- Confirmed `branchFromStash` did not create `forkline/missing-stash-result`, and GitTest stayed on branch `123` with a clean worktree.
### Notes
- `server.js`: translates missing `stash@{n}` references into a Chinese refresh-and-reselect message.
- `README.md`: documents stale stash-list behavior for users.
- `docs/CONTINUE.md`: records the missing-stash reference behavior for follow-up development.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `README.md`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-30 - Task: keep overview graph primary line on exact main branch
### What was done
- Found that the overview commit graph treated any ref ending in `/main` as the primary `main` branch.
- Reproduced the issue with a temporary local branch named `forkline/main`: the graph primary-line selector chose `forkline/main` instead of the real local `main`.
- Updated the graph primary-ref check so local primary refs must match `main` / `master` exactly, while remote primary refs must match a known remote name such as `origin/main`.
### Testing
- Reproduced on `D:\桌面\GitTest` by creating temporary branch `forkline/main`; the old selector chose `HEAD -> forkline/main` as the primary tip while the exact `main` tip was `5c1167c`.
- Regression passed with the patched `public/js/features/graph.js`: in the same temporary `forkline/main` scenario, the real `main` commit stayed on lane `0`, and `forkline/main` moved to lane `1`.
- `node --check public/js/features/graph.js` passed.
- `node --check public/app.js` passed.
- `git diff --check` passed.
- Confirmed `D:\桌面\GitTest` returned to branch `123` with a clean worktree after the repro and regression checks.
### Notes
- `public/js/features/graph.js`: primary-line detection now distinguishes exact local primary refs from remote primary refs and no longer uses broad suffix matching.
- `README.md`: documents that overview graph primary detection only treats exact local or known remote main/master refs as primary.
- `docs/CONTINUE.md`: records the graph primary-line fix for follow-up development.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `public/js/features/graph.js`, `README.md`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-30 - Task: handle slash-containing remote names
### What was done
- Found that Git allows remote names containing `/`, such as `team/origin`.
- Reproduced that signing out `team/origin/forkline/slash-remote-checkout-20260630` created the wrong local branch `origin/forkline/slash-remote-checkout-20260630`.
- Updated backend remote checkout parsing to split remote branch refs using the real `git remote` names, matching the existing remote-delete backend parser.
- Updated frontend remote branch helpers so checkout labels and delete confirmation commands also use the real remote name.
### Testing
- Reproduced on `D:\桌面\GitTest` with a temporary bare remote at `C:\tmp\forkline-slash-remote.git` and temporary remote name `team/origin`; before the fix, Forkline checked out local branch `origin/forkline/slash-remote-checkout-20260630`.
- Regression passed after restarting the temporary service: the same remote ref checked out local branch `forkline/slash-remote-checkout-20260630`, and the incorrect `origin/forkline/...` branch was not created.
- Frontend helper regression passed in a Node VM: `remoteCheckoutBranch("team/origin/forkline/slash-remote-checkout-20260630")` returned `forkline/slash-remote-checkout-20260630`, and the delete command rendered as `git push team/origin --delete forkline/slash-remote-checkout-20260630`.
- `node --check server.js`, `node --check public/js/features/branches.js`, and `node --check public/js/features/diff-workbench.js` passed.
- Confirmed `D:\桌面\GitTest` returned to branch `123` with a clean worktree, and the temporary remote and bare repository were removed.
### Notes
- `server.js`: remote checkout now derives the local branch by splitting with known remote names.
- `public/js/features/diff-workbench.js`: adds a shared frontend remote-branch splitter that respects `repo.remoteNames`.
- `public/js/features/branches.js`: delete confirmation command now uses the shared frontend splitter.
- `README.md`: documents slash-containing remote name handling for branch operations.
- `docs/CONTINUE.md`: records the remote-name parsing fix for follow-up development.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `public/js/features/diff-workbench.js`, `public/js/features/branches.js`, `README.md`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-30 - Task: infer PR target with slash-containing remote names
### What was done
- Found another slash-remote parsing path in PR/MR link generation.
- Reproduced that a current branch tracking `team/origin/main` generated a Pull Request target of `origin/main` instead of `main`.
- Updated PR target inference to split the upstream ref using the real `git remote` names, matching the remote checkout and delete parsing rules.
### Testing
- Reproduced on `D:\桌面\GitTest` by temporarily adding web remote `team/origin`, creating `refs/remotes/team/origin/main`, and setting temporary branch `forkline/slash-pr-source-20260630` to track `team/origin/main`; before the fix, Forkline generated target `origin/main` and URL `compare/origin%2Fmain...`.
- Regression passed after restarting the temporary service: the same setup generated target `main` and URL `https://github.com/AsphyxiaChoke/Forkline/compare/main...forkline%2Fslash-pr-source-20260630?expand=1`.
- `node --check server.js` passed.
- Confirmed `D:\桌面\GitTest` returned to branch `123` with a clean worktree, and the temporary remote and tracking ref were removed.
### Notes
- `server.js`: PR/MR target inference now derives the upstream branch with `splitRemoteBranchRef`.
- `README.md`: documents correct PR target inference for slash-containing remote names.
- `docs/CONTINUE.md`: records the PR/MR upstream parsing fix for follow-up development.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `README.md`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-30 - Task: use remote main when local main is absent
### What was done
- Found that the overview graph only considered local branch names when choosing the primary line.
- Reproduced that deleting local `main` while keeping `origin/main` made the graph choose current branch `123` as the primary branch, putting `origin/main` on lane `1`.
- Updated primary branch selection so exact local `main` / `master` still wins, but a known remote `main` / `master` is used when the local primary branch is absent.
### Testing
- Reproduced on `D:\桌面\GitTest` by temporarily deleting local `main` while keeping `origin/main`; before the fix, `origin/main` was lane `1` and the current branch `123` was chosen as primary.
- Regression passed with the patched `public/js/features/graph.js`: with local `main` temporarily absent, `primaryBranchName()` returned `origin/main` and the `origin/main` commit was lane `0`.
- Re-ran the previous `forkline/main` regression: with local `main` restored and a temporary `forkline/main` branch present, `primaryBranchName()` returned `main`, real `main` stayed lane `0`, and `forkline/main` stayed lane `1`.
- Confirmed `D:\桌面\GitTest` returned to branch `123` with a clean worktree after both checks.
### Notes
- `public/js/features/graph.js`: primary branch selection now falls back to known remote `main` / `master` refs when no local primary branch exists.
- `README.md`: clarifies local primary branches win and remote primary branches are used only as fallback.
- `docs/CONTINUE.md`: records the remote-main fallback behavior for follow-up development.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `public/js/features/graph.js`, `README.md`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-30 - Task: allow slash-containing remote names in remote management
### What was done
- Found that Git allows remote names containing `/`, but Forkline rejected them during remote management with `远端名不能包含 /`.
- Removed the extra slash-specific remote-name rejection while keeping existing ref-name validation.
- This lets add, edit, test, and delete slash-containing remotes work consistently with checkout, delete, and PR parsing fixes.
### Testing
- Reproduced on `D:\桌面\GitTest` with temporary bare remote `C:\tmp\forkline-add-slash-remote.git`: `addRemote team/origin` returned `远端名不能包含 /`.
- Regression passed on temporary service `http://127.0.0.1:5288`: `addRemote team/origin`, `setRemoteUrl team/origin`, `testRemote team/origin`, and `deleteRemote team/origin` all succeeded.
- Confirmed `git remote` returned only original `origin` after cleanup.
- `node --check server.js` passed.
- Confirmed `D:\桌面\GitTest` returned to branch `123` with a clean worktree and temporary bare repos removed.
### Notes
- `server.js`: `normalizeRemoteName` now allows slash-containing names that pass existing ref-name validation.
- `README.md`: documents slash-containing remote names in remote management.
- `docs/CONTINUE.md`: records the remote-management fix for follow-up development.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `README.md`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-30 - Task: stop truncating worktree file status at 120 entries
### What was done
- Found that Forkline parsed only the first 120 `git status` records, so worktree panels could miss files when a repository had many unstaged or untracked changes.
- Removed the hardcoded 120-file cap from both plain and NUL-delimited status parsers.
- Documented that worktree file lists are no longer silently capped at the backend parser.
### Testing
- Reproduced on `D:\桌面\GitTest` by creating 130 temporary untracked files under `forkline-status-limit-repro-20260630`; before the fix, `/api/worktree` returned `api_count=120`, ended at `file-120.txt`, and did not include `file-130.txt`.
- Regression passed on temporary service `http://127.0.0.1:5293`: the same 130-file setup returned `api_count=130`, included `file-130.txt`, and ended at `file-130.txt`.
- `node --check server.js` passed.
- Confirmed `D:\桌面\GitTest` returned to branch `123` with a clean worktree after cleanup.
### Notes
- `server.js`: removed the 120-entry cap in `parseStatus` and `parseStatusRecords`.
- `README.md`: documents that large worktree change lists are not silently truncated.
- `docs/CONTINUE.md`: records the status parser behavior for follow-up development.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `README.md`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-30 - Task: keep later files visible in large commit diffs
### What was done
- Found that Forkline parsed only the first 320 lines of any Git diff.
- Reproduced that a commit with a 360-line first file and a second small file listed both files, but `/api/commit` returned no diff block for the second file.
- Removed the global 320-line parser cap so file-specific historical diff lookup can still find later files in the same commit.
### Testing
- Reproduced on `D:\桌面\GitTest` with temporary branch `forkline/diff-cap-repro-20260630`: `/api/commit` returned `files_count=2`, `diff_count=320`, `late_file_listed=1`, `late_diff_present=0`, and the last diff line was `+big line 314`.
- Regression passed on temporary service `http://127.0.0.1:5295`: the same setup returned `files_count=2`, `diff_count=373`, `late_file_listed=1`, `late_diff_present=2`, and the last diff line was `+late file should still have diff`.
- `node --check server.js` passed.
- Confirmed `D:\桌面\GitTest` returned to branch `123` with a clean worktree after cleanup.
### Notes
- `server.js`: removed the global 320-line cap in `parseDiff`.
- `README.md`: documents that later files in large historical diffs remain viewable.
- `docs/CONTINUE.md`: records the large-commit diff visibility fix for follow-up development.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `README.md`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-30 - Task: stop truncating name-status file lists at 160 entries
### What was done
- Found that Forkline parsed only the first 160 `git show --name-status` / `git diff --name-status` entries.
- Reproduced that a commit touching 170 files returned only the first 160 files in `/api/commit`, so later files disappeared from the commit file list.
- Removed the hardcoded 160-entry cap from `parseNameStatus`, which also benefits compare and stash file lists that use the same parser.
### Testing
- Reproduced on `D:\桌面\GitTest` with temporary branch `forkline/name-status-cap-repro-20260630`: `/api/commit` returned `files_count=160`, `contains_file_170=0`, and ended at `forkline-name-status-cap-repro-20260630/file-160.txt`.
- Regression passed on temporary service `http://127.0.0.1:5297`: the same 170-file setup returned `files_count=170`, `contains_file_170=1`, and ended at `forkline-name-status-cap-repro-20260630/file-170.txt`.
- `node --check server.js` passed.
- Confirmed `D:\桌面\GitTest` returned to branch `123` with a clean worktree after cleanup.
### Notes
- `server.js`: removed the 160-entry cap in `parseNameStatus`.
- `README.md`: documents that large historical file lists remain viewable.
- `docs/CONTINUE.md`: records the name-status parser behavior for follow-up development.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `README.md`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-07-01 - Task: stop truncating branch lists at 32 entries
### What was done
- Found that `/api/state` returned only the first 32 local branches and first 32 remote branches.
- Reproduced that repositories with many branches could hide later branches from the left branch list and related actions.
- Removed the hardcoded 32-entry caps for local and remote branch arrays while keeping existing branch parsing and filtering behavior.
### Testing
- Reproduced on `D:\桌面\GitTest` by creating 40 temporary local branches named `zzzz/forkline-branch-cap-20260701-*`; before the fix, `/api/state` returned `api_branch_count=32`, `contains_branch_040=0`, and ended at `zzzz/forkline-branch-cap-20260701-028`.
- Regression passed on temporary service `http://127.0.0.1:5299`: the same local branch setup returned `api_branch_count=44`, `contains_branch_040=1`, and ended at `zzzz/forkline-branch-cap-20260701-040`.
- Remote branch regression passed on temporary service `http://127.0.0.1:5300` with 40 temporary `refs/remotes/origin/zzzz/forkline-remote-cap-20260701-*` refs: `/api/state` returned `api_remote_count=44` and `contains_remote_040=1`.
- `node --check server.js` passed.
- Confirmed `D:\桌面\GitTest` returned to branch `123` with a clean worktree after cleanup.
### Notes
- `server.js`: `/api/state` now returns full `branches` and `remotes` arrays instead of slicing them to 32 entries.
- `README.md`: documents that large local/remote branch lists are not silently truncated.
- `docs/CONTINUE.md`: records the branch list behavior for follow-up development.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `README.md`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-07-01 - Task: stop truncating tag lists at 160 entries
### What was done
- Found that Forkline parsed only the first 160 local Tag refs.
- Reproduced that repositories with many Tags could hide older Tags from the right-side Tag panel and related actions.
- Removed the hardcoded 160-entry cap from `parseTags` while keeping existing Tag sorting and metadata parsing behavior.
### Testing
- Reproduced on `D:\桌面\GitTest` by creating 170 temporary annotated Tags named `forkline-tag-cap-20260701-*` with stable tagger dates; before the fix, `/api/state` returned `api_tag_count=160`, `matching_tag_count=160`, `contains_tag_001=0`, and the oldest matching returned Tag was `forkline-tag-cap-20260701-011`.
- Regression passed on temporary service `http://127.0.0.1:5302`: the same Tag setup returned `api_tag_count=171`, `matching_tag_count=170`, `contains_tag_001=1`, and the oldest matching Tag was `forkline-tag-cap-20260701-001`.
- `node --check server.js` passed.
- Confirmed `D:\桌面\GitTest` returned to branch `123` with a clean worktree after cleanup.
### Notes
- `server.js`: `parseTags` now returns all parsed Tag refs instead of slicing to 160 entries.
- `README.md`: documents that large local Tag lists are not silently truncated.
- `docs/CONTINUE.md`: records the Tag list behavior for follow-up development.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `README.md`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-07-01 - Task: stop truncating stash lists at 80 entries
### What was done
- Found that Forkline parsed only the first 80 stash entries.
- Reproduced that repositories with many stashes could hide older stashes from the right-side stash panel and related recovery actions.
- Removed the hardcoded 80-entry cap from `parseStashList` while keeping existing stash subject parsing behavior.
### Testing
- Reproduced on `D:\桌面\GitTest` by creating 85 temporary stashes named `Forkline stash cap repro 20260701-*`; before the fix, `/api/state` returned `api_stash_count=80`, `matching_stash_count=80`, `contains_stash_001=0`, and the oldest matching stash was `On 123: Forkline stash cap repro 20260701-006`.
- Regression passed on temporary service `http://127.0.0.1:5304`: the same stash setup returned `api_stash_count=85`, `matching_stash_count=85`, `contains_stash_001=1`, and the oldest matching stash was `On 123: Forkline stash cap repro 20260701-001`.
- `node --check server.js` passed.
- Confirmed `D:\桌面\GitTest` returned to branch `123` with a clean worktree and no matching temporary stashes left after cleanup.
### Notes
- `server.js`: `parseStashList` now returns all parsed stash entries instead of slicing to 80 entries.
- `README.md`: documents that large stash lists are not silently truncated.
- `docs/CONTINUE.md`: records the stash list behavior for follow-up development.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `README.md`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-07-01 - Task: preserve full long lines in diff output
### What was done
- Found that Forkline truncated every parsed diff line to 280 characters.
- Reproduced that a changed line longer than 280 characters lost its tail in `/api/commit`, hiding the end of long configuration or JSON-style lines.
- Removed the per-line diff text truncation so the API returns complete diff line text.
### Testing
- Reproduced on `D:\桌面\GitTest` with temporary branch `forkline/diff-long-line-repro-20260701`: a committed line with trailing marker `TAIL_MARKER_20260701` returned `add_text_length=280`, `contains_tail=False`, and a suffix of only `x` characters.
- Regression passed on temporary service `http://127.0.0.1:5306`: the same long line returned `add_text_length=381`, `contains_tail=True`, and suffix `xxxxxxxxxxxxTAIL_MARKER_20260701`.
- `node --check server.js` passed.
- Confirmed `D:\桌面\GitTest` returned to branch `123` with a clean worktree after cleanup.
### Notes
- `server.js`: `parseDiff` now keeps full diff line text instead of slicing each line to 280 characters.
- `README.md`: documents that long diff lines remain fully visible.
- `docs/CONTINUE.md`: records the long-line diff behavior for follow-up development.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `README.md`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-07-01 - Task: stop truncating selected stash files at 120 entries
### What was done
- Found that Forkline silently kept only the first 120 selected files when creating a selected-file stash.
- Reproduced that selecting 130 files created a stash but left files 121-130 in the worktree.
- Removed the 120-file cap from selected stash file normalization while keeping path normalization and de-duplication.
### Testing
- Reproduced on `D:\桌面\GitTest` with 130 temporary untracked files under `forkline-stash-selected-cap-20260701`; before the fix, `requested_files=130`, `remaining_file_count=10`, with remaining files from `file-121.txt` to `file-130.txt`.
- Regression passed on temporary service `http://127.0.0.1:5309`: the same setup returned `requested_files=130` and `remaining_file_count=0`.
- `node --check server.js` passed.
- Confirmed `D:\桌面\GitTest` returned to branch `123` with a clean worktree and no matching temporary stashes left after cleanup.
### Notes
- `server.js`: `normalizeStashFiles` now keeps all selected files after normalization and de-duplication instead of slicing to 120.
- `README.md`: documents that selected-file stash does not silently drop later selected files.
- `docs/CONTINUE.md`: records the selected-stash behavior for follow-up development.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `README.md`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-07-01 - Task: stop truncating untracked text file virtual diffs at 420 lines
### What was done
- Found that Forkline generated virtual Diff blocks for untracked text files from only the first 420 lines.
- Reproduced that a 430-line untracked file lost its tail line in `/api/worktree-diff`, so the user could not see or select that content from the Diff panel.
- Removed the 420-line cap while keeping the existing 40-line virtual hunk size.
### Testing
- Reproduced on `D:\桌面\GitTest` with temporary file `forkline-untracked-long-20260701.txt` containing 430 lines and tail marker `LINE_430_TAIL_MARKER_20260701`; before the fix, temporary service `http://127.0.0.1:5311` returned `add_count=420`, `contains_tail=false`, and `last_add=+line-420`.
- Regression passed on temporary service `http://127.0.0.1:5312`: the same file returned `add_count=430`, `contains_tail=true`, and `last_add=+LINE_430_TAIL_MARKER_20260701`.
- `node --check server.js` passed.
- Stopped both temporary services and deleted the temporary file.
- Confirmed `D:\桌面\GitTest` returned to branch `123` with a clean worktree.
### Notes
- `server.js`: `readNewFileDiff` now builds virtual hunks from all text lines instead of slicing to the first 420.
- `README.md`: documents that untracked text file virtual Diff content is complete.
- `docs/CONTINUE.md`: records the untracked virtual Diff behavior for follow-up development.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `README.md`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-07-01 - Task: keep empty untracked files from becoming fake blank-line diffs
### What was done
- Found that Forkline's virtual Diff for an empty untracked text file generated one fake added blank line.
- Reproduced that running hunk staging on that fake line created a 1-byte staged blob while the worktree file stayed 0 bytes, leaving the file as `AM`.
- Changed virtual Diff line splitting so a truly empty file has no content hunks, while files that actually contain a newline still show that blank line.
### Testing
- Reproduced on `D:\桌面\GitTest` with temporary empty file `forkline-empty-untracked-20260701.txt`; before the fix, `/api/worktree-diff` on temporary service `http://127.0.0.1:5313` returned `diff_count=6`, `add_count=1`, and `add_texts=+`.
- Confirmed the bad operation before the fix: `stageHunk` on the fake hunk produced status `AM` and a cached blob size of `1`.
- Regression passed on temporary service `http://127.0.0.1:5314`: the same empty file returned `diff_count=4`, `add_count=0`, and a forced `stageHunk` call left status as `??`.
- Full-file staging regression passed: `stageFile` staged the empty file as status `A` with cached blob size `0`.
- `node --check server.js` passed.
- Stopped temporary services and deleted the temporary file.
- Confirmed `D:\桌面\GitTest` returned to branch `123` with a clean worktree.
### Notes
- `server.js`: `readNewFileDiff` now treats empty file text as zero lines instead of one empty line.
- `README.md`: documents that empty untracked files do not render fake added blank lines.
- `docs/CONTINUE.md`: records the empty untracked file virtual Diff behavior for follow-up development.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `README.md`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-07-01 - Task: preserve missing trailing newlines in untracked virtual diffs
### What was done
- Found that Forkline's virtual Diff for untracked text files without a trailing newline did not include the standard `No newline at end of file` marker.
- Reproduced that hunk staging such a file added a newline to the staged blob, leaving the worktree file unchanged and the path in `AM` state.
- Added the missing no-newline marker to the final virtual hunk when the source file really has no trailing newline.
### Testing
- Reproduced on `D:\桌面\GitTest` with temporary file `forkline-no-newline-untracked-20260701.txt` containing `NO_NEWLINE_TAIL_20260701` with no trailing newline; before the fix, temporary service `http://127.0.0.1:5315` returned `no_newline_marker_count=0`.
- Confirmed the bad operation before the fix: `stageHunk` returned success, status became `AM`, worktree size was `24`, and cached blob size was `25`.
- Regression passed on temporary service `http://127.0.0.1:5316`: the same virtual Diff returned `marker_count=1`.
- Hunk staging regression passed: cached blob size stayed `24` and status was `A`.
- Selected-line staging regression passed: cached blob size stayed `24` and status was `A`.
- `node --check server.js` passed.
- Stopped temporary services and deleted the temporary file.
- Confirmed `D:\桌面\GitTest` returned to branch `123` with a clean worktree.
### Notes
- `server.js`: `readNewFileDiff` now appends `\ No newline at end of file` to the final virtual hunk for untracked text files that lack a trailing newline.
- `README.md`: documents that hunk and line staging do not add a trailing newline to untracked files.
- `docs/CONTINUE.md`: records the no-trailing-newline virtual Diff behavior for follow-up development.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `README.md`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-07-01 - Task: avoid corrupting non-UTF-8 untracked files in virtual diffs
### What was done
- Found that Forkline decoded untracked files with `Buffer.toString("utf8")` before building virtual Diff hunks.
- Reproduced that a GBK/ANSI-style file without NUL bytes was displayed with replacement characters and could be staged through hunk actions as corrupted UTF-8 content.
- Added strict UTF-8 decoding for virtual untracked text diffs; files that cannot be decoded safely no longer generate selectable virtual content hunks.
### Testing
- Reproduced on `D:\桌面\GitTest` with temporary GBK file `forkline-gbk-untracked-20260701.txt`; before the fix, temporary service `http://127.0.0.1:5317` returned an added line containing replacement characters.
- Confirmed the bad operation before the fix: `stageHunk` returned success, status became `AM`, original file size was `13`, and cached blob size became `29`.
- Regression passed on temporary service `http://127.0.0.1:5318`: the same GBK file returned `gbk_add_count=0`; a forced hunk action left status as `??`.
- Selected-line forced call regression passed: the GBK file stayed untracked and was not added to the index.
- Full-file staging regression passed: `stageFile` still staged the GBK file with cached blob size `13`, preserving original bytes.
- UTF-8 untracked file regression passed: a normal UTF-8 file still staged through `stageHunk` as status `A`.
- `node --check server.js` passed.
- Stopped the temporary service and deleted the temporary files.
- Confirmed `D:\桌面\GitTest` returned to branch `123` with a clean worktree.
### Notes
- `server.js`: `readNewFileDiff` now uses strict UTF-8 decoding and skips virtual content hunks when decoding fails.
- `README.md`: documents that non-UTF-8 untracked files are protected from virtual hunk/line staging corruption.
- `docs/CONTINUE.md`: records the strict UTF-8 virtual Diff behavior for follow-up development.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `README.md`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-07-01 - Task: preserve UTF-8 BOM bytes in untracked virtual diffs
### What was done
- Found that strict UTF-8 virtual Diff decoding still used TextDecoder's default BOM handling, which removed the UTF-8 BOM from untracked file content.
- Reproduced that hunk staging a BOM-prefixed untracked file silently dropped the first three bytes and left the path in `AM` state.
- Updated strict UTF-8 decoding to keep BOM bytes as content when building virtual Diff hunks.
### Testing
- Reproduced on `D:\桌面\GitTest` with temporary file `forkline-bom-untracked-20260701.txt` containing UTF-8 BOM plus `BOM_TEXT`; before the fix, temporary service `http://127.0.0.1:5319` returned first content codepoint `66`, staged hunk status `AM`, original size `11`, and cached blob size `8`.
- Regression passed on temporary service `http://127.0.0.1:5320`: virtual Diff first content codepoint was `65279`, proving the BOM was preserved.
- Hunk staging regression passed: cached blob size stayed `11` and status was `A`.
- Selected-line staging regression passed: cached blob size stayed `11` and status was `A`.
- Non-UTF-8 guard regression passed with temporary GBK file `forkline-gbk-bom-regression-20260701.txt`: `gbk_add_count=0` and forced hunk staging left status `??`.
- `node --check server.js` passed.
- Stopped the temporary service and deleted the temporary files.
- Confirmed `D:\桌面\GitTest` returned to branch `123` with a clean worktree.
### Notes
- `server.js`: strict UTF-8 decoding now uses `ignoreBOM: true` so BOM bytes remain part of virtual Diff content.
- `README.md`: documents that UTF-8 BOM is preserved during untracked virtual hunk/line staging.
- `docs/CONTINUE.md`: records the BOM-preserving virtual Diff behavior for follow-up development.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `README.md`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-07-01 - Task: preserve CRLF bytes in untracked virtual patches
### What was done
- Found that Forkline normalized CRLF to LF while generating and extracting virtual Diff patches for untracked text files.
- Reproduced that when `.gitattributes` marked a new file as `-text`, hunk staging a CRLF file staged LF content instead of the original CRLF bytes.
- Removed CRLF normalization from virtual Diff generation and patch extraction so carriage returns in file content stay part of the generated patch.
### Testing
- Reproduced on `D:\桌面\GitTest` with temporary `.gitattributes` rule `forkline-crlf-raw-20260701.txt -text` and CRLF file `forkline-crlf-raw-20260701.txt`; before the fix, temporary service `http://127.0.0.1:5321` staged hunk status `AM`, original size `12`, and cached blob size `10`.
- First attempted fix only changed patch extraction and still failed on temporary service `http://127.0.0.1:5322`, proving virtual Diff generation was also normalizing CRLF.
- Regression passed on temporary service `http://127.0.0.1:5323`: hunk staging kept cached blob size `12` and status `A`.
- Selected-line staging regression passed: selected-line staging kept cached blob size `12` and status `A`.
- Adjacent regressions passed: UTF-8 LF untracked hunk staging still worked, UTF-8 BOM stayed preserved, and GBK/non-UTF-8 files still produced no virtual add lines.
- `node --check server.js` passed.
- Stopped temporary services and deleted temporary `.gitattributes` and test files.
- Confirmed `D:\桌面\GitTest` returned to branch `123` with a clean worktree.
### Notes
- `server.js`: `readNewFileDiff`, `extractSingleHunkPatch`, `extractMovedFileUnstageHunkPatch`, and `extractSelectedLinePatch` no longer normalize CRLF to LF while building patches.
- `README.md`: documents that `-text` CRLF untracked files do not lose CR bytes during hunk/line staging.
- `docs/CONTINUE.md`: records the CRLF-preserving virtual patch behavior for follow-up development.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `README.md`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-07-01 - Task: preserve leading spaces in repository file paths
### What was done
- Found that `normalizeRepoFile` trimmed file paths before using them for worktree Diff and hunk actions.
- Reproduced that a valid Windows file whose name starts with a space lost that leading space in `/api/worktree-diff`, so Forkline showed an empty Diff and hunk staging could not find the file.
- Removed path trimming from repository file normalization while keeping absolute path, NUL byte, and `..` path rejection.
### Testing
- Reproduced on `D:\桌面\GitTest` with temporary file ` forkline-leading-space-20260701.txt`; before the fix, temporary service `http://127.0.0.1:5326` returned `diff_file_returned=forkline-leading-space-20260701.txt`, `diff_count=0`, and hunk staging failed with “这个文件当前没有可操作的改动。”
- Regression passed on temporary service `http://127.0.0.1:5327`: the same file returned `diff_file_returned= forkline-leading-space-20260701.txt`, `diff_count=6`, `add_count=1`, and hunk staging produced status `A`.
- Normal path regression passed with `forkline-normal-path-regression-20260701.txt`, which still staged as status `A`.
- `node --check server.js` passed.
- Stopped temporary services and deleted the temporary files.
- Confirmed `D:\桌面\GitTest` returned to branch `123` with a clean worktree.
### Notes
- `server.js`: `normalizeRepoFile` no longer trims leading or trailing whitespace from repository-relative paths.
- `README.md`: documents that leading spaces in filenames are preserved.
- `docs/CONTINUE.md`: records the leading-space path behavior for follow-up development.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `README.md`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-07-01 - Task: block encoded backslash traversal in static file serving
### What was done
- Found that the local static file server checked `filePath.startsWith(PUBLIC_DIR)` after joining and normalizing the requested path.
- Reproduced that on Windows an encoded backslash traversal URL could read a file next to `public/`.
- Changed static serving to resolve both the public root and requested file to absolute paths, then require the target to equal the public root or start with the public root plus a path separator.
### Testing
- Reproduced with temporary file `public-leak-20260701.txt` containing `FORKLINE_STATIC_LEAK_20260701`: before the fix, temporary service `http://127.0.0.1:5328/%2e%2e%5cpublic-leak-20260701.txt` returned `200` and the file body.
- Regression passed on temporary service `http://127.0.0.1:5329`: the same traversal URL returned `403`, while `http://127.0.0.1:5329/` returned `200` and contained `Forkline`.
- `node --check server.js` passed.
- Stopped the temporary service and removed the temporary leak file.
- Confirmed `D:\桌面\GitTest` stayed on branch `123` with a clean worktree.
### Notes
- `server.js`: `serveStatic` now checks static file paths with resolved absolute paths and a path-separator boundary.
- `README.md`: documents that static serving is restricted to `public/` and traversal requests return `403`.
- `docs/CONTINUE.md`: records the static path boundary hardening for follow-up development.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `README.md`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-07-01 - Task: keep plus-prefixed diff content selectable
### What was done
- Found that Forkline's Diff parser treated every line beginning with `+++` or `---` as metadata.
- Reproduced that an untracked file containing a real added line `++PLUS_PREFIX_SHOULD_BE_ADD` returned that Diff row as `meta` instead of `add`, leaving it unavailable for line selection.
- Changed Diff parsing so file headers are detected outside hunks, while lines inside hunks are classified first by their real Diff prefix.
### Testing
- Reproduced on `D:\桌面\GitTest` with temporary file `forkline-plus-prefix-20260701.txt`; before the fix, `/api/worktree-diff?scope=unstaged` returned scope `untracked`, but the row `+++PLUS_PREFIX_SHOULD_BE_ADD` was classified as `meta` and only one line was selectable as `add`.
- Regression passed on temporary service `http://127.0.0.1:5335`: the same row was classified as `add`, `hunkIndex = 0`, selectable add line count became `2`, and `stageSelectedLines` staged only `++PLUS_PREFIX_SHOULD_BE_ADD` into the index.
- Regression passed on temporary service `http://127.0.0.1:5336`: a staged new file with the worktree line `--MINUS_PREFIX_SHOULD_BE_DEL` removed returned the Diff row `---MINUS_PREFIX_SHOULD_BE_DEL` as `del`, `hunkIndex = 0`, with one selectable delete line.
- Confirmed `D:\桌面\GitTest` returned to branch `123` with a clean worktree.
### Notes
- `server.js`: `parseDiff` now gives hunk content lines priority over file-header metadata patterns.
- `README.md`: documents that content lines producing `+++...` / `---...` Diff text remain selectable.
- `docs/CONTINUE.md`: records the Diff line classification fix for follow-up development.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `README.md`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-07-01 - Task: preserve spaces in submodule status paths
### What was done
- Found that Forkline parsed `git submodule status --recursive` by splitting the status line on whitespace.
- Reproduced that a configured submodule at `forkline-fixtures/submodule space 20260701` appeared as two records: the real configured path stuck at `configured`, plus a fake truncated path `forkline-fixtures/submodule` marked `ok`.
- Updated submodule status parsing to use paths already read from `.gitmodules` as known path boundaries before falling back to whitespace parsing.
### Testing
- Reproduced on `D:\桌面\GitTest` with temporary local submodule source `C:\tmp\forkline-submodule-space-source-20260701` and submodule path `forkline-fixtures/submodule space 20260701`; before the fix, Forkline API returned two submodules, including bogus path `forkline-fixtures/submodule`.
- Regression passed on temporary service `http://127.0.0.1:5338`: Forkline API returned exactly one submodule with path `forkline-fixtures/submodule space 20260701`, `status = ok`, `statusLabel = 已就绪`, `exists = true`, and `initialized = true`.
- Cleaned the temporary submodule, `.gitmodules` changes, gitlink, `.git/modules` metadata, and temporary source repository.
- Confirmed `D:\桌面\GitTest` returned to branch `123` with a clean worktree.
### Notes
- `server.js`: `parseSubmoduleStatusLine` now accepts configured submodule paths and matches the longest known path before using whitespace fallback parsing.
- `README.md`: documents that submodule paths containing spaces merge with their status correctly.
- `docs/CONTINUE.md`: records the submodule path parsing fix for follow-up development.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `README.md`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-07-01 - Task: preserve leading spaces in submodule paths
### What was done
- Found that Forkline read `.gitmodules` with plain `git config --get-regexp` text output and trimmed config values.
- Reproduced that a submodule path starting with a space, ` leading-submodule-20260701`, was displayed as `leading-submodule-20260701` and marked `exists = false` even though the real submodule directory existed.
- Switched `.gitmodules` reads to `git config -z` and added NUL-record parsing so path values keep leading spaces; status parsing now keeps the path tail's leading space for configured-path matching.
### Testing
- Reproduced on `D:\桌面\GitTest` with temporary local submodule source `C:\tmp\forkline-submodule-leading-space-source-20260701` and submodule path ` leading-submodule-20260701`; before the fix, Forkline API returned path `leading-submodule-20260701`, `status = ok`, but `exists = false` and `initialized = false`.
- Regression passed on temporary service `http://127.0.0.1:5340`: Forkline API returned exactly one submodule with path ` leading-submodule-20260701`, `status = ok`, `statusLabel = 已就绪`, `exists = true`, and `initialized = true`.
- Cleaned the temporary submodule, `.gitmodules` changes, gitlink, `.git/modules` metadata, and temporary source repository.
- Confirmed `D:\桌面\GitTest` returned to branch `123` with a clean worktree.
### Notes
- `server.js`: `.gitmodules` reads now use `submoduleConfigArgs()` with `git config -z`, and `parseSubmoduleConfigEntries` preserves path leading spaces.
- `README.md`: documents that submodule paths with leading spaces are preserved.
- `docs/CONTINUE.md`: records the leading-space submodule path parsing fix for follow-up development.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `README.md`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-07-01 - Task: keep leading-space submodule paths during single update
### What was done
- Found that after preserving leading spaces in the submodule list, the single-submodule update action still trimmed `body.path`.
- Reproduced that Forkline listed ` leading-update-submodule-20260701`, but calling `updateSubmodules` for that listed path failed with “子模块不存在：leading-update-submodule-20260701”.
- Removed trimming from the single-submodule update path so the Git pathspec receives the exact configured submodule path.
### Testing
- Reproduced on `D:\桌面\GitTest` with temporary local submodule source `C:\tmp\forkline-submodule-update-leading-space-source-20260701` and submodule path ` leading-update-submodule-20260701`; before the fix, the update action failed after trimming the path.
- Regression passed on temporary service `http://127.0.0.1:5342`: `updateSubmodules` with path ` leading-update-submodule-20260701` returned `已更新 leading-update-submodule-20260701`, and the returned state kept path ` leading-update-submodule-20260701`, `exists = true`, `initialized = true`.
- Cleaned the temporary submodule, `.gitmodules` changes, gitlink, `.git/modules` metadata, and temporary source repository.
- Confirmed `D:\桌面\GitTest` returned to branch `123` with a clean worktree.
### Notes
- `server.js`: `updateSubmodules` now preserves the exact `body.path` string instead of trimming it.
- `README.md`: documents that single-submodule update path arguments preserve leading spaces.
- `docs/CONTINUE.md`: records the single-submodule update path fix for follow-up development.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `README.md`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-07-01 - Task: avoid prefix collisions when selecting a file diff
### What was done
- Found that the front-end `diffForFile` helper matched diff blocks with string `includes`.
- Reproduced that when one commit changed both `dir a/foo.txt` and `foo.txt`, selecting `foo.txt` matched the earlier `dir a/foo.txt` block and showed the wrong file's content.
- Changed diff block matching to extract candidate paths from `diff --git`, `---/+++`, `rename from/to`, and `copy from/to` lines, then compare paths exactly.
### Testing
- Reproduced on `D:\桌面\GitTest` with temporary commit `Forkline diff path match repro 20260701` adding `dir a/foo.txt` and `foo.txt`; before the fix, the same matching logic selected header `diff --git a/dir a/foo.txt b/dir a/foo.txt` and add line `+nested misleading diff` for target `foo.txt`.
- Regression passed on temporary service `http://127.0.0.1:5346`: selecting target `foo.txt` matched header `diff --git a/foo.txt b/foo.txt` and add line `+root target diff`.
- Rolled back the temporary commit with `git reset --hard HEAD~1` and cleaned temporary files.
- Confirmed `D:\桌面\GitTest` returned to branch `123` with a clean worktree.
### Notes
- `public/js/features/diff-workbench.js`: `diffBlockMatchesFile` now uses exact path candidates instead of substring matching.
- `README.md`: documents that single-file history/sync/compare diffs avoid prefix path collisions.
- `docs/CONTINUE.md`: records the exact diff path matching fix for follow-up development.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `public/js/features/diff-workbench.js`, `README.md`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-07-01 - Task: show file changes for merge commit details
### What was done
- Found that Forkline's commit detail endpoint used plain `git show` for merge commits.
- Reproduced that a two-parent no-ff merge commit bringing in `forkline-merge-diff-20260701.txt` returned `filesCount = 0` and `diffCount = 0`, so the UI would show no merge commit changes.
- Updated `readCommit` to detect multi-parent commits and build the file list and Diff with `git diff <first-parent> <merge-commit>`.
### Testing
- Reproduced on `D:\桌面\GitTest` with temporary branch `forkline/merge-diff-repro-20260701` and a no-ff merge into `123`; before the fix, `/api/commit?sha=<merge>` returned no files and no Diff.
- Regression passed on temporary service `http://127.0.0.1:5351`: the merge commit returned `filesCount = 1`, `diffCount = 7`, file `forkline-merge-diff-20260701.txt`, and add line `+merge diff content`.
- Rolled back the temporary merge commit, deleted the temporary branch, and cleaned temporary files.
- Confirmed `D:\桌面\GitTest` returned to branch `123` with a clean worktree.
### Notes
- `server.js`: `readCommit` now compares merge commits against their first parent for commit detail files and Diff.
- `README.md`: documents that merge commit details show changes introduced relative to the first parent.
- `docs/CONTINUE.md`: records the merge commit detail Diff fix for follow-up development.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `README.md`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-07-01 - Task: open file-history commits outside the graph
### What was done
- Fixed file history actions so commits returned by `git log --follow` can open in the right details panel even when they are not present in the currently loaded commit graph.
- The graph render now preserves a selected file-history commit that is outside the graph, and the inspector can use the file-history record as a temporary commit summary while `/api/commit` loads the real file list and Diff.
- Updated the README and continuation notes for this file history behavior.
### Testing
- Forkline API on `http://127.0.0.1:5281` opened `D:\桌面\GitTest` on branch `123`; `/api/state?ref=123` returned 12 graph commits, while `/api/file-history?file=配置文件3.txt&ref=123` returned 5 file-history commits, including 2 commits missing from the graph.
- Verified `/api/commit` for graph-missing commit `7dd4c624dd9bbee6615e7cd2910805f5bdf90307` returned 1 changed file, 10 Diff lines, and message `移除功能`.
- HTTP static resource check confirmed latest `history-list.js` contains `selectedLoadedInGraph`, and latest `inspector.js` contains `commitRecordForSha` plus `openHistoryCommit`.
- `node --check public\js\features\history-list.js` passed.
- `node --check public\js\panels\inspector.js` passed.
- `git diff --check` passed; Git only reported Windows LF-to-CRLF working-copy warnings.
### Notes
- `public/js/features/history-list.js`: avoids forcing a graph-missing file-history commit back to the first visible graph commit during graph rerender.
- `public/js/panels/inspector.js`: adds a temporary detail source for file-history commits and lets "查看提交 / 文件改动" open graph-missing commits by SHA.
- `README.md`: documents that file-history commits outside the current graph can still open in the right details panel.
- `docs/CONTINUE.md`: records the file-history jump fix for follow-up development.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `public/js/features/history-list.js`, `public/js/panels/inspector.js`, `README.md`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-07-01 - Task: open file-blame commits outside the graph
### What was done
- Found that the file blame row action still required the clicked commit to exist in the currently loaded commit graph.
- Reproduced with `D:\桌面\GitTest`: `.gitignore` blame contains commit `9e97a7e46d993e6f47d4ec8db9201685e0f2d85c`, while the current `123` first-parent graph does not include that SHA.
- Extended the inspector commit fallback so blame rows can supply a temporary commit summary, then open the real commit detail by SHA.
### Testing
- Scanned `D:\桌面\GitTest` on branch `123` and confirmed `.gitignore` has a blame line from graph-missing commit `9e97a7e`.
- Verified the latest static `inspector.js` contains the blame fallback path and routes blame row clicks through `openHistoryCommit`.
- `node --check public\js\panels\inspector.js` passed.
- `git diff --check` passed; Git only reported Windows LF-to-CRLF working-copy warnings.
- Confirmed `D:\桌面\GitTest` stayed on branch `123` with a clean worktree.
### Notes
- `public/js/panels/inspector.js`: file blame rows now use the shared graph-missing commit fallback instead of failing when the SHA is not in `state.data.commits`.
- `README.md`: documents that blame-line commits outside the current graph can still open in the right details panel.
- `docs/CONTINUE.md`: records the file-blame jump fix for follow-up development.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `public/js/panels/inspector.js`, `README.md`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-07-01 - Task: keep graph-missing commit tools working
### What was done
- Found that graph-missing commits opened from file history or file blame could render in the right details panel, but commit tools still looked up commits only in `state.data.commits`.
- Updated commit tool actions and the reword form to resolve commits through the shared `commitRecordForSha` fallback before acting.
- Updated the README and continuation notes so the documented file history / blame behavior covers opening details and using the existing commit tools.
### Testing
- Front-end function harness loaded `inspector.js`, `commit-actions.js`, and `git-actions.js` with an empty graph commit list plus one file-history commit; `runCommitToolAction("copyPatch", sha)` copied a patch for the graph-missing SHA, and `rewordSelectedCommit` sent `rewordCommit` for the same graph-missing SHA.
- This covers the previous failure mode where both paths returned before reaching the action because the SHA was not in `state.data.commits`.
- `node --check public\js\features\commit-actions.js` passed.
- `node --check public\js\features\git-actions.js` passed.
- `node --check public\js\panels\inspector.js` passed.
- `git diff --check` passed; Git only reported Windows LF-to-CRLF working-copy warnings.
- Confirmed `D:\桌面\GitTest` stayed on branch `123` with a clean worktree.
### Notes
- `public/js/features/commit-actions.js`: commit context/tool/history-plan actions now resolve graph-missing commits through `commitRecordForSha`.
- `public/js/features/git-actions.js`: the commit message reword form now uses the same fallback and avoids negative-index reselection after reload.
- `README.md`: clarifies that file history and blame commits outside the current graph can still use commit actions.
- `docs/CONTINUE.md`: records the graph-missing commit tool fix for follow-up development.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `public/js/features/commit-actions.js`, `public/js/features/git-actions.js`, `README.md`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-07-01 - Task: keep graph-missing branch starts exact
### What was done
- Found that "新建分支" from a graph-missing commit could open the branch modal but then resolve the start commit only from `state.data.commits`.
- Fixed the branch modal to use `commitRecordForSha`, so graph-missing commits opened from file history or blame keep their SHA as the branch start.
- Updated the command palette selected-commit helper to use the same fallback, keeping the "新建分支" hint aligned with the actual start commit.
### Testing
- Front-end function harness loaded `inspector.js`, `branches.js`, and `folder-command.js` with an empty graph commit list plus one file-history commit; `openBranchModal()` set `state.branchStartSha` to `7dd4c624dd9bbee6615e7cd2910805f5bdf90307` and rendered text for `7dd4c62`.
- The same harness verified `selectedCommandCommit()` returns the graph-missing file-history commit instead of falling back to the first graph commit or HEAD.
- `node --check public\js\features\branches.js` passed.
- `node --check public\js\features\folder-command.js` passed.
- `git diff --check` passed; Git only reported Windows LF-to-CRLF working-copy warnings.
- Confirmed `D:\桌面\GitTest` stayed on branch `123` with a clean worktree.
### Notes
- `public/js/features/branches.js`: branch creation modal now resolves graph-missing selected commits through `commitRecordForSha`.
- `public/js/features/folder-command.js`: command palette branch hint now uses the same selected commit fallback.
- `docs/CONTINUE.md`: records the graph-missing branch start fix.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `public/js/features/branches.js`, `public/js/features/folder-command.js`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-07-01 - Task: keep graph-missing merge mainline submit working
### What was done
- Found that graph-missing merge commits could open the cherry-pick/revert mainline modal, but submitting the modal looked up the commit only in `state.data.commits`.
- Updated mainline submission to resolve the commit through `commitRecordForSha`, matching the modal open path and other graph-missing commit tools.
### Testing
- Front-end function harness loaded `inspector.js` and `commit-actions.js` with an empty graph commit list plus one file-history merge commit; `submitMainlineForm()` sent `revertCommit` for the graph-missing merge SHA with `mainline = 2`.
- This covers the previous failure mode where the same submit path saw no commit and only showed “请选择主线”.
- `node --check public\js\features\commit-actions.js` passed.
- `git diff --check` passed; Git only reported Windows LF-to-CRLF working-copy warnings.
- Confirmed `D:\桌面\GitTest` stayed on branch `123` with a clean worktree.
### Notes
- `public/js/features/commit-actions.js`: mainline modal submit now uses the same graph-missing commit fallback as the rest of the commit tool path.
- `docs/CONTINUE.md`: records the graph-missing merge mainline submit fix.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `public/js/features/commit-actions.js`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-07-01 - Task: return metadata for graph-missing commit details
### What was done
- Found that `/api/commit` returned only `files`, `diff`, and full `message`.
- Reproduced with `D:\桌面\GitTest`: graph-missing blame commit `9e97a7e46d993e6f47d4ec8db9201685e0f2d85c` has real parent `1d2f5d6a8fa9c781ce69cf443ee895100c7d732b`, but the API response had no `parents`, so the right details panel could present it as a root commit.
- Added basic commit metadata to `/api/commit` and kept full message separate from the summary used by temporary graph-missing commit records.
### Testing
- Current API before the fix returned keys `diff,files,message` for `9e97a7e`, while `git rev-list --parents -n 1` showed a real parent.
- After the fix, `/api/commit?sha=9e97a7e...` returned parent metadata and summary while preserving the full message field.
- `node --check server.js` passed.
- `node --check public\js\panels\inspector.js` passed.
- `git diff --check` passed; Git only reported Windows LF-to-CRLF working-copy warnings.
- Confirmed `D:\桌面\GitTest` stayed on branch `123` with a clean worktree.
### Notes
- `server.js`: `readCommit` now returns `sha`, `short`, `author`, `time`, `parents`, and `summary` alongside files, diff, and full message.
- `public/js/panels/inspector.js`: graph-missing file-history/blame commit records merge loaded metadata without replacing their one-line title with the full commit body.
- `docs/CONTINUE.md`: records the graph-missing commit metadata fix.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `public/js/panels/inspector.js`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-07-01 - Task: clear stale file selection for empty commits
### What was done
- Found that the commit files tab preserved `state.selectedCommitFile` when the selected commit had no changed files.
- Reproduced with a front-end harness: rendering an empty commit after `old.txt` was selected kept `old.txt` selected and rendered the old file path into the history workbench.
- Updated the files tab to clear the selected commit file when `detail.files` is empty, and to render the bottom diff area as an explicit empty commit state.
### Testing
- Front-end harness passed: `renderFilesTab()` for an empty commit clears `state.selectedCommitFile`, does not call stale `diffForFile` / `renderHistoryDiffInWorkbench`, and sends “这个提交没有文件改动” to the workbench.
- Real GitTest repro passed: temporary branch `forkline/empty-commit-repro-*` created an `--allow-empty` commit; `/api/commit?sha=<empty>` returned `files=0`, `diff=0`, and the empty commit message. The temporary branch was deleted and GitTest returned to `123`.
- `node --check public\js\panels\inspector.js` passed.
- `git diff --check` passed; Git only reported Windows LF-to-CRLF working-copy warnings.
- Confirmed `D:\桌面\GitTest` stayed on branch `123` with a clean worktree.
### Notes
- `public/js/panels/inspector.js`: empty commit file tabs now clear stale file selection and show an explicit empty workbench message.
- `docs/CONTINUE.md`: records the empty commit file-tab fix.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `public/js/panels/inspector.js`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-07-01 - Task: preserve selected non-final line endings in untracked line staging
### What was done
- Found that an untracked text file without a trailing newline could lose the selected line's real newline when only a non-final line was staged.
- Reproduced with `D:\桌面\GitTest`: staging only `alpha` from `alpha\nbeta` produced a staged blob size of `5`, meaning the staged content became `alpha` instead of `alpha\n`.
- Updated selected-line patch generation so `\ No newline at end of file` metadata is kept only when the previous diff line is actually included in the generated patch.
### Testing
- Before the fix, Forkline `stageSelectedLines` on `forkline-fixtures/no-newline-line-stage-20260701.txt` staged only the first line with blob size `5`.
- After the fix, the same API flow staged the first line with blob size `6`, preserving `alpha\n`.
- Verified the true final line still stays without a trailing newline: staging only `beta` produced blob size `4`.
- `node --check server.js` passed.
- `git diff --check` passed; Git only reported Windows LF-to-CRLF working-copy warnings.
- Cleaned the temporary file and confirmed `D:\桌面\GitTest` stayed on branch `123` with a clean worktree.
### Notes
- `server.js`: selected-line patch generation now skips stale no-newline metadata when the line it belonged to was omitted from the patch.
- `README.md`: documents the non-final line no-newline boundary.
- `docs/CONTINUE.md`: records the same worktree Diff boundary for future continuation.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `README.md`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-07-01 - Task: return all Git worktrees
### What was done
- Found that Forkline silently returned only the first 24 worktrees from `git worktree list --porcelain`.
- Reproduced with `D:\桌面\GitTest` by creating 25 temporary detached worktrees under `C:\tmp\forkline-wt-limit-20260701`: raw Git listed 26 worktrees including the main worktree, but `/api/state` returned only 24 and ended at `wt-23`.
- Removed the backend slice so worktree enrichment keeps every parsed worktree row.
### Testing
- Before the fix, `/api/state` returned `API_WORKTREE_COUNT=24` while raw Git returned `RAW_WORKTREE_COUNT=26`.
- After the fix, the same repository returned `API_WORKTREE_COUNT=26`, with the last API row at `C:/tmp/forkline-wt-limit-20260701/wt-25`.
- `node --check server.js` passed.
- `git diff --check` passed; Git only reported Windows LF-to-CRLF working-copy warnings.
- Removed all 25 temporary worktrees, deleted the temporary directory, and confirmed `D:\桌面\GitTest` stayed on branch `123` with a clean worktree.
### Notes
- `server.js`: `enrichWorktreeList` now enriches all parsed worktree rows instead of slicing to the first 24.
- `README.md`: documents that large worktree lists are not silently truncated.
- `docs/CONTINUE.md`: records the worktree list limit fix for future continuation.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `README.md`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-07-01 - Task: return all configured submodules
### What was done
- Found that Forkline silently returned only the first 80 configured submodules from `.gitmodules`.
- Reproduced with `D:\桌面\GitTest` by creating a temporary `.gitmodules` containing 81 configured submodule paths; before the fix, `/api/state` returned 80 submodules and ended at `forkline-fixtures/submodule-limit-080`.
- Removed the backend slice so submodule enrichment keeps every parsed submodule row.
### Testing
- Before the fix, `CONFIG_SUBMODULE_PATHS=81` but `API_SUBMODULE_COUNT=80` and `HAS_081=False`.
- After the fix, the same temporary configuration returned `API_SUBMODULE_COUNT=81`, `LAST_API=forkline-fixtures/submodule-limit-081`, and `HAS_081=True`.
- `node --check server.js` passed.
- `git diff --check` passed; Git only reported Windows LF-to-CRLF working-copy warnings.
- Removed the temporary `.gitmodules` file and confirmed `D:\桌面\GitTest` stayed on branch `123` with a clean worktree.
### Notes
- `server.js`: `enrichSubmodules` now enriches all parsed submodule rows instead of slicing to the first 80.
- `README.md`: documents that large submodule lists are not silently truncated.
- `docs/CONTINUE.md`: records the submodule list limit fix for future continuation.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `README.md`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-07-01 - Task: preserve tabs in Tag subjects
### What was done
- Found that Forkline parsed Tag metadata with a plain tab split, so an annotated Tag subject containing a tab shifted the object type field.
- Reproduced with `D:\桌面\GitTest`: temporary Tag `forkline-tab-subject-20260701` had raw subject `subject\tpart`, but `/api/state` returned `subject = subject` and `type = part`.
- Updated Tag parsing so the first fields stay fixed, the last field remains the object type, and any middle fields are joined back into the subject.
### Testing
- Before the fix, the temporary Tag returned `SUBJECT_MATCH=False` and `TYPE_MATCH=False`.
- After the fix, the same Tag returned `API_SUBJECT=subject\tpart`, `API_TYPE=tag`, `SUBJECT_MATCH=True`, and `TYPE_MATCH=True`.
- `node --check server.js` passed.
- `git diff --check` passed; Git only reported Windows LF-to-CRLF working-copy warnings.
- Deleted the temporary Tag and confirmed `D:\桌面\GitTest` stayed on branch `123` with a clean worktree.
### Notes
- `server.js`: `parseTags` now preserves tabs inside Tag subjects without shifting the object type field.
- `README.md`: documents the Tab-in-subject Tag parsing boundary.
- `docs/CONTINUE.md`: records the Tag subject parsing fix for future continuation.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `README.md`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-07-01 - Task: preserve tabs in recovery point subjects
### What was done
- Found that Forkline parsed recovery point metadata with a plain tab split, so a recovery point whose target commit subject contained a tab lost everything after that tab.
- Reproduced with `D:\桌面\GitTest`: temporary recovery ref `refs/forkline/recovery/20260701-999999/forkline_tab_subject/recovery-tab-test` pointed at a commit titled `recovery\tpart`, but `/api/state` returned `subject = recovery`.
- Updated recovery point parsing so all fields after the short SHA are joined back into the subject.
### Testing
- Before the fix, the temporary recovery point returned `API_SUBJECT=recovery` and `SUBJECT_MATCH=False`.
- After the fix, the same recovery point returned `API_SUBJECT=recovery\tpart` and `SUBJECT_MATCH=True`.
- `node --check server.js` passed.
- `git diff --check` passed; Git only reported Windows LF-to-CRLF working-copy warnings.
- Deleted the temporary recovery ref, deleted the temporary branch, and confirmed `D:\桌面\GitTest` returned to branch `123` with a clean worktree.
### Notes
- `server.js`: `parseRecoveryPoints` now preserves tabs inside recovery point subjects.
- `README.md`: documents that recovery point search keeps Tab-containing commit subjects intact.
- `docs/CONTINUE.md`: records the recovery point subject parsing fix for future continuation.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `README.md`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-07-02 - Task: preserve control separators in commit subjects
### What was done
- Found that Forkline used `0x1f` as the internal Git log field separator for commit graph, file history, compare preview, history rewrite previews, and sync commit previews.
- Reproduced with `D:\桌面\GitTest`: temporary branch `forkline/unit-separator-subject-20260701` contained a commit titled `unit\x1fsep`; before the fix, `/api/state` returned `message = unit`, `refs = sep`, and a bogus parent count of 3.
- Changed commit log field separation to NUL-delimited formatting and updated the shared commit parsers to split on that delimiter.
### Testing
- After the fix, `/api/state` for the same commit returned the full `message = unit\x1fsep`, `refs = HEAD -> forkline/unit-separator-subject-20260701`, and `parents.length = 1`.
- `/api/commit?sha=<temporary commit>` returned `summary = unit\x1fsep`.
- `/api/file-history?file=forkline-fixtures/unit-separator-subject-20260701.txt&ref=forkline/unit-separator-subject-20260701` returned the same full message.
- `node --check server.js` passed.
- `git diff --check` passed; Git only reported Windows LF-to-CRLF working-copy warnings.
- Deleted the temporary branch and test file, and confirmed `D:\桌面\GitTest` returned to branch `123` with a clean worktree.
### Notes
- `server.js`: commit log formatting now uses NUL field separators for commit graph, file history, compare preview, history rewrite previews, and sync commit previews.
- `README.md`: documents that special commit-title separators no longer break graph parsing.
- `docs/CONTINUE.md`: records the commit subject separator parsing fix for future continuation.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `README.md`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.
## 2026-07-02 - Task: 修复储藏列表和引用日志内部控制分隔符解析错位
### What was done
- 复现并修复 HEAD reflog 说明里包含内部控制分隔符时的解析错位：之前会把提交标题后半段误当作者，把作者误当时间。
- 将 reflog 和 stash 列表的 Git 输出字段分隔符从 `0x1f` 改为 NUL，避免用户提交标题或储藏说明中的控制字符冲断字段。
- 同步 README 和继续开发文档，说明储藏列表、引用日志在异常说明文本下不会错位。

### Testing
- `node --check server.js` 通过。
- `git diff --check` 通过；仅提示 Windows 工作区 LF 将被 CRLF 替换。
- 在 `D:\桌面\GitTest` 临时分支 `forkline/reflog-separator-20260702` 创建标题为 `forkline-reflog\x1fsubject` 的空提交；修复前 `/api/state` 的首条 reflog 显示 `message = commit: forkline-reflog`、`author = subject`、`time = Forkline Tester`，确认 bug 可复现。
- 修复后用临时服务 `http://127.0.0.1:5293` 打开 GitTest，`/api/state` 的首条 reflog 返回 `message = commit: forkline-reflog\x1fsubject`、`author = Forkline Tester`、`time = 2026-07-02 10:16:43`。
- 用 Git 索引临时加入 `forkline-fixtures/stash-separator-index-20260702.txt` 并创建说明为 `forkline-stash\x1fsubject` 的临时 stash；`/api/state` 的 `stashes[0].message` 保留完整说明，`time` 仍为正常相对时间。
- 调用 `/api/action` 的 `findCheckoutStash`，使用同一条 `forkline-stash\x1fsubject` 能正确找到 `stash@{0}`。
- 已删除临时 stash、切回 `123` 并删除临时分支；`git -C D:\桌面\GitTest status --short --branch` 返回 `## 123`。

### Notes
- `server.js`：将 stash 列表、签出储藏查找、reflog 读取和对应解析统一改为 NUL 字段分隔。
- `README.md`：补充储藏列表和引用日志对内部控制分隔符的可靠性说明。
- `docs/CONTINUE.md`：补充本轮解析边界修复与验证背景，便于后续继续排查同类问题。
- `progress.md`：追加本轮复现、修复、验证和清理记录。
- 回滚方式：提交前可执行 `git checkout -- server.js README.md docs/CONTINUE.md progress.md`；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-02 - Task: 修复同秒同类恢复点被覆盖
### What was done
- 复现并修复恢复点 ref 只由秒级时间、分支和动作组成导致的覆盖问题：同一秒内连续执行两次同类危险操作时，第二个恢复点会覆盖第一个。
- 恢复点创建改为只在 ref 不存在时写入；若同秒同分支同动作已存在，则使用同级后缀 `-2`、`-3` 等继续创建，保留所有恢复点。
- 恢复点解析会把 `reset-hard-2` 这类后缀识别回原动作 `reset-hard`，右侧标签仍显示“硬重置前”。
- 同步 README 和继续开发文档，说明同秒连续危险操作不会覆盖更早恢复点。

### Testing
- 在 `D:\桌面\GitTest` 临时分支 `forkline/recovery-collision-20260702` 创建 A/B/C 三个空提交。
- 修复前用临时服务 `http://127.0.0.1:5300` 连续调用两次 `resetToCommit` hard：先从 C 重置到 B，再从 B 重置到 A。两次响应都返回同一个恢复点 ref `.../reset-hard`，第二次把 ref 从 `eca5c5f` 覆盖为 `b839200`，最终只剩 1 个恢复点。
- 修复后用临时服务 `http://127.0.0.1:5302` 重复同样两次 reset，响应分别返回 `.../reset-hard`（`eca5c5f`）和 `.../reset-hard-2`（`b839200`），`for-each-ref refs/forkline/recovery` 同时列出两条恢复点。
- `/api/state` 返回两条恢复点的 `action = reset-hard`、`actionLabel = 硬重置前`，证明带后缀的恢复点仍按原动作显示。
- `node --check server.js` 通过。
- 已删除测试恢复点、切回 `123` 并删除临时分支；`git -C D:\桌面\GitTest status --short --branch` 返回 `## 123`，`refs/forkline/recovery` 为空。

### Notes
- `server.js`：新增恢复点唯一创建逻辑，同秒冲突时使用同级后缀，且解析动作时忽略数字后缀。
- `README.md`：补充同秒同类危险操作会保留多个恢复点。
- `docs/CONTINUE.md`：记录恢复点同秒覆盖修复。
- `progress.md`：追加本轮复现、修复、验证和清理记录。
- 回滚方式：提交前可执行 `git checkout -- server.js README.md docs/CONTINUE.md progress.md`；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-02 - Task: 拦截修改旧提交信息时跨 merge 重放导致拓扑被展平
### What was done
- 复现并修复单个“修改提交信息”执行入口缺少 merge 范围检查的问题：目标提交本身不是 merge，但它后面的重放范围包含 merge 时，旧代码会直接执行 `git rebase -i` 并把 merge 拓扑展平成单父历史。
- 给 `rewordCommit` 增加与历史编辑预检一致的线性范围检查；修改 HEAD 提交仍走 amend，不受影响。
- 同步 README 和继续开发文档，说明修改旧提交信息会拦截包含 merge 的重放范围。

### Testing
- 在 `D:\桌面\GitTest` 临时分支 `forkline/reword-merge-range-20260702` 构造 `A -> B -> merge(side)`，目标 A 为非 merge 提交，`A^..HEAD` 内有 1 个 merge。
- 修复前用临时服务 `http://127.0.0.1:5297` 调用 `/api/action` 的 `rewordCommit` 修改 A，API 返回成功；随后 HEAD 从双父 merge 变成单父提交，全仓库 merge 数从 4 变成 3，确认拓扑被展平。
- 修复后重新构造同样历史，用临时服务 `http://127.0.0.1:5298` 调用相同 `rewordCommit`，API 返回中文错误“这段历史里包含 merge 提交 34df391...”，HEAD 仍为双父 merge，`A^..HEAD` 内 merge 数仍为 1。
- `node --check server.js` 通过。
- 已删除临时恢复点、临时分支 `forkline/reword-merge-range-20260702` / `forkline/reword-merge-side-20260702`，`git -C D:\桌面\GitTest status --short --branch` 返回 `## 123`，`refs/forkline/recovery` 为空。

### Notes
- `server.js`：`rewordCommit` 在非 HEAD 目标上执行前调用 `ensureLinearRewriteRange`，阻止跨 merge 的普通 rebase reword。
- `README.md`：补充修改旧提交信息会保护分支拓扑。
- `docs/CONTINUE.md`：记录单个 reword 执行入口的 merge 范围保护。
- `progress.md`：追加本轮复现、修复、验证和清理记录。
- 回滚方式：提交前可执行 `git checkout -- server.js README.md docs/CONTINUE.md progress.md`；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-02 - Task: 修复文件历史提交标题内部记录分隔符导致记录丢失
### What was done
- 复现并修复文件历史解析中使用 `0x1e` 分隔提交记录的问题：当提交标题本身包含该控制字符时，`/api/file-history` 会把一条提交拆成两段并丢弃。
- 将文件历史解析改为逐行识别提交头行，不再依赖可能出现在提交标题中的记录分隔符。
- 同步 README 和继续开发文档，说明文件历史不会因为提交标题中的内部记录分隔符漏掉提交。

### Testing
- 在 `D:\桌面\GitTest` 临时分支 `forkline/file-history-separator-20260702` 创建提交 `82df96e`，标题为 `forkline-file-history\x1esubject`，并修改 `.gitignore`。
- 修复前临时服务 `http://127.0.0.1:5294` 打开 GitTest 后，请求 `/api/file-history?file=.gitignore` 只返回更早的 `9e97a7e`、`6db540c`，没有最新的 `82df96e`。
- 修复后临时服务 `http://127.0.0.1:5295` 打开 GitTest 后，同一请求首条返回 `82df96e`，`message = forkline-file-history\x1esubject`，文件状态为 `M .gitignore`。
- `node --check server.js` 通过。
- 已恢复 `.gitignore` 工作区内容、切回 `123`、删除临时分支；`git -C D:\桌面\GitTest status --short --branch` 返回 `## 123`。

### Notes
- `server.js`：文件历史 `git log` 输出不再注入 `0x1e` 记录分隔符，`parseFileHistoryLog` 改为按提交头行收集文件状态行。
- `README.md`：补充文件历史对内部记录分隔符的可靠性说明。
- `docs/CONTINUE.md`：记录文件历史解析边界修复，便于后续继续查同类问题。
- `progress.md`：追加本轮复现、修复、验证和清理记录。
- 回滚方式：提交前可执行 `git checkout -- server.js README.md docs/CONTINUE.md progress.md`；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-02 - Task: 修复无提交分支同步操作误报游离 HEAD
### What was done
- 复现并修复当前分支还没有首个提交时，推送入口把本地分支误判为游离 HEAD 的问题。
- 同步状态新增 `unborn` 标记，右侧同步页、命令面板和分支右键菜单会阻止普通推送 / 安全强推，并提示先创建首个提交。
- 快进拉取入口补充 upstream 预检，直接 API 调用时也返回中文原因，不再透出 Git 英文提示。
- 同步 README 和继续开发文档，说明无提交分支的同步保护行为。

### Testing
- 在 `D:\桌面\GitTest` 从干净 `123` 分支切到临时孤儿分支 `forkline/unborn-push-20260702` 复现；修复前 `/api/state` 没有 `unborn` 标记，调用 `/api/action push` 返回“当前处于游离 HEAD”。
- 修复后重启临时服务 `http://127.0.0.1:5291`，打开 GitTest 后 `/api/state` 返回 `sync.branch = forkline/unborn-push-20260702`、`detached = false`、`unborn = true`。
- 修复后调用 `/api/action push` 返回“当前分支 forkline/unborn-push-20260702 还没有任何提交，不能推送”；调用 `/api/action forcePushLease` 返回“还没有任何提交，不能强推”；调用 `/api/action pull` 返回“当前分支没有 upstream，不能拉取”。
- `node --check server.js`、`node --check public\js\panels\sync.js`、`node --check public\js\features\context-menus.js`、`node --check public\js\features\git-actions.js`、`node --check public\js\features\folder-command.js` 均通过。
- 已切回 `D:\桌面\GitTest` 的 `123` 分支，`git -C D:\桌面\GitTest status --short --branch` 返回 `## 123`，临时孤儿分支没有留下本地分支引用。

### Notes
- `server.js`：推送 / 安全强推改用真实分支名判断，新增 HEAD commit 检查、同步 `unborn` 状态和拉取 upstream 预检，并补充 refspec 失败中文兜底。
- `public/js/panels/sync.js`：同步页显示“还没有首个提交”，并禁用普通推送入口。
- `public/js/features/context-menus.js`：当前分支右键菜单在无提交分支上禁用安全强推。
- `public/js/features/git-actions.js`：推送和安全强推确认文案加入无提交分支的下一步提示。
- `public/js/features/folder-command.js`：命令面板按同步状态禁用拉取、推送和安全强推。
- `README.md`：补充无提交分支需要先创建首个提交后再推送。
- `docs/CONTINUE.md`：记录无提交分支同步保护已接入。
- `progress.md`：追加本轮复现、修复、验证和清理记录。
- 回滚方式：提交前可执行 `git checkout -- server.js public/js/panels/sync.js public/js/features/context-menus.js public/js/features/git-actions.js public/js/features/folder-command.js README.md docs/CONTINUE.md progress.md`；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-02 - Task: 修复无提交分支设置 upstream 透出英文错误
### What was done
- 复现并修复当前分支还没有首个提交时，点击“设置 upstream”会透出 Git 英文错误的问题。
- 后端在执行 `git branch --set-upstream-to` 前检查 `unborn` 状态，返回中文“先创建首个提交”。
- 同步页和远端分支右键菜单在无提交分支上禁用设置 upstream，避免界面给出不可执行入口。
- README 和继续开发文档同步说明：设置 upstream 需要当前本地分支已有提交。

### Testing
- 在 `D:\桌面\GitTest` 从干净 `123` 分支切到临时孤儿分支 `forkline/unborn-upstream-20260702` 复现；修复前调用 `/api/action setUpstream` 到 `origin/123` 返回英文 `fatal: no commit on branch ... yet`。
- 修复后重启临时服务 `http://127.0.0.1:5292`，同一请求返回中文“当前分支 forkline/unborn-upstream-20260702 还没有任何提交，不能设置 upstream。请先创建首个提交后再设置。”。
- `node --check server.js`、`node --check public\js\panels\sync.js`、`node --check public\js\features\context-menus.js` 和 `git diff --check` 均通过。
- 已切回 `D:\桌面\GitTest` 的 `123` 分支，`git -C D:\桌面\GitTest status --short --branch` 返回 `## 123`，临时孤儿分支没有留下本地分支引用。

### Notes
- `server.js`：`setCurrentBranchUpstream` 增加无提交分支中文拦截，并为 `no commit on branch` 增加通用中文兜底。
- `public/js/panels/sync.js`：无提交分支上禁用同步页 upstream 设置控件。
- `public/js/features/context-menus.js`：远端分支右键菜单在当前分支无提交时禁用“设为 upstream”。
- `README.md`：说明设置 upstream 需要当前本地分支已有提交。
- `docs/CONTINUE.md`：补充无提交分支同步保护覆盖设置 upstream。
- `progress.md`：追加本轮复现、修复、验证和清理记录。
- 回滚方式：提交前可执行 `git checkout -- server.js public/js/panels/sync.js public/js/features/context-menus.js README.md docs/CONTINUE.md progress.md`；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-02 - Task: 修复无提交分支合并和变基错误提示
### What was done
- 复现并修复当前分支还没有首个提交时，合并分支透出 `empty head` 英文错误、变基误报“游离 HEAD”的问题。
- 后端 `mergeRef` / `rebaseOntoRef` 改用真实当前分支判断，并在无提交分支上返回中文“先创建首个提交”。
- 分支右键菜单在当前分支无提交时禁用“合并分支”和“变基当前分支到此分支”，避免给出不可执行入口。
- README 和继续开发文档同步说明无提交分支会先阻止合并和变基。

### Testing
- 在 `D:\桌面\GitTest` 从干净 `123` 分支切到临时孤儿分支 `forkline/unborn-branch-actions-20260702` 复现；修复前 `/api/action mergeRef` 到 `origin/123` 返回英文 `fatal: Non-fast-forward commit does not make sense into an empty head`，`/api/action rebaseOntoRef` 返回误导性的“当前处于游离 HEAD”。
- 修复后重启临时服务 `http://127.0.0.1:5293`，同样请求 `mergeRef` 返回“当前分支 forkline/unborn-branch-actions-20260702 还没有任何提交，不能合并分支”，`rebaseOntoRef` 返回“还没有任何提交，不能变基”。
- `node --check server.js`、`node --check public\js\features\context-menus.js` 和 `git diff --check` 均通过。
- 已切回 `D:\桌面\GitTest` 的 `123` 分支，`git -C D:\桌面\GitTest status --short --branch` 返回 `## 123`，临时孤儿分支没有留下本地分支引用。

### Notes
- `server.js`：`mergeRef` / `rebaseOntoRef` 使用 `currentLocalBranch` 和 `hasHeadCommit` 进行无提交分支中文拦截，并为 `empty head` 增加通用中文兜底。
- `public/js/features/context-menus.js`：当前分支无提交时禁用合并和变基目标菜单项。
- `README.md`：说明当前分支没有首个提交时会先阻止合并和变基。
- `docs/CONTINUE.md`：记录无提交分支合并 / 变基保护已接入。
- `progress.md`：追加本轮复现、修复、验证和清理记录。
- 回滚方式：提交前可执行 `git checkout -- server.js public/js/features/context-menus.js README.md docs/CONTINUE.md progress.md`；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-02 - Task: 修复无提交分支新建分支和比较边界提示
### What was done
- 复现并修复当前分支还没有首个提交时，新建分支取消“创建后切换”会透出 `not a valid object name` 英文错误的问题。
- 后端在无提交分支上拒绝“不切换”的新建分支，并提示勾选“创建后切换”或从已有提交/分支创建。
- 分支弹窗在无提交分支上固定勾选并禁用“创建后切换”，避免界面给出不可执行选项。
- 比较接口在默认基准落到当前无提交分支时返回明确中文提示；手动选择两个已有提交引用仍可正常比较。
- README 和继续开发文档同步说明无提交分支的新建分支和比较限制。

### Testing
- 在 `D:\桌面\GitTest` 从干净 `123` 分支切到临时孤儿分支 `forkline/unborn-compare-branch-20260702`，并通过 `createBranch checkout=true` 进入 `forkline/unborn-created-checkout-20260702` 复现无提交分支状态。
- 修复前调用 `/api/action createBranch`，`checkout=false`，返回英文 `fatal: not a valid object name: 'forkline/unborn-compare-branch-20260702'`。
- 修复后重启临时服务 `http://127.0.0.1:5294`，同类 `checkout=false` 请求返回中文“当前分支还没有任何提交，不能创建不切换的新分支。请勾选‘创建后切换’，或从已有提交/分支创建。”。
- 修复后请求 `/api/compare?head=origin/123` 返回中文“当前分支 ... 还没有任何提交，不能作为比较基准”；请求 `/api/compare?base=origin/123&head=origin/main` 成功返回 `ok=true` 和 `git diff origin/123...origin/main`。
- `node --check server.js`、`node --check public\js\features\branches.js` 和 `git diff --check` 均通过。
- 已切回 `D:\桌面\GitTest` 的 `123` 分支，`git -C D:\桌面\GitTest status --short --branch` 返回 `## 123`，临时孤儿分支没有留下本地分支引用。

### Notes
- `server.js`：`readCompare` 在当前无提交分支参与比较时给出中文原因；`createBranch` 在无起点、无提交且不切换时提前中文拦截；补充 `not a valid object name` 中文兜底。
- `public/js/features/branches.js`：无提交分支打开新建分支弹窗时固定勾选并禁用“创建后切换”，并显示对应说明。
- `README.md`：说明无提交分支会阻止不切换的新建分支，比较需要已有提交引用。
- `docs/CONTINUE.md`：记录无提交分支新建分支 / 比较保护已接入。
- `progress.md`：追加本轮复现、修复、验证和清理记录。
- 回滚方式：提交前可执行 `git checkout -- server.js public/js/features/branches.js README.md docs/CONTINUE.md progress.md`；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复无提交分支储藏和丢弃全部工作区操作
### What was done
- 复现并修复当前分支还没有首个提交时，“储藏工作区”透出英文 `You do not have the initial commit yet` 的问题。
- 修复无提交分支上“丢弃全部”先执行 `git reset --hard HEAD` 导致失败、未跟踪文件无法清理的问题。
- 后端在无提交分支上阻止创建储藏并给出中文原因；“丢弃全部”改为清空索引后执行 `git clean -fd`。
- 前端在无提交分支上禁用顶部和命令面板的储藏入口，并在直接调用储藏时给出中文提示。
- README 和继续开发文档同步说明无提交分支下储藏与丢弃全部的行为。

### Testing
- 在 `D:\桌面\GitTest` 从干净 `123` 分支切到临时孤儿分支 `forkline/unborn-worktree-actions-20260703` 复现；该状态下 `/api/state` 返回 `sync.unborn = true`，工作区有 14 个未跟踪文件。
- 修复前调用 `/api/action createStash` 返回英文 `You do not have the initial commit yet`；调用 `/api/action discardAll` 返回 `fatal: ambiguous argument 'HEAD'`，未跟踪文件没有被清理。
- 修复后重启临时服务 `http://127.0.0.1:5295`，`createStash` 返回中文“当前分支还没有任何提交，不能创建储藏”；`discardAll` 返回“已丢弃全部未提交更改”。
- 修复后同一无提交分支 `git status --short --branch` 只剩 `## No commits yet on forkline/unborn-worktree-actions-20260703`，Forkline `/api/state` 返回 `workingCount = 0`。
- `node --check server.js`、`node --check public\js\features\git-actions.js`、`node --check public\js\features\folder-command.js`、`node --check public\js\features\worktree-changes.js` 和 `git diff --check` 均通过。
- 已切回 `D:\桌面\GitTest` 的 `123` 分支，`git -C D:\桌面\GitTest status --short --branch` 返回 `## 123`，临时孤儿分支没有留下本地分支引用。

### Notes
- `server.js`：`discardAll` 在无提交分支上跳过 `reset HEAD`，改为清空索引并 clean；`createStash` 在无提交分支上中文拦截，并补充 initial commit / HEAD unknown 的中文兜底。
- `public/js/features/git-actions.js`：无提交分支直接调用储藏时给出中文提示。
- `public/js/features/folder-command.js`：命令面板在无提交分支上禁用“储藏工作区”。
- `public/js/features/worktree-changes.js`：顶部“储藏”按钮在无提交分支上禁用并显示原因。
- `README.md`：说明无提交分支不能创建储藏，以及“丢弃全部”会清理未跟踪文件。
- `docs/CONTINUE.md`：记录无提交分支工作区操作修复。
- `progress.md`：追加本轮复现、修复、验证和清理记录。
- 回滚方式：提交前可执行 `git checkout -- server.js public/js/features/git-actions.js public/js/features/folder-command.js public/js/features/worktree-changes.js README.md docs/CONTINUE.md progress.md`；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复无提交分支默认 HEAD 创建 worktree 的英文错误
### What was done
- 复现并修复当前分支还没有首个提交时，工作树表单使用默认 `HEAD` 起点创建 worktree 会透出英文 Git 错误的问题。
- 后端在执行 `git worktree add` 前识别 `HEAD`、`@`、当前无提交分支名和 `refs/heads/<当前分支>`，直接返回中文提示。
- 保留从已有本地分支、Tag 或提交 SHA 创建 worktree 的能力，避免把合法的跨引用工作树创建误拦截。
- README 和继续开发文档同步说明无提交分支下 worktree 起点的限制。

### Testing
- 在 `D:\桌面\GitTest` 的临时无提交分支 `forkline/unborn-staged-file-20260703` 上复现；修复前调用 `/api/action createWorktree`，`ref = HEAD` 返回英文 `fatal: 'HEAD' is not a valid branch name`。
- 修复后重启临时服务 `http://127.0.0.1:5296`，同一请求返回中文“当前分支 forkline/unborn-staged-file-20260703 还没有任何提交，不能从 HEAD 创建工作树”。
- 修复后用当前无提交分支名作为 `ref` 创建 worktree，同样返回中文拦截；用已有分支 `123` 作为 `ref` 并创建临时分支 `forkline/worktree-from-123-unborn-20260703` 成功。
- `node --check server.js` 通过。
- 已删除临时 worktree `C:\tmp\forkline-worktree-unborn-allowed-20260703` 和临时分支 `forkline/worktree-from-123-unborn-20260703`；`D:\桌面\GitTest` 已切回 `123`，`git status --short --branch` 返回 `## 123`。

### Notes
- `server.js`：`createWorktree` 在无提交分支上拦截依赖当前 `HEAD` 的起点，并提示改用已有引用。
- `README.md`：说明无提交分支不能用默认 `HEAD` 或当前无提交分支名创建 worktree。
- `docs/CONTINUE.md`：记录无提交分支的工作树起点保护已接入。
- `progress.md`：追加本轮复现、修复、验证和清理记录。
- 回滚方式：提交前仅反向删除本轮在 `server.js`、`README.md`、`docs/CONTINUE.md` 和本日志块中的新增内容；这些文件已有其他未提交改动，不要用整文件 checkout 回滚。提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复无提交分支追加提交误用图谱首条提交
### What was done
- 复现并修复当前分支还没有首个提交时，“追加”可能拿全部分支图谱第一条提交当作上一次提交的问题。
- 前端改为只根据当前仓库真实 `repo.headSha` 填充追加提交信息；没有 HEAD 提交或 `sync.unborn = true` 时禁用“追加”复选框。
- 后端在 `amendCommit` 创建恢复点前检查当前分支是否已有 HEAD 提交，没有则返回中文提示，不再透出 `fatal: Needed a single revision`。
- README 和继续开发文档同步说明无提交分支下追加提交会被禁用。

### Testing
- 在 `D:\桌面\GitTest` 临时无提交分支 `forkline/unborn-amend-20260703` 上复现：`/api/open` 返回 `headSha = ""`、`sync.unborn = true`，但 `commits[0]` 是 `main` 的 `5c1167c Merge branch 'local_debug'`。
- 修复前调用 `/api/action amendCommit` 返回英文 `fatal: Needed a single revision`。
- 修复后重启临时服务 `http://127.0.0.1:5296`，同一 `amendCommit` 请求返回中文“forkline/unborn-amend-20260703 还没有上一次提交，不能追加提交。请先创建首个提交。”。
- 静态检查确认前端 `fillLatestCommitMessage` 使用 `currentHeadCommitForAmend()`，`updateAmendMode` 会根据 `repo.headSha` 和 `sync.unborn` 设置 `amendToggle.disabled`。
- `node --check server.js`、`node --check public\js\features\git-actions.js`、`node --check public\js\app\init.js` 均通过。
- 已对 `D:\桌面\GitTest` 执行 `reset --hard HEAD` 和 `clean -fd` 清理测试文件，最终 `git status --short --branch` 返回 `## 123`。

### Notes
- `server.js`：`amendCommit` 在无 HEAD 提交时返回中文拦截。
- `public/js/features/git-actions.js`：追加提交填充逻辑改用真实 HEAD 提交，并在无提交分支禁用复选框。
- `public/js/app/init.js`：全量渲染时同步刷新追加提交复选框状态。
- `README.md`：说明无提交分支会禁用追加提交，追加只读取当前真实 HEAD。
- `docs/CONTINUE.md`：记录无提交分支追加提交保护。
- `progress.md`：追加本轮复现、修复、验证和清理记录。
- 回滚方式：提交前仅反向删除本轮在 `server.js`、`public/js/features/git-actions.js`、`public/js/app/init.js`、`README.md`、`docs/CONTINUE.md` 和本日志块中的新增内容；这些文件已有其他未提交改动，不要用整文件 checkout 回滚。提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复无提交分支文件历史和逐行追踪误导提示
### What was done
- 复现并修复当前分支还没有首个提交时，工作区文件打开“文件历史”或“逐行追踪”提示“刷新分支列表后再试”的误导问题。
- 后端现在会识别 `HEAD`、`@`、当前无提交分支名和 `refs/heads/<当前分支>`，并提示先创建首个提交，或选择已有分支、Tag、提交 SHA。
- 保留显式查询已有引用的能力，例如当前分支无提交时仍可对 `123` 分支上的文件查看历史和 blame。
- README 和继续开发文档同步说明无提交分支下文件历史 / 逐行追踪的限制。

### Testing
- 在 `D:\桌面\GitTest` 临时无提交分支 `forkline/unborn-history-20260703` 上复现：`/api/file-history` 和 `/api/file-blame` 使用当前无提交分支名作为 `ref` 时，修复前分别返回“不是有效提交引用。请刷新分支列表后再试。”。
- 修复后重启临时服务 `http://127.0.0.1:5296`，同样请求分别返回“当前分支还没有任何提交，不能在 ... 上查看文件历史”和“不能在 ... 上逐行追踪”。
- 回归确认显式引用 `123` 不受影响：`/api/file-history?file=189.txt&ref=123` 和 `/api/file-blame?file=189.txt&ref=123` 均返回 200。
- `node --check server.js` 通过。
- 已切回 `D:\桌面\GitTest` 的 `123` 分支，并执行 `reset --hard HEAD` 与 `clean -fd` 清理测试文件；最终 `git status --short --branch` 返回 `## 123`。

### Notes
- `server.js`：文件历史和逐行追踪在当前无提交引用上返回明确中文提示。
- `README.md`：说明无提交分支不能用当前 `HEAD` 查看文件历史或逐行追踪。
- `docs/CONTINUE.md`：记录无提交分支文件历史 / 逐行追踪提示修正。
- `progress.md`：追加本轮复现、修复、验证和清理记录。
- 回滚方式：提交前仅反向删除本轮在 `server.js`、`README.md`、`docs/CONTINUE.md` 和本日志块中的新增内容；这些文件已有其他未提交改动，不要用整文件 checkout 回滚。提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复无提交分支强制签出仍依赖 HEAD
### What was done
- 复现并修复当前分支还没有首个提交时，“强制签出”先执行 `git reset --hard HEAD` 导致无法切到目标分支的问题。
- 强制签出现在复用“丢弃全部”的清理逻辑：有 HEAD 时执行 `reset --hard HEAD`，无 HEAD 时清空索引，再执行 `git clean -fd`，随后切换目标分支。
- “储藏并签出”在无提交分支上改为提前给出明确中文提示，说明 Git 不能在无首提交时创建储藏，并建议先提交或改用强制签出。
- README 和继续开发文档同步说明无提交分支下储藏并签出 / 强制签出的行为。

### Testing
- 在 `D:\桌面\GitTest` 临时无提交分支 `forkline/unborn-checkout-20260703` 上复现：存在未跟踪文件 `forkline-fixtures/unborn-checkout.txt`。
- 修复前调用 `/api/action checkoutBranch`，`branch = 123`、`mode = force` 返回“当前分支还没有首个提交，HEAD 暂时不是有效引用...”且没有切换。
- 修复后重启临时服务 `http://127.0.0.1:5296`，同样的强制签出请求返回 200 “已丢弃本地更改并强制切换分支”。
- 修复后同一场景下 `mode = stash` 返回明确中文“当前分支 forkline/unborn-checkout-20260703 还没有任何提交，不能储藏并签出。请先创建首个提交，或改用‘强制签出’丢弃这些改动。”。
- `node --check server.js` 通过。
- 强制签出后 `D:\桌面\GitTest` 回到 `123`，`git status --short --branch` 返回 `## 123`，测试文件路径不存在。

### Notes
- `server.js`：新增统一的工作区清理函数，并让丢弃全部、本地强制签出和远端强制签出走同一套无 HEAD 兼容清理；储藏并签出在无提交分支上提前中文拦截。
- `README.md`：说明无提交分支不能储藏并签出，但可以强制签出丢弃当前改动。
- `docs/CONTINUE.md`：记录无提交分支强制签出修复。
- `progress.md`：追加本轮复现、修复、验证和清理记录。
- 回滚方式：提交前仅反向删除本轮在 `server.js`、`README.md`、`docs/CONTINUE.md` 和本日志块中的新增内容；这些文件已有其他未提交改动，不要用整文件 checkout 回滚。提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复无提交分支重置到提交时的英文错误
### What was done
- 复现当前分支还没有首个提交时，对历史提交执行硬重置会在创建恢复点阶段失败，并透出 `fatal: Needed a single revision`。
- `resetToCommit` 现在只有在当前分支已有 `HEAD` 提交时才创建“重置前恢复点”；无提交分支会继续执行 reset，并在结果里说明本次没有可保存的旧 HEAD。
- README 和继续开发文档同步说明无提交分支执行 reset 时不会创建重置前恢复点。

### Testing
- 先验证远端强制签出回归：在 `D:\桌面\GitTest` 临时无提交分支上模拟 `origin/forkline-remote-only-checkout-20260703`，调用 `/api/action checkoutRemoteBranch`，`mode = force` 返回 200 “已强制签出本地分支 forkline-remote-only-checkout-20260703”。
- 在 `D:\桌面\GitTest` 临时无提交分支 `forkline/unborn-reset-20260703` 上复现：修复前调用 `/api/action resetToCommit`，`mode = hard` 返回 `fatal: Needed a single revision`。
- 修复后重启临时服务 `http://127.0.0.1:5298`，同一 hard reset 请求返回 200 “已硬重置到 4fbce18 / 当前分支原本还没有提交，无法创建重置前恢复点。”。
- 同一服务继续验证 `mode = mixed` 和 `mode = soft`，均返回 200，并显示对应的“无法创建重置前恢复点”中文说明。
- `node --check server.js` 通过。
- 已切回 `D:\桌面\GitTest` 的 `123` 分支，删除本轮临时本地分支和临时远端跟踪引用；最终 `git status --short --branch` 返回 `## 123`。

### Notes
- `server.js`：无提交分支执行 reset 时跳过恢复点创建，避免依赖不存在的 `HEAD`。
- `README.md`：说明无提交分支 reset 到已有提交会继续执行，但不会创建重置前恢复点。
- `docs/CONTINUE.md`：记录无提交分支 reset 修复。
- `progress.md`：追加本轮复现、修复、验证和清理记录。
- 回滚方式：提交前仅反向删除本轮在 `server.js`、`README.md`、`docs/CONTINUE.md` 和本日志块中的新增内容；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复变基已不存在远端分支时误用过期 tracking
### What was done
- 复现远端分支已经被外部删除，但本地仍保留 `origin/...` 过期跟踪引用时，Forkline 仍会把当前分支变基到这个过期提交。
- `rebaseOntoRef` 现在在目标是远端分支时会校验真实远端分支仍存在；不存在时自动 `fetch --prune` 并拒绝变基。
- README 和继续开发文档同步说明过期远端分支不会再作为变基目标。

### Testing
- 在 GitTest 创建临时分支 `forkline/stale-remote-rebase-20260703`，添加一个空提交 `9a1d73a`，推送并抓取出 `origin/forkline/stale-remote-rebase-20260703`。
- 切回 `123`、删除本地临时分支，并直接在 `D:\桌面\GitTestRemote.git` 删除真实远端分支，只保留本地过期远端跟踪引用。
- 临时服务 `http://127.0.0.1:5327` 打开 GitTest 后，修复前调用 `rebaseOntoRef origin/forkline/stale-remote-rebase-20260703` 返回成功，并把当前 `123` 分支移动到过期提交 `9a1d73a`。
- 已用 `git reset --hard 4fbce18...` 将 GitTest 恢复到基准提交；修复后重启临时服务 `http://127.0.0.1:5328` 再次调用同一动作，返回“远端分支 ... 已不存在，已刷新远端分支列表。请刷新后重新选择。”。
- 修复后确认当前 HEAD 仍为 `4fbce18bd7ae1b652dc7c550321acac3de9093b3`，本地过期 `origin/forkline/stale-remote-rebase-20260703` 已被 prune，`git status --short --branch` 返回 `## 123`。

### Notes
- `server.js`：变基远端分支前校验真实远端分支仍存在，过期时自动 prune 并拒绝变基。
- `README.md`：补充过期远端分支会拒绝变基。
- `docs/CONTINUE.md`：记录变基过期远端分支的 API 复现和验证结果。
- `progress.md`：追加本轮复现、修复、验证和清理记录。
- 回滚方式：提交前仅反向删除本轮在 `server.js`、`README.md`、`docs/CONTINUE.md` 和本日志块中的新增内容；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复无提交分支恢复到 Forkline 恢复点的英文错误
### What was done
- 复现当前分支还没有首个提交时，恢复到 Forkline 恢复点会在创建“恢复前恢复点”阶段失败，并透出 `fatal: Needed a single revision`。
- `restoreRecoveryPoint` 现在只有在当前分支已有 `HEAD` 提交时才创建恢复前恢复点；无提交分支会继续执行 `reset --hard <恢复点提交>`，并在结果里说明本次没有可保存的旧 HEAD。
- README 和继续开发文档同步说明无提交分支恢复到 Forkline 恢复点时不会创建恢复前恢复点。

### Testing
- 在 `D:\桌面\GitTest` 手动创建临时恢复点 `refs/forkline/recovery/20260703-122700/forkline_unborn-restore-20260703/manual`，指向 `123` 分支的 `4fbce18`。
- 在临时无提交分支 `forkline/unborn-restore-20260703` 上复现：修复前调用 `/api/action restoreRecoveryPoint` 返回 `fatal: Needed a single revision`。
- 修复后重启临时服务 `http://127.0.0.1:5302`，在无提交分支 `forkline/unborn-reflog-restore-20260703` 上调用同一恢复点，返回 200 “已恢复到 4fbce18 / 当前分支原本还没有提交，无法创建恢复前恢复点。”。
- 探查引用日志恢复路径：无提交分支下 `git log -g ... HEAD` 返回 `fatal: ambiguous argument 'HEAD'`，Forkline 没有可选择的 HEAD reflog 记录，因此本轮未改 reflog 恢复逻辑。
- `node --check server.js` 通过。
- 已切回 `D:\桌面\GitTest` 的 `123` 分支，删除本轮临时分支和临时恢复点 ref；最终 `git status --short --branch` 返回 `## 123`。

### Notes
- `server.js`：无提交分支恢复到 Forkline 恢复点时跳过恢复前恢复点创建，避免依赖不存在的 `HEAD`。
- `README.md`：说明无提交分支恢复到 Forkline 恢复点时会继续恢复，但不会创建恢复前恢复点。
- `docs/CONTINUE.md`：记录无提交分支恢复点恢复修复。
- `progress.md`：追加本轮复现、修复、验证和清理记录。
- 回滚方式：提交前仅反向删除本轮在 `server.js`、`README.md`、`docs/CONTINUE.md` 和本日志块中的新增内容；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复还原和挑选覆盖本地修改时的误导提示
### What was done
- 复现工作区存在暂存修改时，`revertCommit` 被 Git 阻止后 Forkline 返回通用“切换分支可储藏并签出/强制签出”提示，和还原场景不匹配。
- 错误提示映射现在会区分 `revertCommit` 和 `cherryPickCommit`：还原 / 挑选会覆盖本地修改时，分别提示先提交、储藏或丢弃当前修改后再还原 / 挑选。
- README 和继续开发文档同步说明还原 / 挑选覆盖本地修改时的专用中文提示。

### Testing
- 在 `D:\桌面\GitTest` 临时分支 `forkline/dirty-revert-20260703` 上创建并暂存 `forkline-fixtures/dirty-revert-20260703.txt`。
- 修复前调用 `/api/action revertCommit`，返回通用提示“这个操作会覆盖本地修改...如果是切换分支，也可以使用‘储藏并签出/强制签出’”。
- 修复后重启临时服务 `http://127.0.0.1:5304`，同一还原请求返回“还原提交会覆盖当前工作区的本地修改。请先提交、储藏或丢弃这些修改后再还原。”。
- 同一脏工作区下调用 `/api/action cherryPickCommit` 返回“挑选提交会覆盖当前工作区的本地修改。请先提交、储藏或丢弃这些修改后再挑选。”。
- `node --check server.js` 通过。
- 已切回 `D:\桌面\GitTest` 的 `123` 分支，删除本轮临时分支；最终 `git status --short --branch` 返回 `## 123`。

### Notes
- `server.js`：覆盖本地修改错误映射新增还原 / 挑选专用提示。
- `README.md`：补充还原 / 挑选覆盖本地修改时会提示先处理当前工作区。
- `docs/CONTINUE.md`：记录还原 / 挑选覆盖本地修改提示修正。
- `progress.md`：追加本轮复现、修复、验证和清理记录。
- 回滚方式：提交前仅反向删除本轮在 `server.js`、`README.md`、`docs/CONTINUE.md` 和本日志块中的新增内容；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复本地分支列表过期时的英文错误
### What was done
- 复现当前前端分支列表已过期时，继续删除或重命名一个已经不存在的本地分支会透出 Git 英文错误。
- 错误提示映射新增 `branch not found` / `no branch named` 场景，统一提示本地分支已经不存在，需要刷新分支列表后重新选择。
- README 和继续开发文档同步说明删除 / 重命名过期分支时的中文刷新提示。

### Testing
- 临时服务 `http://127.0.0.1:5305` 打开 `D:\桌面\GitTest` 后，调用 `/api/action deleteBranch`，`branch = forkline/missing-stale-20260703`，修复前返回 `error: branch 'forkline/missing-stale-20260703' not found`。
- 同一服务调用 `/api/action renameBranch`，`branch = forkline/missing-stale-20260703`，修复前返回 `fatal: no branch named 'forkline/missing-stale-20260703'`。
- 修复后重启临时服务 `http://127.0.0.1:5306`，同样的删除和重命名请求都返回“这个本地分支已经不存在，可能是分支列表还没有刷新。请刷新分支列表后重新选择。”。
- `node --check server.js` 通过。
- 本轮没有创建或修改 GitTest 分支；最终 `git -C D:\桌面\GitTest status --short --branch` 返回 `## 123`。

### Notes
- `server.js`：为已不存在本地分支的 Git 错误增加中文刷新提示。
- `README.md`：说明外部删除分支后再删除 / 重命名会提示刷新分支列表。
- `docs/CONTINUE.md`：记录本地分支列表过期提示修正。
- `progress.md`：追加本轮复现、修复、验证和清理记录。
- 回滚方式：提交前仅反向删除本轮在 `server.js`、`README.md`、`docs/CONTINUE.md` 和本日志块中的新增内容；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复远端 Tag 失败提示误用 Tag 名
### What was done
- 排查 Tag 列表过期场景：删除不存在的本地 Tag 已有中文预检“本地 Tag ... 不存在”，无需修改。
- 复现删除远端 Tag 时，如果远端仓库不可读，Forkline 会把 `body.name` 里的 Tag 名显示成远端名，提示“远端 <Tag名> 无法读取”。
- 远端错误提示现在优先使用 `body.remote`，再回退到 `body.name`，避免 `deleteRemoteTag` / `pushTag` 这类请求把 Tag 名误当远端。
- README 和继续开发文档同步说明远端 Tag 操作失败时会按实际远端名显示认证、路径或网络提示。

### Testing
- 临时服务 `http://127.0.0.1:5307` 打开 `D:\桌面\GitTest` 后，调用 `/api/action deleteTag`，`name = forkline-missing-tag-20260703`，确认已有中文“本地 Tag ... 不存在”。
- 同一服务调用 `/api/action deleteRemoteTag`，`name = forkline-missing-remote-tag-20260703`、`remote = origin`；由于 GitTest 的 `origin` 路径当前不可读，修复前返回“远端 forkline-missing-remote-tag-20260703 无法读取”。
- 通过原始 Git 命令确认失败原因是 `D:\桌面\GitTestRemote.git` 不可读，而不是 Tag 名本身。
- 修复后重启临时服务 `http://127.0.0.1:5309`，同一请求返回“远端 origin 无法读取。请确认远端 URL 正确、仓库存在，并且你拥有访问权限。”。
- `node --check server.js` 通过。
- 本轮没有创建或修改 GitTest 分支 / Tag；最终 `git -C D:\桌面\GitTest status --short --branch` 返回 `## 123`。

### Notes
- `server.js`：远端错误提示优先使用 `body.remote`，避免 Tag 名覆盖远端名。
- `README.md`：补充远端 Tag 操作失败时按实际远端名显示提示。
- `docs/CONTINUE.md`：记录远端 Tag 失败提示修正。
- `progress.md`：追加本轮复现、修复、验证和清理记录。
- 回滚方式：提交前仅反向删除本轮在 `server.js`、`README.md`、`docs/CONTINUE.md` 和本日志块中的新增内容；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复删除不存在远端 Tag 误报成功
### What was done
- 复现远端可访问但目标 Tag 不存在时，Git 会返回成功并带 `deleting a non-existent ref` warning，Forkline 也误报“已删除远端 Tag”。
- `deleteRemoteTag` 现在执行删除前先用 `git ls-remote --tags <远端> refs/tags/<Tag>` 确认远端 Tag 仍存在；不存在时返回中文“请刷新 Tag 列表后重新选择”。
- 保留远端不可读时的原有远端错误提示；正常存在的远端 Tag 仍可删除成功。
- README 和继续开发文档同步说明删除远端 Tag 会先确认远端仍存在该 Tag。

### Testing
- 在 `C:\tmp\forkline-remote-tag-missing-20260703.git` 创建临时 bare 远端，并临时添加到 `D:\桌面\GitTest`，远端名 `forkline-temp-tag-missing`。
- 修复前通过 Forkline API 调用 `deleteRemoteTag` 删除不存在的 `forkline-missing-existing-remote-tag-20260703`，返回 200 “已删除远端 Tag...”，但 Git 输出包含 `remote: warning: deleting a non-existent ref`。
- 修复后重启临时服务 `http://127.0.0.1:5311`，同一请求返回“远端 Tag ... 不存在或已经被删除。请刷新 Tag 列表后重新选择。”。
- 正常路径验证：创建本地临时 Tag `forkline-temp-existing-remote-tag-20260703`，通过 Forkline `pushTag` 推送到临时远端，再通过 `deleteRemoteTag` 删除成功；`ls-remote --tags` 确认远端 Tag 不存在。
- `node --check server.js` 通过。
- 已删除本地临时 Tag、移除临时远端、删除 `C:\tmp` 临时 bare 仓库；最终 `git -C D:\桌面\GitTest status --short --branch` 返回 `## 123`，`remote -v` 只剩 `origin`。

### Notes
- `server.js`：删除远端 Tag 前新增远端 Tag 存在性预检，避免 Git warning 被误当成功。
- `README.md`：说明删除远端 Tag 会先确认远端仍存在该 Tag。
- `docs/CONTINUE.md`：记录删除不存在远端 Tag 误报成功的修复。
- `progress.md`：追加本轮复现、修复、验证和清理记录。
- 回滚方式：提交前仅反向删除本轮在 `server.js`、`README.md`、`docs/CONTINUE.md` 和本日志块中的新增内容；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复推送同名远端 Tag 冲突的误导提示
### What was done
- 复现远端已有同名 Tag、但本地 Tag 指向另一个提交时，`pushTag` 被 Git 拒绝后 Forkline 误报“这个远端名已经存在”。
- 错误提示映射现在会优先识别 `pushTag` 的 `tag already exists` 场景，明确说明远端已经存在同名 Tag，Git 拒绝覆盖。
- README 和继续开发文档同步说明远端同名 Tag 冲突时，需要先确认是否删除远端 Tag 或改用新 Tag 名。

### Testing
- 在 `C:\tmp\forkline-remote-tag-exists-20260703.git` 创建临时 bare 远端，并临时添加到 `D:\桌面\GitTest`，远端名 `forkline-temp-tag-exists`。
- 在 GitTest 创建本地 Tag `forkline-temp-existing-push-tag-20260703` 指向 `123`，通过 Forkline `pushTag` 推送到临时远端成功。
- 将本地同名 Tag 改指向 `3a90fbb` 后再次调用 `pushTag`；修复前返回“这个远端名已经存在。请换一个名称，或在同步页修改已有远端的 URL。”。
- 修复后重启临时服务 `http://127.0.0.1:5313`，同一请求返回“远端 forkline-temp-tag-exists 已经存在 Tag forkline-temp-existing-push-tag-20260703，Git 已拒绝覆盖...”。
- `node --check server.js` 通过。
- 已删除本地临时 Tag、移除临时远端、删除 `C:\tmp` 临时 bare 仓库；最终 `git -C D:\桌面\GitTest status --short --branch` 返回 `## 123`，`remote -v` 只剩 `origin`。

### Notes
- `server.js`：为 `pushTag` 的远端同名 Tag 冲突增加专用中文提示。
- `README.md`：补充远端已有同名 Tag 且 Git 拒绝覆盖时的处理说明。
- `docs/CONTINUE.md`：记录推送同名远端 Tag 冲突提示修正。
- `progress.md`：追加本轮复现、修复、验证和清理记录。
- 回滚方式：提交前仅反向删除本轮在 `server.js`、`README.md`、`docs/CONTINUE.md` 和本日志块中的新增内容；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复重复推送相同远端 Tag 的误导提示
### What was done
- 复现远端已经存在完全相同的 Tag 时，重复执行 `pushTag` 返回 `Everything up-to-date`，但 Forkline 总结仍显示“已推送 Tag...”。
- `pushTag` 现在识别 `Everything up-to-date` 输出，并总结为“远端 ... 已有相同 Tag ...，无需重复推送”。
- README 和继续开发文档同步说明重复推送相同远端 Tag 时会提示无需重复推送。

### Testing
- 在 `C:\tmp\forkline-remote-tag-uptodate-20260703.git` 创建临时 bare 远端，并临时添加到 `D:\桌面\GitTest`，远端名 `forkline-temp-tag-uptodate`。
- 在 GitTest 创建本地 Tag `forkline-temp-uptodate-tag-20260703` 指向 `123`，通过 Forkline `pushTag` 第一次推送到临时远端成功。
- 第二次推送同一 Tag 时，修复前返回 200 “已推送 Tag ... / Everything up-to-date”。
- 修复后重启临时服务 `http://127.0.0.1:5315`，同一请求返回 200 “远端 forkline-temp-tag-uptodate 已有相同 Tag forkline-temp-uptodate-tag-20260703，无需重复推送 / Everything up-to-date”。
- `node --check server.js` 通过。
- 已删除本地临时 Tag、移除临时远端、删除 `C:\tmp` 临时 bare 仓库；最终 `git -C D:\桌面\GitTest status --short --branch` 返回 `## 123`，`remote -v` 只剩 `origin`。

### Notes
- `server.js`：`pushTag` 对 `Everything up-to-date` 使用无需重复推送的摘要。
- `README.md`：说明远端已有完全相同 Tag 时不会误报新推送。
- `docs/CONTINUE.md`：记录重复推送相同远端 Tag 的提示修正。
- `progress.md`：追加本轮复现、修复、验证和清理记录。
- 回滚方式：提交前仅反向删除本轮在 `server.js`、`README.md`、`docs/CONTINUE.md` 和本日志块中的新增内容；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复创建 Tag 目标提交过期时的英文错误
### What was done
- 复现使用一个格式合法但仓库中不存在的提交 SHA 创建 Tag 时，Forkline 透出 Git 原始错误 `cannot update ref ... nonexistent object`。
- `createTag` 现在先解析目标 SHA 是否是有效提交；目标不存在或不是提交对象时，返回中文“Tag 目标提交不存在或不是有效提交。请刷新提交列表后重新选择。”。
- README 和继续开发文档同步说明创建 Tag 会先确认目标提交仍存在。

### Testing
- 临时服务 `http://127.0.0.1:5316` 打开 `D:\桌面\GitTest` 后，调用 `/api/action createTag`，`target = 0123456789abcdef0123456789abcdef01234567`；修复前返回 `fatal: cannot update ref ... nonexistent object ...`。
- 修复后重启临时服务 `http://127.0.0.1:5317`，同一请求返回中文“Tag 目标提交不存在或不是有效提交。请刷新提交列表后重新选择。”。
- 正常路径验证：使用真实提交 `4fbce18...` 创建临时 Tag `forkline-valid-target-tag-20260703` 成功。
- `node --check server.js` 通过。
- 已删除临时 Tag；最终 `git -C D:\桌面\GitTest tag --list "forkline-*-target-tag-20260703"` 无输出，`git -C D:\桌面\GitTest status --short --branch` 返回 `## 123`。

### Notes
- `server.js`：创建 Tag 前使用提交解析校验目标 SHA，避免过期提交详情透出 Git 原始错误。
- `README.md`：补充创建 Tag 会确认目标提交仍存在。
- `docs/CONTINUE.md`：记录创建 Tag 目标提交过期提示修正。
- `progress.md`：追加本轮复现、修复、验证和清理记录。
- 回滚方式：提交前仅反向删除本轮在 `server.js`、`README.md`、`docs/CONTINUE.md` 和本日志块中的新增内容；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复远端分支签出已有本地分支时不建立 upstream
### What was done
- 复现 `D:\桌面\GitTest` 当前 `123` 分支没有 upstream 时，通过 Forkline 签出 `origin/123` 返回成功，但本地分支仍未跟踪 `origin/123`。
- `checkoutRemoteBranch` 现在在本地同名分支已存在且没有 upstream 时，会补执行 `git branch --set-upstream-to=<远端分支> <本地分支>`。
- 如果本地同名分支已经跟踪其他 upstream，Forkline 不会静默覆盖，只会在结果中说明现有跟踪关系。

### Testing
- 临时服务 `http://127.0.0.1:5319` 打开 `D:\桌面\GitTest` 后，先确认 `git rev-parse --abbrev-ref --symbolic-full-name @{u}` 返回 `fatal: no upstream configured for branch '123'`。
- 调用 `/api/action`：`checkoutRemoteBranch`、`ref = origin/123`、`mode = keep`，修复后返回“已从 origin/123 签出本地分支 123 / 已设置 upstream：123 -> origin/123”。
- `git -C D:\桌面\GitTest rev-parse --abbrev-ref --symbolic-full-name @{u}` 返回 `origin/123`。
- `node --check server.js` 通过。
- 验证后已执行 `git -C D:\桌面\GitTest branch --unset-upstream 123`，测试仓库恢复为 `## 123`。

### Notes
- `server.js`：远端分支签出时为已存在且无 upstream 的本地同名分支补建跟踪关系。
- `README.md`：补充远端签出已有本地同名分支时的 upstream 行为说明。
- `docs/CONTINUE.md`：记录远端分支签出跟踪关系的 API 复现和验证结果。
- `progress.md`：追加本轮复现、修复、验证和清理记录。
- 回滚方式：提交前仅反向删除本轮在 `server.js`、`README.md`、`docs/CONTINUE.md` 和本日志块中的新增内容；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复本地路径远端缺失时的模糊错误提示
### What was done
- 复现 GitTest 的 `origin` 指向 `D:\桌面\GitTestRemote.git`，但该本地裸仓库不存在时，Forkline 的“诊断远端”和“抓取此远端”只提示“远端 origin 无法读取”。
- 远端错误映射现在会从 Git 原始输出中识别本地路径，并直接提示该路径不存在或不是 Git 仓库。
- README 和继续开发文档同步说明本地路径远端缺失时会显示具体路径；验证后重新创建了 `D:\桌面\GitTestRemote.git` 测试裸仓库。

### Testing
- `Test-Path -LiteralPath D:\桌面\GitTestRemote.git` 返回 `False`。
- 临时服务 `http://127.0.0.1:5320` 打开 `D:\桌面\GitTest` 后，修复前调用 `testRemote origin` 和 `fetchRemote origin` 均返回“远端 origin 无法读取。请确认远端 URL 正确、仓库存在，并且你拥有访问权限。”。
- 修复后重启同端口服务，再次调用 `testRemote origin` 和 `fetchRemote origin`，均返回“远端 origin 指向的本地路径 D:\桌面\GitTestRemote.git 不存在或不是 Git 仓库...”。
- 执行 `git clone --bare D:\桌面\GitTest D:\桌面\GitTestRemote.git` 重建测试裸仓库；`git -C D:\桌面\GitTest ls-remote --heads origin` 可读取 `123`、`local`、`local_debug` 和 `main`。
- `git -C D:\桌面\GitTest status --short --branch` 返回 `## 123`。

### Notes
- `server.js`：远端错误提示新增本地路径远端缺失识别。
- `README.md`：说明本地路径远端不存在或不是 Git 仓库时会直接显示路径。
- `docs/CONTINUE.md`：记录本地路径远端缺失提示修复，并说明 GitTestRemote 已重建。
- `progress.md`：追加本轮复现、修复、验证和清理记录。
- 回滚方式：提交前仅反向删除本轮在 `server.js`、`README.md`、`docs/CONTINUE.md` 和本日志块中的新增内容；提交后可用 `git revert <本次提交>` 回滚。测试裸仓库如需回滚到缺失状态，可删除 `D:\桌面\GitTestRemote.git`，但默认保留它以便后续远端功能验证。

## 2026-07-03 - Task: 修复相对本地路径远端缺失时的模糊错误提示
### What was done
- 复现 GitTest 临时远端 `forkline-relative-missing -> MissingBare.git` 不存在时，Forkline 的“诊断远端”只提示“远端无法读取”，没有指出相对本地路径。
- 本地路径远端识别现在覆盖 `MissingBare.git` 这类相对裸仓库路径，同时排除 URL 和 SSH scp 写法，避免误判远端仓库地址。
- README 和继续开发文档同步说明相对本地路径远端缺失时也会显示具体路径。

### Testing
- 临时添加 `git -C D:\桌面\GitTest remote add forkline-relative-missing MissingBare.git`，并确认 `D:\桌面\GitTest\MissingBare.git` 不存在。
- 临时服务 `http://127.0.0.1:5321` 打开 `D:\桌面\GitTest` 后，修复前调用 `testRemote forkline-relative-missing` 返回通用“远端无法读取”。
- 修复后重启同端口服务，调用 `testRemote forkline-relative-missing` 和 `fetchRemote forkline-relative-missing`，均返回“远端 forkline-relative-missing 指向的本地路径 MissingBare.git 不存在或不是 Git 仓库...”。
- 已删除临时远端；`git -C D:\桌面\GitTest remote -v` 只剩 `origin -> D:\桌面\GitTestRemote.git`，`git -C D:\桌面\GitTest status --short --branch` 返回 `## 123`。

### Notes
- `server.js`：本地路径远端缺失识别补充相对 `.git` 路径。
- `README.md`：补充 `MissingBare.git` 这类相对裸仓库路径也会直接显示。
- `docs/CONTINUE.md`：记录相对本地路径远端缺失提示修复。
- `progress.md`：追加本轮复现、修复、验证和清理记录。
- 回滚方式：提交前仅反向删除本轮在 `server.js`、`README.md`、`docs/CONTINUE.md` 和本日志块中的新增内容；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复删除已不存在远端分支后本地列表仍残留
### What was done
- 复现远端分支已经被外部删除，但本地仍保留 `origin/...` 过期跟踪引用时，Forkline 删除该远端分支只返回错误“请先抓取远端刷新列表”，但没有实际刷新列表。
- `deleteRemoteBranch` 现在识别 Git 返回的 `remote ref does not exist` / `unable to delete` 场景，把目标分支视为远端已不存在，并自动执行 `git fetch <remote> --prune` 清理本地过期跟踪引用。
- README 和继续开发文档同步说明远端分支已被别人删除时会自动清理本地远端跟踪引用。

### Testing
- 在 GitTest 创建本地临时分支 `forkline/stale-remote-delete-20260703`，推送到 `origin`，并显式抓取到 `refs/remotes/origin/forkline/stale-remote-delete-20260703`。
- 直接在 `D:\桌面\GitTestRemote.git` 执行 `update-ref -d refs/heads/forkline/stale-remote-delete-20260703`，制造真实远端分支不存在、本地远端跟踪引用仍存在的过期列表状态。
- 临时服务 `http://127.0.0.1:5322` 打开 GitTest 后，修复前调用 `deleteRemoteBranch origin/forkline/stale-remote-delete-20260703` 返回错误，且 `git branch -r --list origin/forkline/stale-remote-delete-20260703` 仍能看到过期引用。
- 修复后重启同端口服务，再次调用同一动作返回 200 “远端分支 ... 已不存在，已刷新远端分支列表”，输出包含 `fetch --prune` 删除该远端跟踪引用。
- 已删除本地临时分支；`git -C D:\桌面\GitTest branch -r --list origin/forkline/stale-remote-delete-20260703` 和 `git -C D:\桌面\GitTest ls-remote --heads origin forkline/stale-remote-delete-20260703` 均无输出。

### Notes
- `server.js`：删除远端分支时对远端已不存在的分支自动执行 prune 并返回成功摘要。
- `README.md`：说明删除远端分支遇到过期列表时会自动刷新本地远端跟踪引用。
- `docs/CONTINUE.md`：记录远端删除过期列表的 API 复现和验证结果。
- `progress.md`：追加本轮复现、修复、验证和清理记录。
- 回滚方式：提交前仅反向删除本轮在 `server.js`、`README.md`、`docs/CONTINUE.md` 和本日志块中的新增内容；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复远端分支已不存在但仍可从过期列表签出
### What was done
- 复现远端分支已经被外部删除，但本地仍保留 `origin/...` 过期跟踪引用时，Forkline 仍会从过期引用创建本地分支并设置 upstream。
- `checkoutRemoteBranch` 现在在签出前使用 `git ls-remote --heads <remote> <branch>` 确认真正的远端分支仍存在；不存在时自动 `fetch --prune` 并拒绝签出。
- README 和继续开发文档同步说明过期远端分支不会再被签出为本地分支。

### Testing
- 在 GitTest 推送 `HEAD` 到远端分支 `forkline/stale-remote-checkout-20260703`，抓取出 `origin/forkline/stale-remote-checkout-20260703` 后，直接在 `D:\桌面\GitTestRemote.git` 删除真实远端分支，制造过期远端分支列表。
- 临时服务 `http://127.0.0.1:5323` 打开 GitTest 后，修复前调用 `checkoutRemoteBranch origin/forkline/stale-remote-checkout-20260703` 返回成功，并创建本地分支 `forkline/stale-remote-checkout-20260703`，upstream 指向已经不存在的远端跟踪分支。
- 修复后删除误创建的本地分支、保留过期跟踪引用，重启同端口服务再次调用同一动作，返回“远端分支 ... 已不存在，已刷新远端分支列表。请刷新后重新选择。”。
- 修复后确认当前分支仍为 `123`，没有创建本地 `forkline/stale-remote-checkout-20260703`，并且本地过期 `origin/forkline/stale-remote-checkout-20260703` 已被 prune 清理。

### Notes
- `server.js`：远端分支签出前增加真实远端分支存在性校验，过期时自动 prune 并拒绝签出。
- `README.md`：补充远端分支已不存在但本地列表未刷新时会清理过期引用并拒绝签出。
- `docs/CONTINUE.md`：记录远端分支签出过期列表的 API 复现和验证结果。
- `progress.md`：追加本轮复现、修复、验证和清理记录。
- 回滚方式：提交前仅反向删除本轮在 `server.js`、`README.md`、`docs/CONTINUE.md` 和本日志块中的新增内容；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复过期远端分支仍可设为 upstream
### What was done
- 复现远端分支已经被外部删除，但本地仍保留 `origin/...` 过期跟踪引用时，Forkline 仍会把当前分支 upstream 设置到这个已不存在的远端分支，并显示“本地与上游一致”。
- `setUpstream` 现在复用远端真实存在性校验；目标远端分支已不存在时会自动 `fetch --prune` 并拒绝写入 upstream。
- README 和继续开发文档同步说明设置 upstream 前会确认远端分支仍存在。

### Testing
- 在 GitTest 推送 `HEAD` 到远端分支 `forkline/stale-upstream-20260703`，抓取出 `origin/forkline/stale-upstream-20260703` 后，直接在 `D:\桌面\GitTestRemote.git` 删除真实远端分支，制造过期远端分支列表。
- 临时服务 `http://127.0.0.1:5324` 打开 GitTest 后，修复前调用 `setUpstream origin/forkline/stale-upstream-20260703` 返回成功，并把 `123` 的 upstream 写成这个已不存在的远端分支。
- 修复后先取消误写入的 upstream，保留过期跟踪引用，重启同端口服务再次调用同一动作，返回“远端分支 ... 已不存在，已刷新远端分支列表。请刷新后重新选择。”。
- 修复后 `git -C D:\桌面\GitTest rev-parse --abbrev-ref --symbolic-full-name @{u}` 返回没有 upstream，`git branch -r --list origin/forkline/stale-upstream-20260703` 无输出，`git status --short --branch` 返回 `## 123`。

### Notes
- `server.js`：设置 upstream 前校验真实远端分支仍存在，过期时自动 prune 并拒绝写入配置。
- `README.md`：补充设置 upstream 会拒绝过期远端分支。
- `docs/CONTINUE.md`：记录 Upstream 过期列表的 API 复现和验证结果。
- `progress.md`：追加本轮复现、修复、验证和清理记录。
- 回滚方式：提交前仅反向删除本轮在 `server.js`、`README.md`、`docs/CONTINUE.md` 和本日志块中的新增内容；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复合并已不存在远端分支时误用过期 tracking
### What was done
- 复现远端分支已经被外部删除，但本地仍保留 `origin/...` 过期跟踪引用时，Forkline 仍会把这个过期引用合并进当前分支，创建新的 merge commit。
- `mergeRef` 现在在目标是远端分支时会校验真实远端分支仍存在；不存在时自动 `fetch --prune` 并拒绝合并。
- README 和继续开发文档同步说明过期远端分支不会再被合并。

### Testing
- 在 GitTest 创建临时分支 `forkline/stale-remote-merge-20260703`，添加一个空提交 `25321cd`，推送并抓取出 `origin/forkline/stale-remote-merge-20260703`。
- 切回 `123`、删除本地临时分支，并直接在 `D:\桌面\GitTestRemote.git` 删除真实远端分支，只保留本地过期远端跟踪引用。
- 临时服务 `http://127.0.0.1:5325` 打开 GitTest 后，修复前调用 `mergeRef origin/forkline/stale-remote-merge-20260703` 返回成功，并创建 merge commit `6ca351e`。
- 已用 `git reset --hard 4fbce18...` 将 GitTest 恢复到基准提交；修复后重启同端口服务再次调用同一动作，返回“远端分支 ... 已不存在，已刷新远端分支列表。请刷新后重新选择。”。
- 修复后确认 `git log -1 --oneline --parents` 仍为 `4fbce18 cdd252a 修改2`，没有新 merge commit；本地过期 `origin/forkline/stale-remote-merge-20260703` 已被 prune，`git status --short --branch` 返回 `## 123`。

### Notes
- `server.js`：合并远端分支前校验真实远端分支仍存在，过期时自动 prune 并拒绝合并。
- `README.md`：补充过期远端分支会拒绝合并。
- `docs/CONTINUE.md`：记录合并过期远端分支的 API 复现和验证结果。
- `progress.md`：追加本轮复现、修复、验证和清理记录。
- 回滚方式：提交前仅反向删除本轮在 `server.js`、`README.md`、`docs/CONTINUE.md` 和本日志块中的新增内容；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复从已不存在远端分支新建本地分支
### What was done
- 复现远端分支已经被外部删除，但本地仍保留 `origin/...` 过期跟踪引用时，Forkline 仍会从这个过期引用创建新的本地分支。
- `createBranch` 现在在起点是远端分支时会校验真实远端分支仍存在；不存在时自动 `fetch --prune` 并拒绝创建。
- README 和继续开发文档同步说明过期远端分支不会再作为新建分支起点。

### Testing
- 在 GitTest 创建临时分支 `forkline/stale-remote-create-branch-20260703`，添加一个空提交 `fd3fe65`，推送并抓取出 `origin/forkline/stale-remote-create-branch-20260703`。
- 切回 `123`、删除本地临时分支，并直接在 `D:\桌面\GitTestRemote.git` 删除真实远端分支，只保留本地过期远端跟踪引用。
- 临时服务 `http://127.0.0.1:5329` 打开 GitTest 后，修复前调用 `createBranch`，起点为 `origin/forkline/stale-remote-create-branch-20260703`，返回成功并创建本地分支 `forkline/from-stale-create-branch-20260703` 指向过期提交 `fd3fe65`。
- 已删除误创建的本地分支；修复后重启临时服务 `http://127.0.0.1:5330` 再次调用同一动作，返回“远端分支 ... 已不存在，已刷新远端分支列表。请刷新后重新选择。”。
- 修复后确认没有创建本地 `forkline/from-stale-create-branch-20260703`，本地过期 `origin/forkline/stale-remote-create-branch-20260703` 已被 prune，`git status --short --branch` 返回 `## 123`。

### Notes
- `server.js`：从远端分支起点新建本地分支前校验真实远端分支仍存在，过期时自动 prune 并拒绝创建。
- `README.md`：补充过期远端分支会拒绝作为新建分支起点。
- `docs/CONTINUE.md`：记录从过期远端分支创建本地分支的 API 复现和验证结果。
- `progress.md`：追加本轮复现、修复、验证和清理记录。
- 回滚方式：提交前仅反向删除本轮在 `server.js`、`README.md`、`docs/CONTINUE.md` 和本日志块中的新增内容；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复从已不存在远端分支创建 worktree
### What was done
- 复现远端分支已经被外部删除，但本地仍保留 `origin/...` 过期跟踪引用时，Forkline 仍会从这个过期引用创建 detached worktree。
- `createWorktree` 现在在起点是远端分支时会校验真实远端分支仍存在；不存在时自动 `fetch --prune` 并拒绝创建。
- README 和继续开发文档同步说明过期远端分支不会再作为 worktree 起点。

### Testing
- 在 GitTest 创建临时分支 `forkline/stale-remote-worktree-20260703`，添加一个空提交 `0204135`，推送并抓取出 `origin/forkline/stale-remote-worktree-20260703`。
- 切回 `123`、删除本地临时分支，并直接在 `D:\桌面\GitTestRemote.git` 删除真实远端分支，只保留本地过期远端跟踪引用。
- 临时服务 `http://127.0.0.1:5331` 打开 GitTest 后，修复前调用 `createWorktree`，起点为 `origin/forkline/stale-remote-worktree-20260703`，返回成功并在 `C:\tmp\forkline-stale-worktree-20260703` 创建 detached worktree，HEAD 指向过期提交 `0204135`。
- 已执行 `git worktree remove --force C:\tmp\forkline-stale-worktree-20260703` 清理误创建的 worktree；修复后重启临时服务 `http://127.0.0.1:5332` 再次调用同一动作，返回“远端分支 ... 已不存在，已刷新远端分支列表。请刷新后重新选择。”。
- 修复后确认没有创建 `C:\tmp\forkline-stale-worktree-20260703`，`git worktree list --porcelain` 只剩主工作树，本地过期 `origin/forkline/stale-remote-worktree-20260703` 已被 prune，`git status --short --branch` 返回 `## 123`。

### Notes
- `server.js`：从远端分支起点创建 worktree 前校验真实远端分支仍存在，过期时自动 prune 并拒绝创建。
- `README.md`：补充过期远端分支会拒绝作为 worktree 起点。
- `docs/CONTINUE.md`：记录从过期远端分支创建 worktree 的 API 复现和验证结果。
- `progress.md`：追加本轮复现、修复、验证和清理记录。
- 回滚方式：提交前仅反向删除本轮在 `server.js`、`README.md`、`docs/CONTINUE.md` 和本日志块中的新增内容；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复比较页读取已不存在远端分支
### What was done
- 复现远端分支已经被外部删除，但本地仍保留 `origin/...` 过期跟踪引用时，比较页仍会读取这个过期引用并展示目标独有提交。
- `readCompare` 现在在比较基准或目标是远端分支时会校验真实远端分支仍存在；不存在时自动 `fetch --prune` 并拒绝比较。
- README 和继续开发文档同步说明比较页不会再展示过期远端分支的数据。

### Testing
- 在 GitTest 创建临时分支 `forkline/stale-remote-compare-20260703`，添加文件 `forkline-fixtures/stale-compare-20260703.txt` 并提交 `e15ae70`，推送并抓取出 `origin/forkline/stale-remote-compare-20260703`。
- 切回 `123`、删除本地临时分支，并直接在 `D:\桌面\GitTestRemote.git` 删除真实远端分支，只保留本地过期远端跟踪引用。
- 临时服务 `http://127.0.0.1:5333` 打开 GitTest 后，修复前请求 `/api/compare?base=123&head=origin/forkline/stale-remote-compare-20260703` 返回成功，`headShort = e15ae70`，`headOnlyCount = 1`。
- 修复后重启临时服务 `http://127.0.0.1:5334` 再次请求同一比较，返回“远端分支 ... 已不存在，已刷新远端分支列表。请刷新后重新选择。”。
- 修复后确认本地过期 `origin/forkline/stale-remote-compare-20260703` 已被 prune，真实远端分支不存在，`git status --short --branch` 返回 `## 123`。

### Notes
- `server.js`：比较前校验基准和目标中的远端分支仍存在，过期时自动 prune 并拒绝比较。
- `README.md`：补充比较页会拒绝过期远端分支。
- `docs/CONTINUE.md`：记录比较页读取过期远端分支的 API 复现和验证结果。
- `progress.md`：追加本轮复现、修复、验证和清理记录。
- 回滚方式：提交前仅反向删除本轮在 `server.js`、`README.md`、`docs/CONTINUE.md` 和本日志块中的新增内容；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复文件历史和逐行追踪读取已不存在远端分支
### What was done
- 复现远端分支已经被外部删除，但本地仍保留 `origin/...` 过期跟踪引用时，文件历史和逐行追踪仍会读取这个过期引用并展示旧提交数据。
- `readFileHistory` 和 `readFileBlame` 现在在引用是远端分支时会校验真实远端分支仍存在；不存在时自动 `fetch --prune` 并拒绝读取。
- README 和继续开发文档同步说明文件历史和逐行追踪不会再展示过期远端分支的数据。

### Testing
- 在 GitTest 创建临时分支 `forkline/stale-remote-file-read-20260703`，添加文件 `forkline-fixtures/stale-file-read-20260703.txt` 并提交 `0408d6d`，推送并抓取出 `origin/forkline/stale-remote-file-read-20260703`。
- 切回 `123`、删除本地临时分支，并直接在 `D:\桌面\GitTestRemote.git` 删除真实远端分支，只保留本地过期远端跟踪引用。
- 临时服务 `http://127.0.0.1:5335` 打开 GitTest 后，修复前请求 `/api/file-history?file=forkline-fixtures/stale-file-read-20260703.txt&ref=origin/forkline/stale-remote-file-read-20260703` 返回 1 条过期提交 `0408d6d`。
- 同一服务请求 `/api/file-blame` 返回 2 行旧 blame，首行文本为 `stale file read line one`，首行提交为 `0408d6d`。
- 修复后重启临时服务 `http://127.0.0.1:5336`，文件历史请求返回“远端分支 ... 已不存在，已刷新远端分支列表。请刷新后重新选择。”，并自动 prune 过期跟踪引用。
- 为单独验证逐行追踪，临时将旧提交重新挂回 `refs/remotes/origin/forkline/stale-remote-file-read-20260703`；修复后的 `/api/file-blame` 同样返回“远端分支 ... 已不存在”，并再次 prune 过期跟踪引用。
- 修复后确认本地过期 `origin/forkline/stale-remote-file-read-20260703` 已被 prune，真实远端分支不存在，`git status --short --branch` 返回 `## 123`。

### Notes
- `server.js`：文件历史和逐行追踪读取前校验远端分支仍存在，过期时自动 prune 并拒绝读取。
- `README.md`：补充文件历史和逐行追踪会拒绝过期远端分支。
- `docs/CONTINUE.md`：记录文件历史和逐行追踪读取过期远端分支的 API 复现和验证结果。
- `progress.md`：追加本轮复现、修复、验证和清理记录。
- 回滚方式：提交前仅反向删除本轮在 `server.js`、`README.md`、`docs/CONTINUE.md` 和本日志块中的新增内容；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复图谱视图读取已不存在远端分支
### What was done
- 复现远端分支已经被外部删除，但本地仍保留 `origin/...` 过期跟踪引用时，轻量图谱和全量状态接口仍会读取这个过期引用并展示旧提交图谱。
- `readState` 和 `readRefState` 现在在选中引用是远端分支时会校验真实远端分支仍存在；不存在时自动 `fetch --prune` 并拒绝读取。
- `ensureLiveRemoteBranchRef` 对空引用快速返回，避免默认状态读取多跑无意义的远端检查。
- README 和继续开发文档同步说明切到远端分支图谱时不会再展示过期 tracking 数据。

### Testing
- 在 GitTest 创建临时分支 `forkline/stale-remote-refstate-20260703`，添加文件 `forkline-fixtures/stale-refstate-20260703.txt` 并提交 `1ebb95c`，推送并抓取出 `origin/forkline/stale-remote-refstate-20260703`。
- 切回 `123`、删除本地临时分支，并直接在 `D:\桌面\GitTestRemote.git` 删除真实远端分支，只保留本地过期远端跟踪引用。
- 临时服务 `http://127.0.0.1:5337` 打开 GitTest 后，修复前请求 `/api/ref-state?ref=origin/forkline/stale-remote-refstate-20260703` 返回成功，首条提交为 `1ebb95c`；`/api/state?ref=...` 同样返回成功，`remotes` 中仍包含该过期引用。
- 修复后重启临时服务 `http://127.0.0.1:5338`，`/api/ref-state?ref=...` 返回“远端分支 ... 已不存在，已刷新远端分支列表。请刷新后重新选择。”，并自动 prune 过期跟踪引用。
- 为单独验证全量状态接口，临时将旧提交重新挂回 `refs/remotes/origin/forkline/stale-remote-refstate-20260703`；修复后的 `/api/state?ref=...` 同样返回“远端分支 ... 已不存在”，并再次 prune 过期跟踪引用。
- 修复后确认本地过期 `origin/forkline/stale-remote-refstate-20260703` 已被 prune，真实远端分支不存在，`git status --short --branch` 返回 `## 123`。

### Notes
- `server.js`：图谱状态读取前校验选中远端分支仍存在，过期时自动 prune 并拒绝读取。
- `README.md`：补充单个远端分支图谱会拒绝过期 tracking。
- `docs/CONTINUE.md`：记录图谱视图读取过期远端分支的 API 复现和验证结果。
- `progress.md`：追加本轮复现、修复、验证和清理记录。
- 回滚方式：提交前仅反向删除本轮在 `server.js`、`README.md`、`docs/CONTINUE.md` 和本日志块中的新增内容；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复切换已不存在远端分支失败后前端状态错位
### What was done
- 复现单个远端分支图谱切换失败时，前端会先把当前引用、右侧页签、搜索框和提交详情缓存改成失败目标。
- `selectRef` 现在先等待 `/api/ref-state` 成功返回，再切换右侧上下文、清搜索和刷新提交图。
- README 和继续开发文档同步说明过期远端分支切换失败会保留当前视图。

### Testing
- 修复前用前端函数 harness 模拟 `/api/ref-state` 抛出“远端分支 origin/missing 已不存在”，`selectedRef` 被改成 `origin/missing`，右侧上下文被改成 `branch / branches`，搜索框被清空，提交详情缓存被清空。
- 修复后复跑同一 harness，`selectedRef` 保持 `123`，右侧上下文保持 `commit / details`，搜索框保持 `keep`，提交详情缓存保持 1 条，仅显示中文错误 toast。
- 成功路径 harness 返回 `origin/live` 和提交 `new-head` 后，仍正常切到 `branch / branches`，清空搜索，加载 `new-head` 并显示“已查看 origin/live”。

### Notes
- `public/js/features/git-actions.js`：把 `selectRef` 的状态修改移动到 `/api/ref-state` 成功之后，避免失败请求污染当前视图。
- `README.md`：补充单个远端分支图谱切换失败会保留当前视图。
- `docs/CONTINUE.md`：记录前端会保留当前视图和详情。
- `progress.md`：追加本轮复现、修复和验证记录。
- 回滚方式：提交前仅反向删除本轮在 `public/js/features/git-actions.js`、`README.md`、`docs/CONTINUE.md` 和本日志块中的新增内容；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复文件历史和逐行追踪快速切换乱序覆盖
### What was done
- 复现连续打开两个文件的历史时，后选择的文件先返回并显示后，较慢返回的旧文件请求会再次覆盖右侧历史面板。
- 文件历史和逐行追踪现在各自使用请求序号，只允许最后一次请求写回面板。
- README 和继续开发文档同步说明快速切换文件时只保留最后选择的结果。

### Testing
- 修复前用前端函数 harness 先调用 `openFileHistory("a.txt")` 再调用 `openFileHistory("b.txt")`，模拟 `a.txt` 慢返回、`b.txt` 快返回；最终 `state.fileHistory.file` 和数据都被旧的 `a.txt` 覆盖。
- 修复后复跑同一 harness，最终 `state.fileHistory.file = b.txt`，数据也为 `b.txt`，旧的 `a.txt` 返回没有再次渲染。
- 逐行追踪使用同样乱序 harness 验证，最终 `state.fileBlame.file = b.txt`，数据也为 `b.txt`，旧请求没有覆盖最后选择。

### Notes
- `public/js/core.js`：新增文件历史和逐行追踪请求序号。
- `public/js/panels/inspector.js`：文件历史和逐行追踪写回前校验请求序号，丢弃过期响应。
- `README.md`：补充快速切换文件时历史和逐行追踪只显示最后选择结果。
- `docs/CONTINUE.md`：记录文件历史和逐行追踪乱序请求保护。
- `progress.md`：追加本轮复现、修复和验证记录。
- 回滚方式：提交前仅反向删除本轮在 `public/js/core.js`、`public/js/panels/inspector.js`、`README.md`、`docs/CONTINUE.md` 和本日志块中的新增内容；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复分支比较快速切换乱序覆盖
### What was done
- 复现连续打开两个比较目标时，后选择的比较先返回并显示后，较慢返回的旧比较请求会再次覆盖右侧比较页。
- 比较页现在使用请求序号，只允许最后一次比较请求写回结果和选中文件。
- README 和继续开发文档同步说明快速切换比较目标时只保留最后选择的结果。

### Testing
- 修复前用前端函数 harness 先调用 `openCompareBranch("slow-head", "main")` 再调用 `openCompareBranch("fast-head", "main")`，模拟 `slow-head` 慢返回、`fast-head` 快返回；最终 `state.compare.head`、数据和 `selectedCompareFile` 都被旧的 `slow-head` 覆盖。
- 修复后复跑同一 harness，最终 `state.compare.head = fast-head`，数据也为 `fast-head`，`selectedCompareFile = fast-head.txt`，旧的 `slow-head` 返回没有再次渲染。

### Notes
- `public/js/core.js`：新增比较页请求序号。
- `public/js/features/commit-actions.js`：比较结果写回前校验请求序号，丢弃过期响应。
- `README.md`：补充快速切换比较目标时只显示最后选择的比较结果。
- `docs/CONTINUE.md`：记录分支比较乱序请求保护。
- `progress.md`：追加本轮复现、修复和验证记录。
- 回滚方式：提交前仅反向删除本轮在 `public/js/core.js`、`public/js/features/commit-actions.js`、`README.md`、`docs/CONTINUE.md` 和本日志块中的新增内容；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复右侧刷新面板慢返回覆盖当前引用
### What was done
- 复现分支整理刷新从 `branch-a` 发出后，用户已经切到 `branch-b`，慢返回的旧刷新仍会把 `selectedRef` 和页面数据拉回 `branch-a`。
- 分支整理、工作树、子模块和操作日志刷新现在会记录发起时的引用；如果返回时当前引用已变化，就丢弃旧响应。
- README 和继续开发文档同步说明刷新类面板不会把页面拉回旧分支。

### Testing
- 修复前用前端函数 harness 调用 `refreshBranchCleanup()` 后立即把 `selectedRef` 改为 `branch-b`；旧请求返回后 `selectedRef` 和数据都变回 `branch-a`，并触发 `renderAll`、`renderInspector` 和“分支整理已刷新”提示。
- 修复后复跑同一 harness，`selectedRef` 保持 `branch-b`，旧请求不再渲染或提示。
- 另用同样模式验证 `refreshWorktreeDashboard()`、`refreshSubmodules()` 和 `refreshLogsTab()`，旧响应都不会覆盖 `branch-b`。
- 贴近真实切换的 harness 同时把 `state.data.repo.selectedRef` 改成 `branch-b`，旧刷新返回后数据仍保持 `branch-b`。

### Notes
- `public/js/panels/workspaces.js`：分支整理、工作树和子模块刷新写回前校验当前引用是否仍是请求发起时的引用。
- `public/js/panels/recovery-settings.js`：操作日志刷新写回前校验当前引用。
- `README.md`：补充刷新类面板不会把页面拉回旧分支。
- `docs/CONTINUE.md`：记录右侧刷新类面板的旧响应丢弃行为。
- `progress.md`：追加本轮复现、修复和验证记录。
- 回滚方式：提交前仅反向删除本轮在 `public/js/panels/workspaces.js`、`public/js/panels/recovery-settings.js`、`README.md`、`docs/CONTINUE.md` 和本日志块中的新增内容；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复目录选择弹窗快速切换乱序覆盖
### What was done
- 复现路径选择弹窗先加载 `C:/slow`、马上加载 `D:/fast` 时，`D:/fast` 先显示后会被慢返回的 `C:/slow` 覆盖。
- 目录浏览现在使用请求序号，只允许最后一次 `loadFolder` 请求写回目录列表；旧错误也不会覆盖新目录。
- README 和继续开发文档同步说明快速切换目录时只保留最后选择结果。

### Testing
- 修复前用前端函数 harness 先调用 `loadFolder("C:/slow")` 再调用 `loadFolder("D:/fast")`，模拟 `C:/slow` 慢返回、`D:/fast` 快返回；最终 `state.folderBrowse.current` 和路径输入框都被旧的 `C:/slow` 覆盖。
- 修复后复跑同一 harness，最终 `state.folderBrowse.current = D:/fast`，路径输入框也保持 `D:/fast`。
- 另验证旧错误不会覆盖新成功：`C:/broken` 慢返回错误、`D:/fast` 快返回成功时，最终仍显示 `D:/fast`，不会显示“旧目录读取失败”或弹出旧错误 toast。

### Notes
- `public/js/core.js`：新增目录浏览请求序号。
- `public/js/features/folder-command.js`：目录浏览成功和失败写回前校验请求序号，丢弃过期响应。
- `README.md`：补充路径选择弹窗快速切换目录时只显示最后选择结果。
- `docs/CONTINUE.md`：记录目录弹窗旧请求和旧错误不会覆盖当前目录。
- `progress.md`：追加本轮复现、修复和验证记录。
- 回滚方式：提交前仅反向删除本轮在 `public/js/core.js`、`public/js/features/folder-command.js`、`README.md`、`docs/CONTINUE.md` 和本日志块中的新增内容；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复连续打开仓库乱序覆盖
### What was done
- 复现先打开 `slow-repo`、马上打开 `fast-repo` 时，`fast-repo` 先显示后会被慢返回的 `slow-repo` 覆盖。
- 打开仓库现在使用请求序号；旧的 `/api/open` 返回和旧的二次 `/api/state` 返回都不会写回页面。
- README 和继续开发文档同步说明连续打开多个仓库时只保留最后一次打开结果。

### Testing
- 修复前用前端函数 harness 先调用 `openRepo("slow-repo")` 再调用 `openRepo("fast-repo")`，模拟 `slow-repo` 的 `/api/open` 慢返回；最终仓库路径、选中引用和提交都被旧的 `slow-repo` 覆盖。
- 修复后复跑同一 harness，最终保持 `fast-repo`、`fast-repo-main` 和 `fast-repo-head`，没有保存、提示或恢复 `slow-repo`。
- 另验证旧请求卡在二次 `/api/state` 阶段的情况：`slow-repo` 的 `/api/open` 先返回但 `/api/state` 慢返回，随后 `fast-repo` 完成打开；最终仍保持 `fast-repo`，旧的 `slow-repo` 状态不会覆盖。

### Notes
- `public/js/core.js`：新增打开仓库请求序号。
- `public/js/features/repositories.js`：`openRepo` 和 `applyOpenedRepoData` 写回前校验请求序号，丢弃过期打开请求。
- `README.md`：补充连续打开多个仓库时只保留最后一次打开结果。
- `docs/CONTINUE.md`：记录打开仓库旧请求不会覆盖当前仓库。
- `progress.md`：追加本轮复现、修复和验证记录。
- 回滚方式：提交前仅反向删除本轮在 `public/js/core.js`、`public/js/features/repositories.js`、`README.md`、`docs/CONTINUE.md` 和本日志块中的新增内容；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复克隆和初始化自动打开乱序覆盖
### What was done
- 复现克隆或初始化选择“完成后打开”时，如果用户在操作完成前又手动打开其他仓库，较慢返回的旧自动打开会覆盖当前仓库。
- 克隆和初始化现在复用打开仓库请求序号；只有仍是最后一次打开意图时，才把返回的仓库状态写回页面。
- README 和继续开发文档同步说明克隆/初始化旧自动打开不会覆盖后来手动打开的仓库。

### Testing
- 克隆自动打开 harness：先提交克隆并模拟慢返回，再手动打开 `fast-repo`；修复后最终保持 `fast-repo`、`fast-repo-main` 和 `fast-repo-head`，旧的 `clone-repo` 没有覆盖当前页面。
- 初始化自动打开 harness：先提交初始化并模拟慢返回，再手动打开 `fast-repo`；修复后最终保持 `fast-repo`、`fast-repo-main` 和 `fast-repo-head`，旧的 `init-repo` 没有覆盖当前页面。

### Notes
- `public/js/features/repositories.js`：克隆和初始化自动打开写回前校验打开仓库请求序号，过期结果不再保存最近仓库或改写路径输入框。
- `README.md`：补充克隆/初始化自动打开不会覆盖后来手动打开的仓库。
- `docs/CONTINUE.md`：记录克隆/初始化期间手动打开其他仓库时的旧自动打开丢弃行为。
- `progress.md`：追加本轮复现、修复和验证记录。
- 回滚方式：提交前仅反向删除本轮在 `public/js/features/repositories.js`、`README.md`、`docs/CONTINUE.md` 和本日志块中的新增内容；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复切换仓库时旧工作区刷新覆盖新仓库
### What was done
- 复现工作区刷新请求仍在等待时，用户打开另一个仓库，旧 `/api/worktree` 返回会把新仓库的变更文件列表覆盖成旧仓库结果。
- 工作区刷新现在记录请求发起时的仓库路径；返回或报错时如果当前仓库路径已经变化，就丢弃旧结果和旧错误。
- README 和继续开发文档同步说明切换仓库期间旧工作区自动刷新不会覆盖新仓库变更列表。

### Testing
- 修复前用前端函数 harness 模拟 `old-repo` 发起 `refreshWorktree(true)`，随后当前状态切到 `new-repo`；旧请求返回 `old-after.txt` 后，最终 `new-repo` 的 `workingFiles` 被覆盖成 `old-after.txt`。
- 修复后复跑同一 harness，最终仍保持 `new-repo` 和 `new-before.txt`，旧请求没有触发 `renderWorkingFiles` 或 `renderStage`。
- 旧请求报错路径也用 harness 验证：仓库已切到 `new-repo` 后，旧错误不会弹出 toast。

### Notes
- `public/js/features/diff-workbench.js`：工作区刷新写回和错误提示前校验当前仓库路径，丢弃旧仓库响应。
- `README.md`：补充切换仓库期间旧工作区自动刷新不会覆盖新仓库变更列表。
- `docs/CONTINUE.md`：记录旧工作区刷新响应的丢弃行为。
- `progress.md`：追加本轮复现、修复和验证记录。
- 回滚方式：提交前仅反向删除本轮在 `public/js/features/diff-workbench.js`、`README.md`、`docs/CONTINUE.md` 和本日志块中的新增内容；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复切换仓库时旧文件动作刷新覆盖新仓库
### What was done
- 复现单文件暂存/取消暂存/丢弃等工作区文件动作完成后，如果用户已经打开另一个仓库，旧动作随后读取的 `/api/worktree` 会覆盖新仓库的变更文件列表。
- 文件动作现在记录发起时的仓库路径；动作结果、错误提示和工作区刷新写回前都会确认仍在同一仓库。
- 批量文件动作在仓库切走后会停止后续文件循环，避免继续使用旧文件列表对当前仓库发动作。

### Testing
- 修复前用前端函数 harness 模拟 `old-repo` 执行 `runSingleFileAction("stageFile", "a.txt")`，随后当前状态切到 `new-repo`；旧 `/api/worktree` 返回 `old-after.txt` 后，最终 `new-repo` 的 `workingFiles` 被覆盖成 `old-after.txt`。
- 修复后复跑同一 harness，最终仍保持 `new-repo` 和 `new-before.txt`，旧刷新没有触发 `syncFileSelectionAfterAction`、`renderWorkingFiles` 或 `renderStage`。
- 旧动作在切仓库后才返回的 harness 中，不会弹出旧仓库的完成提示。
- 批量动作 harness 中，第一项动作返回后仓库切到 `new-repo`，后续旧文件动作停止执行，最终只发送 1 次文件动作请求，按钮恢复可用。

### Notes
- `public/js/features/git-actions.js`：工作区文件动作发起时记录仓库路径，并在动作结果、错误提示、批量循环和 `/api/worktree` 写回前校验当前仓库仍一致。
- `README.md`：补充旧文件动作刷新不会覆盖新仓库变更列表。
- `docs/CONTINUE.md`：记录旧文件动作刷新响应的丢弃行为。
- `progress.md`：追加本轮复现、修复和验证记录。
- 回滚方式：提交前仅反向删除本轮在 `public/js/features/git-actions.js`、`README.md`、`docs/CONTINUE.md` 和本日志块中的新增内容；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复切换仓库时旧储藏动作覆盖新仓库
### What was done
- 复现储藏应用/弹出/删除动作完成后，如果用户已经打开另一个仓库，旧动作随后读取的 `/api/state` 会把页面切回旧仓库状态。
- 储藏动作现在记录发起时的仓库路径；动作结果、错误提示和状态写回前都会确认仍在同一仓库。
- 从储藏创建分支也加上同样保护，旧 `result.state` 不会覆盖新仓库页面。

### Testing
- 修复前用前端函数 harness 模拟 `old-repo` 执行 `runStashAction("apply", "stash@{0}")`，随后当前状态切到 `new-repo`；旧 `/api/state` 返回后，最终页面仓库变回 `old-repo`，储藏列表变成 `old-stash`。
- 修复后复跑同一 harness，最终仍保持 `new-repo`、`new-main` 和 `new-stash`，旧状态没有触发 `renderAll`。
- 旧储藏动作在切仓库后才返回的 harness 中，不会弹出旧仓库的完成提示。
- 从储藏创建分支 harness 中，旧 `result.state` 返回后仍保持 `new-repo` 和 `new-main`，不会写回旧仓库的分支和储藏列表。

### Notes
- `public/js/core.js`：新增仓库路径快照和当前仓库校验 helper，供多个前端模块复用。
- `public/js/features/git-actions.js`：改用共享仓库路径校验 helper，保留上一轮文件动作防护。
- `public/js/panels/sync.js`：储藏动作和从储藏创建分支写回前校验当前仓库路径。
- `README.md`：补充旧储藏动作刷新不会覆盖新仓库页面。
- `docs/CONTINUE.md`：记录旧储藏动作刷新响应的丢弃行为。
- `progress.md`：追加本轮复现、修复和验证记录。
- 回滚方式：提交前仅反向删除本轮在 `public/js/core.js`、`public/js/features/git-actions.js`、`public/js/panels/sync.js`、`README.md`、`docs/CONTINUE.md` 和本日志块中的新增内容；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复切换仓库时旧同步和远端动作覆盖新仓库
### What was done
- 复现同步动作执行后，如果用户已经打开另一个仓库，旧动作随后读取的 `/api/state` 会把页面切回旧仓库状态。
- 同步、提交、冲突继续/中止、upstream 和远端管理动作现在都会记录发起时的仓库路径；动作结果、错误提示和状态写回前都会确认仍在同一仓库。
- 远端测试成功或失败返回时也会校验当前仓库，旧仓库的 `remoteCheck` 不会污染新仓库同步页。

### Testing
- 修复前用前端函数 harness 模拟 `old-repo` 执行 `runAction("fetch")`，随后当前状态切到 `new-repo`；旧 `/api/state` 返回后，最终页面仓库变回 `old-repo`，选中引用和提交也变回旧仓库。
- 修复后复跑同一 harness，最终仍保持 `new-repo`、`new-main` 和 `new-head`，旧状态没有触发 `renderAll`、`loadCommit` 或 `renderInspector`。
- 旧同步动作在切仓库后才返回的 harness 中，不会弹出旧仓库的完成提示。
- 远端测试 harness 中，旧 `testRemote` 结果在切到 `new-repo` 后返回时，`state.remoteCheck` 仍保持 `null`，不会显示旧仓库诊断结果。
- upstream 状态刷新 harness 中，旧状态返回后仍保持 `new` 仓库和原右侧页签，不会切到旧仓库同步页。

### Notes
- `public/js/features/git-actions.js`：同步/提交、冲突继续/中止、upstream 和远端动作写回前校验当前仓库路径，远端测试结果也不再跨仓库写 `remoteCheck`。
- `README.md`：补充旧同步/远端动作刷新不会覆盖新仓库页面。
- `docs/CONTINUE.md`：记录旧同步/远端动作刷新响应的丢弃行为。
- `progress.md`：追加本轮复现、修复和验证记录。
- 回滚方式：提交前仅反向删除本轮在 `public/js/features/git-actions.js`、`README.md`、`docs/CONTINUE.md` 和本日志块中的新增内容；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 阻止 Git 操作运行中切换仓库导致命令落到错误仓库
### What was done
- 复现后端使用全局 `currentRepo` 时，同一个动作前半段在旧仓库执行，用户切换仓库后，动作后半段会使用新的 `currentRepo`，存在把写入命令执行到错误仓库的致命风险。
- 后端现在在有 Git 动作运行时拒绝 `/api/open` 切换仓库；正在切换仓库时也拒绝新的 Git 动作。
- 会切换仓库的动作（打开工作树、克隆后打开、初始化后打开）不能和其他动作并发，避免中途改写全局仓库上下文。

### Testing
- 修复前用后端时序 harness 模拟 `currentRepo = repo-A` 的动作先执行 `first`，随后 `currentRepo` 切到 `repo-B`，动作后半段 `dangerous-write` 实际记录为 `repo-B:dangerous-write`。
- 修复后用锁行为 harness 验证：有操作运行时切仓库会被拒绝；切仓库进行中启动新动作会被拒绝；会切仓库的动作与其他动作并发会被拒绝；已有切仓库动作时启动普通动作会被拒绝。
- 会切仓库动作识别 harness 验证：`cloneRepository` / `initRepository` 默认会切仓库，`openAfter:false` 时不标记为切仓库，`openWorktree` 会切仓库，`fetch` 不会切仓库。
- `node --check server.js`、`node --check public/js/core.js`、`node --check public/js/features/git-actions.js`、`node --check public/js/panels/sync.js` 均通过。

### Notes
- `server.js`：新增仓库切换锁和动作并发校验，阻止运行中 Git 动作与仓库切换交叉执行。
- `README.md`：说明有 Git 操作运行时会暂时阻止切换仓库。
- `docs/CONTINUE.md`：记录后端仓库切换锁行为。
- `progress.md`：追加本轮复现、修复和验证记录。
- 回滚方式：提交前仅反向删除本轮在 `server.js`、`README.md`、`docs/CONTINUE.md` 和本日志块中的新增内容；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复切换仓库时旧历史和 reset 动作刷新覆盖新仓库
### What was done
- 复现 reset、历史编辑、挑选和还原等高风险动作完成后，如果用户已经打开另一个仓库，旧动作随后读取的 `/api/state` 会把页面切回旧仓库状态。
- 历史编辑队列、单条历史编辑、cherry-pick、revert 和 reset 现在都会记录发起时的仓库路径；动作结果、错误提示和状态刷新写回前都会确认仍在同一仓库。
- 统一的历史动作刷新逻辑在加载提交详情后也会再次校验仓库路径，避免旧提交详情刷新新仓库右侧栏。

### Testing
- 修复前用前端函数 harness 模拟旧历史动作 `reloadAfterHistoryAction()` 发出 `/api/state`，随后当前状态切到 `new` 仓库；旧状态返回后，最终页面仓库变回 `old`，选中引用和提交也变回旧仓库。
- 修复后复跑同一 harness，最终仍保持 `new`、`new` 引用和 `new-head`，没有触发旧仓库 `renderAll`。
- reset 动作结果在切仓库后才返回的 harness 中，不会弹出旧仓库的 reset 完成提示。
- `node --check public/js/features/commit-actions.js`、`node --check public/js/core.js`、`node --check server.js` 均通过。

### Notes
- `public/js/features/commit-actions.js`：高风险历史/reset 类动作和统一刷新逻辑写回前校验当前仓库路径。
- `README.md`：补充旧历史/reset 动作刷新不会覆盖新仓库页面。
- `docs/CONTINUE.md`：记录旧历史/reset 动作刷新响应的丢弃行为。
- `progress.md`：追加本轮复现、修复和验证记录。
- 回滚方式：提交前仅反向删除本轮在 `public/js/features/commit-actions.js`、`README.md`、`docs/CONTINUE.md` 和本日志块中的新增内容；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复切换仓库时旧恢复点和引用日志动作刷新覆盖新仓库
### What was done
- 复现恢复点恢复、引用日志恢复等高风险动作完成后，如果用户已经打开另一个仓库，旧动作随后读取的 `/api/state` 会把页面切回旧仓库状态。
- 恢复点清理、批量删除、单个删除、恢复点恢复、引用日志创建恢复点和引用日志恢复现在都会记录发起时的仓库路径；动作结果、错误提示和状态刷新写回前都会确认仍在同一仓库。
- 操作日志页刷新也增加仓库路径校验，避免同名分支下旧仓库日志刷新覆盖新仓库右侧栏。

### Testing
- 修复前用前端函数 harness 模拟旧恢复点动作发出 `/api/state`，随后当前状态切到 `new` 仓库；旧状态返回后，最终页面仓库变回 `old`，选中引用和提交也变回旧仓库。
- 修复后复跑同一 harness，最终仍保持 `new`、`new` 引用和 `new-head`；旧状态没有触发新页面渲染。
- 引用日志恢复 harness 中，旧 `restoreReflogEntry` 结果在切到 `new` 后返回时，没有触发旧仓库渲染。
- 旧恢复点动作在切仓库后才返回的 harness 中，不会弹出旧仓库的恢复完成提示。
- `node --check public/js/panels/recovery-settings.js`、`node --check public/js/features/commit-actions.js`、`node --check public/js/core.js` 均通过。

### Notes
- `public/js/panels/recovery-settings.js`：恢复点和引用日志类动作写回前校验当前仓库路径。
- `README.md`：补充旧恢复点动作刷新不会覆盖新仓库页面。
- `docs/CONTINUE.md`：记录旧恢复点/引用日志动作刷新响应的丢弃行为。
- `progress.md`：追加本轮复现、修复和验证记录。
- 回滚方式：提交前仅反向删除本轮在 `public/js/panels/recovery-settings.js`、`README.md`、`docs/CONTINUE.md` 和本日志块中的新增内容；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复切换仓库时旧分支、Tag、worktree、子模块和补丁动作覆盖新仓库
### What was done
- 复现分支切换动作完成后，如果用户已经打开另一个仓库，旧动作随后读取的 `/api/state` 会把页面切回旧仓库状态。
- 分支切换、远端分支签出、合并、变基、创建储藏、恢复签出储藏和修改提交信息现在会记录发起时的仓库路径；动作结果、错误提示、提交详情加载和状态写回前都会确认仍在同一仓库。
- 本地/远端分支删除、批量删除已合并分支、创建/重命名分支、清理 worktree、创建 worktree、子模块操作、Tag 推送/删除和应用补丁也加上同样保护。
- 右侧分支整理、工作树和子模块刷新现在同时校验仓库路径和选中引用，避免同名分支下旧仓库刷新覆盖新仓库页面。

### Testing
- 修复前用前端函数 harness 模拟 `old-repo` 执行 `checkoutBranch("feature")`，随后当前状态切到 `repo-B`；旧 `/api/state` 返回后，最终页面仓库变回 `repo-A/feature`。
- 修复后复跑同一 harness，最终仍保持 `repo-B/dev`，旧状态没有覆盖 `state.data`、`selectedRef` 或 `selectedSha`。
- 另用同类 harness 验证 `deleteBranch("feature")` 和 `runTagAction("deleteRemote", "v1")`，旧动作返回后仍保持 `repo-B/dev`，Tag 选择保持新仓库的 `v2`。
- `node --check public/js/core.js`、`node --check public/js/features/git-actions.js`、`node --check public/js/features/branches.js`、`node --check public/js/panels/workspaces.js`、`node --check public/js/panels/recovery-settings.js` 和 `node --check public/js/features/repositories.js` 均通过；`git diff --check` 通过；`D:\桌面\GitTest` 保持 `123` 分支且工作区干净。

### Notes
- `public/js/core.js`：新增按仓库路径加载状态和渲染选中提交的共享 helper。
- `public/js/features/git-actions.js`：为分支切换、合并/变基、储藏恢复、创建储藏、提交信息填充和修改提交信息加仓库路径校验。
- `public/js/features/branches.js`：为分支创建、重命名、本地/远端删除和清理失效 worktree 记录加仓库路径校验。
- `public/js/panels/workspaces.js`：为分支整理刷新、批量删分支、worktree 和子模块动作加仓库路径校验。
- `public/js/panels/recovery-settings.js`：为 Tag 推送/删除动作加仓库路径校验。
- `public/js/features/repositories.js`：为应用补丁后的状态刷新加仓库路径校验。
- `README.md`：补充切换仓库期间旧分支/Tag/worktree/子模块/补丁动作不会覆盖新仓库页面。
- `docs/CONTINUE.md`：记录本轮旧仓库响应丢弃范围。
- `progress.md`：追加本轮复现、修复和验证记录。
- 回滚方式：提交前仅反向删除本轮在上述文件和本日志块中的新增内容；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复切换仓库时旧创建弹窗和右键菜单上下文残留
### What was done
- 复现创建 Tag 动作完成后，如果用户已经打开另一个仓库，旧动作的状态刷新会把页面拉回旧仓库，甚至出现旧仓库路径搭配新仓库提交 SHA 的错位状态。
- 复现打开新仓库后，旧仓库分支创建弹窗、Tag 创建弹窗保存的旧提交 SHA 和旧分支名仍留在状态里，用户继续提交时可能把旧目标带到新仓库。
- 创建 Tag 现在使用仓库路径快照，旧动作返回、旧错误和旧状态刷新不会覆盖新仓库页面。
- 打开新仓库时会清空分支创建/重命名、Tag 创建、merge 提交主线选择弹窗，以及提交、分支、文件、Tag、远端和 reflog 右键菜单上下文。

### Testing
- 修复前用前端函数 harness 模拟 `repo-A` 执行 `createTagFromForm()`，随后当前状态切到 `repo-B`；旧 `/api/state` 返回后，页面仓库变回 `repo-A`，但 `selectedSha` 保留 `repo-B` 的 `new-b`。
- 修复后复跑同一 harness，最终保持 `repo-B/dev`，`selectedTag` 没有被旧 Tag 写入。
- 打开仓库状态清理 harness 验证：`tagTargetSha`、`branchStartSha`、`branchRenameOld`、`mainlineAction`、`mainlineCommitSha` 和全部右键菜单上下文都会清空，分支/Tag/mainline 弹窗和右键菜单会关闭。
- `node --check public/js/features/commit-actions.js`、`node --check public/js/features/repositories.js` 和 `node --check public/js/features/branches.js` 均通过。

### Notes
- `public/js/features/commit-actions.js`：创建 Tag 后刷新状态前校验当前仓库路径。
- `public/js/features/repositories.js`：打开新仓库时清空旧仓库弹窗状态和右键菜单上下文。
- `public/js/features/branches.js`：关闭分支弹窗时同步清空分支弹窗状态。
- `README.md`：补充打开新仓库会清空旧仓库弹窗和右键菜单上下文。
- `docs/CONTINUE.md`：记录切仓库时旧上下文清理行为。
- `progress.md`：追加本轮复现、修复和验证记录。
- 回滚方式：提交前仅反向删除本轮在上述文件和本日志块中的新增内容；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复切换仓库时后端状态读取混入两个仓库
### What was done
- 复现 `/api/state` 读取过程中如果用户切到另一个仓库，后端前半段 Git 输出来自旧仓库，后半段仓库路径、同步状态和子模块补充信息可能来自新仓库。
- 全量状态、轻量引用状态和工作区状态读取现在会在请求开始时保存仓库路径，后续 Git 命令、远端校验、引用日志、子模块补充和同步详情都使用同一个路径。
- 远端分支、远端详情、reflog、子模块和同步状态等读取 helper 增加仓库路径参数，避免内部再次读取已变化的全局仓库路径。

### Testing
- 最小后端模型复现旧行为：请求从 `repo-A` 开始后切到 `repo-B`，旧结果会返回 `repo.path = repo-B`，但分支输出仍是 `repo-A:branches`。
- 修复后复跑同一模型，结果保持 `repo.path = repo-A`、分支输出为 `repo-A:branches`、同步状态也来自 `repo-A`。
- `node --check server.js` 通过。

### Notes
- `server.js`：状态读取链路改为使用请求发起时的仓库路径快照。
- `README.md`：补充后端状态读取不会混入两个仓库的数据。
- `docs/CONTINUE.md`：记录后端状态读取的仓库快照行为。
- `progress.md`：追加本轮复现、修复和验证记录。
- 回滚方式：提交前反向删除本轮 `server.js`、`README.md`、`docs/CONTINUE.md` 和本日志块的改动；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复切换仓库时旧提交详情、文件历史、逐行追踪和比较结果覆盖新仓库
### What was done
- 复现比较、文件历史和提交详情请求发出后，如果用户先切到另一个仓库，旧仓库请求返回时仍会写入新仓库页面。
- 比较页、文件历史、逐行追踪和提交详情加载现在会记录请求发起时的仓库路径；返回或报错时如果当前仓库已经变化，就丢弃旧结果。
- 打开新仓库时同步清空还在加载中的提交详情标记，避免旧仓库的提交详情请求阻塞新仓库同 SHA 的详情加载。
- 后端提交详情、补丁导出、文件历史、逐行追踪和比较接口也改为使用请求发起时的仓库路径快照，避免同一次响应混入两个仓库的数据。

### Testing
- 前端竞态 harness 复现旧行为：`openCompareBranch()` 发起于 `repo-A` 后切到 `repo-B`，旧比较结果仍写入 `state.compare`；`openFileHistory()` 发起于旧仓库后切到 `repo-C`，旧历史提交仍写入新仓库面板。
- 修复后复跑同一 harness，旧比较、旧文件历史和旧提交详情都被丢弃，没有写入新仓库状态。
- 后端 VM harness 验证：`readCompare("main", "feature")` 发起于 `repo-A` 后把全局 `currentRepo` 改成 `repo-B`，所有 Git 调用仍只使用 `repo-A`，返回的 SHA 和文件列表也来自 `repo-A`。
- `node --check server.js`、`node --check public/js/features/commit-actions.js`、`node --check public/js/features/graph.js`、`node --check public/js/features/repositories.js` 和 `node --check public/js/panels/inspector.js` 均通过。

### Notes
- `public/js/features/commit-actions.js`：比较请求写回前校验仓库路径。
- `public/js/features/graph.js`：提交详情请求写回和错误提示前校验仓库路径。
- `public/js/features/repositories.js`：打开新仓库时清空提交详情加载标记。
- `public/js/panels/inspector.js`：文件历史和逐行追踪请求写回前校验仓库路径。
- `server.js`：提交详情、补丁、文件历史、逐行追踪和比较读取链路使用仓库路径快照。
- `README.md`：补充切换仓库期间旧历史读取不会覆盖新仓库页面。
- `docs/CONTINUE.md`：记录历史读取接口的仓库快照行为。
- `progress.md`：追加本轮复现、修复和验证记录。
- 回滚方式：提交前反向删除本轮在上述文件和本日志块中的改动；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复切换仓库时旧工作区 Diff 和储藏详情覆盖新仓库
### What was done
- 复现工作区 Diff 请求发出后，如果用户先切到另一个仓库，旧仓库 Diff 返回时仍会写入新仓库底部对照面板。
- 复现储藏详情请求发出后切换仓库，旧仓库的 `stash@{0}` 文件列表和 Diff 仍可能写入新仓库；打开新仓库时也没有清空旧储藏详情缓存。
- 工作区 Diff 和储藏详情加载现在会记录请求发起时的仓库路径，返回或报错时如果当前仓库已经变化，就丢弃旧结果。
- 打开新仓库时会清空储藏详情缓存和当前选中储藏，避免两个仓库都有同名 `stash@{0}` 时复用旧详情。
- 后端工作区 Diff 和储藏详情读取会使用请求发起时的仓库路径快照，避免一次响应混入两个仓库的数据。

### Testing
- 前端竞态 harness 复现旧行为：`loadWorkingDiff("old.txt")` 发起于 `repo-A` 后切到 `repo-B`，旧 Diff 仍写入 `activeDiff`；`loadStashDetail("stash@{0}")` 发起于 `repo-C` 后切到 `repo-D`，旧储藏文件仍写入 `stashDetails`。
- 修复后复跑同一 harness，旧工作区 Diff 和旧储藏详情都被丢弃，没有写入新仓库状态。
- 后端 VM harness 验证：`readWorkingDiff("file.txt", "unstaged")` 和 `readStash("stash@{0}")` 都在请求发起后把全局 `currentRepo` 改成 `repo-B`，所有 Git 调用仍只使用 `repo-A`。
- `node --check server.js`、`node --check public/js/features/diff-workbench.js`、`node --check public/js/features/repositories.js` 和 `node --check public/js/panels/sync.js` 均通过。

### Notes
- `public/js/features/diff-workbench.js`：工作区 Diff 请求写回和错误提示前校验仓库路径。
- `public/js/panels/sync.js`：储藏详情请求写回和错误提示前校验仓库路径。
- `public/js/features/repositories.js`：打开新仓库时清空储藏详情缓存和选中储藏。
- `server.js`：工作区 Diff、未跟踪文件虚拟 Diff 和储藏详情读取链路使用仓库路径快照。
- `README.md`：补充切换仓库期间旧工作区 Diff 和旧储藏详情不会覆盖新仓库页面。
- `docs/CONTINUE.md`：记录工作区 Diff 和储藏详情读取的仓库快照行为。
- `progress.md`：追加本轮复现、修复和验证记录。
- 回滚方式：提交前反向删除本轮在上述文件和本日志块中的改动；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复普通 Git 写操作可并发执行的问题
### What was done
- 复现后端只拦截切仓库类动作并发，普通写动作可以同时进入 `/api/action`：例如 `stageAll` 仍在运行时，`commit` 可以被允许启动。
- 后端现在只要已有 Git 操作正在运行，就拒绝新的 Git 操作；切仓库类动作仍保留“暂不能切换仓库”的明确提示，普通动作返回“暂不能执行新的 Git 操作”。
- 这个后端保护覆盖浏览器连点、多个页面同时操作和脚本直接调用，避免多个命令同时修改索引或工作区状态。

### Testing
- 修复前 VM harness：先 `beginOperation({ action: "stageAll" })`，再启动 `commit`，`ensureCanStartAction()` 返回允许，`activeOperations` 同时有 2 个操作。
- 修复后同一 harness：第二个普通写动作被拒绝，提示“当前还有 Git 操作正在执行，暂不能执行新的 Git 操作...”。
- 另用 VM harness 验证：已有普通操作时再启动 `openWorktree`，仍返回原来的“暂不能切换仓库”提示。
- `node --check server.js` 通过。

### Notes
- `server.js`：`ensureCanStartAction` 改为串行化所有 Git 操作。
- `README.md`：补充有 Git 操作运行时会阻止新的 Git 操作。
- `docs/CONTINUE.md`：记录后端操作串行化行为。
- `progress.md`：追加本轮复现、修复和验证记录。
- 回滚方式：提交前反向删除本轮在 `server.js`、`README.md`、`docs/CONTINUE.md` 和本日志块中的改动；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复切换仓库时旧历史重写预览覆盖新仓库
### What was done
- 复现历史重写单项预览和队列预览请求发出后，如果用户切到另一个仓库，旧仓库预览仍可能写入新仓库详情页。
- 历史重写单项预览和队列预览现在都会记录请求发起时的仓库路径；返回或报错时如果当前仓库已经变化，就丢弃旧结果。
- 后端历史重写单项预览和队列预览会使用请求发起时的仓库路径快照，提交解析、当前分支、未提交状态、父提交、影响范围和 merge 检查都固定在同一个仓库。

### Testing
- 旧逻辑形状 harness 复现：`historyPlan` 只校验 SHA/mode、`historyQueue` 只校验队列签名时，切到新仓库后旧预览仍写入当前状态。
- 修复后前端 harness 验证：旧单项历史重写预览和旧队列预览返回时都被丢弃，没有写入新仓库页面。
- 后端 VM harness 验证：`readHistoryRewritePreview()` 和 `readHistoryRewriteQueuePreview()` 发起于 `repo-A` 后把全局 `currentRepo` 改成 `repo-B`，所有 Git 调用仍只使用 `repo-A`。
- `node --check server.js` 和 `node --check public/js/features/commit-actions.js` 均通过。

### Notes
- `public/js/features/commit-actions.js`：历史重写单项预览和队列预览写回前校验仓库路径。
- `server.js`：历史重写预览读取链路和相关 helper 支持仓库路径快照。
- `README.md`：补充切换仓库期间旧历史重写预览不会覆盖新仓库页面。
- `docs/CONTINUE.md`：记录历史重写预览的仓库快照行为。
- `progress.md`：追加本轮复现、修复和验证记录。
- 回滚方式：提交前反向删除本轮在上述文件和本日志块中的改动；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复切换仓库时旧提交补丁复制下载结果泄漏
### What was done
- 复现提交补丁复制和下载请求发出后，如果用户切到另一个仓库，旧仓库补丁仍可能写入剪贴板或触发下载。
- 复制补丁和下载补丁现在会记录请求发起时的仓库路径；返回时如果当前仓库已经变化，就丢弃旧结果。
- 该保护避免用户在新仓库页面里误拿到旧仓库的 `.patch` 内容。

### Testing
- 旧逻辑形状 harness 复现：旧补丁请求返回时，`copyCommitPatch()` 会复制旧补丁，`downloadCommitPatch()` 会下载旧补丁。
- 修复后 Node harness 验证：切到 `repo-B` 后，`repo-A` 的旧复制和下载结果均被丢弃，输出 `{"copyDiscarded":true,"downloadDiscarded":true}`。
- `node --check server.js`、`node --check public/js/features/commit-actions.js`、`node --check public/js/features/diff-workbench.js`、`node --check public/js/features/graph.js`、`node --check public/js/features/repositories.js`、`node --check public/js/panels/inspector.js`、`node --check public/js/panels/sync.js` 均通过。
- `git diff --check` 通过，仅提示工作副本未来会按 Git 设置转为 CRLF。
- 调试标记扫描无命中。

### Notes
- `public/js/features/commit-actions.js`：补丁复制和下载写入前校验仓库路径。
- `README.md`：补充补丁复制/下载在切仓库时丢弃旧结果。
- `docs/CONTINUE.md`：记录旧提交补丁复制/下载结果不会覆盖新仓库页面。
- `progress.md`：追加本轮复现、修复和验证记录。
- 回滚方式：提交前反向删除本轮在上述文件和本日志块中的改动；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复切换仓库时旧工作区按块按行刷新泄漏
### What was done
- 复现工作区 Diff 按块操作完成后，如果后续刷新期间用户已经切到另一个仓库，旧动作仍会继续用旧文件路径读取当前新仓库 Diff。
- 工作区 Diff 的按块操作和按行操作现在会记录动作发起时的仓库路径；动作返回、刷新工作区和重新读取 Diff 后都会确认仍在同一仓库。
- 该保护避免切仓库后底部对照突然显示旧仓库文件路径的空 Diff 或错误提示，降低用户基于错误工作区状态继续操作的风险。

### Testing
- 旧逻辑最小复现 harness：`repo-A` 的块操作成功后，在刷新返回前切到 `repo-B`，旧代码继续调用 `loadWorkingDiff("old.txt")`，输出 `{"oldLoadedNewRepo":true,...}`。
- 修复后 Node harness 验证：同样切仓库时，按块和按行两条路径都不再继续读取旧文件，输出 `{"hunkDiscarded":true,"lineDiscarded":true,"hunkLoaded":[],"lineLoaded":[]}`。
- `node --check public/js/features/diff-workbench.js` 和 `node --check server.js` 均通过。
- `git diff --check` 通过，仅提示工作副本未来会按 Git 设置转为 CRLF。
- 调试标记扫描无命中。
- `git -C D:\桌面\GitTest status --short --branch` 输出 `## 123`，测试仓库未被本轮修改。

### Notes
- `public/js/features/diff-workbench.js`：工作区 Diff 按块/按行动作的后续 toast、刷新和重新读取 Diff 增加仓库路径校验。
- `README.md`：补充旧工作区按块/按行动作刷新不会覆盖新仓库页面。
- `docs/CONTINUE.md`：记录旧工作区按块/按行动作刷新会在切仓库后丢弃。
- `progress.md`：追加本轮复现、修复和验证记录。
- 回滚方式：提交前反向删除本轮在上述文件和本日志块中的改动；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复旧 API 响应污染新仓库操作日志状态
### What was done
- 复现公共 `api()` 包装器会在调用方执行仓库校验之前，先把响应中的 `operationLog` 和 `runningOperations` 写入当前页面状态。
- 公共 `api()` 现在会记录请求发起时的仓库路径；响应回来时只有当前仍是同一个仓库，才会同步操作日志和运行中操作状态。
- 该保护补上了调用方仓库校验之外的公共副作用，避免旧仓库动作响应让新仓库页面误显示旧操作或清空当前运行中状态。

### Testing
- 旧逻辑最小复现 harness：请求发起于 `repo-A`，响应前切到 `repo-B`，旧代码仍把 `old repo action` 和 `old running` 写入 `repo-B` 状态。
- 修复后 Node harness 验证：切到 `repo-B` 后旧日志/运行中状态被跳过；保持在 `repo-A` 时同类响应仍会正常更新，输出 `{"staleSkipped":true,"sameRepoApplied":true,...}`。
- `node --check public/js/api.js`、`node --check public/js/features/diff-workbench.js` 和 `node --check server.js` 均通过。

### Notes
- `public/js/api.js`：公共 API 包装器同步操作日志和运行中状态前增加仓库路径快照校验。
- `README.md`：补充旧操作日志/运行中状态刷新不会覆盖新仓库页面。
- `docs/CONTINUE.md`：记录旧操作日志/运行中状态刷新会在切仓库后丢弃。
- `progress.md`：追加本轮复现、修复和验证记录。
- 回滚方式：提交前反向删除本轮在上述文件和本日志块中的改动；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复打开工作树后旧仓库详情状态残留
### What was done
- 复现从“工作树”页打开另一个工作树后，前端只替换仓库数据和提交列表，没有清空旧仓库的文件历史、逐行追踪、储藏详情、历史编辑计划、远端诊断和右键上下文。
- 打开工作树现在复用打开仓库时的 repo-scoped 状态清理逻辑，切到新工作树前会清掉旧仓库上下文。
- 该保护避免新工作树页面继续显示旧文件历史、旧储藏 Diff 或旧历史编辑计划，降低用户基于错误上下文继续恢复、重写或复制信息的风险。

### Testing
- 旧逻辑最小复现 harness：`openWorktreePath()` 设置新 `state.data` 后，`renderAll()` 仍渲染 `old/repo/file.txt` 的文件历史，且旧储藏详情、历史编辑计划、远端诊断均残留。
- 修复后 Node harness 验证：打开工作树后旧文件历史、blame、储藏详情、历史编辑计划、远端诊断和右键上下文全部清空，输出 `{"historyCleared":true,"blameCleared":true,"stashCleared":true,"planCleared":true,"remoteCheckCleared":true,"contextCleared":true}`。
- `node --check public/js/features/repositories.js`、`node --check public/js/panels/workspaces.js`、`node --check public/js/api.js`、`node --check public/js/features/diff-workbench.js` 和 `node --check server.js` 均通过。

### Notes
- `public/js/features/repositories.js`：提取打开仓库时的 repo-scoped 状态清理函数，供其他切仓库入口复用。
- `public/js/panels/workspaces.js`：打开工作树时调用同一套 repo-scoped 状态清理逻辑。
- `README.md`：补充打开新仓库或工作树会清空旧文件历史、逐行追踪、历史编辑计划等上下文。
- `docs/CONTINUE.md`：记录打开工作树会复用新仓库清理逻辑。
- `progress.md`：追加本轮复现、修复和验证记录。
- 回滚方式：提交前反向删除本轮在上述文件和本日志块中的改动；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复打开新仓库后旧比较和最大化对照残留
### What was done
- 复现停留在“分支比较”页时打开新仓库或工作树，旧仓库的比较结果、选中文件和最大化 Diff 状态仍会在新仓库页面渲染。
- 打开新仓库或工作树时现在会清空比较结果、同步提交预览选择、提交文件选择、工作区文件选择、底部/最大化 active Diff 和多选状态。
- 该保护避免新仓库页面继续展示旧分支差异或旧文件 Diff，降低用户基于错误比较结果继续复制、查看或执行后续操作的风险。

### Testing
- 旧逻辑最小复现 harness：打开新仓库后，`renderCompareTab()` 仍用旧 `state.compare.data` 渲染 `old.txt`，`activeDiff` 也保持旧比较 Diff。
- 修复后 Node harness 验证：比较结果、activeDiff、同步预览、提交文件选择、工作区选择和多选状态全部清空，输出 `{"compareCleared":true,"activeDiffCleared":true,"syncCleared":true,"commitFileCleared":true,"worktreeSelectionCleared":true,"selectionSetsCleared":true}`。
- `node --check public/js/features/repositories.js`、`node --check public/js/panels/workspaces.js`、`node --check public/js/api.js`、`node --check public/js/features/diff-workbench.js` 和 `node --check server.js` 均通过。

### Notes
- `public/js/features/repositories.js`：打开新仓库/工作树时清空比较、同步预览、提交文件、工作区 Diff 和多选状态。
- `README.md`：补充打开新仓库或工作树会清空旧比较结果和最大化对照。
- `docs/CONTINUE.md`：记录旧比较和最大化对照会在切仓库时清理。
- `progress.md`：追加本轮复现、修复和验证记录。
- 回滚方式：提交前反向删除本轮在上述文件和本日志块中的改动；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复同步页 PR 链接目标分支推断混仓库
### What was done
- 复现同步详情读取发起于 `repo-A` 后，如果全局当前仓库切到 `repo-B`，PR/MR 链接的目标分支推断会读取 `repo-B` 的本地分支和远端名。
- PR/MR 链接生成现在把请求发起时的 `repoPath` 传入目标分支推断，远端信息、当前分支、目标分支都固定在同一个仓库快照中。
- 该保护避免同步页在快速切仓库时生成“旧仓库 URL + 新仓库目标分支”的混合 PR/MR 链接。

### Testing
- 旧逻辑最小复现 harness：请求 `repo-A` 同步详情后把 `currentRepo` 改成 `repo-B`，旧目标分支推断读取 `repo-B`，输出目标分支 `develop`。
- 修复后 Node harness 验证：同样切换全局仓库后，目标分支仍从 `repo-A` 推断为 `main`，所有分支/远端读取调用都使用 `repo-A`，输出 `{"fixed":true,"target":"main",...}`。
- `node --check server.js`、`node --check public/js/features/repositories.js`、`node --check public/js/api.js`、`node --check public/js/features/diff-workbench.js` 和 `node --check public/js/panels/workspaces.js` 均通过。

### Notes
- `server.js`：PR/MR 链接生成和目标分支推断接收并使用请求仓库路径。
- `README.md`：补充 PR/MR 目标分支推断会固定请求发起时的仓库。
- `docs/CONTINUE.md`：记录同步页 PR/MR 目标分支推断使用仓库路径快照。
- `progress.md`：追加本轮复现、修复和验证记录。
- 回滚方式：提交前反向删除本轮在上述文件和本日志块中的改动；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 阻止旧页面请求把 Git 操作执行到当前新仓库
### What was done
- 复现两个页面或旧页面上下文下，服务端全局当前仓库已经从 `repo-A` 切到 `repo-B` 后，来自 `repo-A` 的 `/api/action` 仍会按 `repo-B` 执行，`stageAll` 会把 `repo-B` 文件暂存。
- 前端 API 请求现在会携带发起请求时的真实仓库路径；服务端对仓库相关读取和写入接口校验该路径，发现请求来自旧仓库时直接返回中文错误。
- 该保护覆盖状态读取、提交详情、补丁、文件历史、逐行追踪、比较、历史重写预览、工作区、工作区 Diff、储藏详情和 `/api/action`，避免旧页面、旧弹窗或多标签页把操作打到当前新仓库。

### Testing
- 修复前临时双仓库 HTTP harness：先打开 `repo-A`，再打开 `repo-B`，随后带 `X-Forkline-Repo-Path: repo-A` 调用 `stageAll`；旧逻辑返回成功，`repo-A` 仍为 `?? a.txt`，`repo-B` 变成 `A  b.txt`，确认跨仓库误操作成立。
- 修复后同一 harness：旧仓库请求返回 `400` 和中文“页面仓库已经切换”提示，`repo-A` 保持 `?? a.txt`，`repo-B` 保持 `?? b.txt`，输出 `fixed: true`。
- 正向临时仓库 harness：打开单个仓库后带匹配的 `X-Forkline-Repo-Path` 调用 `stageAll`，返回 `200`，文件正常进入暂存区，输出 `passed: true`。
- `node --check server.js` 和 `node --check public/js/api.js` 均通过。

### Notes
- `public/js/api.js`：真实仓库模式下为 API 请求附带 `X-Forkline-Repo-Path` 仓库上下文。
- `server.js`：仓库相关接口执行前校验请求仓库和服务端当前仓库一致，不一致时拒绝读取或执行。
- `README.md`：补充仓库相关 API 会携带并校验请求发起时的仓库路径。
- `docs/CONTINUE.md`：记录旧页面/多页面请求会被服务端拦截，避免操作落到当前新仓库。
- `progress.md`：追加本轮复现、修复和验证记录。
- 回滚方式：提交前反向删除本轮在上述文件和本日志块中的改动；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 阻止缺少仓库上下文的写操作落到当前仓库
### What was done
- 复现旧脚本或手工请求完全不带 `X-Forkline-Repo-Path` 时，服务端仍会按全局当前仓库执行 `/api/action`，导致来自旧页面语义的 `stageAll` 把当前新仓库文件暂存。
- `/api/action` 现在要求真实仓库已打开时必须带仓库上下文；缺少上下文会在创建操作日志前直接返回中文错误，不再执行任何 Git 写操作。
- 保留 `/api/state` 首次无上下文读取能力，避免刷新页面时无法恢复当前仓库视图。

### Testing
- 修复前临时双仓库 HTTP harness：先打开 `repo-A`，再打开 `repo-B`，随后不带仓库头调用 `stageAll`；旧逻辑返回 `200`，`repo-A` 为 `?? a.txt`，`repo-B` 变成 `A  b.txt`，确认无头写操作会落到当前仓库。
- 修复后同一 harness：不带仓库头的 `stageAll` 返回 `400` 和中文“页面缺少仓库上下文”提示，`repo-A` 保持 `?? a.txt`，`repo-B` 保持 `?? b.txt`，输出 `fixed: true`。
- 不匹配仓库头复测仍返回 `400`，匹配仓库头的 `stageAll` 返回 `200` 且文件正常进入暂存区。
- `node --check server.js` 和 `node --check public/js/api.js` 均通过。

### Notes
- `server.js`：为仓库上下文校验增加“写操作必须提供仓库路径”的模式，并在 `/api/action` 创建操作记录前拦截缺失或不匹配的上下文。
- `README.md`：补充写操作缺少仓库上下文时会拒绝执行。
- `docs/CONTINUE.md`：记录旧脚本/无上下文写操作会被服务端拦截。
- `progress.md`：追加本轮复现、修复和验证记录。
- 回滚方式：提交前反向删除本轮在上述文件和本日志块中的改动；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 阻止后端删除主干保护分支
### What was done
- 复现 UI/文档标记 `main` / `master` / `develop` / `dev` / `trunk` 为主干保护分支，但后端 `deleteBranch` 只拦当前分支，直接 API 调用仍可删除非当前的 `main`。
- 后端删除本地分支现在统一检查当前分支和主干保护分支；单个删除和批量删除都会拒绝这些保护分支。
- 批量删除仍允许删除普通已合并分支，并把被保护的主干分支列入失败原因，不会中断其他安全删除。

### Testing
- 修复前临时仓库 HTTP harness：创建 `main` 和当前 `topic`，直接调用 `deleteBranch main` 返回 `200`，`main` 从本地分支列表消失，输出 `bug: true`。
- 修复后同一 harness：`deleteBranch main` 返回 `400` 和中文“主干/长期分支，Forkline 默认保护”提示，`main` 和 `topic` 都保留，输出 `fixed: true`。
- 批量删除复测：`deleteBranches ["main","cleanup"]` 返回 `200`，普通分支 `cleanup` 被删除，`main` 保留并显示被保护原因，输出 `passed: true`。
- `node --check server.js` 和 `node --check public/js/api.js` 均通过。

### Notes
- `server.js`：本地分支删除入口增加后端主干保护分支兜底，覆盖单删和批量删除。
- `README.md`：补充分支删除保护由后端拒绝主干分支删除。
- `docs/CONTINUE.md`：记录后端会拒绝删除当前分支和主干保护分支。
- `progress.md`：追加本轮复现、修复和验证记录。
- 回滚方式：提交前反向删除本轮在上述文件和本日志块中的改动；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 阻止后端删除远端主干保护分支
### What was done
- 复现远端分支删除接口只确认 tracking 引用存在，直接 API 调用 `deleteRemoteBranch origin/main` 会执行 `git push origin --delete main`，导致远端主干分支被删除。
- 后端删除远端分支时现在会先用真实远端名解析远端引用，再按解析后的分支名拦截 `main` / `master` / `develop` / `development` / `dev` / `trunk` 这类主干/长期分支。
- 普通远端分支删除路径保持不变，仍会删除成功后执行 `fetch --prune`。

### Testing
- 修复前临时仓库 HTTP harness：调用 `deleteRemoteBranch origin/main` 返回 `200`，裸远端只剩 `cleanup`，输出 `mainDeleted: true`。
- 修复后同一 harness：调用 `deleteRemoteBranch origin/main` 返回 `400` 和中文“远端分支 origin/main 是主干/长期分支”提示，远端保留 `cleanup,main`；随后调用 `deleteRemoteBranch origin/cleanup` 返回 `200`，远端只剩 `main`。
- 带斜杠远端名回归：远端名 `team/origin` 时，`deleteRemoteBranch team/origin/main` 返回 `400` 并保留 `main`，`deleteRemoteBranch team/origin/cleanup` 返回 `200` 并删除普通分支。

### Notes
- `server.js`：远端分支删除入口增加后端主干保护分支兜底，并复用统一的保护分支名判断。
- `README.md`：补充远端主干/长期分支删除会被后端拒绝。
- `docs/CONTINUE.md`：记录远端分支删除的后端保护范围。
- `progress.md`：追加本轮复现、修复和验证记录。
- 回滚方式：提交前反向删除本轮在上述文件和本日志块中的改动；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 阻止安全强推改写远端主干保护分支
### What was done
- 复现普通本地分支设置 upstream 到 `origin/main` 后，直接调用 `forcePushLease` 会执行 `git push --force-with-lease origin HEAD:main`，把远端 `main` 改写成普通分支提交。
- 后端安全强推现在会解析当前 upstream 的真实远端分支名，并拒绝推送到 `main` / `master` / `develop` / `development` / `dev` / `trunk` 这类主干/长期分支。
- 普通非保护远端分支的 `--force-with-lease` 路径保持可用。

### Testing
- 修复前临时仓库 HTTP harness：`setUpstream origin/main` 返回 `200`，随后 `forcePushLease` 返回 `200`，远端 `main` 从 `7ee68ef` 被改写为普通分支孤立提交 `2d82f23`，输出 `mainOverwritten: true`。
- 修复后同一 harness：`setUpstream origin/main` 返回 `200`，`forcePushLease` 返回 `400` 和中文“远端分支 origin/main 是主干/长期分支”提示，远端 `main` 保持原提交，输出 `mainKept: true`。
- 普通分支回归：当前分支跟踪 `origin/topic` 时，`forcePushLease` 返回 `200`，远端 `topic` 更新到本地改写后的提交。
- 带斜杠远端名回归：远端名 `team/origin` 时，`team/origin/main` 被 `400` 拦截，远端 `main` 保持原提交。

### Notes
- `server.js`：安全强推入口增加后端主干保护分支兜底，复用统一的保护分支名判断。
- `README.md`：补充安全强推不会打到远端主干/长期分支。
- `docs/CONTINUE.md`：记录安全强推的后端保护范围。
- `progress.md`：追加本轮复现、修复和验证记录。
- 回滚方式：提交前反向删除本轮在上述文件和本日志块中的改动；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 阻止普通推送把普通分支推到远端主干
### What was done
- 复现仓库配置 `push.default=upstream` 时，普通本地分支 `feature` 跟踪 `origin/main` 后，直接调用 `push` 会执行裸 `git push` 并把远端 `main` 快进到 `feature` 提交。
- 后端普通推送现在会解析当前 upstream 的真实远端分支名；如果 upstream 是主干/长期分支且当前分支名不一致，会返回中文保护提示，不执行 `git push`。
- 当前分支名和远端主干分支名一致时仍允许普通推送；普通非保护分支也不受影响。

### Testing
- 修复前临时仓库 HTTP harness：配置 `push.default=upstream`，`feature` 跟踪 `origin/main` 后调用 `push` 返回 `200`，远端 `main` 从 `817c67e` 更新到 `feature` 提交 `e405367`，输出 `mainUpdatedByFeature: true`。
- 修复后同一 harness：`feature` 跟踪 `origin/main` 后调用 `push` 返回 `400` 和中文“当前分支 feature 的 upstream 是远端主干/长期分支 origin/main”提示，远端 `main` 保持原提交，输出 `mainKept: true`。
- 普通分支回归：`topic` 跟踪 `origin/topic` 且本地领先时，调用 `push` 返回 `200`，远端 `topic` 更新到本地提交。
- 主干同名回归：`main` 跟踪 `origin/main` 且本地领先时，调用 `push` 返回 `200`，远端 `main` 正常更新。
- 带斜杠远端名回归：远端名 `team/origin` 时，`feature` 跟踪 `team/origin/main` 调用 `push` 返回 `400`，远端 `main` 保持原提交。

### Notes
- `server.js`：普通 push 在执行裸 `git push` 前增加 upstream 主干保护，防止分支名不一致时推到远端主干。
- `README.md`：补充普通推送会拦截普通分支推到远端主干。
- `docs/CONTINUE.md`：记录普通推送保护新增的 upstream 主干分支名一致性检查。
- `progress.md`：追加本轮复现、修复和验证记录。
- 回滚方式：提交前反向删除本轮在上述文件和本日志块中的改动；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 阻止重命名本地主干保护分支
### What was done
- 复现后端已拒绝删除 `main` 等主干保护分支，但 `renameBranch main -> renamed-main` 仍会成功，等价于绕过删除保护让本地 `main` 消失。
- 后端重命名本地分支时现在会拒绝把 `main` / `master` / `develop` / `development` / `dev` / `trunk` 这类主干/长期分支作为源分支重命名。
- 普通本地分支重命名路径保持可用。

### Testing
- 修复前临时仓库 HTTP harness：当前在 `main`，调用 `renameBranch main -> renamed-main` 返回 `200`，分支列表只剩 `renamed-main`，输出 `mainRemoved: true`。
- 修复后同一 harness：调用 `renameBranch main -> renamed-main` 返回 `400` 和中文“主干/长期分支，Forkline 默认保护”提示，分支列表仍为 `main`，输出 `mainKept: true`。
- 普通分支回归：当前在 `topic`，调用 `renameBranch topic -> renamed-topic` 返回 `200`，分支列表只剩 `renamed-topic`。

### Notes
- `server.js`：本地分支重命名入口增加主干保护分支兜底。
- `README.md`：补充分支整理保护会拒绝重命名主干分支。
- `docs/CONTINUE.md`：记录后端拒绝删除/重命名主干保护分支。
- `progress.md`：追加本轮复现、修复和验证记录。
- 回滚方式：提交前反向删除本轮在上述文件和本日志块中的改动；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 阻止 text/plain POST 触发本地写操作
### What was done
- 复现本地服务会把 `Content-Type: text/plain` 的 JSON 字符串照常解析并执行；在无当前仓库状态下，直接 POST `initRepository` 会创建目标目录和 `.git`。
- 服务端统一 JSON 读取入口现在只接受 `application/json`，拒绝 `text/plain` 等简单请求，避免外部网页用 no-cors 简单 POST 绕过前端确认触发克隆、初始化或 Git 写操作。
- 正常前端 `application/json` 请求保持可用。

### Testing
- 修复前临时服务 HTTP harness：用 `Content-Type: text/plain;charset=UTF-8` POST `{"action":"initRepository","targetPath":"C:\\tmp\\forkline-text-plain-init-*","openAfter":false}`，返回 `200`，目标目录下 `.git` 被创建，输出 `gitCreated: true`。
- 修复后同一 text/plain harness：返回 `400` 和中文“请求内容类型不合法”提示，目标目录未创建 `.git`，输出 `gitCreated: false`。
- 正常 JSON 回归：用 `Content-Type: application/json` 调用同一 `initRepository` 返回 `200`，目标目录正常创建 `.git`。

### Notes
- `server.js`：`readJson` 增加 `application/json` 内容类型校验，覆盖 `/api/open`、`/api/action` 和历史队列预览等 POST JSON 入口。
- `README.md`：补充本地 API POST 只接受 JSON 请求。
- `docs/CONTINUE.md`：记录本地 API 内容类型边界。
- `progress.md`：追加本轮复现、修复和验证记录。
- 回滚方式：提交前反向删除本轮在上述文件和本日志块中的改动；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 阻止自动签出储藏恢复到错误分支
### What was done
- 复现“储藏并签出”生成的自动 stash 可被旧弹窗或直接 API 在错误当前分支上恢复：请求声称恢复 `main` 的 stash，但当前仍在 `dev` 时，后端仍会执行 `git stash pop`，导致 `main` 的改动进入 `dev`，原 stash 从列表消失。
- 后端恢复自动签出 stash 前现在会确认当前分支仍等于请求里的所属分支；如果用户已经切到其他分支，会返回中文提示要求先切回原分支。
- 自动签出 stash 查找改为按 `On <分支>:` 前缀和完整消息精确匹配，不再只用 `subject.includes(message)` 命中近似消息或其他分支的 stash。

### Testing
- 修复前临时仓库 HTTP harness：在 `main` 创建 `Forkline: checkout dev ...` stash 后切到 `dev`，调用 `restoreCheckoutStash` 并传 `branch = main` 返回 `200`；当前分支仍为 `dev`，`stash list` 变空，`dev` 工作区出现 `main stash change`。
- 修复后同一错误分支 harness：返回 `400` 和中文“当前分支已经切换到 dev，不能恢复属于 main 的切换储藏”，当前分支仍为 `dev`，`stash@{0}` 仍保留，工作区干净，文件内容仍是 `base`。
- 正确分支回归：当前分支为 `main` 时调用同一 `restoreCheckoutStash` 返回 `200`，stash 被正常弹出，`file.txt` 恢复为 `main stash change`。

### Notes
- `server.js`：恢复自动签出 stash 前增加当前分支校验，并将自动 stash 查找收紧到所属分支和完整消息。
- `README.md`：补充自动签出 stash 恢复的后端分支校验和精确匹配规则。
- `docs/CONTINUE.md`：记录自动签出 stash 恢复不会再应用到错误分支。
- `progress.md`：追加本轮复现、修复和验证记录。
- 回滚方式：提交前反向删除本轮在上述文件和本日志块中的改动；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 阻止过期储藏引用删错储藏
### What was done
- 复现页面选中旧列表里的 `stash@{0}` 后，如果期间又创建了新的 stash，旧 stash 会变成 `stash@{1}`；后端继续按旧 `stash@{0}` 执行 `dropStash` 会删除新 stash，API 返回成功，用户选中的旧 stash 反而保留。
- 状态接口现在返回每条 stash 的 commit SHA；前端执行应用、弹出、删除和从储藏创建分支时，会把页面选中时看到的 SHA 一起传给后端。
- 后端执行这些 stash 写操作前会确认当前 `stash@{n}` 仍指向同一个 SHA；如果序号已经漂移，会拒绝操作并提示刷新储藏列表后重新选择。

### Testing
- 修复前临时仓库 HTTP harness：页面先读取 `old selected stash` 为 `stash@{0}`，随后外部创建 `new later stash`；调用 `dropStash stash@{0}` 返回 `200`，结果 `new later stash` 被删除，`old selected stash` 仍保留。
- 修复后同一 stale 引用 harness：带旧 `ref + sha` 调用 `dropStash` 返回 `400` 和中文“储藏列表已经变化”提示，`new later stash` 与 `old selected stash` 都保留。
- 当前引用回归：刷新后用当前 `stash@{0}` 的 SHA 调用 `dropStash` 返回 `200`，只删除当前选中的 `new later stash`，旧 stash 留在列表中。

### Notes
- `server.js`：stash 列表增加 SHA 输出，应用/弹出/删除/建分支统一校验 ref 当前指向的 SHA。
- `public/js/panels/sync.js`：stash 写操作请求携带页面选中时的 SHA。
- `README.md`：补充 stash 序号漂移时的后端拒绝规则。
- `docs/CONTINUE.md`：记录 stash 操作身份校验边界。
- `progress.md`：追加本轮复现、修复和验证记录。
- 回滚方式：提交前反向删除本轮在上述文件和本日志块中的改动；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 阻止旧页面删除已变化的远端分支
### What was done
- 复现本地页面看到旧 `origin/feature` 后，真实远端 `feature` 被别人更新到新提交；旧页面继续调用 `deleteRemoteBranch origin/feature` 会返回 `200`，并把新远端分支删除。
- 后端删除远端分支前现在会读取本地 tracking 分支 SHA 和真实远端 heads SHA；如果两者不一致，会先抓取刷新远端跟踪引用，然后拒绝删除并提示刷新页面重新选择。
- 本地 tracking 和真实远端一致的普通远端分支删除路径保持可用。

### Testing
- 修复前临时裸仓库 HTTP harness：本地 `origin/feature` 仍指向旧提交 `586b8ec...`，真实远端 `feature` 已更新到 `1fe256b...`；调用 `deleteRemoteBranch origin/feature` 返回 `200`，裸远端 `refs/heads/feature` 被删除。
- 修复后同一 stale 远端分支 harness：本地 tracking 指向旧提交 `37d8af9...`，真实远端为新提交 `e2c11d5...`；调用返回 `400` 和中文“远端分支 origin/feature 已经变化”提示，裸远端 `feature` 仍保留在新提交。
- 普通删除回归：本地 `origin/cleanup` 和真实远端 `cleanup` 都指向 `7b32632...` 时，调用 `deleteRemoteBranch origin/cleanup` 返回 `200`，裸远端 `cleanup` 被删除。

### Notes
- `server.js`：远端分支删除前增加真实远端 SHA 与本地 tracking SHA 的一致性校验。
- `README.md`：补充远端分支变化时会拒绝旧页面删除请求。
- `docs/CONTINUE.md`：记录远端分支删除的 SHA 校验边界。
- `progress.md`：追加本轮复现、修复和验证记录。
- 回滚方式：提交前反向删除本轮在上述文件和本日志块中的改动；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 阻止旧页面删除已变化的 Tag
### What was done
- 复现本地页面看到旧 `v1` Tag 后，真实远端 `v1` 被别人强制更新到新提交；旧页面继续调用 `deleteRemoteTag v1` 会返回 `200`，并把新远端 Tag 删除。
- Tag 状态现在保留完整对象 SHA，前端推送 Tag、删除本地 Tag、删除远端 Tag 时会把页面看到的 SHA 一起传给后端。
- 后端执行 Tag 写操作前会确认本地同名 Tag 仍是页面看到的对象；删除远端 Tag 时还会确认真实远端 Tag 也仍是同一个对象，避免旧页面删错或推错同名 Tag。

### Testing
- 修复前临时裸仓库 HTTP harness：本地 `v1` 仍指向旧提交 `f10ed26...`，真实远端 `v1` 已更新到 `60c8f97...`；调用 `deleteRemoteTag v1` 返回 `200`，裸远端 `refs/tags/v1` 被删除。
- 修复后同一 stale 远端 Tag harness：页面 SHA 为旧对象 `2130e81...`，真实远端为新对象 `aaa0c6a...`；调用返回 `400` 和中文“远端 Tag v1 已经变化”提示，裸远端 `v1` 仍保留在新对象。
- 普通远端删除回归：本地和真实远端 `v1` 都指向 `51330d0...` 时，调用 `deleteRemoteTag v1` 返回 `200`，裸远端 `v1` 被删除。
- 本地 stale Tag 回归：页面 SHA 为旧对象 `5d7c852...`，本地同名 `v1` 已被外部改到 `0c4aa60...`；调用 `deleteTag v1` 返回 `400`，本地新 `v1` 保留。

### Notes
- `server.js`：Tag 列表增加完整对象 SHA，Tag 写操作统一校验页面 SHA、本地 SHA，并在删除远端 Tag 时校验真实远端 SHA。
- `public/js/panels/recovery-settings.js`：Tag 写操作请求携带页面选中时的完整对象 SHA，界面仍显示短 SHA。
- `README.md`：补充 Tag 写操作的对象 SHA 校验规则。
- `docs/CONTINUE.md`：记录 Tag 列表完整 SHA 和远端删除校验边界。
- `progress.md`：追加本轮复现、修复和验证记录。
- 回滚方式：提交前反向删除本轮在上述文件和本日志块中的改动；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 阻止旧页面恢复或删除已变化的恢复点
### What was done
- 复现页面看到恢复点 ref 指向提交 B 后，如果同一个 `refs/forkline/recovery/...` 被外部改到提交 A，旧页面继续调用 `restoreRecoveryPoint` 会返回 `200` 并把 HEAD 重置到 A，和用户看到的恢复点不一致。
- 恢复点恢复、单个删除和批量删除现在都会携带页面看到的恢复点 SHA；后端执行前会确认当前 ref 仍指向同一个提交。
- 如果恢复点 ref 已经变化，后端会返回中文提示要求刷新恢复点列表，不会执行 reset 或 update-ref 删除。

### Testing
- 修复前临时仓库 HTTP harness：页面读取恢复点 SHA 为 B `4ec2d45...`，外部把同一恢复点 ref 改到 A `98df6b2...`；调用 `restoreRecoveryPoint` 返回 `200`，HEAD 被重置到 A，文件内容变成 `A`。
- 修复后同一 stale 恢复点 harness：页面 SHA 为 B `2525e97...`，ref 已改到 A `cbcd664...`；调用 `restoreRecoveryPoint` 返回 `400` 和中文“恢复点已经变化”，HEAD 仍停在 C `9f634a5...`，文件内容仍为 `C`。
- 正常恢复回归：ref 和页面 SHA 都指向 B `16437e7...` 时，调用 `restoreRecoveryPoint` 返回 `200`，HEAD 恢复到 B，并创建新的 `restore-recovery` 恢复前恢复点。
- 删除回归：页面 SHA 为 B `bb25814...`，ref 已改到 A `fb85397...`；调用 `deleteRecoveryPoint` 返回 `400`，该 ref 仍保留并指向 A。

### Notes
- `server.js`：恢复点恢复、单个删除和批量删除增加页面 SHA 与当前 ref SHA 的一致性校验。
- `public/js/panels/recovery-settings.js`：恢复点恢复、删除和筛选批量删除请求携带页面看到的 SHA。
- `README.md`：补充恢复点 ref 变化时会拒绝旧页面恢复/删除请求。
- `docs/CONTINUE.md`：记录恢复点恢复和删除的 SHA 校验边界。
- `progress.md`：追加本轮复现、修复和验证记录。
- 回滚方式：提交前反向删除本轮在上述文件和本日志块中的改动；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 阻止旧页面重命名或删除已变化的本地分支
### What was done
- 复现页面看到本地分支 `topic` 指向旧提交后，外部 Git 命令把同名 `topic` 移到新提交；旧页面继续调用 `renameBranch topic -> renamed-stale` 会返回 `200`，并把新 `topic` 改名。
- 本地分支状态现在会把分支 HEAD SHA 合并进 `branchInfo`；普通分支删除、重命名和分支整理批量删除都会把页面看到的 SHA 传给后端。
- 后端在执行 `deleteBranch`、`deleteBranches` 和 `renameBranch` 前会校验当前 `refs/heads/<branch>` 仍指向页面看到的提交；分支已删除、请求缺少 SHA 或同名分支已经移动时都会返回中文提示并拒绝写操作。

### Testing
- `node --check server.js`
- `node --check public\js\features\branches.js`
- `node --check public\js\panels\workspaces.js`
- 修复前临时仓库 HTTP harness：页面读取 `topic` 的旧 SHA `fc0f9fa...`，外部把 `topic` 移到新 SHA `7b474d...`；调用 `renameBranch` 返回 `200`，`topic` 消失，`renamed-stale` 指向新 SHA，`staleWasIgnored = true`。
- 修复后同一 stale harness：页面 SHA 为 `858d134...`，外部新 SHA 为 `46c4d9a...`；带旧 SHA 调用 `renameBranch` 返回 `400` 和中文“本地分支 topic 已经变化”，`topic` 仍指向新 SHA，`renamed-stale` 不存在，`staleBlocked = true`。
- 正常路径回归：匹配 SHA 的 `renameBranch topic -> renamed-ok` 返回成功，匹配 SHA 的 `deleteBranch old-merged` 返回成功。
- 批量删除回归：`deleteBranches` 使用 `{ branch, sha }` 数组删除 `merged-a` 和 `merged-b`，两个分支均被删除。

### Notes
- `server.js`：本地分支状态暴露分支 HEAD SHA，并为删除、批量删除、重命名增加页面 SHA 与当前分支 SHA 的一致性校验。
- `public/js/features/branches.js`：本地分支删除和重命名请求携带页面快照中的分支 SHA。
- `public/js/panels/workspaces.js`：分支整理批量删除改为传 `{ branch, sha }`，备用分支行也保留最后提交 SHA。
- `README.md`：补充本地分支删除/重命名会校验页面看到的分支 HEAD SHA。
- `docs/CONTINUE.md`：记录本地分支删除、批量删除和重命名的 SHA 校验边界。
- `progress.md`：追加本轮复现、修复、验证和回滚说明。
- 回滚方式：提交前反向删除本轮在上述文件和本日志块中的改动；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 阻止旧页面应用补丁落到外部切换后的分支
### What was done
- 复现页面打开时显示 `main`，外部命令切到 `dev` 后，旧页面继续调用 `applyPatch`；修复前会把补丁内容写进 `dev` 工作区。
- 后端当前分支快照保护范围扩展到 `applyPatch`。
- 前端应用补丁请求会携带页面看到的当前分支和 HEAD。

### Testing
- 修复前临时仓库 `C:\tmp\forkline-stale-apply-patch-20260703214856`：旧 `applyPatch` 写入 `dev` 的 `patch-applied.txt`，状态为 `?? patch-applied.txt`。
- 修复后临时仓库 `C:\tmp\forkline-stale-apply-patch-fixed-20260703215022`：stale `applyPatch` 返回 `400`，提示当前分支已从 `main` 切到 `dev`，`patch-stale.txt` 不存在。
- 后端兜底回归：不带分支快照的 `applyPatch` 返回 `400`“页面分支状态已过期，请刷新后重新执行这个操作。”，`patch-missing.txt` 不存在。
- 正常回归：当前 `dev` 且 HEAD 未变时，带快照的 `applyPatch` 返回 `200`“已应用补丁到工作区”，`patch-normal.txt` 写入工作区。
- 推送前静态验证通过：`node --check server.js`、`node --check public\js\features\git-actions.js`、`node --check public\js\features\diff-workbench.js`、`node --check public\js\features\repositories.js`、`git diff --check`。
- 推送前确认 `D:\桌面\GitTest` 状态为 `## 123`，未被本轮推送流程改动。
- 临时服务进程 `15232` 已确认命令行为 `"D:\Program Files\nodejs\node.exe" server.js`，但停止进程的提权请求被环境拒绝；本轮未绕过权限强杀。临时 apply patch 复现仓库也因沙箱限制未在本轮确认清理。

### Notes
- `server.js`：扩大当前分支快照保护动作集合，覆盖应用补丁。
- `public/js/features/repositories.js`：应用补丁请求携带当前分支快照。
- `README.md`：补充应用补丁会校验页面分支和 HEAD。
- `docs/CONTINUE.md`：记录补丁工作流已携带页面分支快照。
- `progress.md`：追加本轮复现、修复、验证、清理限制和回滚说明。
- 回滚方式：提交前反向删除本轮在上述文件和本日志块中的改动；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 阻止旧页面储藏操作落到外部切换后的分支
### What was done
- 复现页面在 `main` 看到 `stash@{0}`，外部命令切到 `dev` 后，旧页面继续调用 `applyStash`；修复前后端会在 `dev` 执行 `git stash apply`，返回失败但已经把 `dev` 工作区打成 `UU shared.txt` 冲突状态。
- 后端当前分支快照保护范围扩展到 `restoreCheckoutStash`、`createStash`、`applyStash`、`popStash`、`dropStash` 和 `branchFromStash`。
- 前端创建储藏、恢复签出储藏、应用/弹出/删除储藏、从储藏创建分支请求都会携带页面看到的当前分支和 HEAD。

### Testing
- 修复前临时仓库 `C:\tmp\forkline-stale-apply-stash-20260703220038`：页面分支为 `main`，外部切到 `dev`；旧 `applyStash` 返回 `400`，但 `shared.txt` 已变成冲突内容，状态为 `UU shared.txt`。
- 修复后临时仓库 `C:\tmp\forkline-stale-apply-stash-fixed-20260703220226`：同一 stale `applyStash` 带页面快照返回 `400`，提示当前分支已从 `main` 切到 `dev`；`shared.txt` 仍为 `dev-base`，状态仍为 `## dev`。
- 后端兜底回归：不带分支快照的 `applyStash` 返回 `400`“页面分支状态已过期，请刷新后重新执行这个操作。”，`dev` 工作区仍干净。
- 正常应用储藏回归：当前 `main` 且 HEAD 未变时，带快照的 `applyStash` 返回 `200`，`shared.txt` 变为 `main-stashed`，状态为 `M shared.txt`。
- 创建储藏回归：临时仓库 `C:\tmp\forkline-stale-create-stash-fixed-20260703220258` 中，stale `createStash` 带 `main` 快照在当前 `dev` 返回 `400`，`dev-unsaved` 保留；当前 `dev` 快照一致时 `createStash` 返回 `200` 并生成 `stash@{0}: On dev: normal create stash`。
- 本轮临时服务进程 `7272`、`17932` 已停止；本轮三个 `C:\tmp\forkline-stale-*stash*` 临时仓库已清理。

### Notes
- `server.js`：扩大当前分支快照保护动作集合，覆盖储藏写操作。
- `public/js/features/git-actions.js`：创建储藏和恢复签出储藏请求携带当前分支快照。
- `public/js/panels/sync.js`：应用、弹出、删除储藏和从储藏创建分支请求携带当前分支快照。
- `README.md`：补充储藏写操作会校验页面分支和 HEAD。
- `docs/CONTINUE.md`：记录储藏写操作已纳入当前分支快照保护。
- `progress.md`：追加本轮复现、修复、验证、清理和回滚说明。
- 回滚方式：提交前反向删除本轮在上述文件和本日志块中的改动；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 阻止旧页面恢复点保留策略误删新产生的恢复点
### What was done
- 复现页面看到两个 `main` 恢复点，保留策略“每个分支保留 1 个”预览只应删除旧恢复点；外部命令在确认前新增更晚恢复点后，旧页面继续调用 `pruneRecoveryPoints`。修复前后端重新按当前真实 refs 计算并删除了两个恢复点，包括页面原本预览要保留的恢复点。
- 前端执行保留策略清理时会提交页面预览出的删除候选 `ref + sha`。
- 后端执行前重新读取真实恢复点并重新计算保留策略，只有当前删除候选与页面提交候选完全一致时才删除；候选变化或旧脚本缺少候选列表时会拒绝执行。

### Testing
- 修复前临时仓库 `C:\tmp\forkline-stale-recovery-prune-20260703222759`：页面看到 `reset-keep` 和 `reset-old`，外部新增 `reset-new`；旧 `pruneRecoveryPoints` 返回 `200`，实际删除 `reset-keep` 和 `reset-old`，只剩 `reset-new`。
- 修复后临时仓库 `C:\tmp\forkline-stale-recovery-prune-fixed2-20260703223109`：同一 stale 请求只携带页面预览的 `reset-old` 候选，返回 `400`“恢复点清理预览已经变化”；`reset-old`、`reset-keep`、`reset-new` 全部保留。
- 后端兜底回归：不带 `deleteRefs` 的旧脚本调用返回 `400`“恢复点清理预览已过期”，三个恢复点全部保留。
- 正常保留策略回归：刷新后携带当前候选 `reset-keep` 和 `reset-old`，`pruneRecoveryPoints` 返回 `200`，删除 2 个，只保留最新的 `reset-new`。
- 本轮临时服务进程 `34008`、`18072` 已停止；本轮 `C:\tmp\forkline-stale-recovery-prune*` 临时仓库已清理。

### Notes
- `server.js`：保留策略清理要求请求携带页面预览候选，执行前重新计算并校验候选列表和每个恢复点 SHA。
- `public/js/panels/recovery-settings.js`：保留策略清理请求携带待删除恢复点的 `ref + sha`。
- `README.md`：补充保留策略清理会校验候选列表未变化。
- `docs/CONTINUE.md`：记录恢复点保留策略只删除页面确认过且后端重新计算一致的候选。
- `progress.md`：追加本轮复现、修复、验证、清理和回滚说明。
- 回滚方式：提交前反向删除本轮在上述文件和本日志块中的改动；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 阻止旧页面子模块操作按外部切换后的分支记录更新
### What was done
- 复现父仓库 `main` 记录子模块提交 A，`dev` 记录子模块提交 B；页面在 `main`，外部切到 `dev` 后，旧页面继续调用 `updateSubmodules`。修复前后端返回成功，并把子模块工作区从 A checkout 到 `dev` 记录的 B。
- 后端当前分支快照保护范围扩展到 `initSubmodules`、`updateSubmodules` 和 `syncSubmodules`。
- 前端子模块初始化、更新全部、更新单个子模块和同步 URL 请求都会携带页面看到的当前分支和 HEAD。
- 检查 Tag 写操作：本地/远端 Tag 删除和推送已有页面看到的 Tag 对象 SHA 校验，创建 Tag 使用明确目标提交 SHA，本轮未改 Tag 路径。

### Testing
- 修复前临时仓库 `C:\tmp\forkline-stale-submodule-parent-20260703222148`：页面分支为 `main`，外部切到 `dev`；旧 `updateSubmodules modules/sub` 返回 `200`，子模块从 `d653577` 变为 `74f0064`，文件内容变为 `sub B`。
- 修复后临时仓库 `C:\tmp\forkline-stale-submodule-parent-fixed-20260703222255`：同一 stale `updateSubmodules` 带页面快照返回 `400`，提示当前分支已从 `main` 切到 `dev`；子模块仍停在 `177ac88`，文件内容仍为 `sub A`。
- 后端兜底回归：不带分支快照的 `updateSubmodules` 返回 `400`“页面分支状态已过期，请刷新后重新执行这个操作。”，子模块仍未移动。
- 正常子模块更新回归：当前 `dev` 且 HEAD 未变时，带快照的 `updateSubmodules` 返回 `200`，子模块更新到 `2c8e4b0`，文件内容变为 `sub B`。
- 本轮临时服务进程 `32812`、`8988` 已停止；本轮 `C:\tmp\forkline-stale-submodule-*` 临时父仓库和子模块源仓库已清理。

### Notes
- `server.js`：扩大当前分支快照保护动作集合，覆盖子模块初始化、更新和同步。
- `public/js/panels/workspaces.js`：子模块写操作请求携带当前分支快照。
- `README.md`：补充子模块写操作会校验页面分支和 HEAD。
- `docs/CONTINUE.md`：记录子模块写操作已纳入当前分支快照保护。
- `progress.md`：追加本轮复现、修复、验证、清理和回滚说明。
- 回滚方式：提交前反向删除本轮在上述文件和本日志块中的改动；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 阻止旧页面创建工作树从外部切换后的分支派生
### What was done
- 复现页面在 `main` 创建工作树，起点为 `HEAD` 且填写新分支；外部命令切到 `dev` 后，旧页面继续调用 `createWorktree`。修复前后端返回成功，并从 `dev` 的 HEAD 创建了新工作树分支。
- 后端当前分支快照保护范围扩展到 `createWorktree`。
- 前端创建工作树请求会携带页面看到的当前分支和 HEAD。

### Testing
- 修复前临时仓库 `C:\tmp\forkline-stale-worktree-create-20260703221509`：页面分支为 `main`，外部切到 `dev`；旧 `createWorktree` 返回 `200`，目标 `C:\tmp\forkline-stale-worktree-target-20260703221509` 中新分支 `wt-old-page` 指向 `dev` 的 `36bfa38`，文件内容为 `dev current`。
- 修复后临时仓库 `C:\tmp\forkline-stale-worktree-create-fixed-20260703221620`：同一 stale `createWorktree` 带页面快照返回 `400`，提示当前分支已从 `main` 切到 `dev`；目标目录未创建，`wt-stale` 分支不存在。
- 后端兜底回归：不带分支快照的 `createWorktree` 返回 `400`“页面分支状态已过期，请刷新后重新执行这个操作。”，目标目录未创建，`wt-missing` 分支不存在。
- 正常创建工作树回归：当前 `dev` 且 HEAD 未变时，带快照的 `createWorktree` 返回 `200`，目标工作树分支 `wt-normal` 指向 `dev` 的 `8678dda`，文件内容为 `dev current`。
- 本轮临时服务进程 `36804`、`10788` 已停止；本轮 `C:\tmp\forkline-stale-worktree-*` 临时仓库和目标工作树目录已清理。

### Notes
- `server.js`：扩大当前分支快照保护动作集合，覆盖创建工作树。
- `public/js/panels/workspaces.js`：创建工作树请求携带当前分支快照。
- `README.md`：补充创建工作树会校验页面分支和 HEAD。
- `docs/CONTINUE.md`：记录创建工作树已纳入当前分支快照保护。
- `progress.md`：追加本轮复现、修复、验证、清理和回滚说明。
- 回滚方式：提交前反向删除本轮在上述文件和本日志块中的改动；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 阻止旧页面恢复点和引用日志恢复硬重置外部切换后的分支
### What was done
- 复现页面在 `main` 查看恢复点，外部命令切到 `dev` 后，旧页面继续调用 `restoreRecoveryPoint`；修复前后端返回成功，并把当前 `dev` 从自己的提交硬重置到 `main` 的恢复点提交。
- 后端当前分支快照保护范围扩展到 `restoreRecoveryPoint` 和 `restoreReflogEntry`。
- 前端恢复点恢复和引用日志恢复请求会携带页面看到的当前分支和 HEAD；删除恢复点、批量删除和保留策略清理仍只走恢复点 SHA/范围校验，不额外绑定当前分支。

### Testing
- 修复前临时仓库 `C:\tmp\forkline-stale-recovery-restore-20260703220758`：页面分支为 `main`，外部切到 `dev`；旧 `restoreRecoveryPoint` 返回 `200`，`dev` 从 `66bea06` 被硬重置到 `70cda80`，`branch.txt` 变为 `main target`。
- 修复后临时仓库 `C:\tmp\forkline-stale-recovery-restore-fixed-20260703220905`：同一 stale `restoreRecoveryPoint` 带页面快照返回 `400`，提示当前分支已从 `main` 切到 `dev`；`dev` 仍停在 `32391a2`，`branch.txt` 保留 `dev current`。
- 后端兜底回归：不带分支快照的 `restoreRecoveryPoint` 返回 `400`“页面分支状态已过期，请刷新后重新执行这个操作。”，`dev` 仍未移动。
- 正常恢复点回归：当前 `main` 且 HEAD 未变时，带快照的 `restoreRecoveryPoint` 返回 `200`，`main` 从 `af8cfa0` 恢复到 `55241a3`，`branch.txt` 变为 `main target`。
- 引用日志恢复回归：临时仓库 `C:\tmp\forkline-stale-reflog-restore-fixed-20260703220949` 中，stale `restoreReflogEntry` 和不带快照请求均返回 `400` 且 `dev current` 保留；当前 `main` 快照一致时，`restoreReflogEntry` 返回 `200` 并恢复到目标 reflog 提交。
- 本轮临时服务进程 `25120`、`26132` 已停止；本轮三个 `C:\tmp\forkline-stale-*restore*` 临时仓库已清理。

### Notes
- `server.js`：扩大当前分支快照保护动作集合，覆盖恢复点恢复和引用日志恢复。
- `public/js/panels/recovery-settings.js`：恢复点恢复和引用日志恢复请求携带当前分支快照。
- `README.md`：补充恢复点/引用日志恢复会校验页面分支和 HEAD。
- `docs/CONTINUE.md`：记录恢复点恢复和引用日志恢复已纳入当前分支快照保护。
- `progress.md`：追加本轮复现、修复、验证、清理和回滚说明。
- 回滚方式：提交前反向删除本轮在上述文件和本日志块中的改动；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 阻止旧页面删除本地 tracking 已更新的远端分支
### What was done
- 复现页面看到旧 `origin/feature` 后，外部把真实远端 `feature` 更新到新提交，并执行 `git fetch` 让本地 tracking 也更新；旧页面继续调用 `deleteRemoteBranch origin/feature` 会返回 `200`，把新远端分支删除。
- 远端分支状态现在会返回 `remoteInfo[远端分支].sha`，前端删除远端分支时会携带页面看到的 tracking SHA。
- 后端删除远端分支前会先确认当前本地 tracking 仍匹配页面 SHA，再确认当前本地 tracking 和真实远端 heads SHA 一致，避免旧页面删掉别人新推送后又被本机 fetch 到的新分支。

### Testing
- `node --check server.js`
- `node --check public\js\features\branches.js`
- 修复前临时裸远端 HTTP harness：页面看到 `origin/feature` 为旧 SHA `9ec5466...`，外部远端和本地 tracking 都更新到 `bfcd616...`；旧请求返回 `200`，裸远端 `refs/heads/feature` 被删除，`stalePageDeletedNewRemote = true`。
- 修复后同一 stale harness：页面 SHA 为 `d7dce6e...`，外部远端和本地 tracking 更新到 `89912fd...`；带旧 SHA 调用返回 `400` 和中文“本地跟踪引用已经变化”，远端 `feature` 保留在新 SHA，`staleBlocked = true`。
- 正常远端删除回归：页面 SHA、当前 tracking 和真实远端都指向 `origin/cleanup` 同一提交时，`deleteRemoteBranch` 返回成功，裸远端 `cleanup` 被删除。

### Notes
- `server.js`：远端分支状态增加 `remoteInfo`，删除远端分支前校验页面 tracking SHA、当前本地 tracking SHA 和真实远端 SHA。
- `public/js/features/branches.js`：远端分支删除请求携带页面快照中的 tracking SHA。
- `README.md`：补充删除远端分支会校验页面 tracking SHA、当前 tracking SHA 和真实远端 SHA。
- `docs/CONTINUE.md`：记录本地 tracking 被外部 fetch 更新后的远端删除保护边界。
- `progress.md`：追加本轮复现、修复、验证和回滚说明。
- 回滚方式：提交前反向删除本轮在上述文件和本日志块中的改动；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 阻止旧页面当前分支动作落到外部切换后的分支
### What was done
- 复现页面打开时显示 `main` 且只看到 `main-unsaved.txt`，随后外部命令切到 `dev` 并修改 `dev-only.txt`；旧页面继续调用 `discardAll` 会返回 `200`，把 `dev-only.txt` 的未提交内容丢弃。
- 前端通用当前分支动作现在会携带页面看到的 `expectedBranch` 和 `expectedHead`。
- 后端对 `pull`、`pullRebase`、`push`、`forcePushLease`、`stageAll`、`discardAll`、`commit`、`amendCommit` 统一校验当前分支和 HEAD 快照；如果分支已切换或 HEAD 已变化，会拒绝旧页面请求。

### Testing
- `node --check server.js`
- `node --check public\js\features\git-actions.js`
- 修复前临时仓库 HTTP harness：页面分支为 `main`，外部切到 `dev` 并让 `dev-only.txt` 变为 `M`；调用旧 `discardAll` 返回 `200`，`dev-only.txt` 回到提交内容，`stalePageDiscardedDevWork = true`。
- 修复后同一 stale 分支切换 harness：带 `expectedBranch = main` 和页面 HEAD 调用 `discardAll` 返回 `400`，提示当前分支已经从 `main` 切换到 `dev`，`dev-only.txt` 的未提交内容保留，`staleDiscardBlocked = true`。
- 正常路径回归：当前仍是页面看到的 `main` 且 HEAD 未变时，`discardAll` 返回成功，已跟踪修改和未跟踪文件都被清理。
- 同分支 HEAD 变化回归：页面看到旧 `main` HEAD 后，外部在 `main` 上新增提交并创建未跟踪文件；旧 `discardAll` 返回 `400`，提示 HEAD 已经变化，未跟踪文件保留。

### Notes
- `server.js`：新增当前分支快照动作集合和校验逻辑，在当前分支类写操作前确认页面分支/HEAD 仍匹配。
- `public/js/features/git-actions.js`：通用 `runAction` 请求携带页面当前分支和 HEAD 快照。
- `README.md`：补充当前分支类写操作会在外部切换分支或移动 HEAD 后拒绝旧页面请求。
- `docs/CONTINUE.md`：记录当前分支类写操作的页面快照保护范围。
- `progress.md`：追加本轮复现、修复、验证和回滚说明。
- 回滚方式：提交前反向删除本轮在上述文件和本日志块中的改动；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 阻止旧页面 reset 和提交操作落到错误分支
### What was done
- 复现页面打开时显示 `main`，外部命令切到 `dev` 后，旧页面继续调用 `resetToCommit` hard 到 `main` 的旧提交；后端返回 `200`，把 `dev` 分支从自己的提交移动到 `main` 的旧提交，并删除了 `dev` 专属文件。
- 后端当前分支快照保护范围扩展到 `mergeRef`、`rebaseOntoRef`、`rewordCommit`、`rewriteHistoryCommit`、`rewriteHistoryQueue`、`cherryPickCommit`、`revertCommit`、`resetToCommit`。
- 前端分支合并/变基、提交挑选/还原/reset、修改提交信息和历史编辑请求都会携带页面看到的当前分支和 HEAD。

### Testing
- `node --check server.js`
- `node --check public\js\features\commit-actions.js`
- `node --check public\js\features\git-actions.js`
- 修复前临时仓库 HTTP harness：页面分支为 `main`，外部切到 `dev`；调用旧 `resetToCommit` hard 到提交 `79241d8...` 返回 `200`，`dev` 从 `3bc8a45...` 被移动到 `79241d8...`，`dev-c.txt` 不存在，`stalePageResetWrongBranch = true`。
- 修复后同一 stale reset harness：带页面 `expectedBranch = main` 和页面 HEAD 调用 `resetToCommit` 返回 `400`，提示当前分支已从 `main` 切到 `dev`；`dev` 仍停在原提交，`dev-c.txt` 保留，`staleResetBlocked = true`。
- 正常 reset 回归：当前仍是页面看到的 `main` 且 HEAD 未变时，带快照的 hard reset 返回成功，分支移动到目标提交并创建恢复点。
- 后端兜底回归：直接调用不带快照的 `resetToCommit` 返回 `400`“页面分支状态已过期”，HEAD 保持不变。

### Notes
- `server.js`：扩大当前分支快照保护动作集合，覆盖合并、变基、挑选、还原、reset 和历史编辑类写操作。
- `public/js/features/git-actions.js`：合并、分支变基和修改提交信息请求携带当前分支快照。
- `public/js/features/commit-actions.js`：挑选、还原、reset、历史编辑计划和历史编辑队列执行请求携带当前分支快照。
- `README.md`：补充当前分支类写操作的快照保护覆盖 reset、挑选、还原和历史编辑。
- `docs/CONTINUE.md`：记录当前分支快照保护已扩展到提交右键和历史编辑动作。
- `progress.md`：追加本轮复现、修复、验证和回滚说明。
- 回滚方式：提交前反向删除本轮在上述文件和本日志块中的改动；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 阻止旧页面工作区文件操作落到外部切换后的分支
### What was done
- 复现页面打开时看到 `main` 的 `shared.txt` 有未暂存改动，外部命令切到 `dev` 后，旧页面继续调用 `discardWorktreeFile shared.txt`；修复前后端返回成功，并把 `dev` 分支上的未保存内容丢回 `dev-base`。
- 后端当前分支快照保护范围扩展到 `stageFile`、`ignoreWorktreePath`、`unstageFile`、`resolveConflictFile`、`stageHunk`、`stageSelectedLines`、`unstageSelectedLines`、`unstageHunk`、`discardWorktreeHunk`、`discardWorktreeFile`、`discardStagedFile`。
- 前端单文件、批量文件、加入 `.gitignore`、冲突文件取舍、工作区 Diff 按块和按行请求都会携带页面看到的当前分支和 HEAD。

### Testing
- 修复前临时仓库 `C:\tmp\forkline-stale-file-action-header-20260703211828`：页面分支为 `main`，外部切到 `dev`；旧 `discardWorktreeFile` 返回 `工作区改动已丢弃`，`shared.txt` 从 `dev-important-unsaved` 变为 `dev-base`，工作区变干净。
- 修复后临时仓库 `C:\tmp\forkline-stale-file-fixed-20260703212044`：同一 stale `discardWorktreeFile` 带页面快照返回 `400`，提示当前分支已从 `main` 切到 `dev`；`shared.txt` 保留 `dev-important-unsaved`，状态仍为 ` M shared.txt`。
- 后端兜底回归：直接调用不带快照的 `stageFile` 返回 `400`“页面分支状态已过期，请刷新后重新执行这个操作。”
- 正常操作回归：当前仍是页面看到的 `dev` 且 HEAD 未变时，带快照的 `stageFile` 可把 `shared.txt` 暂存为 `M  shared.txt`；带快照的 `discardWorktreeFile` 可正常丢弃工作区改动。
- 本轮 `C:\tmp\forkline-stale-file-*` 临时复现仓库已清理，临时服务进程已停止。

### Notes
- `server.js`：扩大当前分支快照保护动作集合，覆盖工作区文件、冲突文件、按块和按行写操作。
- `public/js/features/git-actions.js`：单文件、批量文件和加入 `.gitignore` 请求携带当前分支快照。
- `public/js/features/diff-workbench.js`：工作区 Diff 按块和按行请求携带当前分支快照。
- `README.md`：补充文件级和 Diff 细粒度写操作也会校验页面分支和 HEAD。
- `docs/CONTINUE.md`：记录当前分支快照保护已扩展到工作区文件、块和行级操作。
- `progress.md`：追加本轮复现、修复、验证和回滚说明。
- 回滚方式：提交前反向删除本轮在上述文件和本日志块中的改动；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 阻止旧页面中止进行中的 Git 操作落到外部切换后的分支
### What was done
- 复现页面显示 `main` 正在合并冲突，外部命令中止 `main` 合并后切到 `dev` 并制造新的合并冲突；旧页面继续调用 `abortMerge`，修复前会把 `dev` 当前合并中止，清掉 `MERGE_HEAD` 并恢复 `dev` 文件内容。
- 后端当前分支快照保护范围扩展到 `continueRevert`、`abortRevert`、`continueCherryPick`、`skipCherryPick`、`abortCherryPick`、`continueMerge`、`abortMerge`、`continueRebase`、`skipRebase`、`abortRebase`。
- 前端工作区冲突横幅里的继续、跳过和中止请求都会携带页面看到的当前分支和 HEAD。

### Testing
- 修复前临时仓库 `C:\tmp\forkline-stale-op-abort-merge-20260703212818`：页面分支为 `main`，外部切到 `dev` 并进入合并冲突；旧 `abortMerge` 返回 `已中止合并，工作区已回到合并前状态`，`dev` 的 `.git\MERGE_HEAD` 被清除，`conflict.txt` 从冲突内容恢复为 `dev`。
- 修复后临时仓库 `C:\tmp\forkline-stale-op-abort-merge-fixed-20260703212941`：同一 stale `abortMerge` 带页面快照返回 `400`，提示当前分支已从 `main` 切到 `dev`；`dev` 的 `.git\MERGE_HEAD` 仍存在，`conflict.txt` 仍保留冲突内容，状态仍为 `UU conflict.txt`。
- 后端兜底回归：直接调用不带快照的 `abortMerge` 返回 `400`“页面分支状态已过期，请刷新后重新执行这个操作。”
- 正常合并中止回归：当前仍是页面看到的 `dev` 且 HEAD 未变时，带快照的 `abortMerge` 返回 `200`，`.git\MERGE_HEAD` 被清除，工作区回到干净。
- 正常变基中止回归：临时仓库 `C:\tmp\forkline-op-abort-rebase-normal-20260703213010` 在 rebase 冲突中页面分支为 `detached HEAD`；带页面快照调用 `abortRebase` 返回 `200`，分支回到 `topic`，工作区干净。
- 本轮 `C:\tmp\forkline-stale-op-abort-merge-*` 和 `C:\tmp\forkline-op-abort-rebase-normal-*` 临时复现仓库已清理，临时服务进程已停止。

### Notes
- `server.js`：扩大当前分支快照保护动作集合，覆盖合并、变基、挑选和还原的继续、跳过、中止操作。
- `public/js/features/git-actions.js`：工作区冲突横幅的 repo operation 请求携带当前分支快照。
- `README.md`：补充继续、跳过和中止进行中 Git 操作也会校验页面分支和 HEAD。
- `docs/CONTINUE.md`：记录当前分支快照保护已扩展到进行中操作控制按钮。
- `progress.md`：追加本轮复现、修复、验证和回滚说明。
- 回滚方式：提交前反向删除本轮在上述文件和本日志块中的改动；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 阻止旧页面 upstream 操作落到外部切换后的分支
### What was done
- 复现页面打开时显示 `main -> origin/main`，外部命令切到 `dev -> origin/dev` 后，旧页面继续调用 `unsetUpstream`；修复前会取消 `dev` 的 upstream，返回“已取消 upstream：dev”。
- 后端当前分支快照保护范围扩展到 `setUpstream` 和 `unsetUpstream`。
- 前端同步页和分支右键菜单里的设置/取消 upstream 请求都会携带页面看到的当前分支和 HEAD。

### Testing
- 修复前临时仓库 `C:\tmp\forkline-stale-upstream-work-20260703213451`：页面分支为 `main`，外部切到 `dev`；旧 `unsetUpstream` 返回 `200`，`dev` 的 upstream 从 `origin/dev` 变为空，`main` 仍是 `origin/main`。
- 修复后临时仓库 `C:\tmp\forkline-stale-upstream-work-fixed-20260703213630`：同一 stale `unsetUpstream` 带页面快照返回 `400`，提示当前分支已从 `main` 切到 `dev`；`dev` upstream 仍为 `origin/dev`。
- 后端兜底回归：直接调用不带快照的 `unsetUpstream` 返回 `400`“页面分支状态已过期，请刷新后重新执行这个操作。”
- 正常 upstream 回归：当前仍是页面看到的 `dev` 且 HEAD 未变时，带快照的 `unsetUpstream` 可取消 `dev` upstream；随后带快照的 `setUpstream origin/dev` 可恢复为 `dev -> origin/dev`。
- 本轮 `C:\tmp\forkline-stale-upstream-*` 临时复现仓库和裸远端已清理，临时服务进程已停止。

### Notes
- `server.js`：扩大当前分支快照保护动作集合，覆盖设置和取消当前分支 upstream。
- `public/js/features/git-actions.js`：upstream 设置/取消请求携带当前分支快照。
- `README.md`：补充 upstream 设置也会校验页面分支和 HEAD。
- `docs/CONTINUE.md`：记录当前分支快照保护已扩展到 upstream 管理。
- `progress.md`：追加本轮复现、修复、验证和回滚说明。
- 回滚方式：提交前反向删除本轮在上述文件和本日志块中的改动；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 阻止旧页面远端配置操作覆盖外部更新后的远端 URL
### What was done
- 复现页面打开时看到 `origin` 指向旧裸远端，外部命令把 `origin` 改到新裸远端后，旧页面继续调用 `deleteRemote`；修复前返回 `200`，并把当前新的 `origin` 远端配置删除。
- 后端新增远端配置快照保护，覆盖 `fetchRemote`、`setRemoteUrl`、`deleteRemote`；执行前会比较页面看到的 fetch/push URL 和当前真实远端 URL。
- 前端远端行的抓取、修改 URL、删除远端请求都会携带页面看到的 fetch/push URL。

### Testing
- 修复前临时仓库 `C:\tmp\forkline-stale-remote-config-work-20260703214146`：页面看到 `origin -> C:\tmp\forkline-stale-remote-config-old-...git`，外部改成 `origin -> C:\tmp\forkline-stale-remote-config-new-...git`；旧 `deleteRemote` 返回 `200`，`git remote -v` 变为空。
- 修复后临时仓库 `C:\tmp\forkline-stale-remote-config-work-fixed-20260703214355`：同一 stale `deleteRemote` 带页面远端 URL 快照返回 `400`，提示远端 URL 已变化；`origin` 仍指向新的裸远端。
- 后端兜底回归：直接调用不带远端 URL 快照的 `deleteRemote` 返回 `400`“页面远端配置已过期，请刷新后重新执行这个操作。”
- 正常远端配置回归：当前远端 URL 与页面快照一致时，`setRemoteUrl` 可把 `origin` 改到第三个裸远端，随后带新快照的 `deleteRemote` 可正常删除 `origin`。
- 抓取指定远端回归：临时仓库 `C:\tmp\forkline-remote-fetch-snapshot-work-20260703214424` 中，不带快照的 `fetchRemote` 返回 `400`；带当前 fetch/push URL 快照的 `fetchRemote` 返回 `200` 并完成抓取。
- 本轮 `C:\tmp\forkline-stale-remote-config-*` 和 `C:\tmp\forkline-remote-fetch-snapshot-*` 临时复现仓库与裸远端已清理，临时服务进程已停止。

### Notes
- `server.js`：新增远端配置快照保护集合和 `ensureRemoteConfigSnapshot`，在执行远端行写操作前校验 fetch/push URL 未被外部改过。
- `public/js/features/git-actions.js`：抓取指定远端、修改 URL 和删除远端请求携带远端配置快照。
- `README.md`：补充远端配置操作会校验页面看到的 fetch/push URL。
- `docs/CONTINUE.md`：记录远端仓库管理已具备 URL 快照保护。
- `progress.md`：追加本轮复现、修复、验证和回滚说明。
- 回滚方式：提交前反向删除本轮在上述文件和本日志块中的改动；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: Guard stale branch checkout and branch creation actions

### What was done
- Reproduced a stale-page destructive checkout bug in a temporary `C:\tmp` repository: the page opened `main`, an external command switched to `dev` and added `dev-work.txt`, then an old `checkoutBranch` force request ran `git clean` against `dev` and removed the new untracked file before failing on occupied service logs.
- Added current branch / HEAD snapshot protection to local branch checkout, remote branch checkout, and branch creation so old pages are rejected before they can stash, clean, switch, or create from the wrong HEAD.
- Updated the frontend checkout and branch creation requests to send the same current branch snapshot payload used by other high-risk Git write actions.
- Updated user-facing continuation docs to record that stale branch checkout and branch creation are now protected.

### Testing
- `C:\tmp` fixed regression: stale `checkoutBranch` force request with `expectedBranch = main` after external switch to `dev` returned HTTP 400 with `当前分支已经从 main 切换到 dev...`; `dev-work.txt` still existed and the repo remained on `dev`.
- `C:\tmp` fixed regression: stale `createBranch` returned the same branch-change protection, left the repo on `dev`, and did not create `created-from-stale`.
- `C:\tmp` fixed regression: stale `checkoutRemoteBranch` returned the same branch-change protection before checking the remote ref.

### Notes
- `server.js`：把 `checkoutBranch`、`checkoutRemoteBranch`、`createBranch` 纳入当前分支快照保护。
- `public/js/features/git-actions.js`：本地/远端分支签出请求带上页面当前分支和 HEAD。
- `public/js/features/branches.js`：新建分支请求带上页面当前分支和 HEAD。
- `README.md`：补充分支签出和新建分支的旧页面保护说明。
- `docs/CONTINUE.md`：同步当前状态和本轮 API 验证记录。
- Rollback: revert this task's changes in the files above, or reset to the commit before this task once it is committed.

## 2026-07-03 - Task: Guard stale remote URL for Tag remote actions

### What was done
- Reproduced a stale Tag remote bug in a temporary `C:\tmp` repository: the page saw `origin -> RemoteA.git`, an external command changed `origin` to `RemoteB.git`, then an old `pushTag` request without a remote snapshot pushed `stale-tag` to RemoteB while RemoteA stayed unchanged.
- Added remote URL snapshot protection for `pushTag` and `deleteRemoteTag`; stale requests must carry the page's remote name plus fetch/push URL snapshot and are rejected if the current remote config differs.
- Updated the Tag panel to resolve the default Tag remote on the page, include that remote in confirmations, and send the remote snapshot with Tag push/delete-remote actions.
- Updated README and continuation docs to describe the stale remote protection.

### Testing
- `C:\tmp` fixed push regression: stale `pushTag` with `origin` snapshot from RemoteA after external `origin` switch to RemoteB returned HTTP 400 with `远端 origin 的 URL 已经变化...`; neither RemoteA nor RemoteB received `stale-tag`.
- `C:\tmp` fresh push regression: after restoring `origin` to RemoteA and refreshing state, `pushTag` for `ok-tag` succeeded and RemoteA contained the Tag.
- `C:\tmp` fixed delete regression: stale `deleteRemoteTag` with RemoteA snapshot after external switch to RemoteB returned HTTP 400; both RemoteA and RemoteB still contained `stale-delete`.
- `C:\tmp` fresh delete regression: after restoring `origin` to RemoteA and refreshing state, `deleteRemoteTag` for `ok-delete` succeeded and RemoteA no longer contained the Tag.

### Notes
- `server.js`：新增 Tag 远端写操作的远端 URL 快照校验，缺少远端快照的旧 Tag 请求会被拒绝。
- `public/js/panels/recovery-settings.js`：Tag 推送/删除远端请求固定页面默认远端并携带 fetch/push URL 快照，确认提示显示实际远端名。
- `README.md`：说明远端 Tag 推送/删除会校验页面看到的远端 URL。
- `docs/CONTINUE.md`：同步 Tag 管理状态和旧页面远端保护验证。
- Rollback: revert this task's changes in the files above, or reset to the commit before this task once it is committed.

## 2026-07-03 - Task: Guard stale upstream remote for sync actions

### What was done
- Reproduced a stale upstream push bug in a temporary `C:\tmp` repository: the page saw `feature -> origin/feature` and `origin -> RemoteA.git`, an external command changed `origin` to `RemoteB.git`, then an old `push` request passed the branch/HEAD snapshot and pushed the local ahead commit to RemoteB.
- Added upstream snapshot protection for pull, rebase pull, push, force-with-lease, and unset-upstream actions; these actions now compare the page's upstream and upstream remote URL with the live repository before running Git.
- Added default push remote snapshot protection for no-upstream smart push, so an old page cannot create upstream on a newly changed default remote.
- Updated README and continuation docs with the new sync protection behavior.

### Testing
- `C:\tmp` fixed upstream push regression: stale `push` after `origin` changed from RemoteA to RemoteB returned HTTP 400 with `upstream 远端 origin 的 URL 已经变化...`; RemoteB did not receive `feature`.
- `C:\tmp` fresh upstream push regression: after restoring `origin` to RemoteA and refreshing state, `push` succeeded and updated RemoteA.
- `C:\tmp` fixed no-upstream smart push regression: stale `push` after default `origin` changed from RemoteA to RemoteB returned HTTP 400 with `默认推送远端 origin 的 URL 已经变化...`; RemoteB did not receive `feature`.
- `C:\tmp` fresh no-upstream smart push regression: after restoring `origin` to RemoteA and refreshing state, `push` succeeded, RemoteA received `feature`, and upstream was established.

### Notes
- `server.js`：新增 upstream/默认推送远端快照校验，覆盖拉取、变基拉取、推送、安全强推和取消 upstream。
- `public/js/features/git-actions.js`：当前分支快照载荷增加页面 upstream、upstream 远端 URL，以及无 upstream 时的默认推送远端 URL。
- `README.md`：说明同步类操作会校验 upstream 和远端 URL。
- `docs/CONTINUE.md`：同步当前状态和本轮推送旧页面回归验证。
- Rollback: revert this task's changes in the files above, or reset to the commit before this task once it is committed.

## 2026-07-03 - Task: Guard stale remote list for fetch all

### What was done
- Reproduced a stale fetch-all bug in a temporary `C:\tmp` repository: the page saw `origin -> RemoteA.git` and `origin/feature` at RemoteA's commit, an external command changed `origin` to `RemoteB.git`, then an old `fetch` request ran `git fetch --all --prune` and force-updated the local tracking ref to RemoteB's commit.
- Added full remote-list snapshot protection for fetch-all actions so the server compares the page's remote names and fetch/push URLs with the live repository before running `git fetch --all --prune`.
- Updated the frontend fetch action to send the current remote list snapshot from the sync panel state.
- Updated README and continuation docs with the fetch-all stale remote protection behavior.

### Testing
- `C:\tmp` fixed regression: stale `fetch` after `origin` changed from RemoteA to RemoteB returned HTTP 400 with `远端 origin 的 URL 已经变化...`; `refs/remotes/origin/feature` stayed at the RemoteA commit.
- `C:\tmp` fresh regression: after restoring `origin` to RemoteA and refreshing state, `fetch` succeeded and updated `origin/feature` to RemoteA's later commit.

### Notes
- `server.js`：新增抓取全部远端前的完整远端列表和 URL 快照校验。
- `public/js/features/git-actions.js`：抓取全部远端请求携带页面看到的远端列表、fetch URL 和 push URL。
- `README.md`：说明 `git fetch --all --prune` 会校验页面远端列表和 URL。
- `docs/CONTINUE.md`：同步当前状态和本轮抓取全部旧页面回归验证。
- `progress.md`：追加本轮复现、修复、验证和回滚说明。
- Rollback: revert this task's changes in the files above, or reset to the commit before this task once it is committed.

## 2026-07-03 - Task: Guard stale remote URL for remote branch deletion

### What was done
- Reproduced a stale remote-branch deletion bug in a temporary `C:\tmp` repository: the page saw `origin -> RemoteA.git` and `origin/feature`, an external command changed `origin` to `RemoteB.git`, then an old `deleteRemoteBranch origin/feature` request deleted RemoteB's same-named branch while RemoteA remained untouched.
- Added remote URL snapshot protection for `deleteRemoteBranch`, deriving the remote name from the remote branch ref before the server runs `git push <remote> --delete <branch>`.
- Updated the frontend remote branch deletion request to send the page's fetch/push URL snapshot for the remote that owns the selected remote-tracking branch.
- Updated README and continuation docs with the additional stale remote protection.

### Testing
- `C:\tmp` reproduced regression before the fix: stale `deleteRemoteBranch origin/feature` after `origin` changed from RemoteA to RemoteB returned HTTP 200 and deleted RemoteB's `feature`; RemoteA's `feature` still existed.
- `C:\tmp` fixed regression: stale `deleteRemoteBranch origin/feature` with RemoteA URL snapshot after external switch to RemoteB returned HTTP 400 with `远端 origin 的 URL 已经变化...`; RemoteB's `feature` still existed.
- `C:\tmp` fresh regression: after restoring `origin` to RemoteA and refreshing state, `deleteRemoteBranch origin/feature` succeeded and deleted RemoteA's `feature`; RemoteB's `feature` still existed.

### Notes
- `server.js`：删除远端分支前校验页面看到的远端 fetch/push URL，避免远端 URL 被外部改过后删到错误仓库。
- `public/js/features/branches.js`：删除远端分支请求携带对应远端的 URL 快照。
- `README.md`：补充远端分支删除会校验远端 URL。
- `docs/CONTINUE.md`：同步当前状态和本轮远端分支删除旧页面回归验证。
- `progress.md`：追加本轮复现、修复、验证和回滚说明。
- Rollback: revert this task's changes in the files above, or reset to the commit before this task once it is committed.

## 2026-07-03 - Task: Guard stale remote URL for setting upstream

### What was done
- Reproduced a stale upstream configuration bug in a temporary `C:\tmp` repository: the page saw `origin -> RemoteA.git` and `origin/feature`, an external command changed `origin` to `RemoteB.git`, then an old `setUpstream origin/feature` request configured the current `topic` branch to track RemoteB's `origin/feature` semantics.
- Added remote URL snapshot protection for `setUpstream`, reusing the remote-branch ref to derive the target remote before writing branch config.
- Updated the frontend upstream action to send the page's fetch/push URL snapshot for the selected remote branch.
- Updated README and continuation docs with the additional stale remote protection.

### Testing
- `C:\tmp` reproduced regression before the fix: stale `setUpstream origin/feature` after `origin` changed from RemoteA to RemoteB returned HTTP 200 and wrote `topic -> origin/feature` while `origin` pointed to RemoteB.
- `C:\tmp` fixed regression: stale `setUpstream origin/feature` with RemoteA URL snapshot after external switch to RemoteB returned HTTP 400 with `远端 origin 的 URL 已经变化...`; `topic` still had no upstream.
- `C:\tmp` fresh regression: after restoring `origin` to RemoteA and refreshing state, `setUpstream origin/feature` succeeded and wrote `topic -> origin/feature` while `origin` pointed to RemoteA.

### Notes
- `server.js`：设置 upstream 前校验页面看到的目标远端 fetch/push URL，避免远端 URL 被外部改过后写入错误跟踪关系。
- `public/js/features/git-actions.js`：设置 upstream 请求携带对应远端的 URL 快照。
- `README.md`：补充设置 upstream 会校验目标远端 URL。
- `docs/CONTINUE.md`：同步当前状态和本轮设置 upstream 旧页面回归验证。
- `progress.md`：追加本轮复现、修复、验证和回滚说明。
- Rollback: revert this task's changes in the files above, or reset to the commit before this task once it is committed.

## 2026-07-03 - Task: Guard stale remote URL for remote branch target actions

### What was done
- Reproduced a stale remote-branch target bug in a temporary `C:\tmp` repository: the page saw `origin -> RemoteA.git` and RemoteA's `origin/feature`, an external command changed `origin` to `RemoteB.git`, then an old `mergeRef origin/feature` request merged the locally cached RemoteA tracking commit into the current branch while `origin` pointed at RemoteB.
- Added remote URL snapshot protection for remote-branch target actions: remote branch checkout, merge, rebase, create branch from remote branch, create worktree from remote branch, set upstream, and delete remote branch.
- Kept the server-side protection scoped to refs that are actually known remote-tracking branches, so local branch, Tag, `HEAD`, and SHA targets do not require a remote URL snapshot.
- Updated the relevant frontend requests to send the selected remote branch's fetch/push URL snapshot.

### Testing
- `C:\tmp` reproduced regression before the fix: stale `mergeRef origin/feature` after `origin` changed from RemoteA to RemoteB returned HTTP 200, created a merge commit, and added `from-remote-a.txt` from RemoteA while `origin` pointed to RemoteB.
- `C:\tmp` fixed regression: stale `mergeRef origin/feature` with RemoteA URL snapshot after external switch to RemoteB returned HTTP 400 with `远端 origin 的 URL 已经变化...`; no RemoteA or RemoteB feature file was merged and HEAD stayed on the original main commit.
- `C:\tmp` fresh regression: after restoring `origin` to RemoteA and refreshing state, `mergeRef origin/feature` succeeded and merged RemoteA's feature commit.

### Notes
- `server.js`：远端分支目标写操作执行前会校验页面看到的远端 fetch/push URL，避免旧页面使用错误远端 tracking。
- `public/js/features/git-actions.js`：远端分支签出、合并、变基和设置 upstream 请求携带目标远端 URL 快照。
- `public/js/features/branches.js`：从远端分支新建分支和删除远端分支请求携带目标远端 URL 快照。
- `public/js/panels/workspaces.js`：从远端分支创建 worktree 请求携带目标远端 URL 快照。
- `README.md`：补充远端分支目标动作会校验远端 URL。
- `docs/CONTINUE.md`：同步当前状态和本轮远端分支目标旧页面回归验证。
- `progress.md`：追加本轮复现、修复、验证和回滚说明。
- Rollback: revert this task's changes in the files above, or reset to the commit before this task once it is committed.

## 2026-07-03 - Task: Guard stale local target branch SHA for branch target actions

### What was done
- Reproduced a stale local target branch bug in a temporary `C:\tmp` repository: the page saw local `feature` at commit A, an external command advanced `feature` to commit B, then an old `mergeRef feature` request merged B into the current branch even though the page had shown A.
- Added target ref SHA snapshot protection for local and remote branch target actions: local branch checkout, remote branch checkout, merge, rebase, create branch from a branch ref, and create worktree from a branch ref.
- Updated frontend requests for those actions to send the page's target branch SHA when the selected target is a known local or remote branch.
- Updated README and continuation docs with the additional stale target branch protection.

### Testing
- `C:\tmp` reproduced regression before the fix: stale `mergeRef feature` after local `feature` advanced from A to B returned HTTP 200, created a merge commit, and added `from-feature-b.txt`.
- `C:\tmp` fixed regression after the fix: stale `mergeRef feature` with A as `expectedTargetSha` returned HTTP 400 with `本地分支 feature 已经变化。为避免旧页面使用错误提交，请刷新后重新操作。`; HEAD stayed on the original main commit and `from-feature-b.txt` was not merged.
- `C:\tmp` fresh regression after the fix: repeating `mergeRef feature` with B as `expectedTargetSha` succeeded and merged `from-feature-b.txt`.

### Notes
- `server.js`：分支目标写操作执行前会校验页面看到的目标本地/远端分支 SHA，避免旧页面使用外部移动后的同名分支提交。
- `public/js/features/git-actions.js`：本地/远端分支签出、合并和变基请求携带目标分支 SHA 快照。
- `public/js/features/branches.js`：从本地/远端分支新建分支请求携带目标分支 SHA 快照，并保留远端 URL 快照。
- `public/js/panels/workspaces.js`：从本地/远端分支创建 worktree 请求携带目标分支 SHA 快照，并保留远端 URL 快照。
- `README.md`：补充分支目标动作会校验目标分支 SHA。
- `docs/CONTINUE.md`：同步当前状态和本轮本地目标分支旧页面 SHA 回归验证。
- `progress.md`：追加本轮复现、修复、验证和回滚说明。
- Rollback: revert this task's changes in the files above, or reset to the commit before this task once it is committed.

## 2026-07-04 - Task: Guard stale worktree file snapshots for destructive file actions

### What was done
- Reproduced a stale-page data loss bug in a temporary `C:\tmp` repository: the page saw `note.txt` with `page version`, an external editor changed the same file to `external version`, then an old `discardWorktreeFile note.txt` request returned success and restored the file to committed `base`, losing the external edit.
- Added opaque file snapshots to `/api/state` and `/api/worktree`, based on Git status, index entries, and current worktree file content.
- Added server-side file snapshot checks for file-level and Diff-level write actions: stage, unstage, discard, conflict resolution, hunk operations, and selected-line operations.
- Added an overall worktree snapshot check for broad worktree write actions: stage all, discard all, commit, amend, create stash, and apply patch.
- Updated frontend file, hunk, line, and broad worktree action requests to send the page's latest file/worktree snapshot.
- Updated README and continuation docs with the additional stale worktree protection.

### Testing
- `C:\tmp` reproduced regression before the fix: stale `discardWorktreeFile note.txt` after `note.txt` changed from `page version` to `external version` returned HTTP 200 and restored the file to `base`.
- `C:\tmp` fixed single-file regression: stale `discardWorktreeFile note.txt` with the old file snapshot returned HTTP 400 with `文件 note.txt 的内容或暂存状态已经变化。为避免旧页面操作到新的文件内容，请刷新后重新操作。`; `note.txt` still contained `external version`.
- `C:\tmp` fresh single-file regression: after refreshing `/api/worktree`, `discardWorktreeFile note.txt` with the new file snapshot succeeded and restored the file to `base`.
- `C:\tmp` fixed discard-all regression: stale `discardAll` with the old worktree snapshot returned HTTP 400 with `工作区状态已经变化。为避免旧页面操作到新的文件内容，请刷新后重新操作。`; `note.txt` still contained `external version`.
- `C:\tmp` fresh discard-all regression: after refreshing `/api/worktree`, `discardAll` with the new worktree snapshot succeeded and restored the file to `base`.

### Notes
- `server.js`：工作区状态读取会返回文件快照和整体工作区快照；文件级、Diff 级和整工作区写操作执行前会拒绝旧快照。
- `public/js/features/worktree-changes.js`：新增文件快照和工作区快照请求 payload helper。
- `public/js/features/git-actions.js`：文件动作、批量文件动作和当前分支写操作会携带对应快照，并在刷新工作区后保存新快照。
- `public/js/features/diff-workbench.js`：按块/按行操作会携带文件快照，刷新工作区后保存新快照。
- `README.md`：补充文件/工作区快照保护说明。
- `docs/CONTINUE.md`：同步当前状态和本轮旧页面文件快照回归验证。
- `progress.md`：追加本轮复现、修复、验证和回滚说明。
- Rollback: revert this task's changes in the files above, or reset to the commit before this task once it is committed.

## 2026-07-04 - Task: Guard stale in-progress Git operation snapshots

### What was done
- Reproduced a stale operation bug in a temporary `C:\tmp` repository: the page saw a `side-a` merge conflict, an external command aborted that merge and started a new `side-b` merge conflict at the same `main` HEAD, then the old page's `abortMerge` request aborted the new `side-b` merge.
- Added operation snapshots to `detectRepoOperation` for merge, rebase, cherry-pick, and revert, based on the relevant Git control files such as `MERGE_HEAD`, `rebase-merge`, `rebase-apply`, `CHERRY_PICK_HEAD`, `REVERT_HEAD`, and `sequencer`.
- Added server-side operation snapshot checks for continue/skip/abort actions so old pages cannot operate on a different in-progress Git operation with the same branch and HEAD.
- Updated frontend continue/skip/abort requests to send the page's operation type and snapshot.
- Updated README and continuation docs with the additional stale operation protection.

### Testing
- `C:\tmp` reproduced regression before the fix: stale `abortMerge` after replacing a `side-a` merge conflict with a `side-b` merge conflict returned HTTP 200, removed `.git/MERGE_HEAD`, and restored `shared.txt` to the `main` version.
- `C:\tmp` fixed regression after the fix: stale `abortMerge` with the old `side-a` operation snapshot returned HTTP 400 with `正在进行的合并已经变化。为避免旧页面操作到新的 Git 状态，请刷新后重新操作。`; `.git/MERGE_HEAD` still pointed to `side-b`.
- `C:\tmp` fresh regression after the fix: after refreshing `/api/state`, `abortMerge` with the new `side-b` operation snapshot succeeded and cleared `.git/MERGE_HEAD`.

### Notes
- `server.js`：进行中的 merge/rebase/cherry-pick/revert 会暴露操作快照，继续/跳过/中止前会拒绝旧快照。
- `public/js/features/git-actions.js`：继续/跳过/中止进行中 Git 操作时携带页面看到的操作类型和快照。
- `README.md`：补充进行中 Git 操作快照保护说明。
- `docs/CONTINUE.md`：同步当前状态和本轮旧页面操作快照回归验证。
- `progress.md`：追加本轮复现、修复、验证和回滚说明。
- Rollback: revert this task's changes in the files above, or reset to the commit before this task once it is committed.

## 2026-07-04 - Task: Guard checkout stash restore by stash SHA

### What was done
- Reproduced a stale checkout-stash restore bug in a temporary `C:\tmp` repository: two Forkline checkout stashes on the same branch had the same message, the page remembered the older stash, then `restoreCheckoutStash` restored and popped the newer inserted stash because the server matched only by message.
- Added checkout stash SHA capture when local or remote "stash and checkout" creates the automatic stash.
- Updated checkout stash lookup to include stash commit SHA and to find the exact SHA when restoring.
- Updated the frontend remembered checkout stash restore request to send the remembered stash SHA; legacy no-SHA records are forgotten before restore.
- Updated README and continuation docs with the checkout stash identity protection.

### Testing
- `C:\tmp` reproduced regression before the fix: old checkout stash SHA `9ad08d5...` remained in the stash list, but stale `restoreCheckoutStash` popped newer same-message stash `d78dfc9...` and restored `note.txt` to `new inserted stash content`.
- `C:\tmp` fixed regression after the fix: `restoreCheckoutStash` with the old stash SHA restored `note.txt` to `old checkout stash content`, popped the old stash, and preserved the newer same-message stash.

### Notes
- `server.js`：自动 checkout stash 创建后返回 SHA；恢复时按分支、完整消息和 SHA 精确定位 stash。
- `public/js/features/git-actions.js`：恢复 checkout stash 时携带 SHA，并丢弃旧版无 SHA 本地记录。
- `README.md`：补充“储藏并签出”恢复会校验 stash SHA。
- `docs/CONTINUE.md`：同步当前状态和本轮 checkout stash 身份回归验证。
- `progress.md`：追加本轮复现、修复、验证和回滚说明。
- Rollback: revert this task's changes in the files above, or reset to the commit before this task once it is committed.

## 2026-07-04 - Task: Guard stale submodule worktree snapshots

### What was done
- Reproduced a stale submodule sync bug in a temporary `C:\tmp` repository: the page saw the original `.gitmodules` URL, an external edit changed `.gitmodules`, then stale `syncSubmodules` still returned success and wrote the new URL into `.git/config`.
- Added `initSubmodules`, `updateSubmodules`, and `syncSubmodules` to the server-side worktree snapshot protection list so submodule writes reject stale `.gitmodules` or worktree state.
- Updated README and continuation docs to state that submodule write operations validate the current branch, HEAD, and worktree snapshot.

### Testing
- Reproduced regression before the fix in `C:\tmp\forkline-stale-submodule-sync-repro-20260703163045`: stale `syncSubmodules` returned HTTP 200 and changed `submodule.libs/sub.url` from `C:/tmp/Initial.git` to `C:/tmp/SubmoduleRemoteB.git`.
- Verified after the fix in `C:\tmp\forkline-stale-submodule-sync-verify-20260703163151`: stale `syncSubmodules` returned HTTP 400 with `工作区状态已经变化。为避免旧页面操作到新的文件内容，请刷新后重新操作。`, and `submodule.libs/sub.url` stayed `C:/tmp/Initial.git`.
- Verified the fresh-path regression after the fix: after refreshing `/api/state`, `syncSubmodules` with the new worktree snapshot returned HTTP 200 and synced `submodule.libs/sub.url` to `C:/tmp/SubmoduleRemoteB.git`.
- `node --check server.js`

### Notes
- `server.js`：子模块初始化、更新和同步动作纳入整体工作区快照校验。
- `README.md`：补充子模块写操作会校验工作区快照，避免旧 `.gitmodules` 状态被继续使用。
- `docs/CONTINUE.md`：同步当前状态和本轮子模块工作区快照回归验证。
- `progress.md`：追加本轮复现、修复、验证和回滚说明。
- Rollback: revert this task's changes in the files above, or reset to the commit before this task once it is committed.

## 2026-07-04 - Task: Guard stale stash worktree snapshots

### What was done
- Reproduced a stale stash pop bug in a temporary `C:\tmp` repository: the page saw a clean worktree with one stash, an external edit added a new file, then stale `popStash` still returned success, applied the stash, and removed it from the stash list.
- Added `applyStash`, `popStash`, `restoreCheckoutStash`, and `branchFromStash` to the server-side worktree snapshot protection list so stash operations that write into the worktree reject stale worktree state.
- Updated README and continuation docs to state that stash apply/pop/restore/branch operations validate the worktree snapshot in addition to branch and stash identity.

### Testing
- Reproduced regression before the fix in `C:\tmp\forkline-stale-stash-pop-repro-20260703163815`: stale `popStash` returned HTTP 200, dropped the stash, staged `stash.txt`, and left the externally added `external.txt` in the worktree.
- Verified after the fix in `C:\tmp\forkline-stale-stash-pop-verify-20260703163933`: stale `popStash` returned HTTP 400 with `工作区状态已经变化。为避免旧页面操作到新的文件内容，请刷新后重新操作。`, the stash was preserved, and `stash.txt` was not applied.
- Verified the fresh-path regression after the fix: after refreshing `/api/state`, `popStash` with the new worktree snapshot returned HTTP 200, applied `stash.txt`, and removed the stash.
- `node --check server.js`

### Notes
- `server.js`：储藏应用、弹出、签出恢复和从储藏创建分支动作纳入整体工作区快照校验。
- `README.md`：补充储藏写入工作区前会校验工作区快照。
- `docs/CONTINUE.md`：同步当前状态和本轮储藏工作区快照回归验证。
- `progress.md`：追加本轮复现、修复、验证和回滚说明。
- Rollback: revert this task's changes in the files above, or reset to the commit before this task once it is committed.

## 2026-07-04 - Task: Guard stale reset worktree snapshots

### What was done
- Reproduced a stale hard-reset bug in a temporary `C:\tmp` repository: the page saw a clean worktree, an external edit changed a tracked file, then stale `resetToCommit --hard` still returned success, moved `HEAD`, and discarded the external edit.
- Added `resetToCommit` to the server-side worktree snapshot protection list so soft/mixed/hard reset reject stale worktree state before moving the current branch or rewriting the index/worktree.
- Updated README and continuation docs to state that reset validates the worktree snapshot.

### Testing
- Reproduced regression before the fix in `C:\tmp\forkline-stale-reset-hard-repro-20260703164536`: stale `resetToCommit` hard returned HTTP 200, moved `HEAD` to the target commit, and changed `note.txt` from `external edit after page snapshot` back to `base`.
- Verified after the fix in `C:\tmp\forkline-stale-reset-hard-verify-20260703164637`: stale `resetToCommit` hard returned HTTP 400 with `工作区状态已经变化。为避免旧页面操作到新的文件内容，请刷新后重新操作。`, kept `HEAD` unchanged, and preserved `note.txt` as `external edit after page snapshot`.
- Verified the fresh-path regression after the fix: after refreshing `/api/state`, `resetToCommit` hard with the new worktree snapshot returned HTTP 200, moved `HEAD` to the target commit, and reset `note.txt` to `base`.
- `node --check server.js`

### Notes
- `server.js`：reset 动作纳入整体工作区快照校验。
- `README.md`：补充 reset 前会校验工作区快照，避免旧页面丢弃外部刚写入的改动。
- `docs/CONTINUE.md`：同步当前状态和本轮 reset 工作区快照回归验证。
- `progress.md`：追加本轮复现、修复、验证和回滚说明。
- Rollback: revert this task's changes in the files above, or reset to the commit before this task once it is committed.

## 2026-07-04 - Task: Guard stale checkout worktree snapshots

### What was done
- Reproduced a stale force-checkout bug in a temporary `C:\tmp` repository: the page saw one dirty tracked file and the user chose force checkout, an external edit then created a new untracked file, and stale `checkoutBranch --force` still returned success and deleted the newly created file.
- Added `checkoutBranch` and `checkoutRemoteBranch` to the server-side worktree snapshot protection list so keep/stash/force checkout reject stale worktree state before carrying, stashing, or discarding changes.
- Updated README and continuation docs to state that local and remote checkout validate the worktree snapshot.

### Testing
- Reproduced regression before the fix in `C:\tmp\forkline-stale-force-checkout-repro-20260703165233`: stale `checkoutBranch` force returned HTTP 200, switched from `main` to `dev`, and deleted `external-untracked.txt` that was created after the page snapshot.
- Verified after the fix in `C:\tmp\forkline-stale-force-checkout-verify-20260703165352`: stale `checkoutBranch` force returned HTTP 400 with `工作区状态已经变化。为避免旧页面操作到新的文件内容，请刷新后重新操作。`, stayed on `main`, kept `external-untracked.txt`, and preserved the original dirty tracked file.
- Verified the fresh-path regression after the fix: after refreshing `/api/state`, `checkoutBranch` force with the new worktree snapshot returned HTTP 200, switched to `dev`, and removed the current snapshot's untracked file as expected.
- `node --check server.js`

### Notes
- `server.js`：本地和远端分支签出动作纳入整体工作区快照校验。
- `README.md`：补充签出前会校验工作区快照，避免旧页面丢弃或储藏外部刚出现的改动。
- `docs/CONTINUE.md`：同步当前状态和本轮签出工作区快照回归验证。
- `progress.md`：追加本轮复现、修复、验证和回滚说明。
- Rollback: revert this task's changes in the files above, or reset to the commit before this task once it is committed.

## 2026-07-04 - Task: Guard stale branch rename current-branch snapshots

### What was done
- Reproduced a stale branch rename bug in a temporary `C:\tmp` repository: the page was on `main` and prepared to rename non-current `feature`, an external command switched to `feature`, then stale `renameBranch feature -> renamed-feature` still returned success and renamed the current branch.
- Added `renameBranch` to the server-side current branch snapshot protection list.
- Updated the branch rename frontend request to send the page's current branch and HEAD snapshot.
- Updated README and continuation docs to state that branch rename validates both the selected branch SHA and the current branch snapshot.

### Testing
- Reproduced regression before the fix in `C:\tmp\forkline-stale-rename-branch-repro-20260703165931`: stale `renameBranch` returned HTTP 200, current branch became `renamed-feature`, and `feature` disappeared from the local branch list.
- Verified after the fix in `C:\tmp\forkline-stale-rename-branch-verify-20260703170057`: stale `renameBranch` returned HTTP 400 with `当前分支已经从 main 切换到 feature。为避免把操作执行到错误分支，请刷新页面后重新操作。`, current branch stayed `feature`, and branch `feature` remained.
- Verified the fresh-path regression after the fix: after refreshing `/api/state` on `feature`, `renameBranch feature -> renamed-feature` returned HTTP 200 and current branch became `renamed-feature`.
- `node --check server.js`
- `node --check public/js/features/branches.js`

### Notes
- `server.js`：分支重命名动作纳入当前分支和 HEAD 快照校验。
- `public/js/features/branches.js`：重命名分支请求携带页面看到的当前分支和 HEAD。
- `README.md`：补充分支重命名前会校验当前分支快照，避免旧页面把外部切换后的当前分支改名。
- `docs/CONTINUE.md`：同步当前状态和本轮分支重命名快照回归验证。
- `progress.md`：追加本轮复现、修复、验证和回滚说明。
- Rollback: revert this task's changes in the files above, or reset to the commit before this task once it is committed.

## 2026-07-04 - Task: Guard stale merge and commit-copy worktree snapshots

### What was done
- Reproduced stale worktree bugs in temporary `C:\tmp` repositories: after the page saw a clean worktree, an external command added a new untracked file, then old `mergeRef` and `cherryPickCommit` requests still returned success and moved HEAD.
- Added worktree snapshot enforcement for `mergeRef`, `cherryPickCommit`, and `revertCommit`, so these operations now reject stale pages before creating a merge, picked, or reverse commit.
- Updated README and continuation notes to document that merge, cherry-pick, and revert now compare the page's worktree snapshot before writing.

### Testing
- Reproduced before the fix with service `http://127.0.0.1:5297`: stale `cherryPickCommit` in `C:\tmp\forkline-stale-cherrypick-repro-20260704010951` returned HTTP 200, moved HEAD from `2b69cf7` to `00bc298`, and left `outside.txt` untracked.
- Reproduced before the fix with service `http://127.0.0.1:5297`: stale `mergeRef` in `C:\tmp\forkline-stale-merge-repro-20260704011054` returned HTTP 200, moved HEAD from `325388b` to `65e9b54`, and left `outside.txt` untracked.
- Verified after the fix with service `http://127.0.0.1:5299`: stale `cherryPickCommit` in `C:\tmp\forkline-stale-cherrypick-final-20260704011418` returned HTTP 400 with `工作区状态已经变化。为避免旧页面操作到新的文件内容，请刷新后重新操作。`, and HEAD did not change.
- Verified after the fix with service `http://127.0.0.1:5299`: stale `mergeRef` in `C:\tmp\forkline-stale-merge-final-20260704011437` returned HTTP 400 with the same stale worktree message, and HEAD did not change.
- Verified after the fix with service `http://127.0.0.1:5299`: stale `revertCommit` in `C:\tmp\forkline-stale-revert-verify-20260704011305` returned HTTP 400 with the same stale worktree message, and HEAD did not change.
- Verified fresh snapshots still work: `cherryPickCommit` in `C:\tmp\forkline-fresh-cherrypick-verify-20260704011332` returned HTTP 200 and cleanly created commit `22c70b3`; `mergeRef` in `C:\tmp\forkline-fresh-merge-verify-20260704011354` returned HTTP 200 and cleanly created merge commit `f4f19f1`.
- Temporary services on ports `5297`, `5298`, and `5299` were stopped; temporary repositories created for this task were removed from `C:\tmp`.

### Notes
- `server.js`：把合并、挑选和还原动作纳入整体工作区快照校验。
- `README.md`：补充合并、挑选和还原会校验工作区快照的使用说明。
- `docs/CONTINUE.md`：同步当前状态和本轮旧页面工作区快照回归验证。
- `progress.md`：追加本轮合并、挑选和还原旧页面保护的实施与验证记录。
- Rollback: revert this task's changes in the files above, or reset to the commit before this task once it is committed.

## 2026-07-04 - Task: Guard stale in-progress operation worktree snapshots

### What was done
- Reproduced a stale in-progress operation bug in a temporary `C:\tmp` repository: the page saw a merge conflict, an external editor changed the conflicted file, then the old `abortMerge` request still returned success and discarded that external resolution content.
- Added worktree snapshot enforcement for merge, rebase, cherry-pick, and revert continue/skip/abort controls, so old conflict banners cannot continue, skip, or abort after the worktree has changed behind the page.
- Updated README and continuation notes to document that in-progress Git operation controls compare both the Git operation snapshot and the worktree snapshot.

### Testing
- Reproduced before the fix with service `http://127.0.0.1:5301`: stale `abortMerge` in `C:\tmp\forkline-stale-abort-merge-worktree-repro-20260704012303` returned HTTP 200, cleared `MERGE_HEAD`, and changed `shared.txt` from `external resolved important content` back to `main change`.
- Verified after the fix with service `http://127.0.0.1:5302`: stale `abortMerge` in `C:\tmp\forkline-stale-abort-merge-worktree-verify-20260704012358` returned HTTP 400 with `工作区状态已经变化。为避免旧页面操作到新的文件内容，请刷新后重新操作。`, kept `MERGE_HEAD`, and preserved `external resolved important content`.
- Verified fresh snapshots still work: `abortMerge` in `C:\tmp\forkline-fresh-abort-merge-worktree-verify-20260704012421` returned HTTP 200 and cleaned the merge state.
- Verified stale continue is also blocked: stale `continueMerge` in `C:\tmp\forkline-stale-continue-merge-worktree-verify-20260704012449` returned HTTP 400, kept `MERGE_HEAD`, and preserved the staged external resolution.
- Verified fresh continue still works: `continueMerge` in `C:\tmp\forkline-fresh-continue-merge-worktree-verify-20260704012513` returned HTTP 200 and created merge commit `bbcb818`.
- Temporary services on ports `5301` and `5302` were stopped; temporary repositories created for this task were removed from `C:\tmp`.

### Notes
- `server.js`：把合并、变基、挑选和还原的继续/跳过/中止动作纳入整体工作区快照校验。
- `README.md`：补充进行中 Git 操作按钮会同时校验操作快照和工作区快照。
- `docs/CONTINUE.md`：同步当前状态和本轮进行中操作工作区快照回归验证。
- `progress.md`：追加本轮进行中操作旧页面保护的实施与验证记录。
- Rollback: revert this task's changes in the files above, or reset to the commit before this task once it is committed.

## 2026-07-04 - Task: Guard stale pull worktree snapshots

### What was done
- Reproduced a stale pull bug in a temporary `C:\tmp` repository: the page saw a clean worktree and a fast-forwardable upstream, an external command added a new untracked file, then the old `pull` request still returned success and moved HEAD.
- Added worktree snapshot enforcement for `pull` and `pullRebase`, so old sync controls cannot move the current branch after the worktree changes behind the page.
- Updated README and continuation notes to document that pull and pull-rebase compare the page's worktree snapshot before writing.

### Testing
- Reproduced before the fix with service `http://127.0.0.1:5303`: stale `pull` in `C:\tmp\forkline-stale-pull-work-20260704013152` returned HTTP 200, moved HEAD from `6de7172` to `295a7d5`, and left `outside.txt` untracked.
- Verified after the fix with service `http://127.0.0.1:5304`: stale `pull` in `C:\tmp\forkline-stale-pull-work-verify-20260704013304` returned HTTP 400 with `工作区状态已经变化。为避免旧页面操作到新的文件内容，请刷新后重新操作。`, kept HEAD at `a2fe659`, and preserved `outside.txt`.
- Verified fresh `pull` still works: `pull` in `C:\tmp\forkline-fresh-pull-work-verify-20260704013330` returned HTTP 200 and fast-forwarded HEAD from `8c49eca` to `6eb3592`.
- Verified stale `pullRebase` is blocked: `pullRebase` in `C:\tmp\forkline-stale-pullrebase-work-verify-20260704013400` returned HTTP 400 with the same stale worktree message and kept HEAD at `e7b915e`.
- Verified fresh `pullRebase` still works: `pullRebase` in `C:\tmp\forkline-fresh-pullrebase-work-verify-20260704013426` returned HTTP 200 and fast-forwarded HEAD from `35367c6` to `37f2b57`.
- Temporary services on ports `5303` and `5304` were stopped; temporary repositories and bare remotes created for this task were removed from `C:\tmp`.

### Notes
- `server.js`：把拉取和变基拉取纳入整体工作区快照校验。
- `README.md`：补充拉取和变基拉取会校验工作区快照，避免旧页面在外部新改动旁移动当前分支。
- `docs/CONTINUE.md`：同步当前状态和本轮拉取类工作区快照回归验证。
- `progress.md`：追加本轮拉取旧页面保护的实施与验证记录。
- Rollback: revert this task's changes in the files above, or reset to the commit before this task once it is committed.

## 2026-07-04 - Task: Guard stale upstream target branch snapshots

### What was done
- Reproduced a stale upstream target bug in a temporary `C:\tmp` repository: the page saw `origin/feature` at commit A, an external command advanced and fetched `origin/feature` to commit B, then the old `setUpstream` request still returned success and configured the current branch to track the changed remote branch.
- Added target-ref SHA snapshot enforcement for `setUpstream`, matching the protection already used by checkout, merge, rebase, branch creation, and worktree creation.
- Updated the upstream UI action payload to send the page's target remote-branch SHA, and documented the new protection in README and continuation notes.

### Testing
- Reproduced before the fix with service `http://127.0.0.1:5481`: stale `setUpstream origin/feature` in `C:\tmp\forkline-upstream-target-stale-20260704014648` returned HTTP 200; the page saw `origin/feature = 37920878d01200ff0252160ef4f78351cf35d072`, the local tracking ref had moved to `2d9b4f1bded0f04e1780c455f0d5d38c341832c5`, and `topic` was configured with upstream `origin/feature`.
- Verified old scripts without target SHA are rejected with service `http://127.0.0.1:5482`: `setUpstream origin/feature` in `C:\tmp\forkline-upstream-target-fixed-20260704014859` returned HTTP 400 `目标分支状态已过期，请刷新后重新执行这个操作。`, and `topic` still had no upstream.
- Verified stale target SHA is rejected: the same fixed harness saw page SHA `57abad9242599380094250d61a4c559b515e78c6`, then local `origin/feature` moved to `f6a1a819dca4a3e02b80803f6694f3d1d3e71e0f`; old `setUpstream` returned HTTP 400 `远端分支 origin/feature 已经变化。为避免旧页面使用错误提交，请刷新后重新操作。`, and `topic` still had no upstream.
- Verified fresh snapshots still work: after refreshing state, `setUpstream origin/feature` returned HTTP 200 and `git rev-parse --abbrev-ref --symbolic-full-name @{u}` returned `origin/feature`.
- Temporary services on ports `5481` and `5482` were stopped.

### Notes
- `server.js`：把 `setUpstream` 纳入目标引用 SHA 快照校验。
- `public/js/features/git-actions.js`：设置 upstream 时提交目标远端分支 SHA 快照。
- `README.md`：补充设置 upstream 会校验目标远端分支 SHA 和目标远端 URL。
- `docs/CONTINUE.md`：同步当前状态和本轮设置 upstream 目标分支快照回归验证。
- `progress.md`：追加本轮 upstream 目标分支旧页面保护的实施与验证记录。
- Rollback: revert this task's changes in the files above, or reset to the commit before this task once it is committed.

## 2026-07-04 - Task: Guard stale worktree snapshots for .gitignore updates

### What was done
- Reproduced a stale `.gitignore` update bug in a temporary `C:\tmp` repository: the page saw only `logs/old.tmp`, an external edit added `logs/important.txt` and changed `.gitignore`, then the old “ignore directory” request still appended `/logs/`.
- Added `ignoreWorktreePath` to the server-side worktree snapshot protection list, so stale pages cannot append ignore rules after files or `.gitignore` change behind the page.
- Updated README and continuation notes to document that adding `.gitignore` rules validates the page's worktree snapshot.

### Testing
- Reproduced before the fix with service `http://127.0.0.1:5483`: stale `ignoreWorktreePath` in `C:\tmp\forkline-stale-ignore-worktree-20260704015647` returned HTTP 200, appended `/logs/`, and hid the externally added `logs/important.txt` from normal untracked status.
- Verified after the fix with service `http://127.0.0.1:5484`: an old request without `expectedWorktreeSnapshot` in `C:\tmp\forkline-stale-ignore-worktree-fixed-20260704015745` returned HTTP 400 `工作区状态已过期，请刷新后重新执行这个操作。`.
- Verified stale worktree snapshots are rejected: after external `logs/important.txt` and `.gitignore` changes, old `ignoreWorktreePath mode=directory` returned HTTP 400 `工作区状态已经变化。为避免旧页面操作到新的文件内容，请刷新后重新操作。`, and `.gitignore` did not contain `/logs/`.
- Verified fresh snapshots still work: after refreshing `/api/state`, `ignoreWorktreePath mode=directory` returned HTTP 200 and appended `/logs/`.
- Temporary services on ports `5483` and `5484` were stopped.

### Notes
- `server.js`：把加入 `.gitignore` 动作纳入整体工作区快照校验。
- `README.md`：补充加入 `.gitignore` 会校验工作区快照，避免旧页面写入旧忽略规则。
- `docs/CONTINUE.md`：同步当前状态和本轮 `.gitignore` 旧页面保护验证。
- `progress.md`：追加本轮 `.gitignore` 工作区快照保护的实施与验证记录。
- Rollback: revert this task's changes in the files above, or reset to the commit before this task once it is committed.

## 2026-07-04 - Task: Guard current-branch writes during in-progress Git operations

### What was done
- Reproduced a stale in-progress operation bug in a temporary `C:\tmp` repository: the page saw a resolved and staged merge with `side-a`, an external command aborted that merge and started a `side-b` merge with the same staged tree, then the old plain `commit` request still created a merge commit for `side-b`.
- Added the current Git operation snapshot to the shared current-branch action payload, so normal current-branch writes carry the page's merge/rebase/cherry-pick/revert identity when one exists.
- Added server-side operation-context enforcement for current-branch writes: if the repo is in an in-progress Git operation, stale or missing operation snapshots are rejected before the write action runs.
- Updated README and continuation notes to document that current-branch writes also bind to the in-progress Git operation when one exists.

### Testing
- Reproduced before the fix with service `http://127.0.0.1:5486`: old `commit` in `C:\tmp\forkline-stale-operation-commit-20260704021821` returned success and created merge commit `d2aa4ef`, whose second parent was `side-b` (`864770a`) even though the page's original `MERGE_HEAD` was `side-a`.
- Verified after the fix with service `http://127.0.0.1:5487`: the same stale `commit` request without `expectedOperationSnapshot` returned an error recorded as `进行中的 Git 操作状态已过期，请刷新后重新执行这个操作。`, and no old-page merge commit was created.
- Verified fresh operation snapshots still work: after refreshing state for the `side-b` merge, `commit` with `expectedOperationType = merge` and the current operation snapshot created merge commit `18c449a`.
- Verified normal commits are not broken when no Git operation is in progress: a follow-up `commit` without operation snapshot created `49863b4 normal commit after guard`.
- `node --check server.js` passed.
- `node --check public\js\features\git-actions.js` passed.
- `git diff --check` passed; Git only printed Windows LF-to-CRLF working-copy warnings.
- `rg -n "\[DEBUG-[A-Za-z0-9]+\]" server.js public\js README.md docs\CONTINUE.md progress.md` returned no debug markers.
- Temporary services on ports `5486` and `5487` were stopped, and temporary `C:\tmp\forkline-stale-operation-commit-*` directories were removed.

### Notes
- `server.js`：当前分支类写操作在仓库存在进行中 Git 操作时会校验页面看到的操作快照。
- `public/js/features/git-actions.js`：通用当前分支 payload 自动携带进行中 Git 操作快照。
- `README.md`：补充当前分支写操作会绑定进行中的 merge/rebase/cherry-pick/revert 快照。
- `docs/CONTINUE.md`：同步当前状态和本轮旧页面普通提交误操作新合并的验证记录。
- `progress.md`：追加本轮进行中 Git 操作上下文保护的实施与验证记录。
- Rollback: revert this task's changes in the files above, or reset to the commit before this task once it is committed.

## 2026-07-04 - Task: Fix file snapshot checks for staged rename worktree edits

### What was done
- Reproduced a legitimate file operation being blocked as stale: a temporary repo had `git mv old.txt new.txt` staged, then `new.txt` received an unstaged edit; calling `discardStagedFile` immediately after loading state returned “文件 new.txt 的内容或暂存状态已经变化”.
- Traced the mismatch to Git status semantics: full status reports `RM old.txt -> new.txt`, but path-limited `git status -- new.txt` reports `AM new.txt`, so the server compared a path-limited snapshot against the page's full-status snapshot.
- Updated file snapshot verification to fall back to full `git status -z` when the fast path-limited snapshot is missing or differs, preserving stale-page protection while allowing valid staged-rename operations.
- Updated README and continuation notes to document the staged-rename snapshot behavior.

### Testing
- Reproduced before the fix with service `http://127.0.0.1:5492` and temp repo `C:\tmp\forkline-rename-discard-20260704023533`: `discardStagedFile new.txt` returned the stale-file message even though no external edit occurred.
- Verified after the fix with service `http://127.0.0.1:5493` on the same repo: `discardStagedFile new.txt` returned “已暂存改动已丢弃”; `new.txt` still contained `base\nextra\n`, `old.txt` was absent, and status was `D old.txt` plus `?? new.txt`, preserving the worktree-side rename/edit.
- Verified stale protection still works with service `http://127.0.0.1:5494` and temp repo `C:\tmp\forkline-rename-stale-20260704023744`: after loading the page snapshot, an external edit changed `new.txt`; the old `discardStagedFile` request returned “文件 new.txt 的内容或暂存状态已经变化” and preserved `external\nchange\n`.

### Notes
- `server.js`：文件级快照校验在 pathspec 快照缺失或不一致时回退到全量工作区状态，修正暂存重命名加未暂存编辑的误判。
- `README.md`：补充暂存重命名文件会使用全量状态兜底校验。
- `docs/CONTINUE.md`：记录工作区旧页面保护和“丢已暂存”的重命名快照行为。
- `progress.md`：追加本轮 staged rename 文件快照误判的复现、修复和验证记录。
- Rollback: revert this task's changes in the files above, or reset to the commit before this task once it is committed.

## 2026-07-04 - Task: Protect reflog recovery point creation from stale branch pages

### What was done
- Reproduced the risk where a page loaded on `main` could try to create a Forkline recovery point from a reflog entry after an external command switched the repository to `dev`.
- Added `createRecoveryPointFromReflog` to the current-branch snapshot guarded actions so the server rejects stale branch/HEAD context before creating the recovery ref.
- Updated the reflog action UI path to send the page's current branch and HEAD when creating a recovery point, matching the existing restore-to-reflog protection.
- Updated README and continuation notes to document that reflog recovery point creation is also protected from old-page branch drift.

### Testing
- Ran `node --check server.js`.
- Ran `node --check public\js\panels\recovery-settings.js`.
- Verified through the real local API with temp repo `C:\tmp\forkline-reflog-create-verify-20260703185149`: a page snapshot from `main` was rejected after external `git switch dev` with “当前分支已经从 main 切换到 dev”; no `refs/forkline/recovery/...` ref was created.
- Verified the refreshed `dev` state could still create a reflog recovery point, producing `forkline/recovery/20260704-025152/dev/reflog-fa4d1f4`.
- The temp verification repo was cleaned after the run.

### Notes
- `server.js`：把 `createRecoveryPointFromReflog` 纳入当前分支快照保护。
- `public/js/panels/recovery-settings.js`：从 reflog 创建恢复点时发送页面看到的分支和 HEAD；普通恢复点删除路径不携带无效的创建分支判断。
- `README.md`：补充从引用日志创建恢复点会校验当前分支和 HEAD。
- `docs/CONTINUE.md`：同步 reflog 创建恢复点的旧页面保护说明。
- `progress.md`：追加本轮 reflog 恢复点创建防串分支的实施与验证记录。
- Rollback: revert this task's changes in the files above, or reset to the commit before this task once it is committed.

## 2026-07-04 - Task: Prevent stale-page force push from overwriting newly fetched upstream commits

### What was done
- Reproduced a fatal safe-force-push gap with a temporary bare remote: a page loaded while `origin/feature` pointed at the old upstream commit, then an external collaborator pushed a new commit and the local repo fetched it; the old page's `forcePushLease` request succeeded and overwrote the collaborator commit because plain `--force-with-lease` used the newly fetched tracking ref as its lease.
- Added `upstreamSha` to sync state and sent it back as `expectedUpstreamSha` with current-branch actions.
- Made `forcePushLease` reject stale pages when the local upstream tracking commit no longer matches the page snapshot.
- Changed the Git command to use an explicit lease, `--force-with-lease=refs/heads/<branch>:<upstreamSha>`, so the push stays bound to the page-confirmed upstream commit even if tracking changes after validation.
- Updated README and continuation notes to document the stronger safe-force-push guard.

### Testing
- Reproduced before the fix with temp repo `C:\tmp\forkline-force-lease-stale-20260703185848`: old page saw upstream `f665728`, collaborator pushed `9de4dde`, external `git fetch` updated local `origin/feature`, and stale `forcePushLease` overwrote the remote to local commit `4bfc42d`.
- Ran `node --check server.js`.
- Ran `node --check public\js\features\git-actions.js`.
- Verified after the fix with temp repo `C:\tmp\forkline-force-lease-fixed-20260703190323`: stale `forcePushLease` returned “upstream origin/feature 的提交已经变化”, and the remote stayed on collaborator commit `84b2f22`.
- Verified a refreshed state exposes `sync.upstreamSha = 84b2f22...` and a newly confirmed safe force push succeeds, moving the remote to local commit `a7ec651`.
- The temporary verification repos were cleaned after both runs.

### Notes
- `server.js`：同步状态返回 `upstreamSha`；安全强推校验页面看到的 upstream 提交，并使用显式 `--force-with-lease=<ref>:<sha>`。
- `public/js/features/git-actions.js`：当前分支快照请求携带 `expectedUpstreamSha`。
- `README.md`：补充安全强推会绑定页面看到的 upstream 提交。
- `docs/CONTINUE.md`：同步安全强推旧页面保护和显式 lease 说明。
- `progress.md`：追加本轮 safe-force-push 覆盖外部新提交风险的复现、修复和验证记录。
- Rollback: revert this task's changes in the files above, or reset to the commit before this task once it is committed.

## 2026-07-04 - Task: Guard worktree prune against unconfirmed stale records

### What was done
- Reproduced a scope mismatch in worktree cleanup: a page confirmed cleanup for one stale worktree record (`stale-one`), then an external action created another stale record (`stale-two`); the old `pruneWorktrees` request ran global `git worktree prune --verbose` and removed both records.
- Added a `worktreePruneSnapshot` to `/api/state` based only on prunable worktree records.
- Required `pruneWorktrees` and `pruneAllWorktrees` requests to carry that snapshot; stale pages are rejected when the prunable worktree list changes.
- Restricted single-record cleanup so it only runs when the current prunable list contains exactly that one record; if multiple stale records exist, the user must use the worktree page's “清理失效” action to confirm the full list.
- Updated README and continuation notes to document the stronger worktree cleanup guard.

### Testing
- Reproduced before the fix with temp repo `C:\tmp\forkline-worktree-prune-stale-20260703190801`: after the page saw only `stale-one`, external creation of `stale-two` followed by old `pruneWorktrees stale-one` removed both stale worktree records.
- Ran `node --check server.js`.
- Ran `node --check public\js\features\branches.js`.
- Ran `node --check public\js\panels\workspaces.js`.
- Verified after the fix with temp repo `C:\tmp\forkline-worktree-prune-fixed-20260703191240`: stale `pruneWorktrees stale-one` returned “失效 worktree 列表已经变化” and kept both records; fresh single cleanup with two stale records returned “当前有 2 条失效 worktree 记录”; fresh `pruneAllWorktrees` with the current snapshot removed both confirmed stale records.
- The temporary verification repos were cleaned after both runs.

### Notes
- `server.js`：返回并校验失效 worktree 快照，单项清理在多条失效记录存在时拒绝执行全局 prune。
- `public/js/features/branches.js`：单项 worktree 清理请求携带页面看到的失效记录快照。
- `public/js/panels/workspaces.js`：工作树页“清理失效”请求携带页面看到的失效记录快照。
- `README.md`：补充清理失效 worktree 前会校验失效记录列表，单项清理不会隐式清理多条。
- `docs/CONTINUE.md`：同步 worktree prune 旧页面保护和单项清理保护说明。
- `progress.md`：追加本轮 worktree prune 影响范围不一致的复现、修复和验证记录。
- Rollback: revert this task's changes in the files above, or reset to the commit before this task once it is committed.

## 2026-07-04 - Task: Keep remote push URL aligned when editing remote URL

### What was done
- Reproduced a remote URL edit bug with local bare remotes: `origin` had fetch URL pointing to remote A and a separate push URL pointing to remote B; Forkline's “修改 URL” changed fetch to remote C but left push pointing to remote B.
- Updated remote URL editing so after `git remote set-url <remote> <url>`, Forkline rereads the remote details and runs `git remote set-url --push <remote> <url>` only when the displayed push URL still differs.
- Updated README and continuation notes to document that editing a remote URL keeps fetch and push destinations aligned.

### Testing
- Reproduced before the fix with temp repo `C:\tmp\forkline-remote-url-stale-push-20260703191752`: after `setRemoteUrl origin <remote-c>`, `git remote -v` showed `<remote-c> (fetch)` but still `<remote-b> (push)`.
- Ran `node --check server.js`.
- Ran `node --check public\js\features\git-actions.js`.
- Verified after the fix with temp repo `C:\tmp\forkline-remote-url-fixed-20260703191857`: `git remote -v` showed `<remote-c> (fetch)` and `<remote-c> (push)`, with no old push URL left.
- The temporary verification repos were cleaned after both runs.

### Notes
- `server.js`：修改远端 URL 后复查 push URL，必要时同步更新 push URL。
- `README.md`：补充修改远端 URL 会同时保证 fetch/push 指向新地址。
- `docs/CONTINUE.md`：同步远端 URL 修改加固说明。
- `progress.md`：追加本轮远端 push URL 残留旧地址的复现、修复和验证记录。
- Rollback: revert this task's changes in the files above, or reset to the commit before this task once it is committed.

## 2026-07-04 - Task: Guard Tag start refs for branch and worktree creation

### What was done
- Reproduced a stale Tag target bug: a page saw Tag `v1` at commit A, an external command moved `v1` to commit B, and the old `createWorktree` request with `ref: "v1"` created a worktree at commit B without warning.
- Added Tag objects to the frontend target-ref snapshot payload used by branch/worktree creation.
- Extended backend target-ref snapshot validation so Tag start refs are checked against the page-seen Tag object SHA, not only local/remote branch refs.
- Updated README and continuation notes to document that Tag start refs are protected from old-page drift.

### Testing
- Reproduced before the fix with temp repo `C:\tmp\forkline-tag-target-stale-20260703192404`: old page saw `v1` at `d8ebaa4`, external `git tag -f v1` moved it to `ead87df`, and `createWorktree` created the worktree at `ead87df`.
- Ran `node --check server.js`.
- Ran `node --check public\js\features\branches.js`.
- Verified after the fix with temp repo `C:\tmp\forkline-tag-target-fixed-20260703192541`: stale `createWorktree` returned “Tag v1 已经变化” and did not create the target path; refreshed state with the new Tag SHA created the worktree at `8d1d995`.
- The temporary verification repos were cleaned after both runs.

### Notes
- `server.js`：目标引用快照校验覆盖本地 Tag，并对 Tag 使用对象 SHA 校验，避免外部移动 Tag 后旧页面继续使用新目标。
- `public/js/features/branches.js`：目标引用快照 payload 支持从页面 Tag 列表读取 Tag 对象 SHA。
- `README.md`：补充从 Tag 新建分支/创建工作树会校验页面看到的 Tag 对象。
- `docs/CONTINUE.md`：同步 Tag 起点引用旧页面保护说明。
- `progress.md`：追加本轮 Tag 起点过期导致工作树创建到错误提交的复现、修复和验证记录。
- Rollback: revert this task's changes in the files above, or reset to the commit before this task once it is committed.

## 2026-07-04 - Task: Handle multiple remote push URLs when editing a remote

### What was done
- Closed the remaining remote URL edit edge case where a remote configured with multiple `remote.<name>.pushurl` values could leave fetch changed to the new URL while old push URLs still pointed at previous repositories.
- Preserved the full push URL list in remote state and included it in frontend snapshots for sync, upstream, remote branch, tag remote, and all-remotes fetch actions.
- Updated backend stale-page checks to compare the complete push URL list instead of only the first displayed push URL.
- Changed remote URL editing so explicit push URLs are replaced through Git config after the fetch URL update; multiple old push URLs are collapsed to the new single push destination.
- Updated README and continuation notes to document full push URL list validation and multi-push URL replacement.

### Testing
- Ran `node --check server.js`.
- Ran `node --check public\js\features\git-actions.js`.
- Ran `node --check public\js\features\branches.js`.
- Ran `node --check public\js\panels\workspaces.js`.
- Ran a real API regression with temp repo `C:\tmp\forkline-remote-url-multi-push-fixed-20260704034004`: page state saw `origin` with two push URLs, an external command added a third push URL, stale `setRemoteUrl` returned “URL 已经变化”, refreshed `setRemoteUrl` succeeded, and `remote.origin.pushurl` ended as exactly one URL pointing to the new remote.
- Ran `git diff --check`.
- Ran `rg -n "\[DEBUG-[A-Za-z0-9]+\]" server.js public\js README.md docs\CONTINUE.md progress.md`; no debug markers were found.
- Confirmed no `C:\tmp\forkline-remote-url-multi-push-fixed-*` temp directories remained.

### Notes
- `server.js`：远端状态保留完整 `pushUrls`，远端快照校验比较完整列表，修改远端 URL 时替换所有显式 push URL。
- `public/js/features/git-actions.js`：同步、远端和上游相关动作携带完整 push URL 列表。
- `README.md`：补充多 push URL 校验和修改 URL 时收敛到新地址的行为说明。
- `docs/CONTINUE.md`：同步远端 URL 管理当前能力说明。
- `progress.md`：追加本轮多 push URL 边界的实施与验证记录。
- Rollback: revert this task's changes in the files above, or reset to the commit before this task once it is committed.

## 2026-07-04 - Task: Reject stale real remote branch targets before using local tracking refs

### What was done
- Reproduced a severe stale remote-target bug: a page saw `origin/feature` at commit A, another clone pushed commit B to the real remote, local tracking stayed at A, and the old page successfully created a new local branch from stale `origin/feature` at A.
- Extended target-ref snapshot validation for remote branches so it checks both the local tracking ref and the real remote branch SHA from `git ls-remote`.
- When the real remote branch is missing or no longer points at the page-seen SHA, Forkline now runs `fetch --prune` to refresh local remote refs and rejects the old-page request.
- This protection covers remote branch checkout, setting upstream, merge, rebase, create branch, and create worktree because they share the same target-ref snapshot path.
- Updated README and continuation notes to document real remote SHA validation for remote branch targets.

### Testing
- Reproduced before the fix with temp repo `C:\tmp\forkline-stale-remote-target-repro-20260704034747`: page state saw `origin/feature = d3f3376`, collaborator pushed real remote to `b325c49`, and stale `createBranch` created `from-remote-stale` at old local tracking `d3f3376`.
- Ran `node --check server.js`.
- Verified after the fix with temp repo `C:\tmp\forkline-stale-remote-target-fixed-20260704034926`: stale `createBranch` returned “远端分支 origin/feature 已经变化”, created no branch, refreshed state updated `origin/feature` to `92670a5`, and fresh `createBranch` created `from-remote-fresh` at `92670a5`.
- The temporary verification repos were cleaned after both runs.

### Notes
- `server.js`：远端分支目标快照校验增加真实远端 SHA 对比，并在变化/缺失时抓取刷新后拒绝旧页面操作。
- `README.md`：补充远端分支目标会校验真实远端 SHA。
- `docs/CONTINUE.md`：同步远端分支目标旧页面保护说明。
- `progress.md`：追加本轮真实远端推进但本地 tracking 未更新导致旧页面使用过期目标的复现、修复和验证记录。
- Rollback: revert this task's changes in the files above, or reset to the commit before this task once it is committed.

## 2026-07-10 - Task: Make remote branch and Tag deletion atomic

### What was done
- Reproduced a fatal check-then-delete race for both remote branches and remote Tags: another collaborator could update the confirmed remote ref after Forkline's `ls-remote` check but before the delete push connected, and the old request would delete the newly updated ref.
- Bound remote branch deletion to the confirmed remote branch SHA with an explicit `--force-with-lease`, so Git rejects the deletion atomically if the branch changes after validation.
- Bound remote Tag deletion to the confirmed remote Tag object SHA with the same explicit lease protection.
- Added operation-specific Chinese stale-lease errors for remote branch deletion and remote Tag deletion while preserving the existing safe-force-push message.
- Updated README and continuation notes to document the atomic remote-ref deletion behavior.

### Testing
- Reproduced before the fix through the real Forkline API on `http://127.0.0.1:5510` with temp repo `C:\tmp\forkline-remote-delete-race-20260710`: the page confirmed `origin/feature = 60f888c`, a receive-pack test wrapper pushed collaborator commit `dbaeebb` before the delete push advertised refs, and `deleteRemoteBranch` still returned HTTP 200. The bare remote contained the `dbaeebb` commit object but no longer had `refs/heads/feature`.
- Reproduced the same pre-fix race for Tag `race-tag`: the page confirmed object `60f888c`, the wrapper moved the remote Tag to collaborator object `a73e3d5`, and `deleteRemoteTag` still returned HTTP 200. The bare remote contained `a73e3d5` but no longer had `refs/tags/race-tag`.
- Verified the fix through `http://127.0.0.1:5511`: stale branch deletion returned HTTP 400 with “远端分支删除被 Git 拒绝”, and `refs/heads/feature` remained at collaborator commit `a73e3d5`.
- Verified stale Tag deletion returned HTTP 400 with “远端 Tag 删除被 Git 拒绝”, and `refs/tags/race-tag` remained at collaborator object `a73e3d5`.
- Verified fresh branch and Tag snapshots still delete normally: both API requests returned HTTP 200, and the corresponding remote refs were absent afterward.
- Ran `node --check server.js`.
- Ran `git diff --check`; it passed with only Windows LF-to-CRLF working-copy warnings.
- Ran `rg -n "\[DEBUG-[A-Za-z0-9]+\]" server.js public\js README.md docs\CONTINUE.md progress.md`; no debug markers were found.
- Stopped temporary services on ports `5510` and `5511`, then removed `C:\tmp\forkline-remote-delete-race-20260710` after verifying the target path was inside `C:\tmp`.

### Notes
- `server.js`：远端分支和远端 Tag 删除使用确认对象 SHA 的显式 lease，并为并发变化返回对应中文提示。
- `README.md`：补充远端分支和 Tag 删除的原子 SHA 保护及实际 Git 命令。
- `docs/CONTINUE.md`：同步远端引用删除的当前保护能力和协作竞态行为。
- `progress.md`：追加本轮远端分支/Tag 并发删除数据丢失问题的复现、修复和验证记录。
- Rollback: revert this task's changes in the files above, or reset to commit `cdf4fdf` before this task is committed.

## 2026-07-10 - Task: Block branch checkout during unfinished Git operations

### What was done
- Reproduced a destructive half-completed force-checkout flow while a rebase was paused: Forkline discarded the user's current work with `reset --hard` and `git clean`, then Git rejected `switch --force` because the rebase was still active.
- Added a shared preflight for local branch checkout and remote branch checkout that rejects any checkout while merge, rebase, cherry-pick, or revert is unfinished.
- Kept the current Git operation untouched and instructed the user to continue or abort it explicitly; Forkline does not silently abort an operation on the user's behalf.
- Updated README and continuation notes to document that this guard runs before stash, reset, clean, or switch.

### Testing
- Confirmed the underlying Git sequence in temp repo `C:\tmp\forkline-force-checkout-20260710`: during a paused rebase, `git reset --hard HEAD` removed `resolution-work`, then `git switch --force main` failed with `cannot switch branch while rebasing`; HEAD stayed detached and `.git/rebase-merge` remained.
- Reproduced before the fix through the real Forkline API on `http://127.0.0.1:5512`: `checkoutBranch main mode=force` returned HTTP 400 after deleting `api-resolution-work`; the repository remained on detached HEAD with the rebase still active.
- Verified after the fix through `http://127.0.0.1:5513`: the same request returned HTTP 400 with “仓库还有未完成操作：变基未完成。请先继续或中止后再切换分支。” before destructive commands ran; `preserved-after-fix` remained in `base.txt`, the file stayed modified, and `.git/rebase-merge` remained.
- Verified the normal force-checkout control after aborting the rebase: a dirty `feature` branch returned HTTP 200, discarded the confirmed test edit, switched to `main`, and ended with a clean worktree.
- Ran `node --check server.js`.
- Ran `git diff --check`; it passed with only Windows LF-to-CRLF working-copy warnings.
- Ran `rg -n "\[DEBUG-[A-Za-z0-9]+\]" server.js public\js README.md docs\CONTINUE.md progress.md`; no debug markers were found.
- Stopped temporary services on ports `5512` and `5513`, then removed `C:\tmp\forkline-force-checkout-20260710` after verifying the target path was inside `C:\tmp`.

### Notes
- `server.js`：本地/远端分支签出在未完成 Git 操作存在时，于任何储藏或丢弃动作前拒绝执行。
- `README.md`：补充未完成 merge/rebase/cherry-pick/revert 时的签出保护和业务原因。
- `docs/CONTINUE.md`：同步签出前置保护及失败前不改动工作区的行为。
- `progress.md`：追加本轮强制签出失败后修改已丢失问题的复现、修复和验证记录。
- Rollback: revert this task's changes in the files above, or reset to commit `cdf4fdf` before these uncommitted tasks.

## 2026-07-10 - Task: Protect submodule data from parent discard-all operations

### What was done
- Reproduced that parent-repository “discard all” could report success while leaving an initialized submodule on a different local commit with modified and untracked files.
- Confirmed a more destructive configuration-dependent variant: with `submodule.recurse=true`, the parent `reset --hard` silently moved the submodule from its local commit back to the recorded gitlink and deleted tracked submodule edits.
- Added a preflight at the shared discard-all entry used by “丢弃全部” and local/remote force checkout. It rejects before parent reset/clean when an initialized submodule has internal changes, conflicts, or a commit mismatch.
- Kept submodule cleanup explicit instead of recursively deleting a separate repository on the user's behalf, and included affected submodule paths in the Chinese error.
- Updated README and continuation notes to document the submodule repository boundary.

### Testing
- Reproduced before the fix through the real Forkline API on `http://127.0.0.1:5514` with temp repo `C:\tmp\forkline-discard-submodule-20260710`: the parent had a normal file edit, while `modules/child` was at local commit `b7b0172`, ahead of recorded gitlink `2214d7e`, with one modified and one untracked file. `discardAll` returned HTTP 200 and removed the parent edit, but the API still reported `modules/child` dirty with both child changes intact.
- Verified the Git configuration hazard in the same fixture: after setting `submodule.recurse=true`, parent `git reset --hard HEAD` moved the child HEAD from `b7b0172` to `2214d7e` and removed the tracked child edit, leaving only the untracked file.
- Verified after the fix through `http://127.0.0.1:5515`: with both child worktree changes and commit mismatch present, `discardAll` returned HTTP 400 with the affected path and preserved the parent file, child HEAD, child modification, and untracked file.
- Verified a clean child worktree still receives protection when only its HEAD differs from the parent gitlink: `dirtyCount = 0`, `status = changed`, and `discardAll` returned HTTP 400 before touching the parent edit.
- Verified the normal control with the child aligned to `2214d7e` and clean: `discardAll` returned HTTP 200 and cleaned the parent edit.
- Verified the shared force-checkout path: with the child on local commit `b7b0172`, `checkoutBranch target mode=force` returned HTTP 400 and preserved the current `main` branch, parent edit, and child commit.
- Ran `node --check server.js`.
- Ran `git diff --check`; it passed with only Windows LF-to-CRLF working-copy warnings.
- Ran `rg -n "\[DEBUG-[A-Za-z0-9]+\]" server.js public\js README.md docs\CONTINUE.md progress.md`; no debug markers were found.
- Stopped temporary services on ports `5514` and `5515`, then removed `C:\tmp\forkline-discard-submodule-20260710` after verifying the target path was inside `C:\tmp`.

### Notes
- `server.js`：父仓库丢弃全部和强制签出在独立子模块状态存在时，于 reset/clean 前拒绝并列出路径。
- `README.md`：补充子模块仓库边界及 `submodule.recurse=true` 下的风险保护。
- `docs/CONTINUE.md`：同步对子模块内部修改、冲突和 gitlink 偏移的前置保护行为。
- `progress.md`：追加本轮父仓库丢弃操作误报成功或静默删除子模块数据的复现、修复和验证记录。
- Rollback: revert this task's changes in the files above, or reset to commit `cdf4fdf` before these uncommitted tasks.

## 2026-07-10 - Task: Protect submodule data from parent single-file discard

### What was done
- Reproduced that selecting a submodule row and running the parent repository's single-file discard returned success even though the child repository remained dirty under the default Git configuration.
- Confirmed the destructive configuration-dependent variant: with `submodule.recurse=true`, the same action silently removed tracked modifications inside the independent child repository.
- Confirmed the existing file snapshot could not close this gap because a submodule worktree is represented as a directory; child changes added after the page snapshot did not change the parent file snapshot and were also deleted by the stale request.
- Added a preflight that identifies index entries with gitlink mode `160000` and rejects parent-repository single-file discard before `git restore` can run.
- Kept child-repository cleanup explicit and added a Chinese error directing the user to enter the submodule and commit, stash, or restore there.
- Updated README and continuation notes with the single-file submodule boundary.

### Testing
- Reproduced before the fix through the real Forkline API on `http://127.0.0.1:5290` with temp repo `C:\tmp\forkline-submodule-discard-20260710-2`: under the default configuration, `discardWorktreeFile modules/child` returned HTTP 200 and “工作区改动已丢弃”, while the child still had ` M server.js` and the parent still had ` m modules/child`.
- Reproduced the destructive variant after setting repository-local `submodule.recurse=true`: the same HTTP 200 action removed the child's uncommitted `server.js` modification and left both parent and child clean.
- Reproduced the stale-page variant with snapshot `5cbdb7a9eb464c85a0ea4f11e03e5ca8f8713756517426041a9b23e24122d44b`: the page saw one child modification, a second tracked child file changed during the request delay, and the old request still returned HTTP 200 and removed both changes.
- Verified after the fix with `submodule.recurse=true`: the API returned HTTP 400 with “路径 modules/child 是独立 Git 子模块”, and preserved child modifications in `README.md` and `server.js` plus parent status ` m modules/child`.
- Verified the stale-page regression after the fix: a third child modification in `docs/CONTINUE.md` was added after the page snapshot; the old request returned HTTP 400 and all three child files remained modified.
- Verified the default-configuration regression after unsetting `submodule.recurse`: the same submodule action returned HTTP 400 instead of false success and preserved the child changes.
- Verified an ordinary parent file control: modifying `.gitmodules` and discarding only that file returned HTTP 200, restored `.gitmodules`, and left the independent child modifications untouched.
- Ran `node --check server.js`.
- Ran `git diff --check`; it passed with only Windows LF-to-CRLF working-copy warnings.
- Ran `rg -n "\[DEBUG-[A-Za-z0-9]+\]" server.js public README.md docs\CONTINUE.md progress.md`; no debug markers were found.
- Stopped temporary services on ports `5289` and `5290`; both returned HTTP code `000` afterward. Verified and removed `C:\tmp\forkline-submodule-discard-20260710-2`; the failed first fixture path and temporary API harness were also absent.

### Notes
- `server.js`：父仓库单文件丢弃在目标索引项是 gitlink 时，于执行 `git restore` 前拒绝。
- `README.md`：补充工作区子模块路径不能作为普通父仓库文件丢弃，以及默认/递归配置下的风险。
- `docs/CONTINUE.md`：同步 gitlink 前置检查、中文提示和普通父仓库文件控制行为。
- `progress.md`：追加本轮单文件丢弃误报成功、递归删除和旧快照跨子模块删除的复现与验证证据。
- Rollback: reverse this task's guard and documentation lines, or run `git restore --source=cdf4fdf -- server.js README.md docs/CONTINUE.md progress.md` to roll back the full current uncommitted batch.

## 2026-07-10 - Task: Protect hidden submodule changes from hard reset operations

### What was done
- Reproduced that a parent repository can appear completely clean while an initialized submodule contains uncommitted changes when `submodule.<name>.ignore=dirty` is configured.
- Confirmed three destructive paths crossed that hidden repository boundary when `submodule.recurse=true`: hard reset to a commit, restore from a Forkline recovery point, and restore from a reflog entry.
- Reused the recursive submodule preflight before every confirmed parent `reset --hard` entry. It now blocks hard reset, recovery-point restore, and reflog restore before creating a recovery ref or changing HEAD when a child repository has internal changes, conflicts, or a gitlink commit mismatch.
- Kept soft and mixed reset unchanged because they do not update the submodule worktree.
- Added operation-specific Chinese errors so the user sees whether hard reset, recovery-point restore, or reflog restore was blocked.
- Updated README and continuation notes with the hidden-dirty-submodule case and the affected reset operations.

### Testing
- Reproduced before the fix through the real Forkline API on `http://127.0.0.1:5291` with temp repo `C:\tmp\forkline-submodule-hard-reset-20260710`: parent `git status --short` and API `workingFiles` were empty, while the submodule panel reported `dirtyCount = 1` and child status was ` M server.js`.
- With repository-local `submodule.recurse=true` and `submodule.modules/child.ignore=dirty`, `resetToCommit mode=hard` returned HTTP 200, moved parent HEAD from `022c68c` to `b7cfa90`, and silently removed the child `server.js` modification.
- Recreated the hidden child edit and verified `restoreRecoveryPoint` returned HTTP 200, moved HEAD back to `022c68c`, and again removed the child modification despite the parent clean-worktree check.
- Recreated it again and verified `restoreReflogEntry` returned HTTP 200, moved HEAD to the selected reflog commit, and removed the child modification.
- Verified after the fix that hard reset returned HTTP 400 with “子模块包含独立仓库改动，不能执行硬重置”; child status remained ` M server.js`, parent HEAD stayed `b7cfa90`, and the recovery-ref count stayed at 6, proving the rejection happened before recovery-point creation.
- Verified recovery-point restore returned HTTP 400 with “不能恢复到恢复点”, and reflog restore returned HTTP 400 with “不能恢复引用日志记录”; both preserved the child modification and parent HEAD.
- Verified the non-destructive control: `resetToCommit mode=soft` returned HTTP 200, moved parent HEAD to `022c68c`, and preserved child status ` M server.js`.
- Verified clean-submodule controls: after restoring the child file, hard reset returned HTTP 200 and moved HEAD to `b7cfa90`; restoring the existing recovery point also returned HTTP 200 and moved HEAD back to `022c68c`.
- Ran `node --check server.js`.
- Ran `git diff --check`; it passed with only Windows LF-to-CRLF working-copy warnings.
- Ran `rg -n "\[DEBUG-[A-Za-z0-9]+\]" server.js public README.md docs\CONTINUE.md progress.md`; no debug markers were found.
- Stopped the temporary service on port `5291` and verified it returned HTTP code `000`; removed the temporary API harness. Recursive deletion of `C:\tmp\forkline-submodule-hard-reset-20260710` was requested twice after verifying the absolute path, but the automatic permission review timed out both times, so that test-only fixture remains for later cleanup.

### Notes
- `server.js`：硬重置、恢复点恢复和引用日志恢复在创建恢复点或执行 `reset --hard` 前检查真实递归子模块状态，并输出对应中文阻止原因。
- `README.md`：补充被 `ignore=dirty` 隐藏的子模块修改仍受保护，以及 soft / mixed reset 不受影响。
- `docs/CONTINUE.md`：同步三个破坏性 reset 入口的子模块边界保护和控制行为。
- `progress.md`：追加隐藏子模块修改被 hard reset、恢复点和 reflog 恢复删除的复现、修复、回归和清理缺口。
- Rollback: reverse this task's three guard calls and documentation lines, or run `git restore --source=cdf4fdf -- server.js README.md docs/CONTINUE.md progress.md` to roll back the full current uncommitted batch.

## 2026-07-10 - Task: Protect staged submodule changes from parent discard

### What was done
- Reproduced a configuration-dependent data-loss bug in the parent repository's “丢弃已暂存修改” action for a staged submodule gitlink.
- Confirmed that `submodule.<name>.ignore=dirty` hid the child worktree modification from the parent status row, causing `discardStagedFile` to choose `git restore --source=HEAD --staged --worktree` instead of the index-only path.
- Confirmed that `submodule.recurse=true` then moved the child checkout back to the parent-recorded commit and silently removed the independent child file modification.
- Reused the submodule discard boundary for staged-file discard. Gitlink detection now checks both the index and `HEAD`, so staged submodule deletion cannot bypass the guard when the index entry is already absent.
- Added a Chinese error that directs the user to “取消暂存” when they only want to undo the parent gitlink staging, or to enter the child repository before updating the parent record.
- Kept ordinary staged-file discard and submodule unstage behavior unchanged.
- Updated README and continuation notes with the staged gitlink rule and safe alternative.

### Testing
- Reproduced before the fix through the real Forkline API on `http://127.0.0.1:5292` with temp repo `C:\tmp\forkline-submodule-hard-reset-20260710`: parent status was only `M  modules/child`, the index gitlink pointed to `c4d4c9e`, child HEAD was `c4d4c9e`, and child status was ` M server.js` while `ignore=dirty` hid that worktree side.
- `discardStagedFile modules/child` returned HTTP 200 and “已暂存改动已丢弃”, moved child HEAD and the parent index gitlink to `cdf4fdf`, and removed the child `server.js` modification.
- Verified the safe alternative before the fix: recreating the same state and calling `unstageFile modules/child` returned HTTP 200, reset only the parent index to `cdf4fdf`, and preserved child HEAD `c4d4c9e` plus ` M server.js`.
- Verified the configuration distinction by unsetting `ignore=dirty`: parent status became `Mm modules/child`, the old discard path changed only the parent index, and the child modification remained. This proved the destructive branch depended on the hidden worktree status rather than the staged gitlink itself.
- Verified after the fix with the original hidden-dirty configuration: `discardStagedFile modules/child` returned HTTP 400 with “不能从父仓库丢弃它的已暂存修改”; parent status remained `M  modules/child`, the index and child HEAD stayed at `c4d4c9e`, and child status remained ` M server.js`.
- Verified “取消暂存” still returned HTTP 200 after the fix and preserved the child repository state.
- Verified an ordinary staged parent file control: staged `.gitmodules` discard returned HTTP 200, restored `.gitmodules`, and left child status ` M server.js` untouched.
- Verified staged gitlink deletion cannot bypass the guard: after `git rm --cached modules/child`, the index had no submodule entry and parent status was `D  modules/child`; the API still recognized the `HEAD` gitlink, returned HTTP 400, and preserved child HEAD `c4d4c9e` plus its file modification.
- Ran `node --check server.js`.
- Ran `git diff --check`; it passed with only Windows LF-to-CRLF working-copy warnings.
- Ran `rg -n "\[DEBUG-[A-Za-z0-9]+\]" server.js public README.md docs\CONTINUE.md progress.md`; no debug markers were found.
- Stopped the temporary service on port `5292` and verified it returned HTTP code `000`; removed the temporary API harness. After one automatic approval timeout and one retry, removed the verified `C:\tmp\forkline-submodule-hard-reset-20260710` fixture, closing the cleanup gap recorded by the preceding task.

### Notes
- `server.js`：已暂存文件丢弃在目标由索引或 `HEAD` 识别为 gitlink 时拒绝，并提示改用“取消暂存”；工作区子模块丢弃也获得 staged-deletion 识别补强。
- `README.md`：补充已暂存 gitlink 不能作为普通文件丢弃、取消暂存的安全语义，以及 staged deletion 保护。
- `docs/CONTINUE.md`：同步索引与 `HEAD` 双重 gitlink 检查和普通文件控制行为。
- `progress.md`：追加隐藏子模块修改被 staged discard 删除的复现、配置对照、修复、控制回归和完整清理证据。
- Rollback: remove the `discardStagedFile` submodule preflight, restore index-only gitlink detection if required, and reverse the related documentation lines; or run `git restore --source=cdf4fdf -- server.js README.md docs/CONTINUE.md progress.md` to roll back the full current uncommitted batch.

## 2026-07-11 - Task: Prevent partial pull failure when a dirty submodule is hidden

### What was done
- Reproduced a severe partial-success bug in fast-forward pull: the API returned an error, but the parent branch and upstream tracking ref had already moved to the fetched commit before recursive submodule update failed.
- Confirmed the failure depended on an initialized submodule containing internal modifications hidden from the parent status by `submodule.<name>.ignore=dirty`, combined with `submodule.recurse=true` and an incoming gitlink change.
- Added a reusable safety read for current recursive submodule state.
- Pull and rebase-pull now detect initialized submodules with internal uncommitted files before starting Git. For that single command they append `--no-recurse-submodules`, allowing the parent repository operation to finish atomically from Forkline's perspective while leaving the independent child repository untouched.
- Added an explicit Chinese success notice listing affected submodule paths and directing the user to handle the child changes before updating from the “子模块” page.
- Preserved the existing behavior for clean submodules: when no internal changes exist, the user's recursive configuration is still honored and the child checkout updates automatically.
- Updated README and continuation notes with the dirty/clean submodule pull behavior.

### Testing
- Built a real local-remote topology in `C:\tmp\forkline-submodule-pull-20260711`: a bare parent remote, a local clone, a writer clone, and a local child-submodule origin with multiple commits.
- Reproduced before the fix through Forkline API `http://127.0.0.1:5294`: local parent and tracking HEAD were `548ab92`, the live remote was `7746227`, parent `workingFiles` was empty, and the child had ` M server.js` at `cdf4fdf` while the incoming gitlink targeted `c4d4c9e`.
- The old `pull` returned HTTP 400 with a generic overwrite warning, but afterward local HEAD and `origin/main` were already `7746227`; child HEAD and its modification remained at `cdf4fdf`, leaving parent status ` M modules/child`. This proved the operation was not rolled back despite being reported as failed.
- Verified the fixed dirty-submodule path with a second incoming gitlink update to `2af9ce0`: `pull` returned HTTP 200 with `submoduleUpdateSkipped = true` and the Chinese protection notice; parent HEAD and tracking moved to `0bd7c19`, while child HEAD stayed `c4d4c9e` and ` M server.js` remained intact.
- Verified the clean-submodule control with a third incoming gitlink update to `cdf4fdf`: `pull` returned HTTP 200 without the skip flag, recursively moved the clean child from `2af9ce0` to `cdf4fdf`, and left both parent and child status clean.
- Verified rebase-pull with a real divergence: local had one unpushed empty commit, the remote had one different empty commit, and the child had hidden ` M server.js`. `pullRebase` returned HTTP 200 with the same submodule protection notice, rebased the local commit, created the normal `pull-rebase` recovery point, left the branch ahead by one commit, and preserved child HEAD `cdf4fdf` plus its modification.
- Ran `node --check server.js`.
- Ran `git diff --check`; it passed with only Windows LF-to-CRLF working-copy warnings.
- Ran `rg -n "\[DEBUG-[A-Za-z0-9]+\]" server.js public README.md docs\CONTINUE.md progress.md`; no debug markers were found.
- Stopped the temporary service on port `5294` and verified it returned HTTP code `000`; removed the temporary API harness and the verified `C:\tmp\forkline-submodule-pull-20260711` bare remote, clones, and submodule data.

### Notes
- `server.js`：pull / pull-rebase 在子模块内部脏时仅对本次命令禁用递归子模块更新，并在成功摘要中列出保护原因；现有破坏性操作复用同一子模块状态读取。
- `README.md`：补充脏子模块时只同步父仓库、干净子模块仍递归更新的行为。
- `docs/CONTINUE.md`：同步 pull 半完成问题、`--no-recurse-submodules` 保护和后续子模块更新指引。
- `progress.md`：追加 pull 错误返回但 HEAD 已移动的复现、修复、三组真实 API 回归和完整清理证据。
- Rollback: remove `readDirtySubmoduleWorktrees`, `appendSkippedSubmoduleUpdate`, and the conditional `--no-recurse-submodules` arguments from pull/pull-rebase, then reverse the related documentation lines; or run `git restore --source=cdf4fdf -- server.js README.md docs/CONTINUE.md progress.md` to roll back the full current uncommitted batch.

## 2026-07-11 - Task: Prevent submodule stash loss and partial stash checkout

### What was done
- Reproduced that a Git stash containing a staged submodule gitlink change was accepted by `stash apply` as a successful no-op: the parent gitlink stayed unchanged and the worktree remained clean even though the stash stored `modules/child` moving from `cdf4fdf` to `c4d4c9e`.
- Confirmed the destructive `stash pop` variant: Git again restored nothing, returned success, and dropped the only stash, removing the saved parent gitlink change from the stash list.
- Added structured raw-diff inspection for both the current staged/unstaged storage range and an existing stash's worktree/index trees. New Forkline stashes reject included submodule paths before `git stash`; existing gitlink stashes reject apply, pop, branch creation, and checkout-stash recovery while preserving the original stash.
- Added Chinese errors explaining that submodule contents and gitlinks are not reliably saved/restored by Git stash and directing the user to handle the independent child repository explicitly.
- Reproduced a second partial-operation bug with `submodule.recurse=true` and `submodule.<name>.ignore=dirty`: “储藏并签出” first moved an ordinary parent `.gitmodules` edit into a new stash, then failed to switch because the hidden child modification blocked recursive submodule checkout. The API returned an error while the parent edit had already disappeared from the worktree.
- Local and remote “储藏并签出” now read the real recursive submodule state before creating a stash. Internal child modifications, conflicts, or gitlink mismatch reject the whole action before changing the parent worktree, branch, or stash list.
- Kept manual storage of ordinary parent files available when a hidden child modification is not part of the parent stash; the child modification remains in its own repository.
- Updated README and continuation notes with the submodule stash boundary and recovery behavior.

### Testing
- Used real Forkline API fixture `C:\tmp\forkline-submodule-checkout-20260711` with parent branches `main` / `target`, child commits `cdf4fdf` / `c4d4c9e`, `submodule.recurse=true`, and `submodule.modules/child.ignore=dirty`.
- Before the fix on `http://127.0.0.1:5295`, `applyStash` returned HTTP 200 with `nothing to commit, working tree clean`, left the parent gitlink at `cdf4fdf`, and preserved the stash; `popStash` then returned HTTP 200, still restored nothing, and dropped stash SHA `41875bd`.
- After the fix on `http://127.0.0.1:5296`, applying and popping the reconstructed bad stash returned HTTP 400 with the affected `modules/child` path; parent HEAD/worktree stayed unchanged and stash SHA `41875bd` remained. `branchFromStash` was also rejected before creating a branch.
- Verified current-range guards through `http://127.0.0.1:5297`: both unstaged and staged submodule pointer changes were rejected before stash creation; local and remote “储藏并签出” were rejected before creating a stash when the gitlink was in range.
- Verified ordinary controls on `5297`: a `.gitmodules`-only stash was created successfully, `applyStash` restored the file while retaining the stash, and `popStash` restored the file and removed only that ordinary stash.
- Reproduced the hidden-dirty partial checkout on `5297`: the request returned HTTP 400 and stayed on `main`, but `.gitmodules` disappeared from the worktree and a new Forkline checkout stash was created while the child modification remained.
- Verified the hidden-dirty fix on `http://127.0.0.1:5298`: local and remote stash checkout both returned HTTP 400 before mutation; `.gitmodules`, `main`, parent HEAD, child `M  server.js`, and the existing stash list all stayed unchanged. A manual ordinary-parent stash still returned HTTP 200 and left the hidden child modification intact.
- Ran `node --check server.js`.
- Ran `git diff --check`; it passed with only Windows LF-to-CRLF working-copy warnings.
- Ran `rg -n "\[DEBUG-[A-Za-z0-9]+\]" server.js public README.md docs\CONTINUE.md progress.md`; no debug markers were found.
- Stopped temporary services on ports `5295` through `5298`; verified no listeners remained. Removed both temporary API/patch harnesses and the verified `C:\tmp\forkline-submodule-checkout-20260711` fixture.

### Notes
- `server.js`：储藏创建范围和已有 stash 使用 raw diff 识别子模块路径；应用、弹出、建分支和签出储藏恢复在危险 gitlink 前拒绝；本地/远端储藏并签出在创建 stash 前检查真实子模块状态。
- `README.md`：补充 Git stash 对子模块内容与 gitlink 的限制、旧坏储藏保留策略，以及隐藏脏子模块下储藏并签出的原子性保护。
- `docs/CONTINUE.md`：同步 stash 子模块边界、已有 stash 工作树/索引树检查、隐藏脏子模块前置阻止和普通父仓库储藏控制行为。
- `progress.md`：追加 gitlink stash 弹出丢失、隐藏脏子模块签出半完成、修复、真实 API 回归和完整清理证据。
- Rollback: remove `ensureStashSelectionHasNoSubmoduleChanges`, `ensureStashHasNoGitlinkChanges`, their raw-diff helpers and call sites, and the two stash-checkout submodule preflights; then reverse the related README/CONTINUE entries and this progress block. To roll back the full current uncommitted batch, run `git restore --source=cdf4fdf -- server.js README.md docs/CONTINUE.md progress.md`.

## 2026-07-11 - Task: Add deterministic real Git API regression tests

### What was done
- Added a zero-dependency `npm test` entry using Node's built-in `node:test` runner with file-level concurrency fixed to one because Forkline currently owns one active repository context per service process.
- Added a reusable integration harness that starts the real Forkline server on a random local port, drives `/api/open`, `/api/state`, and `/api/action`, captures server output for assertion failures, and terminates the child service after the suite.
- Added deterministic temporary Git fixtures with a parent repository, `main` / `target` branches, two child commits, a real submodule, `submodule.recurse=true`, and `submodule.<name>.ignore=dirty`. Test Git commands isolate global/system configuration and use repository-local identity.
- Locked down three recent high-risk workflows at the actual HTTP/Git boundary: ordinary stash create/apply/pop, current and legacy gitlink stash protection, and hidden-dirty-submodule stash checkout atomicity.
- Updated README and architecture/continuation documentation with the test command, fixture boundaries, and rule that Git behavior regressions should be tested through real repositories instead of shallow mocks.

### Testing
- Ran `node --check tests\git-api.test.js`.
- Ran `node --check server.js`.
- Ran `npm test`: 3 tests passed, 0 failed, total duration about 30.4 seconds.
- Verified ordinary parent stash creates successfully, apply restores the file while keeping the stash, and pop restores the file while removing that stash.
- Verified a staged gitlink change is rejected before Forkline creates a stash; a direct-Git legacy gitlink stash is rejected by apply and pop while its SHA remains in the stash list.
- Verified `ignore=dirty` hides the child modification from parent `git status`, but local stash checkout still returns HTTP 400 before changing the current branch, parent file, child file, or stash list.
- Confirmed no `forkline-ordinary-stash-*`, `forkline-gitlink-stash-*`, or `forkline-checkout-stash-*` fixture directories remained in the system temporary directory after the suite.
- Ran `git diff --check`; it passed with only Windows LF-to-CRLF working-copy warnings.
- Ran `rg -n "\[DEBUG-[A-Za-z0-9]+\]" server.js public tests README.md docs\CONTINUE.md docs\ARCHITECTURE.md progress.md`; no debug markers were found.

### Notes
- `package.json`：新增无第三方依赖的 `npm test` 命令，并固定测试文件串行执行。
- `tests/git-api.test.js`：新增真实 Forkline 服务、临时父仓库/子模块夹具、API 请求助手及三条 stash 回归。
- `README.md`：新增测试入口、临时仓库边界和首批覆盖范围说明。
- `docs/ARCHITECTURE.md`：记录集成测试运行方式、夹具隔离规则和真实 API 测试原则。
- `docs/CONTINUE.md`：同步自动回归底座、首批覆盖范围，以及不使用 GitTest/业务仓库的约束。
- `progress.md`：追加本轮测试底座实现、真实执行结果和清理证据。
- Rollback: remove `package.json` and `tests/git-api.test.js`, then reverse this task's README, ARCHITECTURE, CONTINUE, and progress additions. The implementation changes from earlier uncommitted tasks are independent and should not be reverted with this test-only rollback.

## 2026-07-11 - Task: 按需加载并缓存同步认证诊断

### What was done
- 将 SSH key、`ssh-agent` 和 Git Credential Manager 探测从每次 `/api/state` 全量刷新中移出，新增只读 `/api/auth-diagnostics` 接口；普通提交历史、工作区和仓库状态刷新不再等待本机认证工具。
- 认证结果按规范化仓库路径和完整 fetch/push URL 配置缓存 60 秒，缓存上限 12 条；远端 URL 变化会使用新缓存键，`refresh=1` 可显式绕过缓存，接口要求当前仓库路径上下文。
- 同步页首次打开时按需加载认证信息，显示中文检测中/失败状态和“重新检测”按钮；仓库或远端配置变化会使前端状态失效，请求 id、仓库路径和远端签名共同阻止旧响应覆盖当前页面。
- 扩展真实 Git API 回归，覆盖状态接口不含认证探测、仓库上下文保护、缓存命中、手动刷新绕过缓存和远端 URL 变化失效，并同步 README、架构说明和继续开发记录。

### Testing
- `npm test` 通过：4 tests passed、0 failed，总耗时约 28.0 秒；认证诊断用例同时验证 HTTPS -> SSH 远端变化不会复用旧结果。
- `node --check server.js`、`node --check tests\git-api.test.js`、`node --check public\js\panels\sync.js`、`node --check public\js\app\events.js`、`node --check public\js\core.js`、`node --check public\js\features\repositories.js` 均通过。
- 新启动临时 Forkline 服务并打开当前仓库，连续 5 次 `/api/state` 耗时为 1149.0 / 1119.9 / 1137.9 / 1130.6 / 1110.8 ms，平均 1129.6 ms，响应确认不含 `sync.auth`；首次 `/api/auth-diagnostics` 为 479.5 ms、`cached = false`，第二次为 48.8 ms、`cached = true`，且 `checkedAt` 相同。临时服务测量后已关闭。
- HTTP 静态资源检查确认最新同步脚本包含 `/api/auth-diagnostics`、中文检测中状态和 `data-auth-action="refresh"`，最新样式包含 `.auth-card-tools`。
- 确认系统临时目录没有残留 `forkline-ordinary-stash-*`、`forkline-gitlink-stash-*`、`forkline-checkout-stash-*` 或 `forkline-auth-diagnostics-*` 测试目录。
- `git diff --check` 通过，仅有 Windows LF -> CRLF 工作区提示；调试标记搜索无结果。
- 浏览器自动视觉检查未计为通过：Windows 自动化无法可靠确认当前浏览器 URL 后主动停止；本轮已有真实 API、静态资源和语法验证，但右侧栏窄宽度视觉效果仍需人工查看。

### Notes
- `server.js`：移除全量状态中的认证探测，新增仓库上下文保护的按需接口、60 秒有界缓存、远端配置缓存键和强制刷新入口。
- `public/js/core.js`：新增认证诊断数据和请求序号状态。
- `public/js/features/repositories.js`：切换仓库时清理认证诊断状态并使旧请求失效。
- `public/js/panels/sync.js`：同步页按需请求认证诊断，处理检测中、失败、缓存结果、手动刷新和旧响应丢弃。
- `public/js/app/events.js`：接入认证助手“重新检测”点击事件。
- `public/styles.css`：补充认证状态和重新检测按钮的紧凑布局。
- `tests/git-api.test.js`：新增认证诊断接口、缓存、强制刷新和远端变化真实 API 回归。
- `README.md`：说明认证诊断的按需加载、缓存、刷新方式和新增测试覆盖。
- `docs/ARCHITECTURE.md`：记录全量状态与可选诊断的边界、缓存键和前端旧响应保护。
- `docs/CONTINUE.md`：同步当前完成状态、测试范围，并移除已经过期的“真实 SSH key 检测待完成”建议。
- `progress.md`：追加本轮实现、性能数据、测试结果和视觉验证缺口。
- Rollback: 本轮尚未单独提交；回滚时只反向移除上述认证诊断接口/缓存、前端认证状态与刷新入口、认证 API 测试及对应文档块，保留此前的子模块安全修复和测试底座。若本轮后续形成独立提交，可执行 `git revert <该提交 SHA>`。

## 2026-07-11 - Task: 优化仓库全量状态读取性能

### What was done
- 使用临时 Forkline 服务和 Git Trace2 对 `/api/state` 做真实命令级分析，确认无子模块仓库仍执行的 `git submodule status --recursive` 单次约耗时 1040 ms，是首要瓶颈。
- 仓库根目录没有 `.gitmodules` 时，状态读取和危险操作前的子模块安全检查直接返回空列表，不再启动 submodule helper；存在 `.gitmodules` 的仓库继续执行原递归读取和子模块安全检查。
- 全量状态首轮读取新增 `remote -v` 并复用已有的当前分支、HEAD、tracking、远端详情和工作区状态；同步状态、PR 目标分支和当前 worktree 不再重复启动相同 Git 命令。
- 工作树详情、子模块详情、工作区文件快照和同步详情从串行改为在基础快照完成后并行生成；当前 worktree 直接复用同一轮 `git status` 输出，使工作树脏状态和工作区文件列表来自同一快照。
- 新增真实状态语义回归，覆盖 upstream、ahead/behind、当前 worktree 脏状态、无子模块、detached HEAD 和无首提交分支，并同步 README、架构说明和继续开发记录。

### Testing
- 优化前旧服务与优化后新服务针对同一当前仓库交替请求 5 次：旧服务耗时 1144.5 / 1261.7 / 1282.6 / 1355.5 / 1425.7 ms，平均 1294.0 ms；新服务耗时 308.5 / 310.5 / 296.0 / 424.7 / 318.1 ms，平均 331.6 ms，下降 74.4%。
- 对两套服务的 `repo`、分支、branchInfo/cleanup、worktree、子模块、远端、同步、工作区、stash、恢复点、reflog、Tag 和 commits 做 JSON 投影比较，结果完全一致；两边子模块数量均为 0。
- 优化后 Trace2 不再出现 `git submodule status --recursive`；剩余最慢单条 Git 读取约 94.2 ms，没有第二条同等级异常命令。中间只跳过子模块 helper 时，5 次状态刷新平均从 1129.6 ms 降到 600.6 ms。
- `npm test` 通过：5 tests passed、0 failed，总耗时约 27.1 秒；既有真实子模块三条安全回归继续通过，新增状态用例确认 upstream 为 `origin/main`、ahead = 1、behind = 0、脏 worktree 计数为 1、detached/unborn 状态正确。
- `node --check server.js`、`node --check tests\git-api.test.js` 通过。
- `git diff --check` 通过，仅有 Windows LF -> CRLF 工作区提示；调试标记搜索无结果。
- 两份 `C:\tmp\forkline-state-trace*.json` 性能记录已删除；系统临时目录没有残留本轮及既有 API 测试夹具。

### Notes
- `server.js`：无 `.gitmodules` 时跳过递归子模块命令，复用基础状态快照，并行生成后续只读详情，减少重复 branch/HEAD/upstream/remote/status 读取。
- `tests/git-api.test.js`：新增 tracked、dirty worktree、detached HEAD、unborn 和无子模块状态语义回归及本地 bare 远端夹具。
- `README.md`：说明全量刷新复用同轮快照、并行生成详情和无子模块快速路径，并更新自动回归覆盖范围。
- `docs/ARCHITECTURE.md`：记录状态读取的基础快照复用、后处理并行边界和 `.gitmodules` 快速判断规则。
- `docs/CONTINUE.md`：同步当前状态读取优化、真实前后性能数据和新增测试覆盖。
- `progress.md`：追加命令级诊断、实现、响应一致性、性能对比、回归和清理证据。
- Rollback: 本轮尚未单独提交；回滚时恢复 `readState` 原来的子模块命令、串行后处理和独立同步读取，移除 `repoHasSubmoduleConfig`、`readCurrentSyncState/readCurrentSyncDetails/readPullRequestLink/inferPullRequestTarget` 的可选快照参数、状态语义测试及对应文档块，保留上一轮认证诊断优化与此前安全修复。若后续形成独立提交，可执行 `git revert <该提交 SHA>`。

## 2026-07-11 - Task: 将 HEAD 引用日志改为恢复点页按需加载

### What was done
- 将真实仓库固定返回的 80 条 HEAD reflog 从 `/api/state` 移出，新增只读 `/api/reflog`；接口要求当前仓库路径上下文，无首提交仓库返回空列表，示例模式继续使用内置 reflog 数据。
- 恢复点页首次打开时加载 reflog，显示中文读取中/失败/空状态并提供“刷新”；加载结果按仓库路径、当前分支和 HEAD SHA 关联，切仓库、切分支或 HEAD 变化后旧请求不会写回当前页面。
- 仓库切换时清理 reflog 请求状态和上下文；reflog 查看、复制、创建恢复点、恢复和右键菜单继续使用同一份按需数据，自动恢复点仍保留在 `/api/state`，没有扩大危险操作流程的改动范围。
- 新增真实 API 断言和零依赖前端状态测试，并同步 README、架构说明和继续开发记录；修正续作文档中仍写着 `/api/state` 返回 reflog 的旧描述。

### Testing
- 旧服务与临时新服务打开同一当前仓库：旧 `/api/state` 为 62,981 bytes，新响应为 38,264 bytes，减少 39.2%；排除 reflog 后其余 repo/分支/worktree/子模块/远端/同步/工作区/stash/恢复点/Tag/commits JSON 完全一致，旧状态中的 reflog 与新 `/api/reflog` JSON 完全一致。
- 最新 `http://127.0.0.1:5287` 服务验证：`/api/state` 为 38,513 bytes 且不含 `reflogEntries`；`/api/reflog` 返回 80 条，首条 selector 使用 Git 真实 `HEAD@{...}` 格式；缺少仓库上下文返回 HTTP 400 和中文“页面缺少仓库上下文”。
- 临时无首提交仓库验证：状态为 `branch = main`、`sync.unborn = true`、全量状态不含 reflog，`/api/reflog` 返回空数组；验证后服务已重新打开当前 Forkline 仓库，临时目录按 `C:\tmp\forkline-reflog-unborn-manual-*` 路径边界检查后删除。
- `node --test tests\reflog-ui-state.test.js` 通过：2 tests passed、0 failed；验证当前仓库结果会保存并重绘恢复点页，切到另一仓库后旧请求返回不会写回或触发重绘。
- `node --check` 已通过 `server.js`、`public/js/panels/recovery-settings.js`、`public/js/app/events.js`、`public/js/core.js`、`public/js/features/repositories.js`、`tests/git-api.test.js` 和 `tests/reflog-ui-state.test.js`。
- HTTP 静态资源检查确认最新恢复点脚本包含按需加载、刷新按钮和 request id 旧响应保护，最新样式包含 `.reflog-section-tools`。
- `git diff --check` 通过，仅有 Windows LF -> CRLF 工作区提示；调试标记搜索无结果。
- 完整 `npm test` 本轮未得到执行结果：两次 unsandboxed 请求都在权限审批检查阶段超时，受限沙箱又在启动 PowerShell 时返回 Windows `CreateProcessAsUserW failed: 5`。上一轮完整套件为 5/5 通过，但本日志不把它冒充成本轮通过；新增真实 API 路径已由上述定向服务验证，完整套件仍需在审批可用后补跑。

### Notes
- `server.js`：从全量状态移除 reflog Git 命令和响应字段，新增仓库上下文保护的 `/api/reflog`。
- `public/js/core.js`：新增 reflog 数据、加载状态和请求序号。
- `public/js/features/repositories.js`：切换仓库时清理 reflog 状态并使旧请求失效。
- `public/js/panels/recovery-settings.js`：恢复点页按需加载、刷新、中文状态、分支/HEAD 数据键和旧响应保护。
- `public/js/app/events.js`：接入 reflog 刷新按钮事件。
- `public/styles.css`：补充 reflog 状态和刷新按钮的紧凑布局。
- `tests/git-api.test.js`：新增 reflog 独立接口、仓库上下文、真实 HEAD selector 和无首提交空日志断言。
- `tests/reflog-ui-state.test.js`：新增当前结果写入和跨仓库旧响应丢弃的 Node VM 状态测试。
- `README.md`：说明 reflog 的按需接口、刷新和旧响应保护，并更新测试覆盖。
- `docs/ARCHITECTURE.md`：记录 reflog 与基础状态的边界、示例模式和前端数据键规则。
- `docs/CONTINUE.md`：同步响应体缩减、当前实现和历史验证描述。
- `progress.md`：追加实现、响应拼回对比、定向验证、完整套件缺口和回滚说明。
- Rollback: 本轮尚未单独提交；回滚时把 `readReflogOutput(80)` 和 `reflogEntries` 恢复到 `readState`，删除 `/api/reflog`、前端 reflog 独立状态/加载/刷新入口、两处新增测试和对应文档块，保留此前认证及全量状态性能优化。若后续形成独立提交，可执行 `git revert <该提交 SHA>`。

## 2026-07-11 - Task: 优化工作区自动刷新开销和内容变化识别

### What was done
- 将每个工作区文件的内容快照加入前端刷新签名；文件保持相同 `M` 状态但内容继续变化时，自动刷新仍会更新文件列表和当前 Diff。
- 将 5 秒工作区轮询限制在页面可见且浏览器窗口有焦点时运行；重新聚焦窗口或切回标签页会立即静默刷新，现有进行中请求保护继续阻止重叠读取。
- 新增零依赖前端状态测试，并同步 README、架构说明和继续开发记录；未改变菜单、Git 写操作或危险操作确认流程。

### Testing
- 当前 Forkline 仓库 `/api/worktree` 实测平均 `128.2 ms`；原 5 秒轮询在持续运行时每分钟会请求 12 次，约占用 `1538.4 ms/min`，失焦和隐藏页面现在不再产生这部分后台读取。
- `node --test tests\worktree-refresh.test.js` 通过：2 tests passed、0 failed；覆盖同状态文件内容快照变化，以及失焦/隐藏暂停轮询、恢复焦点立即刷新。
- 完整 `npm test` 通过：9 tests passed、0 failed，总耗时约 30.69 秒；同时关闭上一轮 reflog 任务中未能执行完整套件的验证缺口。
- `node --check public\js\features\diff-workbench.js` 和 `node --check tests\worktree-refresh.test.js` 通过。
- HTTP 静态资源检查确认最新脚本包含 `file.snapshot`、`document.hasFocus` 和 `visibilitychange`。
- `git diff --check` 通过，仅有 Windows LF -> CRLF 工作区提示；调试标记搜索无结果。

### Notes
- `public/js/features/diff-workbench.js`：工作区签名加入文件内容快照，并按页面可见性和窗口焦点约束自动轮询。
- `tests/worktree-refresh.test.js`：新增快照签名与焦点/可见性轮询边界测试。
- `README.md`：说明相同 Git 状态下的内容刷新和后台轮询暂停规则，并更新测试覆盖。
- `docs/ARCHITECTURE.md`：记录 `/api/worktree` 轮询边界、即时恢复刷新和 snapshot 签名规则。
- `docs/CONTINUE.md`：同步当前行为、性能数据、测试状态和后续优化落点。
- `progress.md`：追加本轮实现、性能依据、完整回归和回滚说明。
- Rollback: 本轮尚未单独提交；回滚时从工作区签名移除 `file.snapshot`，把 `initWorktreeAutoRefresh` 恢复为原来的 focus 监听和仅检查 `document.hidden` 的 5 秒轮询，删除 `tests/worktree-refresh.test.js` 及本轮对应文档段落，保留此前认证、全量状态和 reflog 按需加载优化。若后续形成独立提交，可执行 `git revert <该提交 SHA>`。

## 2026-07-11 - Task: 修复中文仓库路径导致 fetch 请求头失败

### What was done
- 复现并确认浏览器错误发生在请求发出前：仓库路径包含中文时，原始 `X-Forkline-Repo-Path` 无法转换为 Fetch `ByteString`。
- 前端统一把仓库路径发送为 `v1:` 加 `encodeURIComponent` 的 ASCII 请求头；所有通过共享 `api()` 发起的状态读取和 Git 操作同时生效。
- 服务端统一解码版本化仓库上下文，拒绝畸形转义和解码后的控制字符，并继续接受旧页面发送的无前缀英文原始路径。
- 新增前端请求头边界测试和真实 Unicode Git 仓库 API 测试，同步 README、架构说明和继续开发记录；未改变菜单、Git 命令或写操作确认流程。

### Testing
- 修复前最小 `Headers` 构造和新增测试均稳定失败，错误为 `TypeError: Cannot convert argument to a ByteString ... value ... greater than 255`，调用栈落在 `public/js/api.js` 的 `fetch` 请求头。
- `node --test tests\api-repo-context.test.js` 修复后通过：1 test passed、0 failed；确认 `D:\桌面\GitTest` 会发送为 `v1:D%3A%5C%E6%A1%8C%E9%9D%A2%5CGitTest`。
- 真实 API 测试在系统临时目录创建名为“中文仓库”的 Git 仓库，验证编码头读取成功、畸形 `v1:` 返回中文错误、旧英文原始头仍成功。
- 完整 `npm test` 通过：11 tests passed、0 failed，总耗时约 30.79 秒。
- 重启 `http://127.0.0.1:5287` 到新后端 PID `16820` 后，真实打开 `D:\桌面\GitTest` 成功；`/api/state` 返回同一路径和分支 `123`，`/api/worktree` 返回 0 个改动，最新 `js/api.js` 返回 HTTP 200 并包含编码函数。
- 向最新服务发送畸形 `v1:%E0%A4%A` 返回 HTTP 400 和中文“页面仓库上下文编码无效。请刷新页面后再试。”，服务保持正常。
- `node --check` 已通过 `public/js/api.js`、`server.js`、`tests/api-repo-context.test.js` 和 `tests/git-api.test.js`。
- `git diff --check` 通过，仅有 Windows LF -> CRLF 工作区提示；调试标记搜索无结果。

### Notes
- `public/js/api.js`：新增版本化仓库路径请求头编码，避免 Unicode 字符进入 Fetch Header 值。
- `server.js`：新增版本化仓库上下文解码、畸形编码提示和旧 ASCII 头兼容。
- `tests/api-repo-context.test.js`：新增真实 `Headers` 边界的中文路径回归测试。
- `tests/git-api.test.js`：请求辅助函数改用版本化编码，并新增 Unicode 仓库、畸形编码和旧头兼容测试。
- `README.md`：说明中文/Unicode 仓库路径支持和测试覆盖。
- `docs/ARCHITECTURE.md`：记录 `X-Forkline-Repo-Path` 的 `v1:` 编码协议与兼容边界。
- `docs/CONTINUE.md`：同步错误根因、修复行为和后续接手信息。
- `progress.md`：追加复现、红绿测试、真实服务验证和回滚说明。
- Rollback: 本轮尚未单独提交；回滚时恢复 `public/js/api.js` 直接发送原始路径，删除 `decodeRepoPathHeader` 及其调用、`tests/api-repo-context.test.js`、`tests/git-api.test.js` 中本轮协议测试和对应文档段落。该回滚会重新引入中文路径无法请求的问题；若后续形成独立提交，优先执行 `git revert <该提交 SHA>`。

## 2026-07-11 - Task: 限制大提交详情 Diff 预览以消除页面卡顿

### What was done
- 对当前页面做后端和真实浏览器分段诊断，确认服务端没有空闲 CPU 异常，也没有工作区响应变化导致的周期性误重绘。
- 定位到右侧提交“详情”页会把聚合提交 Diff 全量绑定到 DOM；当前大提交一次性渲染 34,851 行，产生超过 10 万个节点。
- 将详情页聚合 Diff 小预览限制为前 400 行，并显示当前预览行数和完整总行数；后端完整 Diff 数据、提交“文件”页和按文件对照保持不变。
- 新增大/小 Diff 渲染回归测试，并同步 README、架构说明和继续开发记录；没有修改业务仓库、Git 命令、菜单或危险操作。

### Testing
- 当前页面仓库只读基线：19 条提交、78 个工作区文件、9 条储藏；Node 服务空闲 5 秒仅消耗约 0.016 秒 CPU，工作集约 50 MB。
- 只读接口各测 5 次：`/api/state` 平均 453.1 ms、`/api/worktree` 平均 350.7 ms、`/api/reflog` 平均 61.2 ms；连续 6 次工作区响应 SHA-256、工作区快照和文件快照完全一致，排除周期性误重绘。
- 修复前 Playwright 页面有 105,885 个 DOM 节点，其中 `.diff-line` 为 34,851 行；对应 `/api/commit` 响应为 3,579,170 bytes、约 489 ms。三次强制详情重绘在 50 秒内未完成，符合用户卡顿现象。
- 最小回归修复前确认 1000 行全部渲染且没有限制提示；修复后只渲染 400 行，包含“仅显示前 400 / 1000 行”，第 401 行不进入 HTML。
- 修复后真实页面降到 2,545 个 DOM 节点、400 行 Diff，节点减少约 97.6%；连续 5 次详情重绘为 19.6 / 19.2 / 21.7 / 25.2 / 23.1 ms，平均 21.8 ms。
- Playwright 调整到 1100 × 700 后，预览提示、右侧详情和页面均无横向溢出；隔离浏览器会话已关闭，`.playwright-cli` 临时目录已按仓库路径边界检查后删除。
- 完整 `npm test` 通过：13 tests passed、0 failed，总耗时约 31.97 秒。
- `node --check public\js\features\diff-workbench.js` 和 `node --check tests\diff-preview.test.js` 通过。
- 最新 `http://127.0.0.1:5287` 静态脚本和样式均返回 HTTP 200，并包含 400 行限制、中文提示和 `.diff-preview-truncated` 样式。
- `git diff --check` 通过，仅有 Windows LF -> CRLF 工作区提示；调试标记搜索无结果。

### Notes
- `public/js/features/diff-workbench.js`：提交详情聚合 Diff 小预览最多生成 400 行，并在截断时显示完整总数。
- `public/styles.css`：新增紧凑的 Diff 预览截断提示布局，窄右栏可正常换行。
- `tests/diff-preview.test.js`：新增大 Diff 限量和小 Diff 完整渲染测试。
- `README.md`：说明大提交小预览的 400 行边界和完整按文件查看入口。
- `docs/ARCHITECTURE.md`：固定详情页轻量渲染规则和对应回归测试。
- `docs/CONTINUE.md`：同步卡顿根因、真实前后 DOM 指标和当前行为。
- `progress.md`：追加分段诊断、浏览器指标、完整回归和回滚说明。
- Rollback: 本轮尚未单独提交；回滚时删除 `DIFF_PREVIEW_LINE_LIMIT` 和截断提示逻辑，恢复 `renderDiff` 对完整数组直接 `.map()`，删除 `.diff-preview-truncated` 样式、`tests/diff-preview.test.js` 及本轮对应文档段落。该回滚会重新引入大提交详情生成十万级 DOM 节点的问题；若后续形成独立提交，优先执行 `git revert <该提交 SHA>`。
## 2026-07-04 - Task: Improve local branch status badges in narrow sidebar

### What was done
- Adjusted the local branch list badges so long upstream labels can truncate cleanly and short status badges wrap to the next line instead of being squeezed together.
- Removed the duplicate `当前` badge under the current branch name because the highlighted row and right-side current button already show that state.
- Added the full upstream value as a hover title on the upstream badge.

### Testing
- Ran `node --check public\js\features\branches.js`.
- Ran `node --check server.js`.
- Ran `git diff --check`.
- Refreshed `http://127.0.0.1:5177/` in the in-app browser and confirmed local branch badges wrap cleanly: long upstream badges occupy the available width, and ahead/behind or warning badges move to the next line without overlapping.

### Notes
- `public/js/features/branches.js`: removed the redundant current-branch badge and added upstream badge title text.
- `public/styles.css`: allowed local branch metadata badges to wrap and made upstream badges flex into the remaining width.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's changes in `public/js/features/branches.js`, `public/styles.css`, and `progress.md`, or reset to the commit before this task once it is committed.

## 2026-07-04 - Task: Collapse long local branch upstream badges by default

### What was done
- Changed the left local branch list so long upstream badges stay compact by default instead of taking the full metadata line.
- Kept the full upstream branch name available through the badge hover title.
- Scoped the compact upstream badge rule to local branch rows so the branch cleanup panel keeps its normal badge layout.

### Testing
- Ran `node --check public\js\features\branches.js`.
- Ran `node --check server.js`.
- Ran `git diff --check`.
- Refreshed `http://127.0.0.1:5177/` in the in-app browser and confirmed upstream badges render at `70px`, use a help cursor, and retain the full upstream value in `title`.

### Notes
- `public/styles.css`: made only left-list upstream badges compact and hover-informative.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's changes in `public/styles.css` and `progress.md`, or reset to the commit before this task once it is committed.
## 2026-07-04 - Task: Install UI/UX Pro Max Codex skills for the project

### What was done
- Verified `ui-ux-pro-max-cli` on npm and installed the Codex templates into the current project with `npx ui-ux-pro-max-cli@2.10.1 init --ai codex`.
- Added project-local skills under `.codex/skills/`, including `ui-ux-pro-max`, `ui-styling`, `design-system`, `brand`, `design`, `slides`, and `banner-design`.
- Documented that the new project-level skills require a new Codex session or restart before they are automatically detected.

### Testing
- Ran `npm view ui-ux-pro-max-cli name version bin description`.
- Ran `npx --yes ui-ux-pro-max-cli@2.10.1 --help`.
- Ran `npx --yes ui-ux-pro-max-cli@2.10.1 init --help`.
- Ran `npx --yes ui-ux-pro-max-cli@2.10.1 init --ai codex`.
- Confirmed `.codex/skills/ui-ux-pro-max/SKILL.md` exists and declares the `ui-ux-pro-max` skill.
- Ran `python .codex\skills\ui-ux-pro-max\scripts\search.py --help`.
- Ran `python .codex\skills\ui-ux-pro-max\scripts\search.py dashboard --domain style --max-results 2`; the script loaded `styles.csv` and returned design results.

### Notes
- `.codex/skills/`: added UI/UX Pro Max project-level skill files and supporting data/scripts.
- `docs/CONTINUE.md`: recorded the installed project-level UI/UX skills and restart/new-session requirement.
- `progress.md`: appended this installation and verification record.
- Rollback: delete `.codex/skills/`, revert the `docs/CONTINUE.md` and `progress.md` entries from this task, or reset to the commit before this task once it is committed.

## 2026-07-04 - Task: Polish Forkline main interface with UI/UX Pro Max

### What was done
- Used the project-local UI/UX Pro Max skill to generate a dense dark developer dashboard direction for Forkline.
- Refined the main interface visual hierarchy while keeping the existing teal/coral identity and Git status colors.
- Improved topbar, repository path controls, action buttons, focus rings, side panels, branch chips, commit rows, worktree file rows, diff surfaces, inspector tabs, empty states, menus, dialogs, and reduced-motion behavior.
- Fixed legacy undefined status color references by mapping deleted/alert states to existing danger/amber tokens.

### Testing
- Ran `python .codex\skills\ui-ux-pro-max\scripts\search.py "developer git visual dashboard dense dark productivity tool" --design-system -f markdown -p "Forkline Web" --variance 5 --motion 2 --density 8`.
- Ran `node --check server.js`.
- Ran `git diff --check`; it only reported the existing LF-to-CRLF Git working-copy warning for `public/styles.css`.
- Counted CSS braces and confirmed `816/816`.
- Searched for unresolved `var(--red)` / `var(--yellow)` references and confirmed none remain.
- Refreshed `http://127.0.0.1:5177/` in the in-app browser and confirmed the topbar, path controls, workspace, sidebar, main area, and inspector do not overlap at the current 1280x720 viewport.
- Checked browser console error/warning logs after refresh; none were present.

### Notes
- `public/styles.css`: updated visual tokens, panel layering, interactive states, status colors, menus, dialogs, diff surfaces, and reduced-motion CSS.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's changes in `public/styles.css` and `progress.md`, or reset to the commit before this task once it is committed.

## 2026-07-04 - Task: Polish maximized diff view

### What was done
- Optimized the maximized diff window so it matches the refreshed main interface style.
- Improved the maximized diff header, close button, modal background, sticky selected-line toolbar, sticky diff column header, code line spacing, line-number gutter, hunk action buttons, hover feedback, and empty state.
- Raised the maximized diff layer above other app panels so it behaves like a true full-screen inspection mode.

### Testing
- Ran `node --check server.js`.
- Ran `git diff --check`; it only reported the existing LF-to-CRLF Git working-copy warning for `public/styles.css`.
- Counted CSS braces and confirmed `826/826`.
- Opened the current repository through `/api/open`, selected the real `public/styles.css` worktree diff, opened the maximized diff view, and confirmed the modal header/body/toolbar/table fit within the 1280x720 viewport without overlap.
- Closed the maximized diff view after verification and confirmed `modal-open` was removed from `body`.
- Checked browser console error/warning logs after the maximized diff verification; none were present.

### Notes
- `public/styles.css`: refined maximized diff modal styling and scoped sticky toolbar/header behavior to `.diff-modal-body`.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's changes in `public/styles.css` and `progress.md`, or reset to the commit before this task once it is committed.

## 2026-07-04 - Task: Normalize maximized diff fonts

### What was done
- Added shared UI/code font tokens so Forkline can consistently separate interface text from code text.
- Normalized the maximized diff view so titles, close button, selected-line toolbar, column headers, and hunk action buttons use the UI font.
- Normalized diff code, line numbers, and diff metadata so they all use the same code font stack.

### Testing
- Ran `node --check server.js`.
- Ran `git diff --check`; it only reported the existing LF-to-CRLF Git working-copy warning for `public/styles.css`.
- Counted CSS braces and confirmed `826/826`.
- Opened `D:/桌面/forkline-web` through the UI, selected the real `public/styles.css` worktree diff, opened the maximized diff view, and checked computed fonts for title, toolbar, toolbar button, column header, hunk button, close button, line number, code, and metadata.
- Confirmed UI elements use `Microsoft YaHei UI` / `PingFang SC` / `Segoe UI`, while code, line numbers, and diff metadata use `Cascadia Mono` / `Consolas` / `SFMono-Regular`.
- Closed the maximized diff view with Esc after verification and confirmed `modal-open` was removed from `body`.
- Checked browser console error/warning logs after verification; none were present.

### Notes
- `public/styles.css`: added shared font tokens and scoped maximized diff font inheritance for UI controls versus code content.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's changes in `public/styles.css` and `progress.md`, or reset to the commit before this task once it is committed.

## 2026-07-04 - Task: Make diff hunk headers readable

### What was done
- Replaced raw Git hunk headers such as `@@ -48,17 +48,19 @@` with readable Chinese descriptions that explain the old/new line positions and changed range.
- Kept the original Git hunk header in the hover title for advanced reference without forcing it into the main UI.
- Renamed hunk action buttons from `暂存此块` / `丢弃此块` to `暂存这段` / `丢弃这段`.
- Allowed readable hunk descriptions to wrap naturally and kept hunk action buttons sticky on the visible right side of the diff row.

### Testing
- Ran `node --check public\js\features\diff-workbench.js`.
- Ran `node --check server.js`.
- Ran `git diff --check`; it only reported the existing LF-to-CRLF Git working-copy warning for `public/js/features/diff-workbench.js` and `public/styles.css`.
- Counted CSS braces and confirmed `827/827`.
- Opened `D:/桌面/forkline-web` through the UI, selected the real `public/styles.css` worktree diff, opened the maximized diff view, and confirmed the hunk header renders as readable text such as `改动位置：旧版第 2169 行，新版第 2169 行；范围：旧 16 行，新 24 行`.
- Confirmed hunk action buttons render as `暂存这段` and `丢弃这段`, and the action group remains visible at the right side of the maximized diff row.
- Closed the maximized diff view with Esc after verification and confirmed `modal-open` was removed from `body`.
- Checked browser console error/warning logs after verification; none were present.

### Notes
- `public/js/features/diff-workbench.js`: translates Git hunk headers into readable Chinese summaries and updates hunk action labels.
- `public/styles.css`: styles readable hunk summaries with UI font, natural wrapping, and sticky visible hunk actions.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's changes in `public/js/features/diff-workbench.js`, `public/styles.css`, and `progress.md`, or reset to the commit before this task once it is committed.

## 2026-07-12 - Task: 新增完整中英双语支持

### What was done
- 新增应用级国际化目录和运行时，默认使用中文，可在设置中切换英语，并将语言偏好持久化到当前浏览器。
- 完成主要界面、弹窗、提示、操作日志、诊断信息、后端错误和相对时间的中英双语覆盖；仓库路径、分支名、标签、提交信息、作者、引用、提交哈希、命令及原始 Git 输出保持原值。
- API 请求携带当前语言，服务端按单次请求返回本地化响应副本，避免修改共享仓库状态。
- 修复英语界面按钮溢出、示例模式目录选择使用伪路径，以及拉取请求判断依赖翻译标题的问题。
- 保持 `README.md`、`docs/` 和 `progress.md` 为中文，并补充国际化架构与后续开发说明。

### Testing
- 运行 `npm test`，20 项测试全部通过。
- 对 30 个 JavaScript 文件运行 `node --check`，全部通过。
- 运行 `git diff --check`，无空白错误，仅保留现有 LF/CRLF 工作区提示。
- 扫描显式前端翻译缺口，结果为 0。
- 在内置浏览器验证设置、提交、分支整理、同步、比较、工作树、子模块、储藏、恢复点、操作日志、文件历史、逐行、命令面板、目录、克隆和初始化等界面；在 1280x720、900x700、734x912 三种视口下未发现控件文字溢出。
- 验证英语刷新后保持英语；验证结束后恢复中文并确认刷新后仍保持中文，随后关闭验证标签页。

### Notes
- `public/index.html`：接入国际化脚本并为可翻译界面提供运行时挂载点。
- `public/js/i18n-catalog.js`：新增中英双语文案目录。
- `public/js/i18n.js`：新增语言切换、持久化、插值和界面翻译运行时。
- `public/js/api.js`：为 API 请求附加当前界面语言。
- `public/js/bootstrap.js`：在应用启动阶段初始化语言环境。
- `public/js/core.js`：接入共享翻译与本地化辅助逻辑。
- `public/js/app/events.js`：本地化应用级交互事件文案。
- `public/js/app/init.js`：本地化初始化流程和启动提示。
- `public/js/app/layout-utils.js`：本地化布局相关提示。
- `public/js/features/branches.js`：本地化分支操作界面和反馈。
- `public/js/features/commit-actions.js`：本地化提交与追加提交界面和反馈。
- `public/js/features/context-menus.js`：本地化上下文菜单及其操作提示。
- `public/js/features/diff-workbench.js`：本地化 Diff 工作台、变更段说明和按行操作反馈。
- `public/js/features/folder-command.js`：本地化目录、克隆、初始化和命令面板。
- `public/js/features/git-actions.js`：本地化通用 Git 操作提示与确认。
- `public/js/features/history-list.js`：本地化提交历史展示和相对时间。
- `public/js/features/repositories.js`：本地化仓库打开、切换和路径选择流程。
- `public/js/features/worktree-changes.js`：本地化工作区、暂存区和文件操作界面。
- `public/js/panels/inspector.js`：本地化详情、文件、标签、历史和逐行面板。
- `public/js/panels/recovery-settings.js`：本地化恢复点与设置面板，并接入语言选项。
- `public/js/panels/sync.js`：本地化同步状态和远端操作界面。
- `public/js/panels/workspaces.js`：本地化工作树、子模块、储藏和操作日志面板。
- `server.js`：根据请求语言本地化响应错误、诊断、操作日志和相对时间，同时保留原始 Git 数据。
- `tests/i18n.test.js`：新增国际化目录、运行时和服务端本地化测试。
- `tests/api-repo-context.test.js`：适配请求语言头并验证仓库上下文行为不回归。
- `tests/diff-preview.test.js`：适配双语 Diff 输出并保持预览行为覆盖。
- `tests/git-api.test.js`：补充双语 API 错误和操作结果验证。
- `docs/ARCHITECTURE.md`：以中文记录国际化模块、加载顺序、服务端边界和测试方式。
- `docs/CONTINUE.md`：以中文记录双语功能范围和后续开发约束。
- `progress.md`：追加本轮实现、验证和回滚记录。
- 回滚方式：执行 `git revert <本轮提交哈希>`；如尚未提交，可仅还原上述文件并删除 `public/js/i18n-catalog.js`、`public/js/i18n.js`、`tests/i18n.test.js`。

## 2026-07-12 - Task: 从远端移除项目级 Codex skills

### What was done
- 将 `.codex/skills/` 从 Git 跟踪中移除，使远端仓库不再包含项目级 skills。
- 将 `.codex/skills/` 加入忽略规则，防止本机 skills 后续被误提交。
- 保留本机现有 skill 文件，不影响当前电脑继续使用。
- 更新继续开发说明，明确 skills 仅供本地 Codex 使用，不进入项目远端。

### Testing
- 确认移除前 `.codex/skills/` 为 Git 已跟踪目录。
- 使用 `git check-ignore` 确认 `.codex/skills/` 受忽略规则保护。
- 确认取消跟踪后本机 `.codex/skills/` 目录及现有文件仍然存在。
- 运行 `git diff --cached --check`，确认待提交差异没有空白错误。

### Notes
- `.gitignore`：忽略本机 `.codex/skills/` 目录。
- `.codex/skills/`：从 Git 索引和远端交付范围移除，本机文件保留。
- `docs/CONTINUE.md`：改为记录 skills 仅限本机使用。
- `progress.md`：追加本轮实现、验证和回滚记录。
- 回滚方式：执行 `git revert <本轮提交哈希>` 可恢复远端中的 skill 文件；如尚未提交，可执行 `git restore --staged .codex/skills .gitignore docs/CONTINUE.md progress.md` 并还原这三处文档改动。

## 2026-07-12 - Task: 为过长代码行增加水平滚动

### What was done
- 调整并排 Diff 的列宽计算，旧版和新版分别按各自最长代码行预留展示宽度。
- 移除代码单元的截断省略，过长代码保持单行完整显示，由文件 Diff 容器提供水平滚动。
- 同步覆盖底部工作区 Diff、提交文件 Diff、储藏 Diff 和最大化 Diff，并保持两侧行号及列分隔对齐。

### Testing
- 运行 `node --check public/js/features/diff-workbench.js`，语法检查通过。
- 运行 `node --test tests/diff-preview.test.js`，3 项测试全部通过，包含英文长行和中文宽字符列宽验证。
- 运行 `npm test`，21 项测试全部通过。
- 运行 `git diff --check`，确认差异没有空白错误。
- 使用包含超长代码行的 Diff 验证底部视图和最大化视图均出现水平滚动，滚动后可查看完整代码且旧版/新版列保持对齐。

### Notes
- `public/js/features/diff-workbench.js`：计算旧版和新版最长代码行的显示宽度并传给 Diff 布局。
- `public/styles.css`：按计算宽度展开并排 Diff，取消代码省略并启用外层水平滚动。
- `tests/diff-preview.test.js`：新增长代码行和中文宽字符列宽测试。
- `docs/CONTINUE.md`：记录过长代码行的水平滚动行为。
- `progress.md`：追加本轮实现、验证和回滚记录。
- 回滚方式：执行 `git revert <本轮提交哈希>`；如尚未提交，可还原上述五个文件。

## 2026-07-12 - Task: 缩小工作区文件树缩进

### What was done
- 修正工作区文件树同时使用 DOM 嵌套和绝对深度缩进造成的重复叠加。
- 改为每层目录固定增加一次紧凑缩进，保留层级引导线和展开箭头。
- 深层目录与文件获得更多横向显示空间，不改变文件选择、展开和多选逻辑。

### Testing
- 运行 `git diff --check`，确认差异没有空白错误。
- 在真实 `forkline-web` 工作区验证根目录 `progress.md` 与一级目录 `docs/CONTINUE.md`、`public/styles.css`，文件行左边距固定相差 15px，层级仍清晰。
- 在 213px 宽的工作区文件树下确认 `clientWidth = scrollWidth = 213px`，没有横向溢出。

### Notes
- `public/styles.css`：将文件树缩进改为随 DOM 嵌套固定递增，移除绝对深度的重复计算。
- `docs/CONTINUE.md`：记录紧凑文件树层级规则。
- `progress.md`：追加本轮实现、验证和回滚记录。
- 回滚方式：执行 `git revert <本轮提交哈希>`；如尚未提交，可还原上述三个文件。

## 2026-07-12 - Task: 优化顶部路径选择区间距

### What was done
- 拉开路径输入框、最近仓库选择器和路径操作按钮组之间的距离。
- 为“选择 / 克隆 / 初始化 / 打开”操作组增加左侧分隔和更均匀的按钮间距。
- 将主要“打开”操作与辅助操作稍微分开，保持原有功能顺序和按钮尺寸。
- 适当增加最近仓库区域宽度，降低文本和清除按钮的拥挤感。

### Testing
- 运行 `git diff --check`，确认差异没有空白错误。
- 检查 `public/styles.css` 花括号数量一致。
- 在 1280px、920px 和 734px 宽度验证路径输入、最近仓库和四个操作按钮没有重叠、变形或文字溢出。
- 在 734px 英语界面验证 `Choose / Clone / Initialize / Open` 均完整显示，路径输入仍保留 253px，路径区没有横向溢出；验证后恢复中文。
- 确认窄屏路径选择区仍保持完整可用，顶部其他按钮布局未发生变化。

### Notes
- `public/styles.css`：调整路径选择区的网格宽度、组间距、按钮组分隔和主操作留白。
- `docs/CONTINUE.md`：更新顶部路径选择区布局规则。
- `progress.md`：追加本轮实现、验证和回滚记录。
- 回滚方式：执行 `git revert <本轮提交哈希>`；如尚未提交，可还原上述三个文件。

## 2026-07-13 - Task: 修复其他分支视图误弹签出储藏恢复提示

### What was done
- 将“储藏并签出”恢复提醒绑定到请求发起时的仓库、实际检出分支和当前查看引用。
- 查询储藏期间如果仓库或实际分支已切换，旧查询结果不再弹窗。
- 当前查看其他分支时，即使实际检出分支或浏览器缓存里存在对应储藏，也不会显示不属于当前视图的恢复提醒。
- 保留在全部分支视图或储藏所属的当前检出分支中正常恢复的能力。

### Testing
- 修复前运行 `node --test tests/checkout-stash-ui-state.test.js`，实际分支切走和查看其他分支两项均稳定复现错误弹窗。
- 修复后重跑定向测试，4 项全部通过，覆盖实际分支变化、查看引用变化、浏览器缓存记录和全部分支正常提示。
- 运行 `npm test`，25 项测试全部通过。
- 运行 `node --check public/js/features/git-actions.js`，脚本语法检查通过。
- 运行 `git diff --check`，确认差异没有空白错误；换行符提示为仓库现有 Windows 工作区转换提醒。
- 搜索 `[DEBUG-`，确认没有遗留临时调试标记。

### Notes
- `public/js/features/git-actions.js`：在提示和恢复前核对仓库、实际检出分支与当前查看引用。
- `tests/checkout-stash-ui-state.test.js`：新增签出储藏提示上下文竞态和缓存记录回归测试。
- `README.md`：说明签出储藏恢复提醒的页面上下文条件。
- `docs/CONTINUE.md`：记录当前页面上下文变化后丢弃旧恢复提醒的行为。
- `docs/ARCHITECTURE.md`：记录恢复提醒状态绑定规则及对应测试入口。
- `progress.md`：追加本轮实现、验证和回滚记录。
- 回滚方式：执行 `git revert <本轮提交哈希>`；如尚未提交，可还原上述六个文件。

## 2026-07-13 - Task: 签出返回原分支时自动恢复储藏

### What was done
- Forkline 成功签出本地或远端分支后，如果目标分支存在对应的“储藏并签出”记录，会直接自动恢复，不再显示“是否恢复”确认框。
- 应用启动、重新打开仓库或刷新时发现遗留恢复记录，仍保留确认提示，避免没有明确签出动作时静默修改工作区。
- 保留仓库、实际检出分支和当前查看引用校验，其他分支视图及过期异步结果不会触发自动恢复。

### Testing
- 修复前新增“主动签出后自动恢复”回归测试，稳定复现仍调用确认框且没有发出恢复请求。
- 修复后运行 `node --test tests/checkout-stash-ui-state.test.js`，5 项全部通过。
- 运行 `npm test`，26 项测试全部通过。
- 运行 `node --check public/js/features/git-actions.js`，脚本语法检查通过。
- 运行 `git diff --check`，确认差异没有空白错误；换行符提示为仓库现有 Windows 工作区转换提醒。
- 搜索 `[DEBUG-`，确认没有遗留临时调试标记。

### Notes
- `public/js/features/git-actions.js`：为 Forkline 主动签出后的储藏检查启用自动恢复模式。
- `tests/checkout-stash-ui-state.test.js`：增加不弹确认框并直接发出恢复请求的回归测试。
- `README.md`：说明主动签出自动恢复与启动时确认恢复的差异。
- `docs/CONTINUE.md`：记录签出返回原分支后的自动恢复行为。
- `docs/ARCHITECTURE.md`：记录自动模式与确认模式的调用边界。
- `progress.md`：追加本轮实现、验证和回滚记录。
- 回滚方式：执行 `git revert <本轮提交哈希>`；如尚未提交，可还原上述六个文件。

## 2026-07-13 - Task: 彻底移除签出储藏恢复确认框

### What was done
- 修正上一轮仍为应用启动、仓库打开和刷新入口保留确认框的问题，所有匹配当前上下文的 Forkline 签出储藏现在统一直接自动恢复。
- 删除“发现可恢复的储藏更改”弹窗 HTML、交互函数、页面状态、DOM 引用、弹窗占用判断、专用样式和中英文文案。
- 保留仓库路径、实际检出分支和当前查看引用校验；上下文不匹配或异步查询结果过期时仍不执行恢复。

### Testing
- 修复前将当前分支总览测试改为要求自动恢复，稳定复现查询命中后仍调用一次确认框。
- 运行 `node --test tests/checkout-stash-ui-state.test.js`，6 项全部通过，覆盖弹窗实现已删除、分支/视图变化拦截、后端查询命中自动恢复和缓存命中自动恢复。
- 运行 `npm test`，27 项测试全部通过。
- 对运行中的 `http://127.0.0.1:5287/` 读取实际 HTML 和脚本，确认 `HasChooseRestore=False`、`HasRestoreModal=False`，同时恢复动作仍存在。
- 对本轮修改的 4 个 JavaScript 文件运行 `node --check`，语法检查全部通过。
- 运行 `git diff --check`，确认差异没有空白错误；换行符提示为仓库现有 Windows 工作区转换提醒。
- 搜索弹窗标识、旧忽略状态和 `[DEBUG-`，除测试中的“不应存在”断言外无实现残留。

### Notes
- `public/js/features/git-actions.js`：统一自动恢复并删除确认分支与弹窗函数。
- `public/js/core.js`：删除弹窗 DOM 引用和旧忽略状态。
- `public/js/features/folder-command.js`：移除不存在弹窗的占用判断。
- `public/index.html`：删除恢复确认框结构。
- `public/styles.css`：删除恢复确认框专用布局。
- `public/js/i18n-catalog.js`：删除恢复确认框专用英文翻译。
- `tests/checkout-stash-ui-state.test.js`：改为断言弹窗实现不存在并验证两种自动恢复来源。
- `README.md`：说明匹配上下文时统一自动恢复。
- `docs/CONTINUE.md`：记录启动、打开和刷新入口不再提示确认。
- `docs/ARCHITECTURE.md`：记录统一自动恢复模式及上下文保护。
- `progress.md`：追加本轮实现、验证和回滚记录。
- 回滚方式：执行 `git revert <本轮提交哈希>`；如尚未提交，可还原上述十一个文件。

## 2026-07-26 - Task: 优化右侧提交文件 Diff 排版

### What was done
- 将右侧提交“文件”页的 Diff 从窄栏双列改为单列阅读，上下文行只保留一份，修改行按删除、增加顺序上下排列。
- 按旧版和新版中的较长一列计算内容宽度，保留长代码水平滚动，同时缩短查看完整改动所需的横向滚动距离。
- 将文件名、完整路径与“文件历史 / 逐行追踪 / 最大化”按钮分成两行，避免窄右栏中的标题和操作互相挤压。
- 保持底部工作台和最大化 Diff 的旧版/新版双栏布局不变。

### Testing
- 检查 `public/styles.css` 花括号数量，确认开启和闭合均为 837。
- 基于最新 `origin/main` 重新运行 `npm test`，27 项测试全部通过。
- 运行 `git diff --check`，确认差异没有空白错误。
- 在内置浏览器以 1146 × 912 验证右侧提交文件面板：内容宽度由约 872px 降到约 447px，上下文行只显示 1 个代码单元，修改行显示 2 个上下排列的代码单元，长行仍有水平滚动。
- 确认右侧标题栏的三个按钮处于同一操作行且没有横向溢出；英语 `File history / Blame / Maximize` 同样完整显示，验证后恢复中文。
- 确认底部工作台和最大化 Diff 仍显示旧版/新版双栏，浏览器控制台无错误。

### Notes
- `public/styles.css`：为右侧提交文件 Diff 增加窄栏单列布局、长行宽度和标题操作换行规则。
- `docs/CONTINUE.md`：记录右侧提交文件 Diff 与其他 Diff 视图的布局边界。
- `progress.md`：追加本轮实现、验证和回滚记录。
- 回滚方式：执行 `git revert <本轮提交哈希>`；如尚未提交，可还原上述三个文件。

## 2026-07-26 - Task: 隐藏工作区摘要中的零数量

### What was done
- 将提交框底部的工作区摘要改为按项目动态生成，只显示数量大于 0 的未暂存、已暂存、冲突和文件状态。
- 使用统一分隔点连接保留项目，隐藏零数量后不会留下多余逗号或分隔符。
- 同步补充英文计数文案，并保留工作区筛选数量提示。

### Testing
- 运行 `node --check public/js/features/worktree-changes.js` 和 `node --check public/js/i18n-catalog.js`，语法检查通过。
- 运行 `node --test tests/worktree-summary.test.js`，2 项定向测试全部通过，覆盖中文零数量隐藏及英文筛选提示。
- 运行 `npm test`，29 项测试全部通过。
- 运行 `git diff --check`，确认差异没有空白错误。
- 在内置浏览器刷新真实 GitTest：中文摘要显示“1 个未暂存 · 1 个删除”，英文摘要显示“1 unstaged · 1 deleted”；恢复中文后显示正常，控制台无错误。

### Notes
- `public/js/features/worktree-changes.js`：按非零数量动态生成工作区摘要。
- `public/js/i18n-catalog.js`：将固定整句摘要翻译拆成可组合的英文计数文案。
- `tests/worktree-summary.test.js`：新增工作区摘要中英文定向测试。
- `docs/CONTINUE.md`：记录零数量隐藏和筛选提示规则。
- `progress.md`：追加本轮实现、验证和回滚记录。
- 回滚方式：执行 `git revert <本轮提交哈希>`；如尚未提交，可还原上述五个文件并删除 `tests/worktree-summary.test.js`。

## 2026-07-28 - Task: 全面修复窄屏排版挤压和中英文指令占位

### What was done
- 将普通功能按钮中的 Git 指令从可见并排文字改为悬停提示，动态渲染的按钮也会自动补充 `title`；提交、分支等右键菜单继续直接显示指令。
- 修正首次加载把空布局偏好误解析为 0 的问题，并调整左右侧栏、变更区和中心区的动态最小宽度；提交列表会随中心区宽度依次隐藏作者和 SHA，超长提交标题不再把时间列和其他提交行推向右侧。
- 修复提交框、设置页、同步区、文件操作区和窄左栏在低分辨率或侧栏极限宽度下的越界、截字和控件挤压；历史提交信息编辑说明允许换行。
- 为所有右键菜单增加视口高度上限和内部滚动；菜单内部滚动不再触发全局关闭逻辑，底部 reset 操作在短视口中仍可访问。

### Testing
- 定向测试先稳定复现并覆盖三项实际问题：`800×720` 提交右键菜单高 `782px` 超出 `720px` 视口、设置页 `266px` 右栏中的“重置布局”按钮横向溢出、GitTest 最窄提交行 `scrollWidth 370px > clientWidth 350px`。
- 运行 `node --test tests/layout-ui.test.js`，7 项全部通过，覆盖指令悬停、动态面板初始化、空布局偏好、窄提交列、右栏换行、左栏约束和右键菜单滚动。
- 运行 `npm test`，36 项全部通过。
- 对 `public/js/app/layout-utils.js`、`public/js/app/events.js`、`public/js/bootstrap.js` 和 `tests/layout-ui.test.js` 运行 `node --check`，全部通过。
- 运行 `git diff --check`，无空白错误；仅有仓库现有的 Windows 换行转换提醒。
- 内置浏览器验证 `800×720`、`920×768`、`1024×768`、`1280×720`、`1600×900`；双侧栏同时拉到约 `420px / 560px` 后中心区仍无越界，提交各列位置偏差为 0。
- 逐页验证详情、文件、文件历史、逐行追踪、分支整理、工作树、子模块、同步、比较、储藏、标签、恢复点、操作日志和设置；逐个验证命令、克隆、初始化、目录选择、新建分支和创建 Tag 弹窗，均无横向溢出或控件重叠。
- 真实打开 `D:\桌面\GitTest`，用 75 字符历史提交标题验证 5 组分辨率，修复后每组提交行越界数均为 0；右键菜单可在 `800×720` 内滚动到底部，页面控制台无错误。

### Notes
- `public/js/app/layout-utils.js`：增加普通按钮指令悬停装饰和动态 DOM 监听，并修正布局偏好及动态宽度边界。
- `public/js/app/events.js`：允许右键菜单内部滚动，不再被全局滚动监听关闭。
- `public/js/bootstrap.js`：在动态面板渲染前初始化指令悬停处理。
- `public/styles.css`：完成低分辨率、侧栏极限宽度、提交列、提交框、设置页和右键菜单的响应式约束。
- `tests/layout-ui.test.js`：新增布局和指令提示回归测试。
- `README.md`：补充低分辨率布局与普通按钮/右键菜单指令展示规则。
- `docs/CONTINUE.md`：记录本轮布局边界、实现规则和浏览器验证证据。
- `progress.md`：追加本轮实现、验证和回滚记录。
- 回滚方式：执行 `git revert <本轮提交哈希>`；如尚未提交，可执行 `git restore --source=ced1319 -- public/js/app/layout-utils.js public/js/app/events.js public/js/bootstrap.js public/styles.css README.md docs/CONTINUE.md progress.md`，再执行 `Remove-Item -LiteralPath tests/layout-ui.test.js`。

## 2026-07-28 - Task: 居中提交详情操作区

### What was done
- 将右侧提交详情中的“提交操作”“历史编辑”“历史编辑队列”标题和按钮文字统一居中，并将空队列提示居中。
- 使用专用类限制改动范围，提交信息、元数据、Diff 等其他详情区域继续保持原排版。

### Testing
- 运行 `node --test tests/layout-ui.test.js`，8 项全部通过；新增用例确认只有三组指定操作区使用居中专用类，通用详情标题没有被整体改为居中。
- 在内置浏览器打开真实 `D:\桌面\GitTest` 验证：右栏默认 `340px` 和最小 `220px` 时，三组标题、16 个按钮以及空队列提示均为居中，按钮和详情区域无横向溢出；“提交信息”标题仍保持左对齐。测试后已将右栏恢复为 `340px`。
- 运行完整测试，37 项全部通过。沙箱默认读取用户 Git ignore 配置会产生权限警告，因此完整测试使用仅对测试进程生效的 `XDG_CONFIG_HOME=C:\tmp` 排除该环境噪声，未修改系统或仓库 Git 配置。
- 对 `public/js/panels/inspector.js` 和 `tests/layout-ui.test.js` 运行 `node --check`，全部通过。
- 运行 `git diff --check`，无空白错误；仅有仓库现有的 Windows 换行转换提醒。

### Notes
- `public/js/panels/inspector.js`：为三组指定操作区增加专用居中类。
- `public/styles.css`：仅对指定标题、按钮文字和空队列提示应用居中规则。
- `tests/layout-ui.test.js`：增加操作区居中范围回归测试。
- `README.md`：补充提交详情操作区的显示规则。
- `docs/CONTINUE.md`：记录专用样式范围，避免后续误改其他详情标题。
- `progress.md`：追加本轮实现、验证和回滚记录。
- 回滚方式：执行 `git revert <本轮提交哈希>`；如尚未提交，可仅还原本轮对上述六个文件的对应修改。

## 2026-07-28 - Task: 紧凑排列提交详情操作按钮

### What was done
- 将右侧提交详情的三组操作按钮从满宽单列改为正常宽度下的两列紧凑网格，降低纵向滚动距离。
- “硬重置”和“丢弃此提交”继续单独占整行，保留危险操作的视觉隔离；右栏不超过 `300px` 时自动恢复单列，长标签允许换行。
- 按钮顺序、功能、提示和右键菜单均未改变。

### Testing
- 运行 `node --test tests/layout-ui.test.js`，9 项全部通过；新增用例覆盖两列网格、危险操作整行、长标签换行和 `300px` 以下单列回退。
- 在内置浏览器打开真实 `D:\桌面\GitTest` 验证：右栏 `340px` 时三组按钮分别占 5、2、2 行，总计由 16 行缩短为 9 行；普通按钮约 `145px` 宽，“硬重置”和“丢弃此提交”约 `296px` 宽并独占整行，所有按钮均无横向或纵向溢出。
- 将右栏缩至 `220px` 后，三组按钮自动恢复 9、3、4 行单列布局，按钮约 `184px` 宽，详情区和右栏均无横向溢出；同时切换英文界面检查长标签可换行，结束后已恢复中文和原有 `220px` 右栏宽度。
- 运行完整测试，38 项全部通过；测试进程继续使用临时 `XDG_CONFIG_HOME=C:\tmp` 排除沙箱无法读取用户 Git ignore 配置产生的环境警告，未修改系统或仓库 Git 配置。
- 对 `tests/layout-ui.test.js` 运行 `node --check`，通过；运行 `git diff --check`，无空白错误，仅有仓库现有的 Windows 换行转换提醒。

### Notes
- `public/styles.css`：增加提交操作区两列布局、危险操作整行规则和窄右栏单列回退。
- `tests/layout-ui.test.js`：增加紧凑网格与响应式回退测试。
- `README.md`：补充提交操作按钮布局规则。
- `docs/CONTINUE.md`：记录两列、危险操作整行和窄栏回退边界。
- `progress.md`：追加本轮实现、验证和回滚记录。
- 回滚方式：执行 `git revert <本轮提交哈希>`；如尚未提交，可仅还原本轮对上述五个文件的对应修改。

## 2026-07-29 - Task: 新增多套皮肤配色

### What was done
- 在原有深色和浅色基础上新增石墨、森林、樱色和高对比，共 6 套可保存的主题皮肤。
- 设置页外观区域改为带四主色色块的紧凑主题卡片，正常右栏双列展示，窄右栏自动回退单列。
- 顶部主题按钮保留原入口并按 6 套主题顺序循环；同步补全浅色原生控件、主题透明强调层和英文名称说明。

### Testing
- 修复前运行 `node --test tests/themes.test.js`，3 项均失败，分别复现运行时不接受新主题、设置页没有主题目录、CSS 和英文文案缺失。
- 修复后重跑 `node --test tests/themes.test.js`，3 项全部通过。
- 对 `public/js/app/layout-utils.js`、`public/js/panels/recovery-settings.js` 和 `public/js/i18n-catalog.js` 运行 `node --check`，全部通过。
- 完整 `npm test` 首次有 3 项被沙箱 Git ignore 权限警告污染；仅为测试进程设置 `XDG_CONFIG_HOME=C:\tmp` 后重跑，41 项全部通过，未修改系统或仓库 Git 配置。
- 在本地服务 `http://127.0.0.1:5287/?tab=settings` 打开真实 `D:\桌面\GitTest`：6 套主题卡均显示，森林、樱色、高对比和顶部循环切换生效；最窄右栏下主题卡、右栏和页面均无横向溢出，控制台无错误或警告。

### Notes
- `public/js/app/layout-utils.js`：新增主题目录、主题校验、显示名称和 6 套循环切换逻辑。
- `public/js/panels/recovery-settings.js`：设置页从固定两项改为渲染完整主题目录及色块预览。
- `public/styles.css`：增加 4 套完整色板、主题相关 RGB 透明层、紧凑主题卡和窄栏回退。
- `public/js/i18n-catalog.js`：补充新主题、说明和快捷切换提示的英文文案。
- `public/index.html`：将顶部按钮静态提示调整为“切换配色”。
- `tests/themes.test.js`：新增主题恢复、保存、循环、设置渲染、CSS 完整性和英文文案回归测试。
- `README.md`：说明 6 套皮肤、设置入口和顶部快捷切换。
- `docs/CONTINUE.md`：记录主题数量、布局边界、存储键和国际化状态。
- `progress.md`：追加本轮实现、验证和回滚记录。
- 回滚方式：执行 `git revert <包含本轮主题改动的提交哈希>`；如尚未提交，只反向还原本条 Notes 所列文件中的主题相关修改，避免覆盖这些文件里更早的未提交工作。

## 2026-07-29 - Task: 新增弹窗式工作区文件编辑器

### What was done
- 在工作区 Diff 顶部和文件右键菜单增加“编辑文件”入口，以独立弹窗编辑当前工作区文本文件。
- 支持保存、取消、关闭、`Ctrl+S`、未保存关闭确认；保存后保留原文件选择并刷新到最新未暂存 Diff，切换仓库时清理旧编辑状态。
- 后端限制为仓库内不超过 1 MiB 的 UTF-8 普通文本文件，保留 BOM 和原换行格式；使用内容快照拒绝覆盖已被外部程序修改的文件，并阻止二进制、符号链接、目录、`.git` 内部文件和越界路径。

### Testing
- 对 `server.js`、`public/js/app/events.js` 和 `public/js/features/file-editor.js` 运行 `node --check`，全部通过。
- 运行 `node --test tests/git-api.test.js tests/file-editor-ui.test.js`，11 项全部通过；覆盖真实 UTF-8/BOM/CRLF 读取保存、外部修改冲突保护、二进制和路径穿越拒绝，以及前端入口、快捷键和切仓库清理接线。
- 使用临时 `XDG_CONFIG_HOME=C:\tmp` 运行完整 `npm test`，44 项全部通过，未修改系统或仓库 Git 配置。
- 内置浏览器在 `http://127.0.0.1:5288/` 打开真实 `D:\桌面\GitTest`：顶部入口和右键入口均可打开 `forkline-editor-demo.txt`，`Ctrl+S` 保存后仍停留在该文件 Diff；弹窗在 `1528×1045` 视口中约为 `1120×760`，无横向或纵向溢出，状态栏正确显示 `UTF-8 · CRLF · 162 B`，控制台无错误。
- 额外使用 `800×720` 浏览器视口覆写检查低分辨率状态，弹窗头部、编辑区、状态栏、取消和保存按钮仍完整可见，容器没有横向或纵向溢出；检查后恢复默认浏览器尺寸。
- 运行 `git diff --check`，无空白错误；仅有仓库现有的 Windows 换行转换提醒。

### Notes
- `server.js`：新增工作区文本文件读取、保存、格式保留、路径边界和内容冲突保护 API。
- `public/index.html`：增加工作区编辑入口、文件右键菜单项和编辑器弹窗结构，并加载编辑器脚本。
- `public/styles.css`：增加弹窗编辑器的桌面与窄屏布局样式。
- `public/js/core.js`：登记编辑器状态和弹窗控件引用。
- `public/js/app/events.js`：接入编辑器按钮、表单、关闭动作、`Escape` 和 `Ctrl+S`。
- `public/js/features/context-menus.js`：接入文件右键“编辑文件”动作。
- `public/js/features/diff-workbench.js`：根据当前 Diff 文件状态启用或禁用编辑入口。
- `public/js/features/repositories.js`：切换仓库时清理旧编辑弹窗和状态。
- `public/js/features/file-editor.js`：实现文件读取、修改状态、保存、关闭确认和保存后刷新流程。
- `public/js/i18n-catalog.js`：补充编辑器及后端限制的中英文提示。
- `tests/git-api.test.js`：增加工作区文件读写、格式保留、冲突和安全边界测试。
- `tests/file-editor-ui.test.js`：增加编辑器入口、弹窗、快捷键和仓库清理接线测试。
- `README.md`：说明弹窗编辑入口、保存行为和文件限制。
- `docs/CONTINUE.md`：记录实现边界、验证状态和 GitTest 演示文件。
- `progress.md`：追加本轮实现、验证和回滚记录。
- 回滚方式：执行 `git restore -p -- server.js public/index.html public/styles.css public/js/core.js public/js/app/events.js public/js/features/context-menus.js public/js/features/diff-workbench.js public/js/features/repositories.js public/js/i18n-catalog.js tests/git-api.test.js README.md docs/CONTINUE.md progress.md`，只选择本轮文件编辑器相关 hunk；再执行 `Remove-Item -LiteralPath public/js/features/file-editor.js,tests/file-editor-ui.test.js`。如本轮以后已提交，则执行 `git revert <包含本轮文件编辑器改动的提交哈希>`。

## 2026-07-29 - Task: 升级文件编辑器为新旧对照、代码高亮、查找替换和 GBK 编辑

### What was done
- 将工作区文件编辑器升级为 `HEAD` 旧版本与工作区新版本双栏：左栏只读、右栏编辑，未跟踪文件左栏为空，重命名文件按 `previousFile` 读取旧路径。
- 随仓库引入 CodeMirror MergeView、diff-match-patch 和 iconv-lite，提供行号、差异连接、常见代码语法高亮、查找上一处/下一处、区分大小写、单处替换、全部替换以及 `Ctrl+F`、`Ctrl+H`、`Ctrl+S`。
- 后端新增 UTF-8、UTF-8 BOM、GBK、GB18030 自动识别和原编码保存，继续保持原换行格式、SHA-256 外部修改保护及文本文件安全边界。
- 浏览器实测修复两处布局问题：查找栏隐藏时正文网格行被底栏占用，以及 CodeMirror 首次测量后行号覆盖代码开头；双栏正文现在稳定占满弹窗并在第二帧完成行号重新对齐。
- 在 `D:\桌面\GitTest` 留下可直接查看的演示内容：已跟踪的 `测试.txt` 保留 `HEAD` / 工作区差异，`forkline-editor-demo.c` 和 `forkline-editor-gbk.c` 作为未跟踪 UTF-8 / GBK C 文件；没有残留暂存。

### Testing
- 对 `server.js`、编辑器相关前端脚本和两份编辑器测试运行 `node --check`，全部通过。
- 运行 `node --test tests/git-api.test.js tests/file-editor-ui.test.js`，14 项全部通过；覆盖真实 UTF-8、GBK、GB18030、`HEAD` 对照、重命名旧路径、编码与换行字节保真、外部修改冲突和安全边界。
- 使用临时 `XDG_CONFIG_HOME=C:\tmp` 运行完整 `npm test`，25 项全部通过。
- 内置浏览器在 `1910×1075` 视口验证 `测试.txt`：左栏显示 `HEAD · UTF-8 · LF`，右栏显示 `工作区 · UTF-8 · 纯文本`；查找 `Forkline` 得到 3 处匹配，下一处显示 `第 1 个，共 3 个`，全部替换并保存后弹窗关闭、原文件选择和最新 Diff 均保留。
- 内置浏览器验证 `forkline-editor-demo.c`：双栏各有独立行号，右栏识别为 C，DOM 中实际生成 3 个关键字 token、1 个预处理 token 和 2 个数字 token；正文高度为约 `713.8px`，行号与代码无覆盖。
- 切换到 GBK 演示文件前浏览器控制被用户侧策略中止，没有改用其他端口或浏览器绕过；GBK / GB18030 保存由上述真实集成测试验证，保存后的字节不能按 UTF-8 解码且可按原编码完整回读。
- `git diff --check` 无空白错误；仅报告仓库现有的 LF / CRLF 工作区转换提示。

### Notes
- `server.js`：增加原始 Git blob 读取、`HEAD` 旧版本对照及 UTF-8 / GBK / GB18030 保真读写。
- `vendor/iconv-lite/`：随仓库提供文本编码转换及其最小运行依赖。
- `public/vendor/codemirror/`：随仓库提供 MergeView、搜索、编辑辅助和常见语言模式资源。
- `public/index.html`：加入本地 CodeMirror 资源、双栏编辑器和查找替换控件。
- `public/styles.css`：加入双栏、行号、差异、高亮、搜索和窄屏布局，并固定弹窗网格行与编辑器高度。
- `public/js/core.js`：登记文件编辑器新增控件引用。
- `public/js/app/events.js`：接入查找替换控件及 `Ctrl+F`、`Ctrl+H`、`Ctrl+S`。
- `public/js/features/file-editor.js`：实现 MergeView、模式识别、查找替换、旧路径标签和双帧刷新对齐。
- `public/js/features/context-menus.js`：文件右键编辑时传递重命名前路径。
- `public/js/features/repositories.js`：切换仓库时销毁 CodeMirror 实例和搜索状态。
- `public/js/i18n-catalog.js`：补充双栏、查找替换、GBK / GB18030 和旧版本异常的中英文文案。
- `tests/git-api.test.js`：增加 `HEAD` 对照、真实 GBK / GB18030 和字节保真测试。
- `tests/file-editor-ui.test.js`：覆盖本地 vendor 资源、MergeView、行号、高亮、查找替换、快捷键、布局和国际化接线。
- `README.md`：更新文件编辑器能力、编码范围和免安装依赖说明。
- `docs/CONTINUE.md`：记录双栏编辑器实现、快捷键、资源和后端边界。
- `progress.md`：追加本轮实现、验证和回滚记录。
- 回滚方式：执行 `git restore -p -- server.js public/index.html public/styles.css public/js/core.js public/js/app/events.js public/js/features/context-menus.js public/js/features/repositories.js public/js/i18n-catalog.js tests/git-api.test.js tests/file-editor-ui.test.js README.md docs/CONTINUE.md progress.md`，只选择本轮编辑器升级相关 hunk；再删除新文件/目录 `public/js/features/file-editor.js`、`public/vendor/codemirror/` 和 `vendor/iconv-lite/`。如本轮以后已提交，则执行 `git revert <包含本轮文件编辑器升级的提交哈希>`。

## 2026-07-29 - Task: 文件对照增加按块还原并强化差异显示

### What was done
- 启用双栏编辑器中间区域的逐块还原按钮，每个差异块都可把左侧 `HEAD` 旧内容回写到右侧工作区编辑缓冲；操作不会自动保存或暂存，差异会即时重算并可继续撤销、编辑。
- 将旧版本差异块和词级删除强化为红色，将新版本差异块和词级新增强化为绿色，同时把差异色延伸到行号区并加深块边界，避免两侧变化看起来相同。
- 为还原按钮和同步滚动补充中文提示；窄屏下将中间操作区固定为 `40px`，避免低分辨率时按钮被裁切。

### Testing
- 对 `public/js/features/file-editor.js` 和 `public/js/i18n-catalog.js` 运行 `node --check`，全部通过。
- 运行 `node --test tests/file-editor-ui.test.js`，4 项全部通过；覆盖逐块还原开关、中文提示、旧红新绿样式、词级差异和窄屏中间栏宽度。
- 首次完整 `npm test` 有 3 项被沙箱无法读取用户 Git ignore 配置产生的警告文本污染；仅为测试进程设置临时 `XDG_CONFIG_HOME=C:\tmp\forkline-test-xdg` 后重跑，47 项全部通过，未修改系统或仓库 Git 配置。
- 浏览器控制仍处于此前用户侧中止状态，没有改用其他浏览器或端口绕过；本轮未新增页面目测记录。
- 运行 `git diff --check`，无空白错误；仅有仓库现有的 LF / CRLF 工作区转换提示。

### Notes
- `public/js/features/file-editor.js`：启用 MergeView 逐块还原、行号区差异类和中文内置提示。
- `public/styles.css`：增加中间还原按钮、旧红新绿块级 / 词级差异和窄屏操作区样式。
- `public/js/i18n-catalog.js`：补充逐块还原与同步滚动的英文文案。
- `tests/file-editor-ui.test.js`：增加逐块还原、差异强调及低分辨率布局回归断言。
- `README.md`：说明逐块还原的保存 / 暂存边界和旧红新绿显示规则。
- `docs/CONTINUE.md`：记录逐块回写行为、视觉规则和窄屏边界。
- `progress.md`：追加本轮实现、验证和回滚记录。
- 回滚方式：如本轮之后单独提交，执行 `git revert <包含本轮逐块还原改动的提交哈希>`；尚未提交时，仅反向还原上述文件中的本轮对应 hunk，保留这些文件里更早的未提交工作。

## 2026-07-29 - Task: 扩大双栏文件编辑器并减少中间栏占用

### What was done
- 修复桌面文件编辑器被固定限制在 `1440×860`、大屏剩余空间无法用于左右代码栏的问题；弹窗现在贴近视口并在超宽屏最高使用 `1920×1200`。
- 将桌面中间还原操作区从随窗口放大的 `6%` 改为固定 `48px`，窄屏继续使用 `40px`；左右栏平分其余空间，并继续各自提供横向滚动查看超长代码行。
- 保留不自动换行、同步滚动、逐块还原、差异高亮、查找替换、保存和编码处理等现有行为。

### Testing
- 修复前新增布局回归并运行 `node --test tests/file-editor-ui.test.js`，稳定复现弹窗缺少近全屏尺寸和桌面中间栏没有固定 `48px` 的失败。
- 修复后重跑 `node --test tests/file-editor-ui.test.js`，5 项全部通过；覆盖接近全视口的弹窗、`1920×1200` 上限、桌面 `48px` / 窄屏 `40px` 中间栏和双栏完整高度。
- 使用仅对测试进程生效的 `XDG_CONFIG_HOME=C:\tmp\forkline-test-xdg` 运行完整 `npm test`，48 项全部通过，未修改系统或仓库 Git 配置。
- 运行 `git diff --check`，无空白错误；仅有仓库现有的 LF / CRLF 工作区转换提示。
- 浏览器控制仍处于此前用户侧中止状态，没有切换其他浏览器绕过；本轮以可重复的布局回归验证尺寸修复。

### Notes
- `public/styles.css`：扩大桌面编辑器弹窗，并固定桌面 / 窄屏中间栏宽度及左右栏分配。
- `tests/file-editor-ui.test.js`：增加弹窗视口利用率和中间栏宽度回归测试。
- `README.md`：说明弹窗尺寸、中间栏和横向滚动规则。
- `docs/CONTINUE.md`：记录桌面 / 窄屏布局边界及不自动换行约束。
- `progress.md`：追加本轮复现、修复、验证和回滚记录。
- 回滚方式：如本轮之后单独提交，执行 `git revert <包含本轮双栏尺寸修复的提交哈希>`；尚未提交时，仅反向还原上述文件中的本轮对应 hunk，保留这些文件里更早的未提交工作。

## 2026-07-29 - Task: 修复双栏编辑器内容不显示

### What was done
- 修复上一轮宽度调整使用 CSS `calc()` 除法后，当前浏览器将左右栏和标题栏尺寸声明判为无效、导致编辑内容无法正常显示的问题。
- 桌面双栏宽度改为兼容写法 `calc(50% - 24px)`，窄屏改为 `calc(50% - 20px)`；继续保留桌面 `48px`、窄屏 `40px` 的中间操作区和接近全屏的弹窗尺寸。

### Testing
- 修复前新增兼容性回归并运行 `node --test tests/file-editor-ui.test.js`，稳定复现标准 `calc(50% - 24px)` 缺失以及除法公式仍存在的失败。
- 修复后重跑 `node --test tests/file-editor-ui.test.js`，5 项全部通过；测试会拒绝再次出现 `calc((100% - 48px) / 2)` 或 `calc((100% - 40px) / 2)`。
- 使用仅对测试进程生效的 `XDG_CONFIG_HOME=C:\tmp\forkline-test-xdg` 运行完整 `npm test`，48 项全部通过，未修改系统或仓库 Git 配置。
- 运行 `git diff --check`，无空白错误；仅有仓库现有的 LF / CRLF 工作区转换提示。
- 浏览器控制仍无法接管当前内置浏览器标签，没有切换其他浏览器绕过；本地服务继续使用 `Cache-Control: no-store`，页面刷新后会读取修复后的样式。

### Notes
- `public/styles.css`：将桌面和窄屏双栏的 CSS 除法公式替换为兼容的百分比减固定宽度公式。
- `tests/file-editor-ui.test.js`：增加兼容公式存在且除法公式不存在的回归保护。
- `progress.md`：追加本轮根因、修复、验证和回滚记录。
- 回滚方式：如本轮之后单独提交，执行 `git revert <包含本轮 CSS 兼容修复的提交哈希>`；尚未提交时，仅反向还原上述文件中的本轮对应 hunk，保留这些文件里更早的未提交工作。

## 2026-07-29 - Task: 支持文件编辑窗口缩放和拖动

### What was done
- 桌面端文件编辑弹窗支持拖动标题栏空白区域移动窗口，并通过右下角手柄自由调节宽高；标题栏按钮、输入框等交互控件不会误触窗口拖动。
- 拖动和缩放均限制在当前浏览器视口内，并设置 `640×360` 的桌面最小尺寸；浏览器视口变化后会重新收拢窗口，避免标题栏或操作区移出屏幕。
- 使用 `ResizeObserver` 在窗口尺寸变化后刷新 CodeMirror 双栏、行号和差异连线；窄屏继续保持近全屏布局，并禁用自由拖动与缩放。
- 补充右下角缩放手柄的英文提示、回归断言和使用文档。

### Testing
- 对 `public/js/features/file-editor.js`、`public/js/app/events.js` 和 `public/js/i18n-catalog.js` 运行 `node --check`，全部通过。
- 运行 `node --test tests/file-editor-ui.test.js`，6 项全部通过；覆盖自定义缩放手柄、标题栏拖动、全局鼠标事件、视口限制、窄屏回退、ResizeObserver 刷新和英文提示。
- 使用仅对测试进程生效的 `XDG_CONFIG_HOME=C:\tmp\forkline-test-xdg` 运行完整 `npm test`，49 项全部通过；首次用错误的 shell 环境写法未传入该变量，3 项测试被用户目录 Git ignore 权限警告污染，改用 PowerShell 进程环境后重跑通过，未修改系统或仓库 Git 配置。
- 运行 `git diff --check`，本轮已跟踪业务代码无空白错误，仅有仓库现有的 LF / CRLF 工作区转换提示；全部文件暂存后，`git diff --cached --check` 仅报告原版 CodeMirror / iconv-lite vendor 源码自带的行尾空格和文件末空行，为保持第三方源码原样未做批量格式化。
- 在 `1910×1075` 真实浏览器视口验证：初始窗口约为 `1886×1051`；缩放后约为 `1501×821`；再拖动到 `left=262, top=112` 后，右边界约为 `1763`、下边界约为 `933`，整个窗口始终位于视口内。
- 最终刷新 `http://127.0.0.1:5287/` 并打开 `D:\桌面\GitTest` 的 `测试.txt`：双栏内容、行号、逐块还原按钮均显示，标题栏计算光标为 `move`，右下角手柄显示且光标为 `nwse-resize`，初始窗口四边均保留约 `12px` 视口边距。

### Notes
- `public/index.html`：增加文件编辑器右下角缩放手柄。
- `public/js/core.js`：登记缩放手柄控件引用。
- `public/js/features/file-editor.js`：实现窗口准备、视口限制、标题栏拖动、自定义缩放和 CodeMirror 尺寸刷新。
- `public/js/app/events.js`：接入标题栏、缩放手柄及全局鼠标移动和释放事件。
- `public/styles.css`：增加可移动桌面窗口、缩放手柄、拖动 / 缩放状态和窄屏禁用规则。
- `public/js/i18n-catalog.js`：补充缩放手柄英文提示。
- `tests/file-editor-ui.test.js`：增加拖动、缩放、视口边界和国际化回归断言。
- `README.md`：说明桌面拖动缩放、视口限制和窄屏行为。
- `docs/CONTINUE.md`：记录实现边界、ResizeObserver 刷新和验证状态。
- `progress.md`：追加本轮实现、验证和回滚记录。
- 回滚方式：如本轮之后单独提交，执行 `git revert <包含本轮窗口拖动缩放改动的提交哈希>`；尚未提交时，仅反向还原上述文件中的本轮对应 hunk，保留这些文件里更早的未提交工作。

## 2026-07-29 - Task: 修复其他电脑启动缺少 safer-buffer

### What was done
- 确认 `iconv-lite 0.6.3` 运行时依赖 `safer-buffer`，本机虽然已有对应文件，但通用 `node_modules/` 忽略规则把它隐藏在 Git 提交之外，导致其他电脑拉取后启动时报 `MODULE_NOT_FOUND`。
- 为 `vendor/iconv-lite/node_modules/safer-buffer/` 增加精确忽略例外，并将 `safer-buffer 2.1.2` 的运行文件和许可证纳入仓库；保持原版 iconv-lite 源码不变，其他电脑仍无需执行 `npm install`。
- 新增便携运行回归，检查依赖文件存在且已被 Git 跟踪，并在清空 `NODE_PATH` 后执行真实 GBK 编解码，防止本机隐藏依赖再次掩盖漏包问题。
- README 增加旧副本报错后的更新指引，继续开发文档同步记录依赖和测试边界。

### Testing
- 使用 `git archive HEAD` 创建只包含已提交文件的临时副本，运行 `node server.js` 稳定复现与用户截图一致的 `Cannot find module 'safer-buffer'`，调用链为 `vendor/iconv-lite/lib/index.js -> server.js`。
- 修复前运行 `node --test tests/portable-runtime.test.js`，1 项按预期失败，明确指出 `.gitignore` 没有放行便携依赖；修复并暂存依赖后重跑，1 项通过。
- 对 `tests/portable-runtime.test.js` 运行 `node --check`，通过。
- 对包含修复后暂存树的全新归档副本执行 `start.cmd`，服务成功输出 `Forkline Web running at http://127.0.0.1:5299`，访问首页返回 HTTP `200`；随后结束测试进程并确认 `5299` 端口不再监听。
- 使用仅对测试进程生效的 `XDG_CONFIG_HOME=C:\tmp\forkline-test-xdg` 运行完整 `npm test`，50 项全部通过。
- 运行 `git diff --check` 和 `git diff --cached --check`，无空白错误；仅有仓库现有的 LF / CRLF 工作区转换和用户 Git ignore 权限提示。
- 已删除本轮创建的两个临时归档及其解压目录，没有在仓库或工作区外留下测试服务。

### Notes
- `.gitignore`：仅放行 iconv-lite 内的 safer-buffer 运行依赖，其他 node_modules 继续忽略。
- `vendor/iconv-lite/node_modules/safer-buffer/package.json`：登记随仓库提供的 safer-buffer 2.1.2 包信息。
- `vendor/iconv-lite/node_modules/safer-buffer/safer.js`：提供 iconv-lite 实际加载的安全 Buffer 兼容实现。
- `vendor/iconv-lite/node_modules/safer-buffer/dangerous.js`：保留 safer-buffer 原包运行文件。
- `vendor/iconv-lite/node_modules/safer-buffer/LICENSE`：保留第三方依赖许可证。
- `tests/portable-runtime.test.js`：增加依赖跟踪状态、独立模块解析和 GBK 编解码回归。
- `README.md`：说明 safer-buffer 已内置及旧副本的更新方式。
- `docs/CONTINUE.md`：记录便携依赖、无需 npm install 的边界和回归入口。
- `progress.md`：追加本轮复现、修复、验证和回滚记录。
- 回滚方式：如本轮单独提交，执行 `git revert <包含本轮 safer-buffer 便携修复的提交哈希>`；尚未提交时，执行 `git restore --staged --worktree -- .gitignore README.md docs/CONTINUE.md progress.md`，删除 `tests/portable-runtime.test.js`，并取消暂存 safer-buffer 四个文件后恢复原忽略状态。

## 2026-07-29 - Task: 添加快速拉取脚本

### What was done
- 新增 Windows 双击脚本，自动进入项目根目录并从 `origin/main` 以 rebase 方式拉取最新代码。
- 脚本只允许在 `main` 分支执行，避免其他分支误变基到主干；成功后显示最新提交，失败时保留 Git 错误，不会清理或强制覆盖本地文件。
- README 和继续开发文档补充脚本用途、执行条件与失败处理说明。

### Testing
- 在受限网络环境运行脚本，验证 GitHub 连接失败时返回非零状态、显示原始 Git 错误并进入停止提示，没有修改仓库。
- 在允许联网的环境运行 `cmd /c "(echo.)|call pull-latest.cmd"`，成功从 `origin/main` 拉取并显示 `Already up to date.` 和最新提交 `c0bef70 fix: 补齐 safer-buffer 便携依赖`，退出码为 0。
- 运行 `git diff --check`，确认本轮改动没有空白错误。

### Notes
- `pull-latest.cmd`：新增定位项目目录、检查 Git 与当前分支、变基拉取和结果展示逻辑。
- `README.md`：增加快速更新项目的使用说明。
- `docs/CONTINUE.md`：记录快速拉取脚本的行为边界。
- `progress.md`：追加本轮实现、验证和回滚记录。
- 回滚方式：如本轮单独提交，执行 `git revert <包含本轮快速拉取脚本的提交哈希>`；尚未提交时，执行 `git restore -- README.md docs/CONTINUE.md progress.md`，并删除 `pull-latest.cmd`。

## 2026-07-30 - Task: 工作区双击打开常驻编辑浮窗并接入暂存与右键还原

### What was done
- 工作区文件支持双击直接打开编辑器；桌面浮窗不再阻挡后方页面，拖到合适位置后单击其他工作区文件会在原浮窗内切换，有未保存内容时先中文确认。
- 双栏对照改为左侧暂存区、右侧工作区；中间操作由旧版还原改为按真实 Git hunk 暂存，右侧选区右键菜单提供“暂存所选行”和“还原所选改动块”。
- 暂存、还原和保存都会保留浮窗并重新加载最新对照；修复 Git 操作完成后关闭、查找、取消等控件仍保持禁用的问题，并禁止未保存内容直接执行暂存或还原。
- 收紧中间按钮的 hunk 匹配，只允许命中实际重叠改动块，避免在两块改动之间误暂存邻近 hunk。
- 补入 CodeMirror 5.65.16 官方 simple mode addon，并在 Dockerfile、Rust 模式之前加载，修复这两类语法高亮启动时报 `defineSimpleMode is not a function` 的问题。
- README 和继续开发文档同步更新为当前的双击、常驻浮窗、暂存区对照、按块/按行暂存及右键还原行为。

### Testing
- 对 `server.js`、本轮改动的 6 个前端功能脚本、国际化目录和新增 CodeMirror addon 运行 `node --check`，共 8 个文件全部通过。
- 运行 `node --test tests/file-editor-ui.test.js`，9 项全部通过；覆盖双击打开、常驻切换、浮窗穿透、拖动缩放、中间暂存、右键菜单、Git hunk/行映射、操作后控件恢复、保存后保持打开和 simple mode 加载顺序。
- 使用仅对测试进程生效的 `XDG_CONFIG_HOME=C:\tmp\forkline-test-xdg` 运行完整 `npm test`，53 项全部通过，退出码为 0；包含真实 UTF-8、GBK/GB18030 文件编辑 API、普通 stash、隐藏脏子模块保护和状态读取语义回归。
- 在 `1910×1075` 真实浏览器视口打开 `http://127.0.0.1:5290/` 和 `D:\桌面\GitTest`：双击文件成功打开暂存区/工作区双栏；浮窗遮罩 `pointer-events: none`、窗口本体为 `auto`；拖动后从 `left=365, top=157` 移到 `left=425, top=197`，单击其他工作区文件后仍保持原位置并切换文件。
- 在 GitTest 实测中间按钮可把未跟踪文件改动块暂存，保存后浮窗继续打开且控件恢复可用；选中新增行右键可显示“暂存所选行 / 还原所选改动块”，确认还原后未暂存 hunk 被移除。测试结束后取消本轮暂存，GitTest 恢复为测试前的 `测试.txt` 修改和 3 个未跟踪演示文件状态。
- 最终新开页面验证 CodeMirror 生成 2 个编辑器面板和 23 个高亮 token，控制台 error 日志为空；修复前可稳定看到的 Dockerfile/Rust 两条 `defineSimpleMode` 错误不再出现。
- 运行 `git diff --check`，无空白错误，仅显示仓库现有的 LF / CRLF 工作区转换提示。

### Notes
- `server.js`：工作区文件接口改为读取暂存区基准，并返回未暂存 Diff、作用域、暂存能力和文件快照。
- `public/index.html`：增加编辑器右键菜单，更新暂存区/工作区标签，并加载 CodeMirror simple mode addon。
- `public/js/core.js`：登记编辑器右键菜单控件引用。
- `public/js/app/events.js`：接入编辑器右键菜单、拖动缩放和常驻浮窗事件，并取消点击透明遮罩关闭窗口。
- `public/js/features/diff-workbench.js`：工作区文件双击打开编辑器，浮窗开启时单击文件切换当前编辑目标。
- `public/js/features/file-editor.js`：实现暂存区对照、中间按块暂存、选区按行暂存、右键整块还原、未保存保护、操作后重载、控件恢复和严格 hunk 命中。
- `public/js/features/repositories.js`：切换仓库时清理编辑器右键菜单状态。
- `public/js/i18n-catalog.js`：补充本轮编辑器操作、状态和错误提示的英文翻译。
- `public/styles.css`：把编辑器调整为后方页面可操作的桌面浮窗，并更新中间暂存按钮和操作中状态样式。
- `public/vendor/codemirror/addon/mode/simple.js`：新增 CodeMirror 5.65.16 官方 simple mode addon，供 Dockerfile 和 Rust 模式使用。
- `tests/file-editor-ui.test.js`：增加双击、常驻、暂存/还原、映射、控件恢复和 simple mode 加载顺序回归。
- `tests/git-api.test.js`：验证文件编辑接口以暂存区为左栏基准，并保持 UTF-8、GBK/GB18030 编码行为。
- `README.md`：更新工作区文件编辑器的正式使用说明。
- `docs/CONTINUE.md`：记录当前实现边界、API 语义和后续开发基线。
- `progress.md`：追加本轮实现、验证和回滚记录。
- 回滚方式：如本轮之后单独提交，执行 `git revert <包含本轮常驻编辑浮窗改动的提交哈希>`；尚未提交时，对本轮 Notes 中除新增 vendor 文件外的文件执行 `git restore -- <文件列表>`，再删除 `public/vendor/codemirror/addon/mode/simple.js`，即可回到本轮开始前状态。

## 2026-07-30 - Task: 修复大型冲突文件编辑器滚动卡死

### What was done
- 后端为工作区文件编辑接口增加明确的冲突标记，不再让前端从中文提示或空内容猜测文件状态。
- 普通文件继续使用暂存区 / 工作区 MergeView；冲突文件改为单栏 CodeMirror，只编辑工作区冲突内容，移除无意义的空左栏、同步滚动、差异连接和暂存按钮监听。
- 冲突单栏继续保留行号、语法高亮、查找替换、编码/换行信息、保存、浮窗拖动和缩放，并把“暂存区没有单一版本”的中文说明放到单栏标题中。
- 增加真实 merge 冲突 API 回归和前端结构回归，README 与继续开发文档同步说明普通文件双栏、冲突文件单栏的行为边界。

### Testing
- `node --check server.js`、`node --check public/js/features/file-editor.js` 均通过；`git diff --check` 无空白错误，仅有仓库现有 LF / CRLF 转换提示。
- `node --test tests/file-editor-ui.test.js`：10 项全部通过，新增冲突文件必须使用单栏 CodeMirror 的回归。
- `node --test --test-name-pattern 'worktree file editor' tests/git-api.test.js`：3 项全部通过，新增真实 merge 冲突接口验证 `conflict = true`、无虚假暂存区对照且仍可读取冲突标记。
- 完整 `npm test`：55 项全部通过，退出码 0；普通文件双栏、按块/按行暂存、UTF-8、GBK/GB18030、stash、子模块保护和其他前端状态回归均未受影响。
- 浏览器在 `http://127.0.0.1:5290/` 打开独立临时仓库 `C:\tmp\forkline-conflict-repro-20260730` 的约 1 MiB、20,000 行冲突文件：修复前生成 2 个高度约 402,950 px 的编辑器面板，40 次滚动总耗时约 1,172 ms、单次最慢约 59 ms；修复后生成 1 个 CodeMirror、0 个 MergeView，从第 1 行滚到约第 1,697 行后仍可立即读取状态，40 次滚动总耗时约 924 ms、单次最慢约 29 ms。
- 截图确认单栏排版、中文冲突说明、行号、长文件滚动条、保存按钮和右下角缩放手柄正常；服务已以 PID `34072` 在 `http://127.0.0.1:5290/` 重启，健康请求返回 HTTP 200。

### Notes
- `server.js`：工作区文件响应增加 `conflict` 字段。
- `public/js/features/file-editor.js`：冲突文件切换为单栏 CodeMirror，并保持普通文件 MergeView 行为。
- `public/styles.css`：冲突单栏使用全宽标题布局。
- `tests/file-editor-ui.test.js`：增加冲突文件单栏结构回归。
- `tests/git-api.test.js`：增加真实 merge 冲突文件接口回归。
- `README.md`：补充普通文件双栏、冲突文件单栏的正式说明。
- `docs/CONTINUE.md`：记录实现边界、性能对照和验证结果。
- `progress.md`：追加本轮修复、验证和回滚记录。
- 回滚方式：尚未提交时执行 `git restore -- server.js public/js/features/file-editor.js public/styles.css tests/file-editor-ui.test.js tests/git-api.test.js README.md docs/CONTINUE.md progress.md`；如本轮之后单独提交，则执行 `git revert <该提交哈希>`。

## 2026-07-30 - Task: 修复编辑器点击单个改动块却暂存全部改动

### What was done
- 复现并确认编辑器视觉块与 Git hunk 上下文不一致：同一文件第 5、10 行的两个独立按钮，在普通 8 行上下文 Diff 中会落入同一个 hunk，导致点击任意按钮都暂存两处修改。
- 工作区文件编辑接口改为给编辑器返回零上下文 Diff 和 `diffContext = 0`；底部工作区 Diff 继续使用原有 8 行上下文，不改变现有阅读和块操作行为。
- MergeView 暂存回调同时使用旧版和新版行范围定位 hunk，覆盖替换、新增和纯删除块；前端把编辑器上下文传回后端，后端用相同上下文重新生成补丁，并为零上下文补丁使用 `git apply --unidiff-zero`。
- 操作后仍保留浮窗并重载最新对照；点击第一个块后，已经暂存的块进入左栏，未暂存的第二个块继续留在右栏。

### Testing
- 修复前新增回归 `file editor stages only the selected visual chunk when nearby changes share the normal diff context` 稳定失败：`/api/worktree-file` 没有 `diffContext`，两个视觉块只返回一个 Git hunk。
- 修复后定向 API 回归通过，确认缓存区只含第 5 行、工作区只含第 10 行；`node --test tests/file-editor-ui.test.js` 10 项通过，覆盖左右范围映射和纯删除块定位。
- `node --check server.js`、`node --check public/js/features/file-editor.js` 均通过。
- 首次完整后端测试被本机 `C:\Users\Administrator\.config\git\ignore` 权限警告污染状态输出；按仓库既有方式仅为测试进程设置 `XDG_CONFIG_HOME=C:\tmp\forkline-test-xdg` 后运行 `npm.cmd test`，56 项全部通过，未修改系统 Git 配置。
- 浏览器在 `http://127.0.0.1:5290/` 打开隔离仓库：修复前两个按钮点击第一个后两处修改全部暂存；修复后点击第一个，按钮数从 2 变为 1，编辑器保持打开，`git diff --cached` 只含第 5 行，`git diff` 只含第 10 行。
- 修复后的服务以 PID `17616` 在 `http://127.0.0.1:5290/` 运行，健康请求返回 HTTP 200；浏览器已切回 `D:\桌面\GitTest`，隔离测试仓库已删除。

### Notes
- `server.js`：增加编辑器零上下文 Diff、上下文校验和 `--unidiff-zero` 块应用。
- `public/js/features/file-editor.js`：保存编辑器 Diff 上下文，并用左右范围定位及暂存当前视觉块。
- `tests/git-api.test.js`：增加相邻视觉块只暂存所点块的真实 Git API 回归。
- `tests/file-editor-ui.test.js`：增加编辑器上下文传递、相邻 hunk 和纯删除块范围映射回归。
- `README.md`：说明编辑器按视觉块独立暂存。
- `docs/CONTINUE.md`：记录实现方式、行为边界和真实浏览器验证。
- `progress.md`：追加本轮复现、修复、验证和回滚记录。
- 回滚方式：尚未提交时执行 `git restore -- server.js public/js/features/file-editor.js tests/file-editor-ui.test.js tests/git-api.test.js README.md docs/CONTINUE.md progress.md`；如本轮之后单独提交，则执行 `git revert <该提交哈希>`。

## 2026-07-30 - Task: 显示暂存区缺失行的斜纹对齐占位

### What was done
- 确认 MergeView 已为单侧新增或删除内容生成等高的 `.CodeMirror-merge-spacer`，但节点背景透明，导致暂存区缺少对应行时看起来像没有任何提示。
- 为现有占位节点增加全宽、上下边界和主题自适应的灰色斜纹；工作区新增行在暂存区左栏显示占位，工作区删除行则在右栏对称显示。
- 保留 CodeMirror 原有的行号、滚动同步、块高度计算、差异颜色和中间暂存按钮，不增加新的 DOM 或暂存分支逻辑。

### Testing
- `node --test tests/file-editor-ui.test.js`：10 项全部通过，新增占位节点必须使用全宽重复斜纹渐变的回归断言。
- 使用 `XDG_CONFIG_HOME=C:\tmp\forkline-test-xdg` 运行完整 `npm.cmd test`：56 项全部通过。
- 浏览器在 `http://127.0.0.1:5290/` 打开 `D:\桌面\GitTest` 的未跟踪文件 `forkline-editor-demo.c`：左侧暂存区生成 1 个约 `535×201px` 的占位节点，与右侧 10 行新增代码等高；深色石墨主题显示深灰斜纹，浅色主题显示白底灰斜纹，上下边界清晰且中间暂存按钮位置不变。
- 测试后已恢复用户原来的石墨主题；服务以 PID `27428` 在 `http://127.0.0.1:5290/` 运行，健康请求返回 HTTP 200，并保持打开该文件供直接查看。

### Notes
- `public/styles.css`：为 MergeView 对齐占位增加主题自适应斜纹样式。
- `tests/file-editor-ui.test.js`：增加占位样式结构回归。
- `README.md`：说明单侧新增/删除时的斜纹占位行为。
- `docs/CONTINUE.md`：记录实现边界和深浅主题验证。
- `progress.md`：追加本轮实现、验证和回滚记录。
- 回滚方式：尚未提交时执行 `git restore -- public/styles.css tests/file-editor-ui.test.js README.md docs/CONTINUE.md progress.md`；如本轮之后单独提交，则执行 `git revert <该提交哈希>`。

## 2026-07-30 - Task: 修正顶部皮肤切换名称与实际配色错位

### What was done
- 确认顶部主题按钮原本显示下一套皮肤名称，而页面实际仍使用当前皮肤，导致按钮名称与配色整体错一位。
- 按钮正文改为显示当前皮肤，悬停提示继续同时说明当前皮肤和点击后将切换到的下一套皮肤；默认深色页面的初始按钮文字同步改为“深色”。
- 保留深色、浅色、石墨、森林、樱色和高对比的既有皮肤 ID、配色定义及循环顺序，设置页行为不变。

### Testing
- `node --test tests/themes.test.js`：3 项全部通过，覆盖查询参数初始化、浏览器存储恢复、六套皮肤循环及当前名称显示。
- 仅为测试进程设置 `XDG_CONFIG_HOME=C:\tmp\forkline-test-xdg` 后运行 `npm.cmd test`：56 项全部通过；首次未正确传入该变量的运行被本机 Git ignore 权限警告污染，不属于功能回归。
- 测试期间服务以 PID `1532` 在 `http://127.0.0.1:5290/` 运行，首页请求返回 HTTP 200；浏览器验证完成后已按要求关闭，端口不再监听。
- 浏览器在 `D:\桌面\GitTest` 设置页验证：石墨状态为 `data-theme=graphite`、按钮“石墨”、提示下一套“森林”；点击后为 `data-theme=forest`、按钮“森林”、提示下一套“樱色”，最后已恢复石墨皮肤。

### Notes
- `public/js/app/layout-utils.js`：主题应用后显示当前皮肤名称，继续在悬停提示中预告下一套。
- `public/index.html`：默认深色皮肤的静态按钮文字改为“深色”。
- `tests/themes.test.js`：回归断言改为校验按钮显示当前皮肤名称。
- `README.md`：说明顶部主题按钮正文与悬停提示的语义。
- `docs/CONTINUE.md`：记录错位根因、修复边界及保持循环顺序不变。
- `progress.md`：追加本轮修复、验证和回滚记录。
- 回滚方式：尚未提交时执行 `git restore -p -- public/index.html public/js/app/layout-utils.js tests/themes.test.js README.md docs/CONTINUE.md progress.md`，仅选择本任务的“当前皮肤名称”相关片段；如本轮之后单独提交，则执行 `git revert <该提交哈希>`。

## 2026-07-30 - Task: 移除提交详情中的聚合 Diff 预览

### What was done
- 删除点击提交后右侧“详情”页底部的“DIFF 预览”，详情内容现在到历史编辑队列结束，不再重复渲染整条提交的聚合 Diff。
- 保留“文件”页的变更文件树、单文件历史 Diff、文件历史、逐行追踪和最大化对照入口，历史改动查看流程不变。
- 清理只服务于该聚合预览的 400 行截断渲染函数、截断提示样式和中英文翻译项。

### Testing
- 修改前新增回归会稳定失败，因为详情模板仍包含 `renderDiff(detail.diff)` 和“DIFF 预览”；修改后 `node --test tests/diff-preview.test.js` 的 3 项全部通过。
- `node --check public/js/panels/inspector.js`、`node --check public/js/features/diff-workbench.js`、`node --check public/js/i18n-catalog.js` 均通过。
- 仅为测试进程设置 `XDG_CONFIG_HOME=C:\tmp\forkline-test-xdg` 后运行 `npm.cmd test`：56 项全部通过。
- 临时服务以 PID `36684` 在 `http://127.0.0.1:5290/` 返回 HTTP 200；浏览器打开 `D:\桌面\GitTest` 并点击提交 `cdd252a` 后，右侧详情存在提交操作和历史编辑队列，不再出现“DIFF 预览”。
- 同一提交切到“文件”页后，变更文件、文件历史和最大化入口仍可见；验证结束后已关闭临时服务，`5290` 不再保留监听。

### Notes
- `public/js/panels/inspector.js`：移除提交详情中的聚合 Diff 标题和渲染调用。
- `public/js/features/diff-workbench.js`：删除不再使用的聚合 Diff 预览渲染函数及行数限制。
- `public/styles.css`：删除聚合预览截断提示的专用样式。
- `public/js/i18n-catalog.js`：删除不再使用的聚合预览翻译项。
- `tests/diff-preview.test.js`：改为验证详情不显示聚合预览，并保留文件页 Diff 与最大化工具。
- `README.md`：更新提交详情和历史 Diff 的当前使用方式。
- `docs/CONTINUE.md`：记录详情预览移除边界及保留的文件页能力。
- `progress.md`：追加本轮实现、验证和回滚记录。
- 回滚方式：尚未提交时执行 `git restore -p -- public/js/panels/inspector.js public/js/features/diff-workbench.js public/styles.css public/js/i18n-catalog.js tests/diff-preview.test.js README.md docs/CONTINUE.md progress.md`，仅选择本任务的“提交详情聚合 Diff 预览”相关片段；如本轮之后单独提交，则执行 `git revert <该提交哈希>`。

## 2026-07-30 - Task: 历史提交文件双击打开完整只读对照

### What was done
- 右侧提交“文件”页的变更文件支持双击打开现有可拖动、可缩放的编辑器浮窗；左栏显示第一父提交中的完整文件，右栏显示当前提交中的完整文件，并在完整代码上下文中标出改动。
- 新增、删除、修改、重命名、根提交和 merge 提交均按第一父提交语义读取；重命名会分别使用旧路径和新路径，一侧不存在时仍完整显示另一侧内容。
- 增加历史只读模式：保留行号、语法高亮、红绿差异、同步滚动和查找，隐藏保存、替换、暂存按钮及编辑器 Git 右键操作；随后打开工作区文件时会恢复可编辑、保存和查找替换状态。
- 新增历史文件读取接口，并沿用工作区编辑器的普通文本、1 MiB、合法仓库路径、UTF-8、UTF-8 BOM、GBK 和 GB18030 边界。

### Testing
- 对 `server.js`、6 个相关前端脚本和 2 个测试文件运行 `node --check`，共 8 个文件全部通过。
- 仅为测试进程设置 `XDG_CONFIG_HOME=C:\tmp\forkline-test-xdg` 后运行 `npm.cmd test`：58 项全部通过，退出码为 0。
- 浏览器使用 `D:\桌面\GitTest` 验证删除文件、新增文件和连续双击切换历史文件：两侧完整内容及不存在提示正确，查找能定位匹配项，右栏 CodeMirror 为只读，保存、替换、暂存按钮均隐藏，控制台无错误。
- 浏览器自动化拖动和缩放本轮未获得有效尺寸变化，因此未记录为新的真实交互结论；原有拖动缩放回归仍通过，且相关实现没有改动。
- `git diff --check` 退出码为 0，无空白错误；仅显示仓库现有的 LF / CRLF 工作区转换提示。临时验证服务已关闭，测试端口 `5290` 无监听。

### Notes
- `server.js`：新增提交及第一父提交完整文件读取、编码识别和 `/api/commit-file` 路由。
- `public/index.html`：调整编辑器查找与替换区域的只读模式挂接结构。
- `public/js/core.js`：登记历史文件对照所需的编辑器状态。
- `public/js/features/diff-workbench.js`：接入提交文件双击并把目标提交、当前路径和重命名前路径传给编辑器。
- `public/js/features/file-editor.js`：实现历史文件加载、完整双栏只读对照、模式切换和工作区可编辑状态恢复。
- `public/js/i18n-catalog.js`：补充历史提交文件对照的中英文标题、状态和错误提示。
- `public/js/panels/inspector.js`：为提交文件行保留双击读取所需的提交和路径数据。
- `public/styles.css`：增加历史只读模式的控件隐藏和状态样式。
- `tests/file-editor-ui.test.js`：增加提交文件双击、只读边界和重新打开工作区文件恢复能力的回归。
- `tests/git-api.test.js`：增加新增、删除、修改、重命名、根提交和第一父提交完整文件读取回归。
- `README.md`：说明历史提交文件双击后的完整只读代码对照能力。
- `docs/CONTINUE.md`：记录 `/api/commit-file`、第一父提交规则、编码限制和只读边界。
- `progress.md`：追加本轮实现、验证和回滚记录。
- 回滚方式：尚未提交时执行 `git restore -p -- server.js public/index.html public/js/core.js public/js/features/diff-workbench.js public/js/features/file-editor.js public/js/i18n-catalog.js public/js/panels/inspector.js public/styles.css tests/file-editor-ui.test.js tests/git-api.test.js README.md docs/CONTINUE.md progress.md`，仅选择本任务的历史提交文件对照相关片段；如本轮之后单独提交，则执行 `git revert <该提交哈希>`。

## 2026-07-31 - Task: 工作区、暂存区和提交编辑三栏平行排布

### What was done
- 将底部工作台改为“工作区 / 暂存区 / 提交编辑”三栏平行结构，工作区和暂存区分别使用独立文件列表及滚动区域，提交表单增加明确标题。
- 移除常驻“变更对照”区域、文件列表宽度拖动条和提交框高度拖动条，保留底部工作台整体上下拖动；中心区较窄时只在工作台内部横向滚动，不再撑宽提交图或页面主体。
- 保留现有 Diff 状态和最大化对照能力；工作区或暂存区文件右键“查看对照”会在数据加载完成后直接打开最大化 Diff。

### Testing
- 设置 `XDG_CONFIG_HOME=C:\tmp\forkline-test-xdg` 后运行完整 `npm.cmd test`：59 项全部通过；首次因执行器未正确传入该隔离变量而出现 3 项本机 Git ignore 权限警告，修正环境赋值后定向 `tests/git-api.test.js` 13 项及完整测试均通过。
- `node --check` 验证 `public/js/core.js`、`public/js/app/layout-utils.js`、`public/js/features/context-menus.js`、`public/js/features/worktree-changes.js`、`public/js/i18n-catalog.js`、`public/js/panels/recovery-settings.js`，全部通过。
- 浏览器使用 `D:\桌面\GitTest` 验证：宽屏下三列各约 `439px`，可见常驻 `.work-diff` 面板数量为 0，页面无整体横向溢出且控制台无错误；中心区缩至约 `361px` 时，三列内部总宽约 `680px`，仅底部工作台出现横向滚动，页面主体不溢出。
- `git diff --check` 退出码为 0，无空白错误；仅显示仓库现有 LF / CRLF 工作区转换提示。临时端口 `5290` 无监听，本轮临时 Node PID `19960` 已不存在。

### Notes
- `public/index.html`：重排底部三栏结构，并保留隐藏兼容节点承接现有 Diff 状态和弹窗逻辑。
- `public/styles.css`：实现等宽三列及窄中心区内部横向滚动，删除常驻 Diff 和两个内部拖动器样式。
- `public/js/core.js`：登记独立暂存区文件列表节点。
- `public/js/app/layout-utils.js`：移除文件列表宽度和提交框高度的布局变量、持久化及拖动逻辑。
- `public/js/features/worktree-changes.js`：把未暂存和已暂存文件分别渲染、绑定到两个独立列表。
- `public/js/features/context-menus.js`：文件右键“查看对照”加载完成后直接打开最大化 Diff。
- `public/js/i18n-catalog.js`：补充“提交编辑”翻译并更新布局重置说明。
- `public/js/panels/recovery-settings.js`：更新设置页布局重置说明。
- `tests/layout-ui.test.js`：增加三栏顺序、常驻 Diff 移除、窄区内部滚动和右键最大化入口回归。
- `README.md`：更新三栏布局、Diff 打开方式和可拖动边界。
- `docs/CONTINUE.md`：记录三栏结构、窄区滚动、常驻 Diff 移除及最大化对照边界。
- `progress.md`：追加本轮实现、验证和回滚记录。
- 回滚方式：尚未提交时执行 `git restore -- README.md docs/CONTINUE.md public/index.html public/styles.css public/js/core.js public/js/app/layout-utils.js public/js/features/context-menus.js public/js/features/worktree-changes.js public/js/i18n-catalog.js public/js/panels/recovery-settings.js tests/layout-ui.test.js progress.md`；如本轮之后单独提交，则执行 `git revert <该提交哈希>`。

## 2026-07-31 - Task: 中等宽度顶栏与侧栏尺寸恢复优化

### What was done
- 修复窗口缩窄时把临时受限侧栏宽度当成用户偏好继续使用的问题；左右栏和底部工作台现在始终根据已保存偏好计算当前可用尺寸，窗口重新放大后会恢复原宽度。
- 为 `921px` 到 `1040px` 的中等宽度增加紧凑仓库路径栏，缩短路径输入和最近仓库列，保证“选择 / 克隆 / 初始化 / 打开”完整显示。
- 补充侧栏缩窄后恢复、底部工作台拉伸保存和中等宽度路径栏的布局回归测试，并同步更新使用说明与继续开发记录。

### Testing
- 修改前运行 `node --test tests/layout-ui.test.js`：新增的侧栏恢复和中等宽度路径栏 2 项回归稳定失败；修改后该文件 13 项全部通过。
- `node --check public/js/app/layout-utils.js` 通过。
- 设置 `XDG_CONFIG_HOME=C:\tmp\forkline-test-xdg` 后运行完整 `npm.cmd test`：62 项全部通过，退出码为 0。
- 浏览器使用 `D:\桌面\GitTest` 验证：CSS 视口宽度 `955px` 时页面、顶栏、仓库栏和路径栏横向溢出均为 0，“打开”按钮右边界约 `939.49px`；宽屏到窄屏再回宽屏时，左右栏从约 `296.99px / 402.99px` 临时压缩为 `159.99px / 266.00px`，随后精确恢复原宽度。
- 底部工作台事件回归确认高度可从 `300px` 拉伸到 `380px` 并保存；`git diff --check` 无空白错误，仅显示仓库现有 LF / CRLF 转换提示。
- 浏览器响应式覆盖结束后已恢复默认视口；临时服务 `5290` 和 `5291` 均已关闭，端口无监听。

### Notes
- `public/js/app/layout-utils.js`：从保存的布局偏好计算受限尺寸，避免窗口缩放覆盖用户宽度。
- `public/styles.css`：增加中等宽度仓库路径栏的紧凑列配置。
- `tests/layout-ui.test.js`：增加侧栏尺寸恢复、底部工作台拉伸和路径栏断点回归。
- `README.md`：说明侧栏自动恢复和中等宽度路径栏行为。
- `docs/CONTINUE.md`：记录布局修复边界及当前响应式规则。
- `progress.md`：追加本轮实现、验证和回滚记录。
- 回滚方式：尚未提交时执行 `git restore -- README.md docs/CONTINUE.md public/js/app/layout-utils.js public/styles.css tests/layout-ui.test.js progress.md`；如本轮之后单独提交，则执行 `git revert <该提交哈希>`。

## 2026-07-31 - Task: 常用 Git 工作流与显示布局完成度回归

### What was done
- 新增 8 条真实 Git API 集成回归，覆盖仓库克隆/初始化/补丁、工作区到提交、分支与历史操作、历史编辑、三类冲突生命周期及本地裸远端同步，不依赖真实 GitHub，也不修改用户测试仓库。
- 工作区链路覆盖单文件暂存/取消暂存、暂存全部、提交、追加提交、单文件丢弃和丢弃全部；历史链路覆盖分支创建/切换/重命名/删除、合并、挑选、还原、Tag 和三种 reset。
- 历史编辑覆盖旧提交改信息、fixup、squash、drop；合并、挑选、还原冲突分别覆盖中止，以及解决或手动处理后继续；同步链路覆盖变基拉取、推送、抓取、快进拉取、Tag 推送和远端删除。
- 使用真实 `D:\桌面\GitTest` 对宽屏、中等宽度和低分辨率布局进行只读复核，覆盖全部常用右侧面板、右键菜单、命令面板、分支签出提示、目录/分支/Tag 弹窗、编辑器、最大化 Diff 和底部三栏。

### Testing
- `node --check tests/git-api.test.js` 通过。
- 新增仓库初始化/克隆/补丁、工作区、历史、同步和历史编辑链路分别定向通过；合并、挑选、还原冲突生命周期定向 3 项全部通过。
- 设置 `XDG_CONFIG_HOME=C:\tmp\forkline-test-xdg` 后运行 `node --test tests/git-api.test.js`：新增克隆/初始化/补丁回归前的 20 项全部通过；最终完整项目测试已覆盖该新增项。
- 同一隔离环境运行最终完整 `npm.cmd test`：70 项全部通过，退出码为 0。
- 浏览器实测 `1910px`、`955px`、`800px` CSS 视口：页面和顶栏横向溢出均为 0；全部 6 个“更多”面板的详情区溢出为 0，没有控件越过右栏边界；`800px` 底部三栏只在自身产生预期的 `320px` 横向滚动，页面主体不溢出。
- `800px` 下提交、分支和文件右键菜单完整显示，长提交菜单可内部滚动；命令面板、分支签出提示、目录/分支/Tag 弹窗、历史只读编辑器、工作区编辑器和最大化 Diff 均位于视口内。宽屏工作区编辑器打开后点击另一文件会在原浮窗切换。
- 测试结束后浏览器恢复默认视口并释放测试页，临时服务 `5292` 已关闭且端口无监听；`D:\桌面\GitTest` 仍保持原有 `测试.txt` 修改和 3 个未跟踪编辑器演示文件，没有新增、暂存、提交或分支变化。

### Notes
- `tests/git-api.test.js`：增加常用本地 Git、冲突恢复、历史编辑和本地裸远端同步回归及夹具助手。
- `README.md`：扩充自动化测试覆盖范围说明。
- `docs/CONTINUE.md`：记录常用工作流回归矩阵和本轮布局验证结果。
- `progress.md`：追加本轮测试、验证和回滚记录。
- 回滚方式：尚未提交时执行 `git restore -- README.md docs/CONTINUE.md tests/git-api.test.js progress.md`；如本轮之后单独提交，则执行 `git revert <该提交哈希>`。

## 2026-07-31 - Task: 竖屏布局与图谱完整分支名

### What was done
- 为纵向屏幕增加专用工作区布局：左侧分支栏与提交图谱保留在上方并排，右侧提交详情停靠到下方整行；左侧栏拖动仍可用，原右侧横向拖动条在竖屏模式隐藏。
- 调整竖屏侧栏宽度上限计算，不再为已下沉的详情栏预留横向空间，避免图谱和提交信息在窄竖屏内继续相互挤压。
- 移除图谱分支标签的固定字符省略，按完整分支名和泳道位置动态计算图谱列及 SVG 宽度，并同步扩展图谱表头标签可用宽度。

### Testing
- `node --check` 验证 `public/js/app/layout-utils.js`、`public/js/features/graph.js`、`public/js/features/history-list.js`，全部通过。
- `node --test tests/layout-ui.test.js`：16 项全部通过，新增竖屏停靠、竖屏宽度计算和完整分支标签 3 项回归。
- 设置 `XDG_CONFIG_HOME=C:\tmp\forkline-test-xdg` 后运行完整 `npm.cmd test`：73 项全部通过，退出码为 0。
- 浏览器在约 `1075×1910` 和 `900×1600` CSS 竖屏视口验证：页面横向溢出均为 0，左侧栏与图谱位于上方，详情栏整行位于下方，底部三栏只保留自身设计内横向滚动。
- 浏览器只读打开 `D:\桌面\GitTest` 的全部分支视图：`main`、`local_debug`、`tag: forkline-v0.1.0`、`123`、`git-svn` 标签均完整显示并位于动态扩展后的 `191px` SVG 内；测试仓库仍保持原有 1 个修改文件和 3 个未跟踪演示文件，没有新增暂存、提交或分支变化。
- `git diff --check` 退出码为 0，无空白错误；仅显示仓库现有的 LF / CRLF 工作区转换提示。

### Notes
- `public/js/app/layout-utils.js`：增加竖屏媒体状态判断及侧栏可用宽度计算。
- `public/js/features/graph.js`：完整输出分支标签，并按标签宽度动态计算图谱尺寸。
- `public/js/features/history-list.js`：把本轮计算出的图谱宽度同步到历史列表 CSS 变量和 SVG 渲染。
- `public/styles.css`：增加竖屏上下分区布局，并让图谱表头跟随动态列宽。
- `tests/layout-ui.test.js`：增加竖屏布局和完整分支标签回归。
- `README.md`：补充竖屏停靠和完整分支名使用说明。
- `docs/CONTINUE.md`：记录当前竖屏规则、实测尺寸和图谱标签边界。
- `progress.md`：追加本轮实现、验证和回滚记录。
- 回滚方式：尚未提交时执行 `git restore -- README.md docs/CONTINUE.md public/js/app/layout-utils.js public/js/features/graph.js public/js/features/history-list.js public/styles.css tests/layout-ui.test.js progress.md`；如本轮之后单独提交，则执行 `git revert <该提交哈希>`。

## 2026-07-31 - Task: 图谱表头范围标签完整显示

### What was done
- 取消图谱表头范围标签的 flex 收缩、最大宽度和省略号规则，使“全部分支”及当前分支名始终按完整内容宽度单行显示。
- 保留其他表头和文件编辑器原有省略行为，仅修改用户标注的 `graphModeLabel`，避免扩大布局影响范围。
- 新增图谱表头范围标签不收缩的布局回归，并同步更新使用说明与继续开发记录。

### Testing
- 修改前运行 `node --test tests/layout-ui.test.js`：新增回归稳定失败，确认旧样式仍为 `flex-shrink: 1`、`max-width` 限制和省略号；修改后 17 项全部通过。
- 浏览器在用户标注对应的 `476×1043` CSS 竖屏视口验证：“全部分支”宽度约 `57.49px`，`clientWidth` 与 `scrollWidth` 均为 `56px`；切换到 `feature/visual-history` 后宽度约 `134.14px`，`clientWidth` 与 `scrollWidth` 均为 `133px`，两者均无截断。
- 计算样式验证范围标签为 `flex-shrink: 0`、`max-width: none`、`overflow: visible`、`text-overflow: clip`。
- 设置 `XDG_CONFIG_HOME=C:\tmp\forkline-test-xdg` 后运行完整 `npm.cmd test`：74 项全部通过，退出码为 0。
- `git diff --check` 退出码为 0，无空白错误；仅显示仓库现有的 LF / CRLF 工作区转换提示。

### Notes
- `public/styles.css`：让图谱表头范围标签固定按完整内容宽度显示。
- `tests/layout-ui.test.js`：增加范围标签不收缩、不省略的回归。
- `README.md`：说明图谱表头中的全部分支或当前分支名不会缩写。
- `docs/CONTINUE.md`：记录范围标签完整显示的样式边界和验证结果。
- `progress.md`：追加本轮实现、验证和回滚记录。
- 回滚方式：尚未提交时执行 `git restore -- README.md docs/CONTINUE.md public/styles.css tests/layout-ui.test.js progress.md`；如本轮之后单独提交，则执行 `git revert <该提交哈希>`。

## 2026-07-31 - Task: 文件编辑器暂存按钮按改动块居中

### What was done
- 文件编辑器中间的“暂存”按钮不再贴近改动块顶部，而是读取暂存区和工作区两侧对应改动范围的实际上下边界，以两侧联合范围的垂直中心作为按钮位置。
- 按钮样式改为以自身中心对齐计算位置，保持原有按块暂存范围、点击行为和左右面板滚动逻辑不变。
- 新增按钮居中回归，并同步更新使用说明和继续开发记录。

### Testing
- 修复前使用 `D:\桌面\GitTest\forkline-editor-demo.c` 复现：改动块高度约 `282px`，块中心约 `394.87px`，按钮中心约 `269.72px`，向上偏移约 `125.15px`。
- 修复后同文件实测：改动块高度约 `221.83px`，块中心约 `364.645515px`，按钮中心约 `364.645501px`，中心偏差约 `0.000014px`。
- `node --check public/js/features/file-editor.js` 通过；`node --test tests/file-editor-ui.test.js` 12 项全部通过。
- 设置隔离测试配置后运行完整 `npm.cmd test`：75 项全部通过，退出码为 0。
- `D:\桌面\GitTest` 测试前后均保持 `测试.txt` 的原有修改和 3 个未跟踪编辑器演示文件，没有新增暂存、提交或分支变化。

### Notes
- `public/js/features/file-editor.js`：根据左右 CodeMirror 改动范围计算暂存按钮中心位置。
- `public/styles.css`：让暂存按钮以自身中心对齐计算出的垂直坐标。
- `tests/file-editor-ui.test.js`：增加左右改动高度不同时的按钮居中回归。
- `README.md`：说明暂存按钮会正对整个视觉改动块。
- `docs/CONTINUE.md`：记录按钮定位算法、行为边界和验证结果。
- `progress.md`：追加本轮实现、验证和回滚记录。
- 回滚方式：由于这些文件还包含前一轮未提交改动，执行 `git restore -p -- README.md docs/CONTINUE.md progress.md public/js/features/file-editor.js public/styles.css tests/file-editor-ui.test.js`，仅接受本任务对应补丁块；如本轮之后单独提交，则执行 `git revert <该提交哈希>`。

## 2026-07-31 - Task: 文件编辑器暂存按钮显示恢复

### What was done
- 确认按钮消失不是居中算法或 CSS 裁剪导致，而是页面加载了最新静态前端、常驻 Node 进程却仍运行旧版 `server.js`；旧 `/api/worktree-file` 响应缺少 `canStage`、`diffScope` 和 `diff`，前端因此不会让 MergeView 创建暂存按钮。
- 只重启 `5287` 的 Forkline Node 服务，使后端接口与当前前端代码同步；随后使用独立 `5293` 测试服务打开 `D:\桌面\GitTest`，避免其他浏览器页切换服务端当前仓库干扰验证。
- 没有修改暂存执行逻辑或用户测试仓库内容，并把后端改动后必须重启服务的验证边界写入继续开发说明。

### Testing
- 重启前只读请求 `5287 /api/worktree-file`，响应仅包含文件内容和暂存区内容，没有 `canStage` / `diffScope`；编辑器 DOM 中 `.CodeMirror-merge-copy` 和按钮容器数量均为 0。
- 最新服务在隔离端口返回 `canStage = true`、`diffScope = unstaged`；双击 `D:\桌面\GitTest\测试.txt` 后暂存按钮数量为 1，按钮文本为“暂存”，尺寸与可见性均正常。
- 浏览器截图确认按钮位于暂存区和工作区改动块之间，并保持上一任务实现的整块垂直居中。
- 测试结束后隔离浏览器页已释放，临时服务 `5293` 已关闭且端口无监听。

### Notes
- `docs/CONTINUE.md`：记录静态前端与旧 Node 后端错配时暂存按钮不会生成，以及后端改动后的重启要求。
- `progress.md`：追加本轮诊断、服务恢复、验证和回滚记录。
- 回滚方式：本轮没有源代码行为改动；若只撤销文档记录，执行 `git restore -p -- docs/CONTINUE.md progress.md` 并仅接受本任务对应补丁块。服务进程不需要回滚，重新运行当前版本 `server.js` 即可。

## 2026-07-31 - Task: 提交正文与冲突按钮布局优化

### What was done
- 把右侧提交详情中的正文输入框默认最小高度从通用 `76px` 提升为提交信息专用的 `132px`，保留原有纵向拉伸和 `220px` 最大高度。
- 把每个冲突文件的路径和操作按钮拆成上下两行；“当前 / 对方”按钮改为两列等宽、占满整行，并在各自按钮区域内居中。
- 新增对应布局回归，并同步更新 README 和继续开发说明。

### Testing
- 修改前运行 `node --test tests/layout-ui.test.js`：新增的正文高度和冲突按钮布局 2 项稳定失败，其余 17 项通过；修改后该文件 19 项全部通过。
- 隔离浏览器实测提交正文输入框 `min-height = 132px`，实际高度约 `131.996px`，仍保留 `max-height = 220px`。
- 浏览器加载后的冲突布局规则为单列文件行、按钮区 `repeat(2, minmax(0, 1fr))`、宽度 `100%`，两个按钮均为宽度 `100%` 且 `justify-content: center`。
- 设置隔离测试配置后运行完整 `npm.cmd test`：77 项全部通过，退出码为 0。
- `D:\桌面\GitTest` 仍保持原有 `测试.txt` 修改和 3 个未跟踪编辑器演示文件，没有新增暂存、提交或分支变化。

### Notes
- `public/styles.css`：加高提交正文编辑区，并重排冲突文件的等宽居中操作按钮。
- `tests/layout-ui.test.js`：增加正文默认高度和冲突按钮布局回归。
- `README.md`：说明正文输入框和冲突操作区的新默认布局。
- `docs/CONTINUE.md`：记录布局尺寸、按钮排列规则和验证边界。
- `progress.md`：追加本轮实现、验证和回滚记录。
- 回滚方式：这些文件还包含前序未提交改动，执行 `git restore -p -- README.md docs/CONTINUE.md progress.md public/styles.css tests/layout-ui.test.js`，仅接受本任务对应补丁块；如本轮之后单独提交，则执行 `git revert <该提交哈希>`。

## 2026-07-31 - Task: 冲突按钮文字双轴居中

### What was done
- 修正上一版只让冲突按钮外框等宽、但没有锁定内部文字双轴对齐的问题：按钮改用网格 `place-items: center`，并明确让可见文字占满按钮内容区后再次居中。
- 保留“当前 / 对方”两列等宽和文件路径单独一行的布局，不改冲突解决命令、确认流程或仓库状态处理。
- 加强布局回归，并同步修正 README 和继续开发说明中对“居中”的定义。

### Testing
- 修改前运行 `node --test tests/layout-ui.test.js`：加强后的冲突按钮居中回归稳定失败；修改后该文件 19 项全部通过。
- 在 `C:\tmp` 创建一次性合并冲突仓库并通过独立 `5294` 服务实测：两个按钮计算样式均为 `display: grid`、`place-items: center`、`text-align: center`，可见文字同样为 `text-align: center`。
- 像素测量“当前”文字相对按钮中心横向偏差为 `0px`、纵向约 `-0.0058px`；“对方”横向约 `-0.000008px`、纵向约 `-0.0058px`。
- 设置隔离测试配置后运行完整 `npm.cmd test`：77 项全部通过，退出码为 0。
- 临时浏览器页、`5294` 服务和一次性冲突仓库均已关闭或删除，没有读取或修改用户“幸运双明牌”仓库中的冲突文件。

### Notes
- `public/styles.css`：把冲突选择按钮和内部可见文字改为明确的双轴居中。
- `tests/layout-ui.test.js`：锁定按钮网格居中和文字全宽居中规则。
- `README.md`：说明按钮外框和内部文字均双轴居中。
- `docs/CONTINUE.md`：记录具体布局规则和验证边界。
- `progress.md`：追加本轮实现、验证和回滚记录。
- 回滚方式：这些文件还包含前序未提交改动，执行 `git restore -p -- README.md docs/CONTINUE.md progress.md public/styles.css tests/layout-ui.test.js`，仅接受本任务对应补丁块；如本轮之后单独提交，则执行 `git revert <该提交哈希>`。

## 2026-07-31 - Task: 提交文件列表单击后保持滚动位置

### What was done
- 修复右侧提交“文件”页在单击变更文件时重建整个详情页的问题；现在只更新当前文件的 Diff 面板和选中样式，文件树 DOM 不再被替换。
- 保留大量文件列表的滚动位置和原有双击监听，使用户滚到下方单击目标文件后仍可在原位置继续双击打开历史完整对照。
- 新增针对局部刷新路径的回归，并同步更新 README 和继续开发说明。

### Testing
- 修复前运行 `node --test tests/file-editor-ui.test.js`：新增回归稳定失败，实际调用为 `renderInspector`，证明单击会重建完整详情；修复后该文件 13 项全部通过。
- `node --check public/js/panels/inspector.js` 与 `node --check public/js/features/diff-workbench.js` 均通过。
- 在一次性 Git 仓库中创建一次提交同时修改 60 个文件，并通过独立 `5295` 服务实测：滚到底部后单击 `files/file-060.txt`，列表 `scrollTop` 在操作前后均为 `1636`，文件树保持同一个 DOM 节点，目标行顶部位置均为 `446px`；随后双击成功打开只读“历史文件对照”。
- 设置隔离测试配置后运行完整 `npm.cmd test`：78 项全部通过，退出码为 0。

### Notes
- `public/js/panels/inspector.js`：拆出当前提交文件 Diff 的局部渲染，完整文件树只在进入文件页时创建。
- `public/js/features/diff-workbench.js`：提交文件单击改为调用局部 Diff 渲染，不再调用完整详情渲染。
- `tests/file-editor-ui.test.js`：增加单击提交文件不得触发完整详情重建的回归。
- `README.md`：说明大量提交文件下单击会保持列表滚动位置并支持后续双击。
- `docs/CONTINUE.md`：记录局部刷新实现边界和文件树 DOM 保留规则。
- `progress.md`：追加本轮实现、验证和回滚记录。
- 回滚方式：这些文件还包含前序未提交改动，执行 `git restore -p -- README.md docs/CONTINUE.md progress.md public/js/panels/inspector.js public/js/features/diff-workbench.js tests/file-editor-ui.test.js`，仅接受本任务对应补丁块；如本轮之后单独提交，则执行 `git revert <该提交哈希>`。

## 2026-07-31 - Task: 历史大文件完整对照卡顿修复

### What was done
- 移除历史文件 Diff 在已废弃底部工作台中的隐藏重复渲染，只保留 `activeDiff` 数据供“最大化”使用。
- 打开历史完整对照时暂停右侧大 Diff，改为轻量提示；浮窗打开期间切换提交文件仍保持暂停，关闭后恢复当前选中文件预览。
- 只读历史对照不再创建暂存按钮 `MutationObserver`，并补充中英文提示与三条性能边界回归。

### Testing
- 修改前新增回归 3 项稳定失败，分别确认隐藏工作台仍渲染、历史浮窗没有暂停/恢复右侧预览、只读模式仍启动暂存按钮监听；修改后 `node --test tests/file-editor-ui.test.js` 16 项全部通过。
- 浏览器在现有 `http://127.0.0.1:5287/` 只读验证“幸运双明牌”，没有修改其未完成合并：`Master_prg.hex` 从右侧 `12,972` 行、全页约 `92,374` 个元素降到打开浮窗后的 0 行、约 `2,157` 个元素，打开约 `1,642 ms`，滚动到约 72% 位置耗时约 `249 ms`；隐藏工作台始终为 0 行。
- `Master_prg.map` 从右侧 `6,497` 行、全页约 `46,905` 个元素降到 0 行、约 `2,072` 个元素，打开约 `1,761 ms`，双栏滚动到底约 `256 ms`；关闭浮窗后恢复原 `6,497` 行预览。
- 浮窗打开期间单击 `progress.md` 和 `print.c` 时右侧预览保持 0 行，双击切换并完成加载分别约 `484 ms` 和 `536 ms`。
- `node --check` 验证本轮 4 个前端脚本通过；完整 `npm.cmd test` 81 项全部通过，退出码为 0。
- `git diff --check` 退出码为 0，无空白错误；仅显示仓库现有的 LF / CRLF 工作区转换提示。

### Notes
- `public/js/features/diff-workbench.js`：停止在隐藏底部工作台渲染历史 Diff。
- `public/js/features/file-editor.js`：历史浮窗打开时暂停右侧预览、关闭时恢复，并门控暂存按钮监听器。
- `public/js/panels/inspector.js`：浮窗打开期间用轻量状态替代重型历史文件预览。
- `public/js/i18n-catalog.js`：补充预览暂停提示的英文翻译。
- `tests/file-editor-ui.test.js`：增加隐藏渲染、暂停/恢复和监听器门控回归。
- `README.md`：说明历史大文件对照的卸载和恢复行为。
- `docs/CONTINUE.md`：记录性能修复边界与真实大文件验证数据。
- `progress.md`：追加本轮实现、验证和回滚记录。
- 回滚方式：这些文件还包含前序未提交改动，执行 `git restore -p -- README.md docs/CONTINUE.md progress.md public/js/features/diff-workbench.js public/js/features/file-editor.js public/js/i18n-catalog.js public/js/panels/inspector.js tests/file-editor-ui.test.js`，仅接受本任务对应补丁块；如本轮之后单独提交，则执行 `git revert <该提交哈希>`。

## 2026-07-31 - Task: 历史大文件 Diff 分批渲染性能优化

### What was done
- 把历史文件右侧 Diff 和最大化 Diff 从一次性完整渲染改为首批 `1000` 行；“继续加载”按 `2000 / 4000 / 8000...` 翻倍扩展，同时保留完整 `activeDiff` 数据，不截断真实改动。
- 历史预览按提交和文件记录当前批次，切换文件后重置为首批；加载更多时保留滚动位置，关闭最大化窗口时清空隐藏 Diff DOM。
- 使用委托点击接入右侧与最大化窗口的加载按钮，补充中英文状态、紧凑样式及分批渲染、加载扩展、关闭释放回归。

### Testing
- 修改前新增的大 Diff 首批限制、委托加载和关闭释放回归稳定失败；修改后 `node --test tests/file-editor-ui.test.js` 18 项全部通过，本轮修改的前端脚本语法检查全部通过。
- 浏览器在现有 `http://127.0.0.1:5287/` 只读验证“幸运双明牌”：`Master_prg.map` 首批为 `1000 / 6554` 行、约 `990` 个渲染行、全页约 `8,407` 个元素；`Master_prg.hex` 选择约 `280 ms`，首批为 `1000 / 12995` 行、约 `979` 个渲染行、全页约 `8,426` 个元素。
- `Master_prg.hex` 右侧继续加载到 `2000`、`4000` 行分别约 `309 ms`、`404 ms`；最大化窗口首批打开约 `315 ms`，加载到 `2000` 行约 `303 ms`，关闭后 Diff 容器的行、元素和子节点均为 0，页面诊断日志为空。
- 完整 `npm.cmd test` 83 项全部通过，退出码为 0；测试过程没有修改“幸运双明牌”的未完成合并。
- `git diff --check` 退出码为 0，无空白错误；仅显示仓库现有的 LF / CRLF 工作区转换提示。

### Notes
- `public/js/core.js`：保存历史预览和最大化 Diff 的当前渲染上限。
- `public/js/features/diff-workbench.js`：实现大 Diff 首批限制、逐步扩展、滚动保持和关闭释放。
- `public/js/panels/inspector.js`：让历史文件右侧预览按当前提交和文件批量渲染。
- `public/js/app/events.js`：委托处理右侧和最大化 Diff 的“继续加载”按钮。
- `public/js/i18n-catalog.js`：补充分批状态和加载按钮英文翻译。
- `public/styles.css`：增加分批状态栏和加载按钮布局。
- `tests/file-editor-ui.test.js`：增加大 Diff 首批、扩展和释放回归。
- `README.md`：说明大差异的分批显示与关闭释放行为。
- `docs/CONTINUE.md`：记录实现边界和真实大文件性能数据。
- `progress.md`：追加本轮实现、验证和回滚记录。
- 回滚方式：这些文件还包含前序未提交改动，执行 `git restore -p -- README.md docs/CONTINUE.md progress.md public/js/app/events.js public/js/core.js public/js/features/diff-workbench.js public/js/i18n-catalog.js public/js/panels/inspector.js public/styles.css tests/file-editor-ui.test.js`，仅接受本任务对应补丁块；如本轮之后单独提交，则执行 `git revert <该提交哈希>`。

## 2026-07-31 - Task: 历史 main.c 完整对照持续卡死缓解

### What was done
- 复现到打开 `STM32F743ucosiii_lg/User/APP/main.c` 后页面主线程持续无响应，并确认文件仅约 35 KiB、851 行，服务端读取和 diff-match-patch 差异计算不是瓶颈。
- 将只读历史提交 MergeView 从强制垂直行对齐改为普通差异连接线，避免 `align` 对齐器持续进行布局计算；工作区编辑器仍保留行对齐和按块暂存按钮。
- 新增只读历史模式不得启用 `align` 的回归，并同步说明历史对照与工作区编辑器的行为边界。

### Testing
- 修改前运行 `node --test tests/file-editor-ui.test.js`：新增的只读对照对齐回归稳定失败；修改后该文件 19 项全部通过。
- 通过真实 `/api/commit-file` 响应确认目标 `main.c` 为 GBK、35 KiB、851 行，父版本 840 行；同一份新旧文本运行仓库内 diff-match-patch 仅约 3.17 ms、36 个差异段，排除文件读取和纯差异计算卡死。
- `node --check public/js/features/file-editor.js` 通过；完整 `npm.cmd test` 84 项全部通过，退出码为 0。
- `git diff --check` 退出码为 0，无空白错误；仅显示仓库现有的 LF / CRLF 工作区转换提示。
- 当前已卡死的浏览器渲染线程无法接受刷新或性能采样；新代码的现场重开复测仍待完成，未将该项记录为已验证解决。

### Notes
- `public/js/features/file-editor.js`：只读历史对照使用普通连接线，工作区模式继续使用强制行对齐。
- `tests/file-editor-ui.test.js`：锁定只读和工作区两种 MergeView 连接策略。
- `README.md`：说明历史只读对照的连接线与性能边界。
- `docs/CONTINUE.md`：记录 `connect` 策略、保留功能和待现场复测状态。
- `progress.md`：追加本轮实现、验证缺口和回滚记录。
- 回滚方式：这些文件还包含前序未提交改动，执行 `git restore -p -- README.md docs/CONTINUE.md progress.md public/js/features/file-editor.js tests/file-editor-ui.test.js`，仅接受本任务对应补丁块；如本轮之后单独提交，则执行 `git revert <该提交哈希>`。

## 2026-07-31 - Task: 整体高频浏览性能优化

### What was done
- 历史完整文件读取把提交解析和第一父提交解析合并为一次 Git 调用，正常的新旧 blob 各只读取一次；缺失、非普通文件、读取失败、二进制和超过 1 MiB 的原有中文语义保持不变。
- 文件历史与逐行追踪并行准备引用和文件路径，只在引用校验失败时补做无提交分支判断，保留过期远端检查和无提交分支指导。
- 点选当前图谱中的可见提交只原地更新选中行，不再重建整张图谱；图谱外历史跳转仍保留完整渲染回退。提交点击和右键改为容器事件代理，不再为每个提交行分别绑定监听器。
- 补充提交选择、事件代理、历史文件 1 MiB 上限、文件历史、逐行追踪和无提交分支提示回归，并同步用户文档与继续开发记录。

### Testing
- GitTest 同一 `/api/commit-file` 请求预热后平均从 217.1 ms 降到 110.1 ms，P95 从 324.9 ms 降到 114.6 ms。
- GitTest 同一 `/api/file-history` 请求平均从 253.8 ms 降到 151.8 ms，P95 从 261.1 ms 降到 159.1 ms。
- 浏览器连续切换 24 次提交时，脚本耗时约从 63.2 ms 降到 22.4 ms，布局耗时约从 75.7 ms 降到 19.7 ms；真实点击只保留一条选中提交，右键菜单正常打开。
- 编辑器连续开关检查确认关闭后 CodeMirror DOM 清空；Merge 插件约 5 秒的延迟清理完成后，节点从 7203 回落到 3764、监听器从 1073 回落到 507、堆内存回收约 1.7 MiB，没有发现持续泄漏，因此未修改编辑器生命周期代码。
- 本轮修改脚本的 `node --check` 全部通过；定向回归通过；完整 `npm.cmd test` 为 88/88 通过，退出码为 0。
- `git diff --check` 退出码为 0，无空白错误；仅显示仓库现有的 LF / CRLF 工作区转换提示。
- 隔离测试服务 `5296` 已关闭并确认端口释放；用户原有 `5287` 服务仍在运行且未被操作。

### Notes
- `server.js`：减少历史完整文件读取的 Git 子进程，并并行准备文件历史和逐行追踪引用。
- `public/js/features/history-list.js`：移除逐行监听器并增加可见提交的原地选中更新。
- `public/js/features/context-menus.js`：提交选择优先使用原地更新，图谱外提交保持完整渲染回退。
- `public/js/app/events.js`：集中委托提交点击和右键事件。
- `tests/git-api.test.js`：增加历史文件大小边界、文件历史、逐行追踪和无提交分支回归。
- `tests/commit-selection-performance.test.js`：增加提交原地选择、图谱外回退和事件代理回归。
- `README.md`：说明高频提交浏览和历史读取的性能边界。
- `docs/CONTINUE.md`：记录实现方式、实测数据和兼容语义。
- `progress.md`：追加本轮实现、验证、临时服务关闭和回滚记录。
- 回滚方式：执行 `git restore -- README.md docs/CONTINUE.md progress.md public/js/app/events.js public/js/features/context-menus.js public/js/features/history-list.js server.js tests/git-api.test.js`，再执行 `Remove-Item -LiteralPath tests/commit-selection-performance.test.js`；如本轮之后单独提交，则执行 `git revert <该提交哈希>`。

## 2026-08-01 - Task: 限制图谱长分支标签宽度

### What was done
- 提交图谱恢复固定列宽，不再按完整分支名称扩大图谱和占用提交信息空间。
- 分支标签最大宽度限制为 `128px`，超长名称按字符宽度省略；悬停仍可查看完整分支名，节点右侧空间不足时标签会移到左侧。
- 增加长标签布局回归，并同步中文功能说明和继续开发文档。

### Testing
- `node --check public/js/features/graph.js` 通过。
- `node --test tests/layout-ui.test.js` 19 项全部通过。
- 完整 `npm.cmd test` 88 项全部通过，退出码为 0，总耗时约 245 秒。
- 浏览器在 `http://127.0.0.1:5177/` 实测：`backup/local-before-origin-main-20260620` 显示为省略标签，标签宽度为 `128px`、图谱列宽为 `176px`，提交标题完整可见，控制台错误为 0。
- `git diff --check` 退出码为 0，无空白错误；仅显示仓库现有的 LF / CRLF 工作区转换提示。

### Notes
- `public/js/features/graph.js`：固定图谱渲染宽度并增加分支标签限宽、省略、悬停全名和左右侧定位。
- `tests/layout-ui.test.js`：锁定长分支标签不得撑宽图谱或挤压提交信息。
- `README.md`：说明长分支标签的限宽省略和悬停查看行为。
- `docs/CONTINUE.md`：记录固定列宽、最大标签宽度和左右侧定位规则。
- `progress.md`：追加本轮实现、验证和回滚记录。
- 回滚方式：提交前执行 `git restore -- README.md docs/CONTINUE.md progress.md public/js/features/graph.js tests/layout-ui.test.js`；提交后执行 `git revert <本任务提交哈希>`。

## 2026-08-02 - Task: 同步面板按钮垂直居中

### What was done
- 将“同步情况”面板中的同步操作、Pull Request、upstream、添加远端和远端操作按钮统一设置为 Grid 单元格水平及垂直居中。
- 保留原有按钮高度、宽度、响应式排列和操作逻辑，只修正按钮文字在拉伸网格项内偏上的视觉问题。
- 增加同步面板按钮对齐回归，并同步继续开发文档。

### Testing
- `node --test tests/layout-ui.test.js` 20 项全部通过，退出码为 0。
- 浏览器在 `http://127.0.0.1:5177/` 的 `1256×912` 视口实测：顶部 7 个同步按钮的文字中心偏差由 `-6.5px` 变为 `0px`；upstream、添加远端和远端操作按钮由 `-5.5px` 变为 `0px`，共 14 个按钮的计算样式均为水平及垂直居中。
- 刷新后的同步面板截图确认按钮尺寸和排列未发生变化，文字不再偏上，未发现相邻内容重叠。
- `git diff --check` 退出码为 0，无空白错误；仅显示仓库现有的 LF / CRLF 工作区转换提示。

### Notes
- `public/styles.css`：为同步面板内使用 Grid 的操作按钮增加双轴居中规则。
- `tests/layout-ui.test.js`：锁定同步操作、upstream 和远端操作按钮的居中样式。
- `docs/CONTINUE.md`：记录修复范围和浏览器实测偏差数据。
- `progress.md`：追加本轮实现、验证和回滚记录。
- 回滚方式：提交前执行 `git restore -- docs/CONTINUE.md progress.md public/styles.css tests/layout-ui.test.js`；提交后执行 `git revert <本任务提交哈希>`。

## 2026-08-02 - Task: 提交图谱表头列宽拖拽

### What was done
- 在“图谱 / 提交信息 / 作者 / 时间 / SHA”之间增加 4 条可拖拽分隔线，调整时只联动相邻列并保持表格总宽度不变，表头与提交行同步使用新列宽。
- 支持左右方向键按 `8px` 微调；列宽保存到浏览器布局偏好，恢复默认布局时一并清除，窗口或侧栏宽度变化后自动限制到可用范围。
- 窄布局隐藏作者或 SHA 列时自动跳过对应分隔线，并修复提交行原生按钮内边距造成的表头与内容列错位。
- 增加列拖拽、持久化、窄布局、表头对齐和中英文无障碍文案回归，同步中文功能说明与继续开发文档。

### Testing
- `node --check public/js/app/layout-utils.js` 通过。
- `node --test tests/layout-ui.test.js tests/i18n.test.js` 26 项全部通过，退出码为 0。
- 浏览器在 `http://127.0.0.1:5177/` 实测：默认列宽为 `176 / 370 / 150 / 96 / 96px`，调整图谱边界后为 `184 / 362 / 150 / 96 / 96px`；表头与提交行总宽均为 `888px` 且各列边界一致。其余边界调整与 4 个 `col-resize` 拖拽柄均正常。
- `git diff --check` 退出码为 0，无空白错误；仅显示仓库现有的 LF / CRLF 工作区转换提示。

### Notes
- `public/index.html`：为提交图谱表头增加 4 个列宽拖拽柄及双语可捕获的无障碍属性。
- `public/js/app/layout-utils.js`：实现相邻列联动调整、宽度限制、键盘操作、持久化和默认布局恢复。
- `public/js/i18n-catalog.js`：增加列宽拖拽提示的英文翻译。
- `public/styles.css`：接入可调整列变量、拖拽柄状态、窄布局隐藏规则，并修复表头与提交行对齐。
- `tests/layout-ui.test.js`：增加指针拖动、列宽存储、拖拽柄和列对齐回归。
- `tests/i18n.test.js`：增加拖拽柄标题与无障碍标签的双语回归。
- `README.md`：说明提交图谱表头列宽调整与布局持久化能力。
- `docs/CONTINUE.md`：记录列联动、响应式限制、存储键和对齐修复。
- `progress.md`：追加本轮实现、验证和回滚记录。
- 回滚方式：提交前执行 `git restore -- README.md docs/CONTINUE.md progress.md public/index.html public/js/app/layout-utils.js public/js/i18n-catalog.js public/styles.css tests/i18n.test.js tests/layout-ui.test.js`；提交后执行 `git revert <本任务提交哈希>`。

## 2026-08-02 - Task: 顶部同步按钮悬浮显示 Git 指令

### What was done
- 将顶部“抓取 / 拉取 / 推送 / 强推”按钮的悬浮标题改为各自实际对应的 Git 指令，不再重复显示按钮名称。
- 抓取和拉取提示与服务端真实参数保持一致，分别显示 `git fetch --all --prune` 与 `git pull --ff-only`；推送和强推显示 `git push` 与 `git push --force-with-lease`。
- 增加顶部同步按钮命令提示回归，并同步中文功能说明与继续开发文档。

### Testing
- `node --test tests/layout-ui.test.js tests/i18n.test.js` 27 项全部通过，退出码为 0。
- 浏览器刷新 `http://127.0.0.1:5177/` 后实测，四个按钮的 `title` 依次为 `git fetch --all --prune`、`git pull --ff-only`、`git push`、`git push --force-with-lease`，按钮可见文字与原有操作行为未变化。
- `git diff --check` 退出码为 0，无空白错误；仅显示仓库现有的 LF / CRLF 工作区转换提示。

### Notes
- `public/index.html`：把顶部四个同步快捷按钮的悬浮标题改为真实 Git 指令。
- `tests/layout-ui.test.js`：锁定四个顶部按钮与对应命令的映射。
- `README.md`：说明顶部同步快捷按钮的悬浮命令。
- `docs/CONTINUE.md`：记录四个按钮的实际命令提示和双语行为。
- `progress.md`：追加本轮实现、验证和回滚记录。
- 回滚方式：提交前执行 `git restore -- README.md docs/CONTINUE.md progress.md public/index.html tests/layout-ui.test.js`；提交后执行 `git revert <本任务提交哈希>`。

## 2026-08-02 - Task: 增强图谱列宽拖拽视觉提示

### What was done
- 将提交图谱表头的列宽拖拽边界改为默认常显的完整竖线，并在每条边界中部增加青色双竖抓手，避免被误认为普通静态表头。
- 将命中区域扩展到 `14px`；悬停、键盘聚焦或按住拖动时，命中区域、边界线和抓手会同步高亮，列宽计算、持久化及响应式隐藏逻辑保持不变。
- 增加分隔线宽度、常显边界、双竖抓手和高亮样式回归，并同步中文功能说明与继续开发文档。

### Testing
- `node --test tests/layout-ui.test.js tests/i18n.test.js` 27 项全部通过，退出码为 0。
- 浏览器刷新 `http://127.0.0.1:5177/` 后在 `1520×912` 视口实测：4 个拖拽柄均为 `14px` 命中宽度和 `col-resize` 光标；默认边界线为 `1px`，中部双竖抓手高 `18px`、颜色为主题青色，表头标签未被遮挡或挤压。
- 内置浏览器的鼠标移动接口未能稳定触发页面 `:hover`，悬停、聚焦和按住状态由定向 CSS 回归验证，未将其记录为浏览器现场验证。
- `git diff --check` 退出码为 0，无空白错误；仅显示仓库现有的 LF / CRLF 工作区转换提示。

### Notes
- `public/styles.css`：增强图谱列分隔线、双竖抓手、命中区及交互高亮状态。
- `tests/layout-ui.test.js`：锁定分隔线宽度、常显边界、抓手和悬停高亮样式。
- `README.md`：说明图谱列宽拖拽的常显抓手和交互反馈。
- `docs/CONTINUE.md`：记录拖拽视觉提示、命中宽度及不变的布局行为。
- `progress.md`：追加本轮实现、验证和回滚记录。
- 回滚方式：提交前执行 `git restore -- README.md docs/CONTINUE.md progress.md public/styles.css tests/layout-ui.test.js`；提交后执行 `git revert <本任务提交哈希>`。

## 2026-08-02 - Task: 修正图谱拖拽柄三线视觉

### What was done
- 移除“边界线 + 双竖抓手”叠加造成的三条竖线，只保留一条与真实列边界对齐的分隔线。
- 分隔线默认宽度为 `2px`，悬停、键盘聚焦或按住拖动时加粗为 `3px` 并切换为主题青色；`14px` 拖拽命中区域保持不变。
- 更新视觉回归与中文文档，明确最终采用单线方案。

### Testing
- `node --test tests/layout-ui.test.js tests/i18n.test.js` 27 项全部通过，退出码为 0。
- 浏览器刷新 `http://127.0.0.1:5177/` 并等待仓库状态加载后实测：4 个拖拽柄的分隔线均为 `2px`，额外 `::after` 内容均为 `none`，光标仍为 `col-resize`；页面只显示单条列边界线，表头与提交行保持对齐。
- `git diff --check` 退出码为 0，无空白错误；仅显示仓库现有的 LF / CRLF 工作区转换提示。

### Notes
- `public/styles.css`：移除双竖抓手并改为单条常显分隔线及交互加粗状态。
- `tests/layout-ui.test.js`：锁定单线宽度、无额外抓手和交互加粗样式。
- `README.md`：将图谱拖拽提示说明修正为单线方案。
- `docs/CONTINUE.md`：记录单线默认与交互状态的最终规格。
- `progress.md`：追加三线问题的修正、验证和回滚记录。
- 回滚方式：提交前执行 `git restore -- README.md docs/CONTINUE.md progress.md public/styles.css tests/layout-ui.test.js`；提交后执行 `git revert <本任务提交哈希>`。

## 2026-08-03 - Task: 增加左上角版本更新提示

### What was done
- 在 Forkline 品牌标题后加入与参考图一致的圆形上箭头更新入口，并保证图标紧跟标题而不是被极窄布局推到可视区域外。
- 服务端使用 `package.json` 当前版本检查 GitHub 最新正式 Release；只有远端版本更高时才返回可见更新，结果缓存 10 分钟，当前已是最新版、网络失败或 Release 数据无效时均静默隐藏。
- 更新入口只打开对应 GitHub Release，不会自动拉取、安装或覆盖本地开发工作区；中英文提示和发布版本维护说明已同步。

### Testing
- `node --check app-update.js`、`node --check server.js`、`node --check public/js/app/init.js` 均通过。
- `node --test --test-concurrency=1` 分组运行除大型 `git-api.test.js` 外的 13 个测试文件，75 项全部通过，退出码为 0；其中覆盖版本号比较、缓存、同版本隐藏、网络失败隐藏、较新版本显示、布局和中英文目录。
- 真实接口 `http://127.0.0.1:5299/api/app-update` 返回当前版本 `0.1.0`、最新版本 `0.1.0`、`available=false`；浏览器确认更新元素存在但不可见，且保留 `hidden`。
- 使用 `FORKLINE_APP_VERSION=0.0.0` 在临时端口 `5300` 模拟旧版本：更新入口显示为约 `34×34px` 圆形上箭头，链接指向 `v0.1.0` Release；桌面和竖屏布局均未与品牌文字重叠，页面控制台无错误。
- 临时测试服务 `5299` 和 `5300` 均已关闭；`git diff --check` 退出码为 0，仅有仓库现有的 LF / CRLF 转换提示。
- 大型 `tests/git-api.test.js` 单独复跑被自动权限审核服务拒绝，未获得本轮新结果；本任务未修改任何仓库 Git 操作路径，服务启动、`/api/state` 页面加载和新增只读接口已完成现场验证。

### Notes
- `app-update.js`：新增正式 Release 查询、语义版本比较、失败静默处理和 10 分钟缓存。
- `package.json`：声明当前 Forkline 版本 `0.1.0`，作为更新比较基准。
- `server.js`：接入 `/api/app-update` 只读接口和可用于验证的当前版本 / Release API 环境覆盖。
- `public/index.html`：在左上角品牌标题后加入默认隐藏的更新链接。
- `public/styles.css`：增加主题自适应圆形更新图标，并保证桌面和竖屏均紧跟标题显示。
- `public/js/core.js`：登记更新提示 DOM 引用。
- `public/js/app/init.js`：启动时异步检查更新，仅在返回较新正式版本时解除隐藏。
- `public/js/i18n-catalog.js`：增加更新入口的英文提示。
- `tests/app-update.test.js`：覆盖版本解析、比较、缓存、同版本和网络失败语义。
- `tests/layout-ui.test.js`：覆盖更新入口默认隐藏及较新版本显隐行为。
- `README.md`：说明更新提示来源、显隐规则和不会自动修改代码的边界。
- `docs/CONTINUE.md`：记录实现方式及发布新版本时同步维护 `package.json` 版本号的要求。
- `progress.md`：追加本轮实现、验证、缺口和回滚记录。
- 回滚方式：提交前执行 `git restore -- README.md docs/CONTINUE.md package.json progress.md public/index.html public/js/app/init.js public/js/core.js public/js/i18n-catalog.js public/styles.css server.js tests/layout-ui.test.js; Remove-Item -LiteralPath app-update.js,tests/app-update.test.js`；提交后执行 `git revert <本任务提交哈希>`。

## 2026-08-03 - Task: 发布 Forkline v0.2.0

### What was done
- 将 Forkline 当前版本从 `0.1.0` 提升到 `0.2.0`，确保左上角更新提示以本次正式版本作为比较基准。
- 将更新提示、双语界面、竖屏布局、完整代码对照与 GBK 编辑、按块/按行暂存、提交浏览性能优化等现有成果作为 `v0.2.0` 正式版本发布。
- 推送 `main` 和 `v0.2.0` 标签，并在 GitHub 创建 `Forkline v0.2.0` Release：`https://github.com/AsphyxiaChoke/Forkline/releases/tag/v0.2.0`。

### Testing
- `node --check app-update.js`、`node --check server.js`、`node --check public/js/app/init.js` 均通过。
- `npm.cmd test` 完整运行仓库测试，97 项全部通过，退出码为 0；其中覆盖更新检测、布局、中英文目录和 Git 集成流程。
- `git diff --check` 通过；发布后使用 `gh release view v0.2.0` 核对 Release、标签、目标提交和公开地址。

### Notes
- `package.json`：将用于更新比较的当前应用版本提升到 `0.2.0`。
- `progress.md`：追加 `v0.2.0` 发布内容、验证和回滚记录。
- 回滚方式：发布前执行 `git restore -- package.json progress.md`；发布后执行 `gh release delete v0.2.0 --yes --cleanup-tag` 删除 Release 与远端标签，再执行 `git revert <本任务提交哈希>` 回退 `main`。

## 2026-08-03 - Task: 在设置页显示版本与更新状态

### What was done
- 在设置页顶部增加“关于 Forkline”卡片，常驻显示当前应用版本、GitHub 最新正式版本和明确的更新状态。
- 更新检查状态区分“正在检查更新”“已是最新版本”“发现新版本”和“暂时无法检查更新”；网络或接口失败不会再被误解成已经是最新版。
- 复用现有 `/api/app-update` 结果更新设置页，左上角更新图标仍只在存在更高正式版本时显示，没更新时继续完全隐藏。
- 增加紧凑双列版本布局、窄右栏换行保护及完整中英文文本，并同步 README 和继续开发文档。

### Testing
- `npm.cmd test` 完整运行仓库测试，98 项全部通过，退出码为 0；覆盖版本相同、发现新版本、检查失败、布局、中英文目录及全部 Git 集成流程。
- `node --check public/js/app/init.js`、`node --check public/js/core.js`、`node --check public/js/panels/recovery-settings.js`、`node --check public/js/i18n-catalog.js` 均通过。
- `git diff --check` 通过，仅显示仓库现有的 LF / CRLF 工作区转换提示。
- 尝试使用临时端口 `5301` 做内置浏览器现场验证时，被浏览器本机策略拒绝访问该端口，因此本轮没有记录浏览器截图为通过；临时 Node 服务及监听端口已关闭，布局和状态显隐由定向回归覆盖。

### Notes
- `public/js/core.js`：增加共享的应用更新检查状态。
- `public/js/app/init.js`：保存更新检查结果，并在设置页打开时刷新版本状态卡片。
- `public/js/panels/recovery-settings.js`：增加当前版本、最新版本和更新状态展示。
- `public/styles.css`：增加版本信息双列布局和状态样式。
- `public/js/i18n-catalog.js`：增加版本与更新状态的英文翻译。
- `tests/layout-ui.test.js`：覆盖最新、可更新和检查失败三种设置页状态，并保持左上角图标原有规则。
- `README.md`：说明设置页可直接确认当前版本和更新状态。
- `docs/CONTINUE.md`：记录版本状态卡片的数据来源、失败语义和发布维护要求。
- `progress.md`：追加本轮实现、验证、缺口和回滚记录。
- 回滚方式：提交前执行 `git restore -- README.md docs/CONTINUE.md progress.md public/js/app/init.js public/js/core.js public/js/i18n-catalog.js public/js/panels/recovery-settings.js public/styles.css tests/layout-ui.test.js`；提交后执行 `git revert <本任务提交哈希>`。

## 2026-08-03 - Task: 增加项目内一键更新并重启

### What was done
- 在设置页发现新正式版本时提供“立即更新并重启”，更新期间保持明确状态并在服务恢复后自动刷新；ZIP 安装方式继续引导到 Release 手动下载。
- 一键更新仅允许官方 `AsphyxiaChoke/Forkline` origin、`main` 分支、干净工作区、无未完成 Git 操作且能够快进到目标 Release Tag 的 Git 克隆；不会自动储藏、不会使用硬重置，也不会修改当前管理的仓库。
- 主服务确认更新计划并返回响应后退出，由独立更新器执行 `git merge --ff-only`、原端口重启和首页健康检查；新版本启动失败时仅使用 `git reset --keep` 回退并重新启动旧版本。
- 更新结果跨服务重启保存在系统临时目录，成功、失败和已回退失败使用可翻译的结构化状态；重启后会恢复更新前正在查看的仓库。文件编辑器有未保存修改、提交信息框有草稿或 Forkline 正在执行操作时会阻止更新。

### Testing
- `node --check app-self-update.js`、`node --check self-update-runner.js`、`node --check server.js`、`node --check public/js/app/init.js`、`node --check public/js/app/events.js`、`node --check public/js/panels/recovery-settings.js`、`node --check public/js/i18n-catalog.js` 均通过。
- 定向运行 `node --test --test-concurrency=1 tests/app-update.test.js tests/app-self-update.test.js tests/layout-ui.test.js`，37 项全部通过；覆盖官方远端校验、真实临时 Git 仓库快进、脏工作区与分叉阻止、状态跨重启、旧服务退出、新服务启动，以及启动失败后回退并重启旧版本。
- `npm.cmd test` 完整运行 106 项测试，全部通过，退出码为 0；既有工作区、历史编辑、冲突、同步、储藏、文件编辑器、布局和多语言流程均未回归。
- 临时端口 `58638` 启动真实服务做只读 API 冒烟：`GET /api/app-update` 返回当前与最新版本均为 `0.2.0`、`available: false`、`installSupported: true`，`GET /api/app-update/status` 返回 `idle`；未调用安装接口。测试进程 `21296` 和端口均已确认关闭。
- `git diff --check` 通过，仅显示仓库现有的 LF / CRLF 工作区转换提示。

### Notes
- `app-self-update.js`：实现官方远端、分支、工作区与快进校验，更新候选引用、快进更新、受保护回退、状态持久化和服务健康检查。
- `self-update-runner.js`：增加脱离旧服务生命周期的更新执行入口和启动失败状态记录。
- `server.js`：增加更新状态与安装 API、运行中操作阻止、更新器启动和响应后关闭服务。
- `app-update.js`：在 Release 检查结果中保留精确 Tag 名供安装阶段重新校验。
- `public/js/core.js`：保存应用更新检查与安装状态。
- `public/js/app/init.js`：轮询跨重启更新结果、显示成功或回退提示、自动刷新并恢复此前打开的仓库。
- `public/js/app/events.js`：接入设置页一键更新操作。
- `public/js/panels/recovery-settings.js`：展示安装按钮、安装限制和更新进度，并阻止未保存编辑或提交草稿下更新。
- `public/styles.css`：增加版本卡片、状态、说明与操作区样式。
- `public/js/i18n-catalog.js`：增加一键更新、安全限制、重启、失败和回退状态的英文翻译。
- `tests/app-update.test.js`：覆盖 Release Tag 透传。
- `tests/app-self-update.test.js`：覆盖更新安全边界、快进、回退、服务重启、状态保存和仓库上下文保存。
- `tests/layout-ui.test.js`：覆盖设置页安装状态、ZIP 限制、回退提示和仓库恢复请求。
- `README.md`：说明 Git 克隆版一键更新、ZIP 限制和安全回退行为。
- `docs/CONTINUE.md`：记录更新器架构、执行约束、状态恢复和后续发布要求。
- `progress.md`：追加本轮实现、验证、临时服务清理和回滚记录。
- 回滚方式：提交前执行 `git restore -- README.md app-update.js docs/CONTINUE.md progress.md public/js/app/events.js public/js/app/init.js public/js/core.js public/js/i18n-catalog.js public/js/panels/recovery-settings.js public/styles.css server.js tests/app-update.test.js tests/layout-ui.test.js`，再执行 `Remove-Item -LiteralPath app-self-update.js,self-update-runner.js,tests/app-self-update.test.js`；提交后执行 `git revert <本任务提交哈希>`。

## 2026-08-03 - Task: 图谱列拉宽后恢复完整分支标签

### What was done
- 修复提交图谱表头拉宽后，图谱 SVG 仍固定停留在 `176px`、分支标签继续按旧宽度省略的问题。
- 图谱渲染宽度现在读取实际的 `--history-graph-col-w`；拖拽或键盘调整图谱列时，通过 `requestAnimationFrame` 只重绘 SVG 图层，不重建提交列表和右侧详情。
- 取消分支标签原有的 `128px` 固定上限，改为按节点所在位置和当前图谱列剩余空间决定宽度：窄列保持省略并保留完整悬停提示，空间足够时自动恢复更多文字或完整名称。
- 保持默认图谱最小宽度、提交信息最小宽度、列宽保存和响应式隐藏规则不变，并同步 README 与继续开发文档。

### Testing
- 先增加失败回归：拖动图谱列后未请求 SVG 重绘，且图谱列从 `176px` 模拟扩到 `360px` 时 `graphRenderWidth` 仍返回 `176`；修复前定向测试稳定以这两个断言失败。
- `node --test tests/layout-ui.test.js` 修复后 27 项全部通过；覆盖拖拽回调、窄列省略、宽列完整显示、标签不越过图谱列和 SVG 实际宽度同步。
- `node --check public/js/features/graph.js`、`node --check public/js/features/history-list.js`、`node --check public/js/app/layout-utils.js` 均通过。
- `npm.cmd test` 完整运行 106 项测试，全部通过，退出码为 0；提交选择原地更新、图谱布局、工作区、同步、冲突、历史编辑、文件编辑器和一键更新均未回归。
- 使用当前已有的 `http://127.0.0.1:5177/` 和 `D:/桌面/GitTest` 现场验证：图谱列为 `176px` 时 `tag: forkline-v0.1.0` 显示为 `tag: forkline-...`，拉宽到 `315px` 后恢复完整名称；SVG CSS 宽度和 `viewBox` 同步从 `176` 变为 `315`，再缩窄和拉宽时标签会实时往返变化。页面控制台错误为 0。
- 本轮没有启动新的测试服务，用户当前的 `5177` 页面继续保留。

### Notes
- `public/js/features/graph.js`：使用实际图谱列宽生成 SVG，并按可用空间计算分支标签宽度。
- `public/js/features/history-list.js`：增加按动画帧合并的 SVG 图层重绘，不重建提交行。
- `public/js/app/layout-utils.js`：图谱列宽变化时通知 SVG 重绘。
- `tests/layout-ui.test.js`：增加图谱列拖拽回调及标签窄宽切换回归。
- `README.md`：说明分支标签会随图谱列实时恢复完整显示。
- `docs/CONTINUE.md`：更新标签宽度规则和 SVG 单层重绘实现说明。
- `progress.md`：追加本轮复现、修复、全量测试和浏览器验证记录。
- 回滚方式：提交前执行 `git restore -- README.md docs/CONTINUE.md progress.md public/js/app/layout-utils.js public/js/features/graph.js public/js/features/history-list.js tests/layout-ui.test.js`；提交后执行 `git revert <本任务提交哈希>`。

## 2026-08-03 - Task: 简化 README 使用说明

### What was done
- 将 README 从堆叠实现细节和回归历史的长功能清单，改写为面向首次使用者的中文说明。
- 按“快速开始、界面说明、常用流程、历史操作、安全说明、更新、开发文档”重新组织内容，保留启动、提交、分支、储藏、冲突、同步和危险操作的必要说明。
- 将 API 校验、缓存策略、性能数据和逐项回归细节移出 README，继续由 `docs/CONTINUE.md` 和 `progress.md` 保存。
- README 从 `61565` 字节缩减为 `6775` 字节，最长正文行缩短到 `97` 个字符，避免一条项目符号塞入大量功能。

### Testing
- 核对 `start.cmd` 实际执行 `node server.js`，服务默认地址仍为 `http://127.0.0.1:5177`，Windows 启动后会自动打开浏览器。
- 核对 `pull-latest.cmd`、`docs/CONTINUE.md`、`docs/ARCHITECTURE.md` 和 `progress.md` 均存在，README 中的命令与链接有真实落点。
- `git diff --check -- README.md` 退出码为 0，没有空白错误；仅显示仓库现有的自动换行符转换提示。
- 本轮只修改文档，没有改动运行代码，因此未重复执行应用测试。

### Notes
- `README.md`：重写为简洁的中文快速使用说明，并保留常见 Git 操作的直白解释。
- `progress.md`：追加本轮文档简化范围、校验结果和回滚说明。
- 回滚点为本任务开始前的 README（`61565` 字节、`181` 行）；提交后执行 `git revert <本任务提交哈希>`。提交前如执行 `git restore --source=HEAD -- README.md`，会同时撤销上一项尚未提交的 README 文案，需按上一条进度记录恢复图谱标签说明；`progress.md` 只删除末尾本任务段。

## 2026-08-03 - Task: 收口 Forkline 0.2.1 性能与发布

### What was done
- 普通提交详情改为只读取元信息和完整文件清单，不再默认生成整条提交 Diff；右侧“文件”页只保留可滚动文件树，双击文件时才读取完整只读对照，同步提交预览继续按需读取 Diff。
- 工作区和历史文件在任一侧超过 1 MiB、且不超过 16 MiB 时进入轻量只读双栏，使用两个独立 CodeMirror，不运行 MergeView、差异连接或块按钮；关闭窗口会销毁编辑器节点，保存和暂存后的普通编辑器继续恢复查看位置。
- 提交历史默认读取 120 条并支持继续加载，最高 5000 条；加载使用轻量引用接口并保留滚动位置。分支切换和历史加载增加独立请求序号，快速连续切换或加载途中换分支时不会被旧响应覆盖。
- 工作区文件快照增加基于文件元数据的 SHA-256 LRU 缓存；暂存全部、丢弃全部和常用储藏写操作改用轻量工作区状态合并，避免重复重建提交图谱、分支和同步数据。
- GitHub Release REST API 失败或限流时，更新检查会通过 `releases/latest` 的 HEAD 重定向继续识别正式版本；低频历史编辑区域改为按需展开，图谱标签宽度和窄屏操作布局同步收口。
- 版本升级为 `0.2.1`，README 和继续开发文档更新为当前真实行为，并补充大文件、历史加载、更新降级和发布维护说明。

### Testing
- `node --check` 覆盖 13 个本轮改动 JavaScript 文件，全部通过。
- 定向运行 `node --test tests/commit-selection-performance.test.js`，7 项全部通过；新增覆盖加载更早提交后切换分支丢弃旧响应，以及快速连续选择引用只保留最新响应。
- `npm.cmd test` 完整运行 119 项测试，119 项通过、0 项失败、退出码为 0；覆盖自更新、提交浏览、工作区、文件编辑器、冲突、储藏、历史编辑、同步、布局、多语言和便携运行时。
- 使用 `D:/桌面/GitTest` 临时生成 `15,728,680` 字节 C 文件做浏览器现场验证：约 `1.1 s` 打开两个 CodeMirror、零个 MergeView，全页约 2140 个元素；连续 40 次滚动总耗时约 `466 ms`、平均约 `11.7 ms`、最慢约 `19 ms`，页面横向溢出为 0，关闭窗口后 CodeMirror 实例为 0。
- 最终临时服务 `http://127.0.0.1:5296` 返回当前版本 `0.2.1`；普通提交响应 `diffLoaded=false` 且 Diff 为 0，显式 `diff=1` 的同一提交返回 `diffLoaded=true` 和 24 条 Diff；连续 5 次 `/api/worktree` 为 `83-86 ms`。
- `git diff --check` 通过，仅显示仓库现有的 LF / CRLF 转换提示。测试大文件、暂存状态、`5296` 服务和临时日志均已清理，GitTest 恢复原有 4 个演示改动；用户已有的 `5177`、`5287` 服务未关闭或重启。

### Notes
- `README.md`：补充历史按需加载、提交文件页不自动生成 Diff 和大文件查看边界。
- `app-update.js`：增加 GitHub Release 页面 HEAD 重定向降级检查。
- `docs/CONTINUE.md`：记录当前历史、提交详情、大文件、快照缓存、更新降级和竞态保护行为。
- `package.json`：发布版本升级为 `0.2.1`。
- `public/js/app/events.js`：接入历史“加载更早提交”委托事件。
- `public/js/app/init.js`：初始化共享历史加载状态。
- `public/js/core.js`：增加历史分页、引用请求和轻量工作区状态合并状态。
- `public/js/features/diff-workbench.js`：移除历史内联 Diff 协调并收口最大化 Diff 分批渲染。
- `public/js/features/file-editor.js`：增加大文件只读双栏、查看位置恢复和历史对照减负。
- `public/js/features/git-actions.js`：常用工作区动作改用轻量刷新，并保护快速引用切换的响应顺序。
- `public/js/features/graph.js`：按实际图谱列宽恢复可见分支标签。
- `public/js/features/history-list.js`：增加历史继续加载、滚动保持、SVG 层重绘和旧响应保护。
- `public/js/i18n-catalog.js`：补充历史加载、大文件和更新状态中英文文案。
- `public/js/panels/inspector.js`：提交文件页改为纯文件树，低频历史编辑区域默认折叠。
- `public/js/panels/sync.js`：储藏操作使用轻量工作区刷新，同步预览按需加载 Diff。
- `public/styles.css`：增加历史加载、大文件模式、折叠操作区和响应式布局样式。
- `server.js`：增加历史分页、按需提交 Diff、大文件读取边界、工作区快照缓存和轻量工作区接口。
- `tests/app-update.test.js`：覆盖 Release API 限流后的页面重定向降级。
- `tests/commit-selection-performance.test.js`：覆盖提交按需 Diff、历史加载和引用切换竞态。
- `tests/diff-preview.test.js`：更新提交详情无聚合 Diff 的边界断言。
- `tests/file-editor-ui.test.js`：覆盖纯文件树、大文件双 CodeMirror、只读历史对照和位置恢复。
- `tests/git-api.test.js`：覆盖历史超过 120 条继续加载、按需提交 Diff 和大文件接口。
- `tests/layout-ui.test.js`：覆盖历史编辑折叠、按钮布局和图谱标签响应式行为。
- `tests/worktree-refresh.test.js`：覆盖文件快照缓存失效和轻量工作区状态合并。
- `progress.md`：追加本轮发布范围、验证证据、临时资源清理和回滚方式。
- 回滚方式：提交前执行 `git restore -- README.md app-update.js docs/CONTINUE.md package.json progress.md public/js/app/events.js public/js/app/init.js public/js/core.js public/js/features/diff-workbench.js public/js/features/file-editor.js public/js/features/git-actions.js public/js/features/graph.js public/js/features/history-list.js public/js/i18n-catalog.js public/js/panels/inspector.js public/js/panels/sync.js public/styles.css server.js tests/app-update.test.js tests/commit-selection-performance.test.js tests/diff-preview.test.js tests/file-editor-ui.test.js tests/git-api.test.js tests/layout-ui.test.js tests/worktree-refresh.test.js`；提交后执行 `git revert <本任务提交哈希>`。

## 2026-08-04 - Task: 长时间 Git 操作实时进度与取消

### What was done
- 克隆、抓取全部/指定远端、拉取/变基拉取、推送/安全强推、初始化/更新子模块执行时，操作日志会实时显示阶段、耗时、实际 Git 命令和最近原始输出。
- 新增运行中操作查询与取消接口；每个动作使用独立操作 ID，取消白名单外的动作不会误显示可取消。Windows 取消会终止完整 Git 进程树，原请求和日志统一记录为“已取消”，不再混入普通失败。
- 操作日志在轮询刷新时保留右侧栏滚动位置，并自动跟随当前输出；克隆弹窗执行期间的“取消”会真正停止克隆。
- 保持原菜单和右键菜单结构不变，并补充用户说明、继续开发记录和操作生命周期架构说明。

### Testing
- `node --check server.js` 通过；本轮其余改动 JavaScript 在完整测试加载和执行时无语法错误。
- `node --test tests/layout-ui.test.js` 运行 29 项，29 项通过、0 项失败；覆盖操作日志实时输出、取消按钮和既有桌面/竖屏布局。
- `npm.cmd test` 完整运行 121 项，121 项通过、0 项失败、退出码为 0，耗时约 89.6 秒；真实 Git 回归覆盖长时间 fetch 输出流、取消接口和 Git/SSH 子进程树退出。
- 使用隔离目录 `C:\tmp\forkline-visual-cancel` 的真实挂起抓取验证取消状态为 `cancelled / 已取消`，运行中操作清空；本轮临时 `5297` 服务、浏览器标签、请求包装进程和测试目录均已关闭或清理，用户已有 `5287`、`5288` 服务未处理。

### Notes
- `server.js`：跟踪长时间 Git 子进程、命令、输出尾部和阶段，提供运行状态与取消接口，并区分取消和失败日志。
- `public/js/api.js`：在动作请求期间轮询运行状态，合并操作日志并保持面板滚动位置。
- `public/js/app/events.js`：接入操作日志取消按钮和克隆取消事件。
- `public/js/core.js`：增加克隆执行状态。
- `public/js/features/repositories.js`：让克隆弹窗在执行期间可请求真实取消并正确收尾。
- `public/js/i18n-catalog.js`：增加进度阶段、取消确认、取消结果和提示的英文文案。
- `public/js/panels/recovery-settings.js`：渲染运行中命令、耗时、输出和取消入口，并展示已取消日志。
- `public/styles.css`：增加运行中操作、命令区、输出区和取消状态的紧凑响应式样式。
- `tests/git-api.test.js`：增加真实长时间 fetch 输出和进程树取消回归。
- `tests/layout-ui.test.js`：增加操作日志实时进度与取消布局回归。
- `README.md`：说明实时进度、取消入口及取消不会回退已完成传输和克隆残留边界。
- `docs/CONTINUE.md`：记录当前接口、轮询、Windows 取消方式和 121/121 回归基线。
- `docs/ARCHITECTURE.md`：记录操作 ID、输出限制、轮询和取消生命周期。
- `progress.md`：追加本轮实现、验证、临时资源清理和回滚方式。
- 回滚方式：提交前执行 `git restore -- README.md docs/ARCHITECTURE.md docs/CONTINUE.md progress.md public/js/api.js public/js/app/events.js public/js/core.js public/js/features/repositories.js public/js/i18n-catalog.js public/js/panels/recovery-settings.js public/styles.css server.js tests/git-api.test.js tests/layout-ui.test.js`；提交后执行 `git revert <本任务提交哈希>`。

## 2026-08-04 - Task: 历史文件对照增加行对齐模式

### What was done
- 历史提交的小文件只读对照顶部增加“连线 / 行对齐”切换；默认保留原连线方式，行对齐会在增删行的另一侧补空白，使后续相同行保持同一水平位置。
- 行对齐复用 CodeMirror MergeView 原生 spacer，不改文件内容、Diff 结果或 Git 语义；切换时重建当前只读对照并恢复两侧查看位置，选择会在当前页面会话内沿用。
- 切换仅对历史提交的小文件显示；工作区编辑器、冲突单栏编辑器和 1 MiB 以上的大文件轻量双栏保持原行为，避免重新引入大型 MergeView 卡顿。
- 增加中英文文案、紧凑分段按钮样式及回归测试，并同步更新用户说明和继续开发记录。

### Testing
- `node --test tests\\file-editor-ui.test.js` 运行 23 项，23 项通过、0 项失败；覆盖模式入口、MergeView `align` 配置、大文件边界和切换前后两侧滚动位置恢复。
- `node --check` 检查 `public/js/core.js`、`public/js/app/events.js`、`public/js/features/file-editor.js`、`public/js/i18n-catalog.js`，全部通过。
- `npm.cmd test` 完整运行 122 项，122 项通过、0 项失败、退出码为 0，耗时约 90.5 秒。
- 内置浏览器在临时服务 `5299` 打开 `D:/桌面/GitTest`，只读查看提交 `cb138fd`：切到“行对齐”后表单包含 `is-line-aligned`、连线 SVG 为 0；新增文件 `189.txt` 的缺失侧生成 1 个 `.CodeMirror-merge-spacer`。切回“连线”后连线 SVG 恢复为 1、spacer 为 0，模式按钮状态同步正确，页面无报错。
- 本轮没有修改 GitTest，原有 4 个工作区演示改动保持不变。临时浏览器标签和 `5297`、`5298`、`5299` 服务已关闭，用户已有的 `5287`、`5288` 服务保持运行。

### Notes
- `README.md`：说明历史文件对照的“连线 / 行对齐”用途。
- `docs/CONTINUE.md`：记录行对齐适用范围、会话内记忆、大文件边界及 122/122 回归基线。
- `public/index.html`：增加历史对照方式分段按钮。
- `public/js/app/events.js`：接入模式切换事件和中文错误提示。
- `public/js/core.js`：保存当前页面会话使用的历史对照方式并缓存对应 DOM。
- `public/js/features/file-editor.js`：控制模式显示、MergeView 重建、spacer 对齐和两侧查看位置恢复。
- `public/js/i18n-catalog.js`：增加模式名称及悬停说明的英文文案。
- `public/styles.css`：增加紧凑分段按钮和行对齐模式下的中间栏宽度。
- `tests/file-editor-ui.test.js`：覆盖模式切换、大文件不启用及 MergeView 左侧滚动恢复。
- `progress.md`：追加本轮实现、验证、临时资源清理和回滚方式。
- 回滚方式：提交前执行 `git restore -- README.md docs/CONTINUE.md progress.md public/index.html public/js/app/events.js public/js/core.js public/js/features/file-editor.js public/js/i18n-catalog.js public/styles.css tests/file-editor-ui.test.js`；提交后执行 `git revert <本任务提交哈希>`。

## 2026-08-04 - Task: 后端 Git 服务模块化

### What was done
- 将原本集中在 `server.js` 的 Git 运行、仓库读取、提交/文件历史、Git 写操作、文件编辑和应用更新拆为独立 CommonJS 工厂模块，API 响应与 Git 行为保持不变。
- `server.js` 从约 7900 行收口到约 1200 行，只保留进程启动、共享状态接线、HTTP 本地化/错误处理、静态资源和路由编排。
- 增加后端模块边界测试，并同步调整更新服务与工作区快照源码测试的读取位置；删除本轮全部一次性迁移脚本。
- 更新架构、继续开发和 README 说明，后续新增逻辑可直接落入对应服务，不再继续扩大入口文件。

### Testing
- `node --check server.js`、`server/*.js` 和 `tests/backend-modules.test.js` 全部通过；`git diff --check` 通过。
- `node --test --test-concurrency=1 tests\\git-api.test.js` 运行 24 项，24 项通过、0 项失败；覆盖文件编辑、GBK/GB18030、储藏、分支、合并、历史改写、冲突、同步和长操作取消。
- `npm.cmd test` 完整运行 123 项，123 项通过、0 项失败，退出码为 0，耗时约 98.1 秒。
- 临时随机端口 `53836` 启动后 `/api/state` 返回 HTTP 200 和示例仓库状态；检查后 PID `37724` 已结束，端口确认关闭，没有遗留测试服务。

### Notes
- `server.js`：仅保留启动、共享接线、HTTP 辅助和 API 路由编排。
- `server/git-runtime.js`：集中 Git 可执行文件发现、命令运行、输出捕获、凭据隐藏和进程终止。
- `server/repository-service.js`：集中仓库状态、工作区、同步、认证、目录浏览和共享只读解析。
- `server/repository-history.js`：集中提交详情、补丁、文件历史、逐行追踪和分支比较。
- `server/git-operations-service.js`：集中分支、远端、储藏、提交、合并/变基、历史改写、恢复点和操作生命周期。
- `server/file-editor-service.js`：集中历史/工作区文件读取、编码处理、编辑边界和保存。
- `server/update-service.js`：集中 Release 检查、更新状态和安装接口。
- `tests/backend-modules.test.js`：固定后端模块接线和入口文件边界。
- `tests/app-self-update.test.js`：更新自更新接口断言到更新服务模块。
- `tests/worktree-refresh.test.js`：从仓库服务读取工作区快照实现进行缓存回归。
- `README.md`、`docs/ARCHITECTURE.md`、`docs/CONTINUE.md`：记录新的后端分层和继续开发基线。
- `progress.md`：追加本轮实现、验证、临时服务清理和回滚方式。
- 回滚方式：提交前先执行 `git restore -- README.md docs/ARCHITECTURE.md docs/CONTINUE.md progress.md server.js tests/app-self-update.test.js tests/worktree-refresh.test.js`，再执行 `Remove-Item -LiteralPath server/file-editor-service.js,server/git-operations-service.js,server/git-runtime.js,server/repository-history.js,server/repository-service.js,server/update-service.js,tests/backend-modules.test.js`；提交后执行 `git revert <本任务提交哈希>`。

## 2026-08-04 - Task: 后端服务二级拆分与直接回归

### What was done
- 将 `git-operations-service.js` 继续拆为分支/远端、工作区/储藏、历史写操作和恢复点四个领域服务，并将临时文件与工作区补丁处理拆为独立辅助模块。
- 将 `repository-service.js` 继续拆为目录浏览、认证、工作树/子模块、工作区读取和状态编排五个领域服务；两个门面分别收口到约 1200 行和 990 行，原 API 响应及 Git 行为保持不变。
- 增加直接服务测试，覆盖补丁裁剪、路径边界、认证 URL、恢复点保留策略、受保护分支和历史分页；测试发现并补齐 `worktree-patch.js` 遗漏的块序号校验依赖。
- 同步更新 README、架构与继续开发说明，并清理全部一次性迁移脚本、冒烟日志和测试服务。

### Testing
- `node --check` 检查仓库内除 `vendor/` 外的 62 个 JavaScript 文件，全部通过；格式清理后再次检查全部 `server/*.js`，全部通过。
- `node --test --test-concurrency=1 tests/backend-modules.test.js tests/backend-services.test.js tests/worktree-refresh.test.js` 运行 13 项，13 项通过、0 项失败。
- 两轮真实 Git 定向回归各运行 6 项并全部通过，覆盖示例/历史状态、工作区、储藏、认证缓存、子模块签出保护和提交追加/丢弃流程。
- `npm.cmd test` 完整运行 130 项，130 项通过、0 项失败，退出码为 0，耗时约 91.3 秒。
- 随机端口 `57238` 启动 Forkline 后，`GET /api/state` 返回 HTTP 200、示例仓库和 11 条提交；PID `17952` 随后结束，端口和仓库相关 Node 进程均确认无遗留。
- `git diff --check` 通过；本轮 `C:\tmp` 中 3 个迁移/分析脚本与 2 个冒烟日志已按明确路径删除。

### Notes
- `server/git-operations-service.js`：改为 Git 写操作门面并接线四个领域子服务。
- `server/git-branch-service.js`：承接克隆/初始化、分支、远端、Tag、工作树、子模块和同步写操作。
- `server/git-worktree-service.js`：承接暂存、丢弃、储藏、冲突处理和补丁应用。
- `server/git-history-service.js`：承接合并、变基、挑选、还原、重置和历史编辑。
- `server/git-recovery-service.js`：承接恢复点、reflog 恢复和保留策略。
- `server/temp-files.js`：集中临时文件写入和可靠清理辅助。
- `server/worktree-patch.js`：集中纯补丁裁剪/行选择逻辑，并补齐块序号校验。
- `server/repository-service.js`：改为仓库读取门面并同步全部读取子服务的仓库上下文。
- `server/repository-browse-service.js`：承接目录浏览、快捷路径和路径边界判断。
- `server/repository-auth-service.js`：承接认证诊断缓存和 PR/MR URL 生成。
- `server/repository-submodule-service.js`：承接工作树/子模块解析、增强和清理快照。
- `server/repository-worktree-service.js`：承接工作区、Diff、储藏、同步详情和文件快照读取。
- `server/repository-state-service.js`：承接示例/全量/轻量状态编排和历史分页。
- `tests/backend-modules.test.js`：固定入口、门面与二级服务边界。
- `tests/backend-services.test.js`：直接验证拆出服务中的纯逻辑和保护规则。
- `tests/worktree-refresh.test.js`：将工作区快照缓存回归切换到新的读取服务源码。
- `README.md`：简要说明仓库读取与 Git 写操作的二级服务拆分。
- `docs/ARCHITECTURE.md`：记录各子服务职责、仓库上下文同步和直接服务测试边界。
- `docs/CONTINUE.md`：记录当前门面规模、模块清单和 130/130 回归基线。
- `progress.md`：追加本轮实现、验证、资源清理和回滚方式。
- 回滚方式：提交前执行 `git restore -- README.md docs/ARCHITECTURE.md docs/CONTINUE.md progress.md server/git-operations-service.js server/repository-service.js tests/backend-modules.test.js tests/worktree-refresh.test.js`，再执行 `Remove-Item -LiteralPath server/git-branch-service.js,server/git-history-service.js,server/git-recovery-service.js,server/git-worktree-service.js,server/repository-auth-service.js,server/repository-browse-service.js,server/repository-state-service.js,server/repository-submodule-service.js,server/repository-worktree-service.js,server/temp-files.js,server/worktree-patch.js,tests/backend-services.test.js`；提交后执行 `git revert <本任务提交哈希>`。

## 2026-08-05 - Task: 工作区精细提交反馈与长 Diff 原位操作

### What was done
- 未跟踪文件对照增加部分暂存说明，明确只把选中块或行加入暂存区，其余内容仍保留在工作区。
- 按块或按行操作后保留当前文件和最大化窗口，并显示本次操作结果以及“仍有未暂存改动 / 已有暂存内容”的当前状态；最后一处改动处理完成后也保留窗口并明确显示无剩余更改。
- 操作刷新前记录弹窗状态、横纵滚动位置和已加载 Diff 行数，刷新后分阶段恢复，避免长文件操作后跳回顶部或缩回首批内容。
- 最大化工作区 Diff 放开内部裁剪，使结果提示、行操作栏和新旧版本表头在长 Diff 中保持吸顶；补充中英文文案、用户说明和回归覆盖。

### Testing
- `node --check public/js/features/diff-workbench.js` 通过。
- `node --test --test-concurrency=1 tests/file-editor-ui.test.js` 运行 26 项，26 项通过、0 项失败；覆盖未跟踪提示、操作结果、弹窗与加载范围保持、横纵滚动恢复和长 Diff 吸顶。
- `node --test --test-concurrency=1 tests/git-api.test.js` 运行 25 项，25 项通过、0 项失败；真实 Git 回归覆盖中文路径、CRLF、无末尾换行、GBK/GB18030、冲突和按块/按行暂存。
- `npm.cmd test` 完整运行 134 项，134 项通过、0 项失败、退出码为 0，耗时约 89.8 秒。
- 真实浏览器在 320 行未跟踪文件第 260 行附近执行按行暂存，操作前后 `scrollTop` 均为 `7064.1787109375`，结果提示、操作栏和表头保持吸顶，控制台错误为 `[]`。
- `git diff --check` 通过，仅输出仓库现有的 LF/CRLF 转换提示；临时 `5347` 服务、测试仓库、日志和浏览器测试页均已关闭或清理，本轮收尾没有启动新服务。

### Notes
- `README.md`：补充工作区右键对照、未跟踪部分暂存和长 Diff 原位操作说明。
- `docs/CONTINUE.md`：记录精细提交反馈、视图恢复、吸顶行为、浏览器验证结果和后续开发落点。
- `public/js/core.js`：增加当前工作区 Diff 操作反馈状态。
- `public/js/features/diff-workbench.js`：渲染未跟踪提示和操作结果，保留当前文件、弹窗、加载范围及滚动位置，并在无剩余改动时保留完成状态。
- `public/js/features/repositories.js`：切换仓库时清理工作区 Diff 操作反馈。
- `public/js/i18n-catalog.js`：增加部分暂存、剩余状态和完成状态的英文文案。
- `public/styles.css`：增加结果提示及长 Diff 提示条、操作栏、表头吸顶样式。
- `tests/file-editor-ui.test.js`：增加提示、原位恢复、无剩余改动和吸顶布局回归。
- `tests/git-api.test.js`：增加未跟踪文件按行暂存并保持剩余 CRLF 内容的真实 Git 回归。
- `progress.md`：追加本轮实现、验证、资源清理和回滚方式。
- 回滚方式：提交前执行 `git restore -- README.md docs/CONTINUE.md progress.md public/js/core.js public/js/features/diff-workbench.js public/js/features/repositories.js public/js/i18n-catalog.js public/styles.css tests/file-editor-ui.test.js tests/git-api.test.js`；提交后执行 `git revert <本任务提交哈希>`。

## 2026-08-05 - Task: 工作区 Diff 操作后目标块短时高亮

### What was done
- 按块或按行操作前记录目标 hunk 的旧/新行范围和改动内容，刷新后重新匹配仍存在的目标块；前方块被移除、hunk 序号变化时仍能定位正确，目标块已经消失时不会误亮其他块。
- 为匹配到的块标题增加低开销琥珀色提示，只动画单个 hunk 标题而不是整块全部代码行，避免大型 Diff 同时触发大量节点绘制。
- 普通环境下高亮渐隐；系统开启“减少动态效果”时使用静态提示。两种模式都会在 1.8 秒后移除 DOM 标记并清空高亮状态，避免后台轮询再次触发。
- 同步更新 README、继续开发说明和界面回归测试，不改变暂存、取消暂存或丢弃的 Git 行为。

### Testing
- `node --check public/js/features/diff-workbench.js` 通过。
- `node --test --test-concurrency=1 tests/file-editor-ui.test.js` 运行 27 项，27 项通过、0 项失败；覆盖 hunk 序号变化后的重新匹配、过期不显示、1.8 秒自动移除、减少动态效果兜底及按块/按行接线。
- `npm.cmd test` 最终完整运行 135 项，135 项通过、0 项失败、退出码为 0，耗时约 102.0 秒。
- 真实浏览器使用隔离仓库 `C:\tmp\forkline-highlight-test`：从 3 处修改中暂存第二处后剩余 2 处，目标标题数量为 1；减少动态效果环境下 `animationName = none`，但琥珀色背景和双侧内边标记可见。等待 1.9 秒后目标标记数量变为 0，操作结果条仍保留，控制台错误为 `[]`。
- `git diff --check` 通过，仅输出仓库现有的 LF/CRLF 转换提示。临时 `5353` 服务 PID `45020` 已关闭并确认无监听，隔离仓库、标准输出日志、错误日志和浏览器测试页均已删除或关闭。

### Notes
- `README.md`：说明工作区操作刷新后会短暂高亮仍存在的目标改动块。
- `docs/CONTINUE.md`：记录目标块重新匹配、性能边界、减少动态效果行为和状态清理方式。
- `public/js/features/diff-workbench.js`：捕获并重新匹配操作目标 hunk，渲染标题高亮并在到时后清理 DOM 与反馈状态。
- `public/styles.css`：增加琥珀色 hunk 标题渐隐动画及减少动态效果时的静态提示。
- `tests/file-editor-ui.test.js`：增加目标 hunk 匹配、过期、自动清理、样式和动作接线回归。
- `progress.md`：追加本轮实现、验证、临时资源清理和回滚方式。
- 回滚方式：提交前执行 `git restore -- README.md docs/CONTINUE.md progress.md public/js/features/diff-workbench.js public/styles.css tests/file-editor-ui.test.js`；提交后执行 `git revert <本任务提交哈希>`。

## 2026-08-05 - Task: 同步页轻量状态刷新

### What was done
- 新增独立 `/api/sync-state`，只读取同步页需要的当前分支、HEAD、upstream、领先/落后、远端配置、远端分支和同步提交摘要，不再连带读取提交图、工作区、储藏、恢复点、Tag、工作树和子模块。
- 切换到“同步”页时按仓库路径、当前分支和 HEAD 校验响应，再局部更新同步详情与分支条；旧请求、已切换仓库或外部改变 HEAD 的结果不会混入当前页面。
- 设置或取消 upstream 后改用轻量状态刷新，保留提交图、工作区、当前提交选择和已加载的提交详情；会改变引用、历史或工作区的同步动作仍使用完整状态刷新。
- 把全量状态中原有的本地/远端分支解析提取为同一内部辅助，保证轻量与全量接口沿用相同过滤语义。

### Testing
- `node --check server.js`、`server/repository-state-service.js`、`public/js/panels/sync.js`、`public/js/features/folder-command.js`、`public/js/features/git-actions.js`、`public/js/i18n-catalog.js` 和 `tests/sync-state-performance.test.js` 均通过。
- `node --test tests/sync-state-performance.test.js tests/backend-modules.test.js` 运行 5 项，5 项通过、0 项失败；覆盖轻量接口接线、upstream 局部刷新、提交图/工作区/提交详情保持和 HEAD 变化保护。
- `node --test --test-name-pattern "sync state endpoint" tests/git-api.test.js` 运行 1 项真实 Git 定向测试并通过，确认响应不包含提交、工作区、储藏、Tag、工作树、子模块或恢复点数据。
- `npm.cmd test` 完整运行 139 项，139 项通过、0 项失败、退出码为 0，耗时约 100.4 秒。
- `D:\桌面\GitTest` 只读测量 6 轮：全量 `/api/state` 平均 `230.5 ms`、`14365` 字节，轻量 `/api/sync-state` 平均 `101.5 ms`、`1145` 字节，约快 `2.27` 倍、响应体缩小约 `92%`。
- 测量使用随机端口 `53628`，脚本结束后确认端口无监听并删除 `C:\tmp\forkline-sync-measure.js`；GitTest 仍只保留测量前已有的 `测试.txt` 修改和 3 个未跟踪编辑器演示文件。
- `git diff --check` 通过，仅输出仓库现有的 LF/CRLF 转换提示。

### Notes
- `server/repository-state-service.js`：新增轻量同步状态编排，并让全量与轻量读取共用分支引用解析。
- `server/repository-service.js`：向仓库读取门面导出 `readSyncState`。
- `server.js`：接入 `GET /api/sync-state` 路由和仓库上下文校验。
- `public/js/core.js`：增加同步状态请求序号，阻止较旧响应覆盖新结果。
- `public/js/panels/sync.js`：合并轻量同步数据，保留分支 SHA 快照并校验仓库、分支与 HEAD。
- `public/js/features/folder-command.js`：切换到同步页时按需触发轻量刷新。
- `public/js/features/git-actions.js`：设置和取消 upstream 后改为局部同步刷新。
- `public/js/i18n-catalog.js`：补充仓库分支或 HEAD 已变化时的英文提示。
- `tests/backend-modules.test.js`：固定轻量同步读取仍属于仓库状态子服务。
- `tests/git-api.test.js`：增加轻量同步响应边界的真实 Git 回归。
- `tests/sync-state-performance.test.js`：增加前端局部更新、状态保持和 HEAD 快照保护回归。
- `README.md`：说明同步页和 upstream 操作不会重读提交图与工作区。
- `docs/CONTINUE.md`：记录接口边界、性能实测、后续同步方向和 139/139 基线。
- `progress.md`：追加本轮实现、验证、资源清理和回滚方式。
- 回滚方式：提交前执行 `git restore -- README.md docs/CONTINUE.md progress.md public/js/core.js public/js/features/folder-command.js public/js/features/git-actions.js public/js/i18n-catalog.js public/js/panels/sync.js server.js server/repository-service.js server/repository-state-service.js tests/backend-modules.test.js tests/git-api.test.js`，再执行 `Remove-Item -LiteralPath tests/sync-state-performance.test.js`；提交后执行 `git revert <本任务提交哈希>`。

## 2026-08-05 - Task: 启动时恢复上次打开的仓库

### What was done
- 应用启动会先读取服务端当前状态；服务端已经保持真实仓库时直接沿用，不会被浏览器中的旧记录覆盖。
- 服务端处于示例仓库时，自动打开最近仓库列表第一项；路径已移动、删除或失效时保留最近记录并回到示例页面。
- 带 `ref` 参数启动时会在恢复仓库后重新读取目标引用；恢复成功后刷新最近仓库的分支和最后打开时间。
- README 和继续开发文档同步说明首次打开、后续自动恢复及失效路径回退行为。

### Testing
- `node --check public/js/app/init.js` 和 `node --check tests/layout-ui.test.js` 均通过。
- `node --test --test-concurrency=1 tests/layout-ui.test.js` 运行 34 项，34 项通过、0 项失败；覆盖服务端已有真实仓库、最近仓库恢复、无最近记录、路径失效和指定引用恢复。
- `npm.cmd test` 完整运行 144 项，144 项通过、0 项失败、退出码为 0，耗时约 89.4 秒。
- `git diff --check` 通过，仅输出仓库现有的 LF/CRLF 转换提示。
- 本轮没有启动新的常驻测试服务；清理了昨天遗留的 `forkline-operation-cancel-*` 自动测试进程，当前 `127.0.0.1:5177` 服务 PID `46316` 保持运行。

### Notes
- `public/js/app/init.js`：增加启动状态读取和最近仓库自动恢复逻辑。
- `tests/layout-ui.test.js`：增加五种启动仓库状态的 VM 回归。
- `README.md`：说明后续启动会恢复上次成功打开的仓库及失效路径回退。
- `docs/CONTINUE.md`：记录恢复优先级、浏览器存储和更新流程兼容行为。
- `progress.md`：追加本轮实现、验证、资源清理和回滚方式。
- 回滚方式：提交前执行 `git restore -- README.md docs/CONTINUE.md progress.md public/js/app/init.js tests/layout-ui.test.js`；提交后执行 `git revert <本任务提交哈希>`。

## 2026-08-05 - Task: 历史文件对照偶发卡死修复

### What was done
- 复现到历史文件对照反复切换“连线 / 行对齐”时，旧 CodeMirror MergeView 在 DOM 已移除后仍由全局 `resize` 监听和 5 秒脱离检测定时器保留；刷新页面会一次性清空这些旧实例，因此表现为卡住后刷新恢复。
- 为本地 MergeView 增加显式销毁入口，并在切换对照方式、切换文件、关闭浮窗或切换仓库移除编辑器 DOM 前立即解绑窗口监听和清除定时器。
- 保留“连线 / 行对齐”、工作区编辑、按块暂存、浮窗拖动缩放和 Git 接口语义，仅缩短旧编辑器实例的释放时间。

### Testing
- 修复前在独立 `692 KiB`、约 60,000 行 `main.c` 对照中连续切换 8 次：浏览器保留节点达到约 `73,713`、事件监听器 `1,053`、已用堆约 `111.2 MB`，约 `6.5 s` 后才回落。
- 修复后同一路径连续切换 8 次：切换结束只保留当前编辑器的一套监听，约 `0.8 s` 内回到 `5,044` 个节点、`415` 个监听器和约 `16.2 MB` 已用堆；继续滚动、拖动缩放和状态读取均可响应，控制台错误为 0。
- `node --check public/js/features/file-editor.js` 与 `node --check public/vendor/codemirror/addon/merge/merge.js` 通过。
- `node --test --test-concurrency=1 tests/file-editor-ui.test.js` 运行 28 项，28 项通过、0 项失败；新增旧 MergeView 立即释放回归。
- `npm.cmd test` 完整运行 145 项，145 项通过、0 项失败、退出码为 0，耗时约 98 秒。
- `git diff --check` 通过，仅输出仓库现有的 LF / CRLF 工作区转换提示。
- `127.0.0.1:5177` 保持运行并已切回 `D:/桌面/GitTest`；临时仓库 `C:\tmp\forkline-freeze-repro-20260805` 已删除。GitTest 仍只保留原有 `测试.txt` 修改和 3 个未跟踪编辑器演示文件。

### Notes
- `public/vendor/codemirror/addon/merge/merge.js`：增加 MergeView 显式销毁，并让原有脱离检测复用同一清理入口。
- `public/js/features/file-editor.js`：在移除编辑器 DOM 前立即销毁当前 MergeView。
- `tests/file-editor-ui.test.js`：固定显式销毁入口及调用顺序。
- `README.md`：补充历史对照切换和关闭时会立即释放旧编辑器。
- `docs/CONTINUE.md`：记录卡死原因、释放边界和 145/145 当前回归基线。
- `progress.md`：追加本轮实现、性能证据、验证和清理记录。
- 回滚方式：提交前执行 `git restore -- README.md docs/CONTINUE.md progress.md public/js/features/file-editor.js public/vendor/codemirror/addon/merge/merge.js tests/file-editor-ui.test.js`；提交后执行 `git revert <本任务提交哈希>`。

## 2026-08-06 - Task: 复杂历史文件自适应轻量对照

### What was done
- 历史提交只读文件在行数很多、不同位置行数过多或差异段过于分散时，会自动从 MergeView 切换为两个独立 CodeMirror，避免小体积但高复杂度文件触发昂贵差异计算。
- 轻量模式状态栏会明确显示“行数较多”或“差异较复杂”，并隐藏不适用的“连线 / 行对齐”；普通历史小差异继续保留完整对照方式。
- 工作区可编辑文件不参与复杂度分流，原有大文件判断、暂存、编辑和 Git 行为保持不变。

### Testing
- `node --check public/js/features/file-editor.js` 和 `node --check public/js/i18n-catalog.js` 通过。
- `node --test tests/file-editor-ui.test.js` 运行 29 项，29 项通过、0 项失败；覆盖 60,000 行、40 个分散差异段、普通小改动、单行插入位移和工作区不触发。
- `npm.cmd test` 完整运行 146 项，146 项通过、0 项失败、退出码为 0，耗时约 105.8 秒。
- 真实 Edge 在独立临时仓库验证：约 399 KiB、60,000 行文件创建 0 个 MergeView 和 2 个 CodeMirror，状态栏显示“复杂文件轻量模式 · 行数较多”，同步大幅滚动事件约 6.2 ms；40 个分散改动显示“差异较复杂”；普通小文件仍创建 1 个 MergeView，并可切换到“行对齐”。关闭复杂文件后 CodeMirror 节点为 0。
- 浏览器唯一控制台错误为既有 `favicon.ico` 404；临时浏览器会话、`5297` 服务、`C:\tmp\forkline-complex-history`、夹具脚本和日志均已关闭或删除，端口确认无监听。
- 既有 `127.0.0.1:5177` 服务保持运行并仍打开 `D:/桌面/GitTest` 的 `123` 分支；GitTest 继续只保留原有 `测试.txt` 修改和 3 个未跟踪编辑器演示文件。
- `git diff --check` 通过，仅输出仓库现有的 LF / CRLF 工作区转换提示。

### Notes
- `public/js/features/file-editor.js`：增加历史文件复杂度判定、轻量模式状态与界面分流。
- `public/styles.css`：让复杂轻量双栏使用与大文件一致的 1px 中线布局。
- `public/js/i18n-catalog.js`：补充复杂轻量模式及原因的英文提示。
- `tests/file-editor-ui.test.js`：增加复杂度阈值、位移保护、工作区边界和英文提示回归。
- `README.md`：用简化说明介绍历史文件自动轻量模式。
- `docs/CONTINUE.md`：记录判定阈值、浏览器实测和 146/146 当前基线。
- `progress.md`：追加本轮实现、验证、资源清理和回滚方式。
- 回滚方式：提交前执行 `git restore -- README.md docs/CONTINUE.md progress.md public/js/features/file-editor.js public/js/i18n-catalog.js public/styles.css tests/file-editor-ui.test.js`；提交后执行 `git revert <本任务提交哈希>`。

## 2026-08-06 - Task: 真实浏览器性能自动回归

### What was done
- 默认 `npm test` 会在系统存在 Edge、Chrome 或 Chromium 时自动启动真实无头浏览器、随机端口 Forkline 服务和独立临时 Git 仓库，验证历史文件对照的实际页面性能。
- 回归覆盖复杂文件轻量结构、打开耗时、事件循环最大延迟、双栏同步滚动、关闭释放、分散差异提示，以及普通 MergeView 连续切换 8 次后的实例数量和全局 `resize` 监听器回落。
- 新增 `npm run test:browser` 独立入口；普通完整测试在缺少浏览器时标记跳过，主动运行独立入口或设置 `FORKLINE_REQUIRE_BROWSER=1` 时缺少浏览器会失败，并支持 `FORKLINE_BROWSER_PATH` 指定路径。
- 测试直接使用 Chromium DevTools Protocol 和 Node.js 内置 WebSocket，不增加 npm 测试依赖或联网下载步骤。

### Testing
- `node --check tests/browser-performance.test.js` 通过。
- `npm.cmd run test:browser` 最终运行 1 项，1 项通过、0 项失败；复杂文件打开约 222.1 ms、最大事件循环延迟约 58.8 ms、同步滚动约 7.8 ms、关闭约 0.6 ms；普通小文件打开约 121.8 ms，连续切换 8 次约 89.8 ms。
- 监听器验证稳定为 `3 -> 4 -> 5 -> 5 -> 4`：首次 CodeMirror 预热只增加 1 个共享监听器，当前 MergeView 增加 1 个，连续切换不继续增长，关闭后回到预热基线。
- 纳入默认测试后，`npm.cmd test` 完整运行 147 项，147 项通过、0 项失败、0 项跳过、退出码为 0，耗时约 99.4 秒；其中真实浏览器复杂文件打开约 177.6 ms、最大延迟约 60.0 ms。
- 每轮测试结束后均确认没有 `forkline-browser-performance-*` 临时目录，也没有命令行包含该路径的残留 Edge 进程；既有 `127.0.0.1:5177` 服务未停止并仍打开 `D:/桌面/GitTest` 的 `123` 分支，GitTest 原有 1 个修改文件和 3 个未跟踪演示文件保持不变。

### Notes
- `tests/browser-performance.test.js`：新增零依赖 Chromium 启动、CDP 控制、真实性能断言、监听器检查和自动清理。
- `package.json`：增加 `test:browser`，默认 `npm test` 通过测试文件通配符自动包含浏览器回归。
- `README.md`：说明浏览器测试入口、浏览器缺失行为和自定义路径。
- `docs/CONTINUE.md`：记录回归边界、实测结果和 147/147 当前基线。
- `progress.md`：追加本轮实现、验证、资源清理和回滚方式。
- 回滚方式：提交前执行 `git restore -- README.md docs/CONTINUE.md package.json progress.md`，再执行 `Remove-Item -LiteralPath tests/browser-performance.test.js`；提交后执行 `git revert <本任务提交哈希>`。

## 2026-08-06 - Task: 危险历史操作一键撤销

### What was done
- 对已经返回自动恢复点的追加提交、修改提交信息、变基拉取、分支变基、历史编辑和重置操作增加顶栏“撤销”入口，直接恢复到操作前的提交位置。
- 一键撤销状态绑定仓库路径、当前分支和操作后 HEAD；上下文变化时自动失效，工作区有未提交改动或仓库有未完成操作时禁用并保留恢复点提示。
- 继续复用受保护的恢复点恢复接口和子模块边界，不把没有恢复点的工作区丢弃、合并、挑选或还原伪装成可撤销。
- 修改提交信息结果补充结构化恢复点，供前端与其他历史操作使用同一撤销流程。

### Testing
- `node --check` 通过新增恢复模块、Git 动作、历史动作、中英文目录、后端历史服务、操作门面和新增测试文件。
- `node --test --test-concurrency=1 tests/recovery-undo-ui.test.js` 运行 2 项，2 项通过、0 项失败；覆盖仓库 / 分支 / HEAD 绑定、脏工作区禁用和受保护恢复请求。
- `node --test --test-concurrency=1 tests/git-api.test.js` 运行 26 项，26 项通过、0 项失败；真实临时 Git 仓库验证 hard reset 返回恢复点、一键恢复后 HEAD 和文件内容回到操作前，以及修改提交信息返回结构化恢复点。
- `node --test --test-concurrency=1 tests/i18n.test.js tests/layout-ui.test.js tests/recovery-undo-ui.test.js` 运行 40 项，40 项通过、0 项失败。
- `npm.cmd test` 完整运行 149 项，149 项通过、0 项失败、0 项跳过，耗时约 106.8 秒；真实 Chromium 复杂文件打开约 187.7 ms、最大事件循环延迟约 71.6 ms、同步滚动约 8.0 ms、关闭约 0.5 ms，监听器保持 `3 -> 4 -> 5 -> 5 -> 4`。
- 临时 `5298` 服务已关闭，端口确认无监听；测试浏览器和临时仓库已关闭或自动清理，`D:\桌面\GitTest` 未参与本轮修改或测试。

### Notes
- `public/index.html`：在顶栏工具组增加默认隐藏的撤销按钮，并加载独立恢复撤销模块。
- `public/js/core.js`：增加最近恢复撤销状态和按钮 DOM 引用。
- `public/js/features/recovery-undo.js`：实现恢复点登记、上下文校验、按钮状态和一键恢复。
- `public/js/features/git-actions.js`：追加、变基拉取、分支变基和修改提交信息完成后登记恢复点。
- `public/js/features/commit-actions.js`：历史编辑、历史编辑队列和重置完成后登记恢复点。
- `public/js/features/repositories.js`：切换仓库时清除旧仓库的一键撤销状态。
- `public/js/features/worktree-changes.js`：工作区刷新后同步撤销按钮禁用状态。
- `public/js/app/events.js`：绑定顶栏撤销入口。
- `public/styles.css`：增加紧凑撤销按钮的正常、悬停、禁用和隐藏样式。
- `public/js/i18n-catalog.js`：补充撤销状态、阻塞原因和恢复动作英文提示。
- `server/git-history-service.js`、`server/git-operations-service.js`：让修改提交信息返回结构化恢复点结果。
- `tests/recovery-undo-ui.test.js`、`tests/git-api.test.js`：增加前端状态和真实 Git 恢复流程回归。
- `README.md`、`docs/CONTINUE.md`：说明一键撤销范围、失效条件和恢复点边界。
- `progress.md`：追加本轮实现、验证、资源清理和回滚方式。
- 回滚方式：提交前执行 `git restore -- README.md docs/CONTINUE.md progress.md public/index.html public/js/app/events.js public/js/core.js public/js/features/commit-actions.js public/js/features/git-actions.js public/js/features/repositories.js public/js/features/worktree-changes.js public/js/i18n-catalog.js public/styles.css server/git-history-service.js server/git-operations-service.js tests/git-api.test.js`，再执行 `Remove-Item -LiteralPath public/js/features/recovery-undo.js,tests/recovery-undo-ui.test.js`；提交后执行 `git revert <本任务提交哈希>`。

## 2026-08-06 - Task: 系统凭据与远端诊断入口

### What was done
- 同步页认证助手增加 Windows 系统凭据入口，非 Windows 明确显示不支持；入口只打开固定的系统 Credential Manager，不读取、修改或删除凭据。
- 认证结果增加远端托管平台识别；认证卡片可直接检查每个远端的网络与认证状态，并为 GitHub、GitLab、Bitbucket 提供平台状态页。
- 补齐中英文响应、窄侧栏换行和固定操作区宽度，避免“提示 / 重新检测”及系统凭据按钮被压缩或溢出。

### Testing
- `node --check` 通过 `server.js`、认证服务、同步面板、事件绑定、中英文目录和新增 UI 测试。
- 定向服务、UI 与 i18n 回归运行 13 项，13 项通过、0 项失败；系统凭据启动使用注入替身，没有在自动测试中打开系统窗口。
- `npm.cmd test` 完整运行 152 项，152 项通过、0 项失败、0 项跳过，耗时约 108.5 秒；真实 Chromium 复杂文件打开约 172.1 ms、最大事件循环延迟约 53.5 ms、监听器保持 `3 -> 4 -> 5 -> 5 -> 4`。
- 真实页面打开当前 Forkline 仓库验收：约 `1910×1075` 和竖屏覆盖下页面横向溢出均为 0；认证卡内部横向溢出由 5px 修正为 0，系统凭据、检查连接和平台状态入口均可见，控制台无错误。
- 临时 `5299` 服务和浏览器测试标签已关闭，端口确认无监听；未使用或修改 `D:\桌面\GitTest`。

### Notes
- `server/repository-auth-service.js`：增加系统凭据平台边界、固定 Windows 启动器、远端托管平台和状态页识别。
- `server/repository-service.js`、`server.js`：接入受仓库上下文保护的系统凭据 API，并补齐英文响应字段。
- `public/js/panels/sync.js`、`public/js/app/events.js`：增加系统凭据、远端连接和平台状态入口及交互。
- `public/styles.css`：增加认证远端紧凑操作布局，并修复窄侧栏操作区压缩。
- `public/js/i18n-catalog.js`：补充系统凭据和远端平台相关英文文本。
- `tests/backend-services.test.js`、`tests/git-api.test.js`、`tests/auth-ui.test.js`：覆盖 Windows/非 Windows 边界、平台识别、英文 API 和前端入口。
- `README.md`、`docs/ARCHITECTURE.md`、`docs/CONTINUE.md`：记录使用方式、安全边界、接口结构、验证结果和后续优化顺序。
- `progress.md`：追加本轮实现、验证、资源清理和回滚方式。
- 回滚点为 `a99eabe`；提交前可执行 `git restore -- README.md docs/ARCHITECTURE.md docs/CONTINUE.md progress.md public/js/app/events.js public/js/i18n-catalog.js public/js/panels/sync.js public/styles.css server.js server/repository-auth-service.js server/repository-service.js tests/backend-services.test.js tests/git-api.test.js`，再执行 `Remove-Item -LiteralPath tests/auth-ui.test.js`；本任务提交位于 HEAD 时可执行 `git revert --no-edit HEAD`。

## 2026-08-06 - Task: 按仓库保存恢复点策略并增加操作后整理提醒

### What was done
- 将恢复点保留策略从浏览器全局值改为按规范化仓库路径隔离保存，并在首次打开真实仓库时迁移旧的全局策略；仓库首次加载和切换时立即应用各自偏好。
- 在“恢复点”和“设置”页增加“操作后提醒整理”复选框；只有危险历史操作成功并返回自动恢复点后才检查候选，确认框会列出策略、保留数量和候选预览，不会静默删除。
- 保持后端现有候选 ref + SHA 重新计算与一致性校验，示例仓库不执行操作后整理；补齐中英文文案和窄侧栏自适应布局。

### Testing
- `node --check` 通过恢复设置、撤销、事件、初始化、仓库切换和新增测试脚本；定向运行 `tests/recovery-policy-ui.test.js` 与 `tests/recovery-undo-ui.test.js` 共 5 项，5 项通过。
- `npm.cmd test` 完整运行 155 项，155 项通过、0 项失败、0 项跳过，耗时约 102.7 秒；真实 Chromium 复杂文件打开约 232.7 ms、最大事件循环延迟约 92.7 ms，监听器保持 `3 -> 4 -> 5 -> 5 -> 4` 回落。
- 临时 `C:\tmp\forkline-recovery-policy-ui-*` 仓库包含 2 条恢复点和 1 条清理候选；真实页面验证设置页、恢复点页、复选框、候选预览和清理确认框。普通侧栏及约 `710px` CSS 宽的窄竖屏下页面和右栏横向溢出均为 0，控制台无错误；取消确认后 2 条恢复点仍存在。
- 临时 `5299` 服务、浏览器标签和测试仓库均已关闭或删除；端口确认无监听，未使用或修改 `D:\桌面\GitTest`。

### Notes
- `public/js/core.js`：增加操作后整理偏好和当前策略仓库路径状态。
- `public/js/app/init.js`、`public/js/features/repositories.js`：首次加载和切换仓库时读取该仓库的恢复策略。
- `public/js/panels/recovery-settings.js`：实现版本化按仓库存储、旧数据迁移、复选框、候选确认文本和操作后检查流程。
- `public/js/features/recovery-undo.js`、`public/js/app/events.js`：危险操作登记恢复点后触发策略检查，并正确读取复选框状态。
- `public/js/i18n-catalog.js`、`public/styles.css`：补齐中英文提示和窄侧栏复选框布局。
- `tests/recovery-policy-ui.test.js`、`tests/recovery-undo-ui.test.js`：覆盖仓库隔离、迁移、取消不删除、示例仓库边界和撤销触发。
- `README.md`、`docs/ARCHITECTURE.md`、`docs/CONTINUE.md`：记录使用方式、存储结构、安全边界、验证结果和下一步顺序。
- `progress.md`：追加本轮实现、验证、资源清理和回滚方式。
- 回滚点为 `eb9f39b`；提交前可执行 `git restore -- README.md docs/ARCHITECTURE.md docs/CONTINUE.md progress.md public/js/app/events.js public/js/app/init.js public/js/core.js public/js/features/recovery-undo.js public/js/features/repositories.js public/js/i18n-catalog.js public/js/panels/recovery-settings.js public/styles.css tests/recovery-undo-ui.test.js`，再执行 `Remove-Item -LiteralPath tests/recovery-policy-ui.test.js`；本任务提交位于 HEAD 时可执行 `git revert --no-edit HEAD`。
- 最终补充启动/切换仓库接线回归后，定向测试为 6/6，完整 `npm.cmd test` 为 156/156，耗时约 102.4 秒；真实 Chromium 复杂文件打开约 170.2 ms、最大事件循环延迟约 52.0 ms，本条结果取代上方施工过程中记录的 5/5 与 155/155 中间值。

## 2026-08-06 - Task: 大仓库提交图可视区域渲染

### What was done
- 使用独立真实 Git 压力夹具测量大仓库瓶颈：通过 `git fast-import` 创建 3012 条包含侧分支和 merge 的提交，并创建 4000 个分层工作区文件，分别记录 API、前端渲染、DOM 和事件循环指标。
- 确认提交图完整重建是主要瓶颈后，对超过 240 条的提交历史启用可视区域渲染，只保留当前窗口及上下各 12 行缓冲，同时保留完整滚动高度、搜索数据和加载上限。
- SVG 图谱只生成与当前窗口相交的分支线、merge 回线、节点和标签；滚动、窗口变化、底部工作台拉伸和图谱列宽调整会按帧刷新当前窗口。
- 保留点击、右键、搜索、跳转视口外提交和“加载更早提交”行为；跳转到未渲染提交时会滚动并立即生成目标行，加载更多后继续保持原滚动位置。
- 4000 文件树前端渲染实测不是主要瓶颈，本轮未引入没有数据依据的文件树虚拟化，也未改变工作区 Git 语义。

### Testing
- `node --check` 通过 `public/js/features/history-list.js`、`public/js/features/graph.js`、`public/js/app/events.js`、`public/js/app/layout-utils.js` 和 `tests/browser-performance.test.js`；`git diff --check` 通过，仅有现有 LF / CRLF 转换提示。
- `node --test --test-concurrency=1 tests/commit-selection-performance.test.js tests/layout-ui.test.js` 运行 41 项，41 项通过、0 项失败。
- `npm.cmd run test:browser` 运行 1 项，1 项通过：3012 条提交只保留 17 行、105 个图谱元素和约 954 个页面节点；渲染约 5.2 ms、搜索约 5.2 ms、恢复约 4.1 ms。中段窗口最多 29 行，连续 80 次深度滚动约 1335.1 ms、最大延迟约 11.7 ms；360 条加载到 480 条时滚动位置保持 `7200 -> 7200`。
- 最终 `npm.cmd test` 完整运行 156 项，156 项通过、0 项失败、0 项跳过，耗时约 113.3 秒；真实 Chromium 中大历史渲染约 5.1 ms、搜索约 6.2 ms、恢复约 5.5 ms，连续滚动最大延迟约 5.2 ms。普通文件对照监听器保持 `3 -> 4 -> 5 -> 5 -> 4` 回落。
- 最终资源检查确认 `forkline-browser-performance-*` 临时目录为 0，相关 Node / Edge / Chrome 进程为 0；测试使用随机端口并自动关闭，没有使用或修改 `D:\桌面\GitTest`。

### Notes
- `public/js/features/history-list.js`：增加提交窗口范围、缓冲行、滚动调度、视口外提交定位和加载更多位置保持。
- `public/js/features/graph.js`：增加窗口化 SVG、跨窗口路径相交裁剪和局部节点/标签生成。
- `public/js/app/events.js`：绑定提交历史滚动和窗口尺寸变化刷新。
- `public/js/app/layout-utils.js`：底部工作台高度变化时同步刷新提交窗口。
- `public/styles.css`：增加提交窗口定位、稳定的全局奇偶行样式和绝对定位加载更多区。
- `tests/browser-performance.test.js`：增加真实大历史、大文件树、深度滚动、节点对齐、视口外选择和加载更多性能回归。
- `tests/layout-ui.test.js`：兼容窗口化 SVG 的位置与高度样式，同时继续校验图谱列宽。
- `README.md`：说明大历史自动使用可视区域渲染。
- `docs/CONTINUE.md`：记录压力基线、优化结果、文件树不改的依据和后续边界。
- `progress.md`：追加本轮实现、验证、资源清理和回滚方式。
- 回滚点为 `76d5cba`；提交前可执行 `git restore -- README.md docs/CONTINUE.md progress.md public/js/app/events.js public/js/app/layout-utils.js public/js/features/graph.js public/js/features/history-list.js public/styles.css tests/browser-performance.test.js tests/layout-ui.test.js`；本任务提交位于 HEAD 时可执行 `git revert --no-edit HEAD`。
- 最终补充提交行交替底色回归后，`npm.cmd run test:browser` 仍为 1/1；当前代码完整 `npm.cmd test` 为 156/156，耗时约 117.8 秒，大历史渲染约 5.2 ms、搜索约 5.7 ms、恢复约 5.1 ms，连续滚动最大延迟约 6.9 ms。本条结果取代上方施工过程中记录的 113.3 秒完整回归数据；最终资源检查仍为临时目录 0、相关进程 0。

## 2026-08-06 - Task: 仓库反复切换与编辑器长时间稳定性

### What was done
- 在真实 Chromium 性能回归中增加第二个独立仓库，连续切换仓库 12 次，并连续开关历史文件编辑器 30 次；通过 CDP 记录 API 调用、窗口监听器、DOM 计数和强制 GC 后的 JS 堆。
- 打开仓库后继续保留 `/api/open` 返回的完整仓库状态，只用轻量 `/api/ref-state` 刷新当前分支的提交图谱和分页信息，避免再次读取工作区、分支、远端、Tag、储藏、同步、工作树和子模块。
- 保留仓库打开请求序号保护；旧仓库的轻量响应不能覆盖后来打开的仓库，并增加局部合并回归确保完整工作区状态不会丢失。

### Testing
- 修改实现前，新增的定向回归稳定失败，实际请求为 `/api/state?ref=main`；修改后同一回归通过，请求变为 `/api/ref-state?ref=main`，完整仓库字段保持原对象。
- `npm.cmd run test:browser` 运行 1 项，1 项通过：12 次仓库切换约从 `20389.4 ms` 降到 `11448.6 ms`，API 计数为 `open/state-ref/ref-state/commit = 12/0/12/12`；编辑器开关 30 次约 `3132.8 ms`，`resize` 监听器保持 `4 -> 4`，DOM `documents/nodes/listeners` 保持 `1/2051/139 -> 1/2051/139`，GC 后堆约 `3.2 MiB -> 3.5 MiB`。
- `node --check` 通过仓库切换脚本、浏览器压力测试和布局测试；最终 `npm.cmd test` 完整运行 157 项，157 项通过、0 项失败、0 项跳过，耗时约 130.4 秒。完整回归中的 12 次切换约 `11393.8 ms`，稳定性计数与定向压力测试一致。
- 浏览器测试使用随机端口和系统临时目录；测试结束后服务、浏览器进程和临时仓库由回归清理逻辑关闭或删除，没有使用或修改 `D:\桌面\GitTest`。

### Notes
- `public/js/features/repositories.js`：仓库打开后使用轻量引用状态并局部合并提交图数据。
- `tests/browser-performance.test.js`：增加双仓库切换、编辑器长时间开关、API 计数、DOM、监听器和堆边界回归。
- `tests/layout-ui.test.js`：验证轻量请求和完整仓库状态保留。
- `README.md`：简要说明切换仓库不会重复读取完整状态。
- `docs/CONTINUE.md`：记录接口边界、性能实测、稳定性指标和当前测试基线。
- `progress.md`：追加本轮实现、验证、资源清理和回滚方式。
- 回滚点为 `23cf952`；提交前可执行 `git restore -- README.md docs/CONTINUE.md progress.md public/js/features/repositories.js tests/browser-performance.test.js tests/layout-ui.test.js`；本任务提交位于 HEAD 时可执行 `git revert --no-edit HEAD`。

## 2026-08-06 - Task: 完善在线更新进度与失败恢复状态

### What was done
- 将一键更新过程拆成准备、停止旧服务、重新校验、写入版本、重启和健康检查 6 个可见阶段；浏览器在服务重启断线期间显示重新连接，并在新服务恢复后继续读取状态。
- 为失败结果增加失败阶段、文件回退状态和服务恢复状态；预检失败明确说明文件未修改，写入后失败会区分完成回退、回退失败、额外 HEAD 变化阻止回退和服务未恢复。
- 恢复过程保持非终态，等待回退和备用服务健康检查完成后再发布最终结果；保留原有布尔回退接口兼容性，并让最后一次失败结果跨服务重启继续显示。
- 设置页增加六阶段进度条、阶段计数、失败标题和独立恢复结论，补齐中英文文案与窄屏布局。

### Testing
- `node --test --test-concurrency=1 tests/i18n.test.js tests/layout-ui.test.js tests/app-self-update.test.js` 运行 47 项，47 项通过、0 项失败。
- `npm.cmd test` 完整运行 158 项，158 项通过、0 项失败、0 项跳过，耗时约 132.9 秒；真实 Chromium 复杂历史文件打开约 186.7 ms、最大事件循环延迟约 44.3 ms，12 次仓库切换约 10.8 秒，编辑器连续开关后监听器、DOM 和堆边界保持稳定。
- `node --check` 通过全部修改的 JavaScript 文件；`git diff --check` 通过，仅显示仓库现有 LF / CRLF 转换提示。
- 真实 Edge 已验证约 `1029x742` 与 `760x900` 视口下更新卡片、进度条、错误框和恢复框无横向溢出，预检失败会显示具体原因和“更新文件没有修改，原版本仍在运行”。
- 最终资源检查确认相关 Node / Edge / Chrome 进程为 0、`forkline-browser-performance-*` 临时目录为 0；未使用或修改 `D:\桌面\GitTest`。

### Notes
- `app-self-update.js`、`self-update-runner.js`：增加六阶段状态、结构化恢复结果、非终态恢复过程和更新器异常状态。
- `server/update-service.js`、`server.js`：记录预检失败状态，并随 API 错误返回结构化更新结果。
- `public/js/core.js`、`public/js/app/init.js`：保存安装阶段、轮询重连、最终失败结果和恢复文案。
- `public/js/panels/recovery-settings.js`、`public/styles.css`：增加设置页进度、失败与恢复结果布局。
- `public/js/i18n-catalog.js`：补齐在线更新阶段和恢复状态英文文案。
- `tests/app-self-update.test.js`、`tests/layout-ui.test.js`：覆盖预检未写入、六阶段完成、回退/服务状态和设置页展示。
- `README.md`、`docs/ARCHITECTURE.md`、`docs/CONTINUE.md`：记录使用方式、状态契约、安全边界、验证基线和后续优化顺序。
- `progress.md`：追加本轮实现、验证、资源清理和回滚方式。
- 回滚点为 `c99a641`；提交前可执行 `git restore -- README.md app-self-update.js self-update-runner.js server.js server/update-service.js public/js/core.js public/js/app/init.js public/js/panels/recovery-settings.js public/js/i18n-catalog.js public/styles.css tests/app-self-update.test.js tests/layout-ui.test.js docs/ARCHITECTURE.md docs/CONTINUE.md progress.md`；本任务提交位于 HEAD 时可执行 `git revert --no-edit HEAD`。

## 2026-08-06 - Task: 拆分 Tag、恢复点、日志和设置面板模块

### What was done
- 将原本同时承载 Tag、恢复点、reflog、操作日志、设置和在线更新的 `recovery-settings.js` 按现有标签页拆成四个独立脚本，不改函数内容、全局入口、状态结构或 Git 请求。
- `tags.js` 负责 Tag 列表、详情和远端操作；`recovery.js` 负责恢复点、reflog、保留策略和相关动作；`logs.js` 负责运行中与历史 Git 操作；`settings.js` 负责主题、语言、最近仓库、布局和在线更新。
- 更新浏览器脚本加载顺序，四个面板模块和恢复点撤销模块继续在统一事件绑定之前加载；新增回归固定该顺序并拒绝旧合并脚本重新进入运行时清单。

### Testing
- `node --check` 通过四个新面板脚本和四个受影响测试文件；受影响专项回归运行 45 项，45 项通过、0 项失败。
- `npm.cmd test` 完整运行 159 项，159 项通过、0 项失败、0 项跳过，耗时约 131.1 秒；真实 Chromium 成功加载新脚本，复杂历史文件打开约 186.3 ms、最大事件循环延迟约 43.3 ms，监听器保持 `3 -> 4 -> 5 -> 5 -> 4` 回落。
- 大历史仍只渲染 17 行和 105 个图谱元素；12 次仓库切换约 12.5 秒，编辑器连续开关后 DOM、监听器和堆边界保持稳定。
- `git diff --check` 通过，仅显示仓库现有 LF / CRLF 转换提示。最终资源检查确认相关 Node / Edge / Chrome 进程为 0、性能测试临时目录为 0、机械拆分脚本已删除；未使用或修改 `D:\桌面\GitTest`。

### Notes
- `public/js/panels/tags.js`：承接 Tag 面板、选择、确认和远端操作。
- `public/js/panels/recovery.js`：承接恢复点、reflog、保留策略和恢复动作。
- `public/js/panels/logs.js`：承接运行中操作、历史日志、取消和刷新。
- `public/js/panels/settings.js`：承接设置页、主题/语言/最近仓库和在线更新。
- `public/js/panels/recovery-settings.js`：删除已拆分的旧合并模块。
- `public/index.html`：按新模块边界更新经典脚本加载顺序。
- `tests/layout-ui.test.js`、`tests/recovery-policy-ui.test.js`、`tests/reflog-ui-state.test.js`、`tests/themes.test.js`：读取对应模块并固定加载顺序、恢复策略、reflog、日志、设置和主题行为。
- `docs/ARCHITECTURE.md`、`docs/CONTINUE.md`：更新面板职责、权威加载顺序、测试基线和后续拆分顺序。
- `progress.md`：追加本轮实现、验证、资源清理和回滚方式。
- 回滚点为 `dedd433`；提交前可执行 `git restore -- docs/ARCHITECTURE.md docs/CONTINUE.md progress.md public/index.html public/js/panels/recovery-settings.js tests/layout-ui.test.js tests/recovery-policy-ui.test.js tests/reflog-ui-state.test.js tests/themes.test.js`，再执行 `Remove-Item -LiteralPath public/js/panels/tags.js,public/js/panels/recovery.js,public/js/panels/logs.js,public/js/panels/settings.js`；本任务提交位于 HEAD 时可执行 `git revert --no-edit HEAD`。

## 2026-08-06 - Task: 拆分储藏、同步、比较和认证面板模块

### What was done
- 保留轻量同步刷新、同步摘要、upstream 控制和提交预览在 `sync.js`，将储藏、分支/引用比较、远端与认证诊断分别移动到独立脚本。
- 保持全部函数内容、全局入口、状态结构、API 路径和 Git 操作不变；`refreshSyncState()` 继续由原文件提供，调用方不需要适配。
- 更新经典脚本加载顺序，并扩充右侧面板边界回归，固定四个模块必须先于统一事件绑定加载。

### Testing
- `node --check` 通过四个同步相关面板脚本和四个受影响测试文件；专项回归运行 46 项，46 项通过、0 项失败。
- `npm.cmd test` 完整运行 159 项，159 项通过、0 项失败、0 项跳过，耗时约 126.9 秒；真实 Chromium 成功加载新脚本，复杂历史文件打开约 196.4 ms、最大事件循环延迟约 55.8 ms。
- 大历史保持 17 行和 105 个图谱元素；12 次仓库切换约 9.5 秒，编辑器连续开关后监听器、DOM 和堆边界保持稳定。
- `git diff --check` 通过，仅显示仓库现有 LF / CRLF 转换提示。最终资源检查确认相关 Node / Edge / Chrome 进程为 0、性能测试临时目录为 0、机械拆分脚本已删除；未使用或修改 `D:\桌面\GitTest`。

### Notes
- `public/js/panels/stashes.js`：承接储藏列表、详情、应用、弹出、删除和从储藏创建分支。
- `public/js/panels/auth.js`：承接远端列表、认证诊断、连接入口、平台状态页和系统凭据入口。
- `public/js/panels/sync.js`：只保留轻量同步状态、同步建议、upstream 和提交预览。
- `public/js/panels/compare.js`：承接引用选择、交换、比较结果和提交列表。
- `public/index.html`：按新同步模块边界更新经典脚本加载顺序。
- `tests/layout-ui.test.js`、`tests/auth-ui.test.js`、`tests/worktree-refresh.test.js`：固定模块职责、认证入口和储藏轻量刷新；`tests/sync-state-performance.test.js` 继续直接覆盖核心同步模块。
- `docs/ARCHITECTURE.md`、`docs/CONTINUE.md`：更新面板职责、权威加载顺序、验证结果和下一项优化。
- `progress.md`：追加本轮实现、验证、资源清理和回滚方式。
- 回滚点为 `2668902`；提交前可执行 `git restore -- docs/ARCHITECTURE.md docs/CONTINUE.md progress.md public/index.html public/js/panels/sync.js tests/auth-ui.test.js tests/layout-ui.test.js tests/worktree-refresh.test.js`，再执行 `Remove-Item -LiteralPath public/js/panels/stashes.js,public/js/panels/auth.js,public/js/panels/compare.js`；本任务提交位于 HEAD 时可执行 `git revert --no-edit HEAD`。

## 2026-08-06 - Task: 拆分文件编辑器核心、动作、窗口、查找和工具模块

### What was done
- 保留文件打开、数据加载、保存和 CodeMirror 初始化在 `file-editor.js`，将暂存/还原动作、浮窗生命周期、查找替换和内容工具分别移动到独立脚本。
- 将搜索数量、窗口尺寸和复杂文件轻量路径阈值常量移动到实际使用模块；拖拽和缩放状态只保留在窗口生命周期模块。
- 保持现有全局函数名、状态结构、Git hunk/行映射、API 请求和浏览器交互不变，并用脚本顺序断言固定五个模块在仓库切换和事件绑定之前加载。

### Testing
- `node --check` 通过五个文件编辑器模块和编辑器 UI 测试；`tests/file-editor-ui.test.js` 运行 29 项，29 项通过、0 项失败。
- `npm.cmd test` 完整运行 159 项，159 项通过、0 项失败、0 项跳过，耗时约 124.9 秒；真实 Chromium 复杂历史文件打开约 168.3 ms、最大事件循环延迟约 50.6 ms。
- 连续开关编辑器 30 次约 2.7 秒，`resize` 监听器保持 `4 -> 4`，DOM `documents/nodes/listeners` 保持 `1/2071/139 -> 1/2071/139`，GC 后堆约 `3.2 MiB -> 3.6 MiB`。
- `git diff --check` 通过，仅显示仓库现有 LF / CRLF 转换提示。最终资源检查确认相关 Node / Edge / Chrome 进程为 0、性能测试临时目录为 0、机械拆分脚本已删除；未使用或修改 `D:\桌面\GitTest`。

### Notes
- `public/js/features/file-editor-utils.js`：承接文件模式、内容标准化、轻量对照判断和格式化工具。
- `public/js/features/file-editor-actions.js`：承接双栏轻量对照、暂存块/选中行、右键还原和 Git 动作刷新。
- `public/js/features/file-editor-window.js`：承接视图状态、拖动/拉伸、ResizeObserver、实例销毁、状态和标签。
- `public/js/features/file-editor-search.js`：承接查找、匹配标记、上一处/下一处和单个/全部替换。
- `public/js/features/file-editor.js`：只保留编辑器核心打开、加载、保存和 CodeMirror 初始化。
- `public/index.html`、`tests/file-editor-ui.test.js`：更新脚本顺序并固定五个模块职责和原有交互回归。
- `docs/ARCHITECTURE.md`、`docs/CONTINUE.md`：更新编辑器职责、权威加载顺序、验证结果和下一项优化。
- `progress.md`：追加本轮实现、验证、资源清理和回滚方式。
- 回滚点为 `f9f6f6f`；提交前可执行 `git restore -- docs/ARCHITECTURE.md docs/CONTINUE.md progress.md public/index.html public/js/features/file-editor.js tests/file-editor-ui.test.js`，再执行 `Remove-Item -LiteralPath public/js/features/file-editor-utils.js,public/js/features/file-editor-actions.js,public/js/features/file-editor-window.js,public/js/features/file-editor-search.js`；本任务提交位于 HEAD 时可执行 `git revert --no-edit HEAD`。

## 2026-08-06 - Task: 拆分 Diff 工作台文件树、渲染、行操作和工作区刷新模块

### What was done
- 将工作区/暂存区/提交文件树及原地选择移动到 `file-tree.js`，将双栏 Diff、分批渲染和块级按钮移动到 `diff-renderer.js`，核心 `diff-workbench.js` 只保留数据加载、视图切换和最大化弹窗编排。
- 将按行选择、暂存/取消暂存和滚动恢复移动到 `diff-selection.js`，将工作区签名、轻量刷新和页面焦点/可见性轮询移动到 `worktree-refresh.js`。
- 把远端分支解析与签出入口归回分支模块，保持全局函数名、状态结构、API 请求、Git hunk/行映射和操作行为不变，并用回归固定五个模块的加载顺序与职责边界。

### Testing
- `node --check` 通过五个 Diff 工作台模块、分支模块和四个受影响测试文件；专项回归运行 44 项，44 项通过、0 项失败。
- `npm.cmd test` 完整运行 159 项，159 项通过、0 项失败、0 项跳过，耗时约 130.5 秒；真实 Chromium 复杂历史文件打开约 206.5 ms、最大事件循环延迟约 64.9 ms。
- 4000 文件工作区 API 约 552.8 ms、前端树渲染约 43.1 ms；连续开关编辑器 30 次约 3.1 秒，`resize` 监听器保持 `4 -> 4`，DOM、监听器和 GC 后堆边界稳定。
- `git diff --check` 通过，仅显示仓库现有 LF / CRLF 转换提示。最终资源检查确认相关 Node / Edge / Chrome 进程为 0、性能测试临时目录为 0、机械拆分脚本已删除；未使用或修改 `D:\桌面\GitTest`。

### Notes
- `public/js/features/file-tree.js`：承接工作区、暂存区和提交文件树、原地选择及文件名工具。
- `public/js/features/diff-renderer.js`：承接双栏 Diff、分批渲染、块级按钮及 Diff 路径工具。
- `public/js/features/diff-workbench.js`：只保留 Diff 数据加载、视图切换、最大化弹窗和工作台编排。
- `public/js/features/diff-selection.js`：承接按行选择、暂存/取消暂存和刷新后的滚动恢复。
- `public/js/features/worktree-refresh.js`：承接工作区签名、轻量刷新和焦点/可见性轮询。
- `public/js/features/branches.js`：承接远端分支引用拆分与签出入口。
- `public/index.html`、`tests/commit-selection-performance.test.js`、`tests/diff-preview.test.js`、`tests/file-editor-ui.test.js`、`tests/worktree-refresh.test.js`：更新运行时加载顺序和模块职责回归。
- `docs/ARCHITECTURE.md`、`docs/CONTINUE.md`：记录五个模块职责、权威加载顺序、验证结果和下一项性能测量方向。
- `progress.md`：追加本轮实现、验证、资源清理和回滚方式。
- 回滚点为 `4f9547b`；提交前可执行 `git restore -- docs/ARCHITECTURE.md docs/CONTINUE.md progress.md public/index.html public/js/features/branches.js public/js/features/diff-workbench.js tests/commit-selection-performance.test.js tests/diff-preview.test.js tests/file-editor-ui.test.js tests/worktree-refresh.test.js`，再执行 `Remove-Item -LiteralPath public/js/features/file-tree.js,public/js/features/diff-renderer.js,public/js/features/diff-selection.js,public/js/features/worktree-refresh.js`；本任务提交位于 HEAD 时可执行 `git revert --no-edit HEAD`。

## 2026-08-06 - Task: 优化大工作区状态读取与文件快照性能

### What was done
- 用独立临时仓库分段测量 4000 文件工作区，确认主要成本来自逐文件快照，并复现全部路径一次传给 `git ls-files` 时 Windows 返回 `ENAMETOOLONG`。
- 未跟踪路径不再查询索引；已跟踪路径按 24 KiB 参数上限分批，最多并行 4 个只读查询，避免大量修改文件时索引快照静默缺失。
- 文件元数据与内容 SHA-256 改为最多 32 路受限并发，缓存容量从 2048 提高到 8192；返回结构、工作区签名、内容哈希和 Git 操作快照语义保持不变。
- 真实 Chromium 性能回归增加同一 4000 文件工作区的冷 API 和紧接着的热 API，并确认两次文件数与工作区快照一致。

### Testing
- `node --check` 通过 `server.js`、工作区服务和两个受影响测试文件；工作区/后端专项回归运行 9 项，9 项通过、0 项失败。
- 独立 4000 个未跟踪文件基准中，原实现 2048 项缓存的冷/热读取约为 567.3/538.1 ms；优化后 8192 项缓存约为 407.7-417.1/248.0-258.7 ms。
- 独立 1600 个已跟踪修改文件基准中，原始单命令路径列表稳定触发 `ENAMETOOLONG`；优化后的分批查询无错误，冷/热结果均为 1600 个文件且快照一致。
- `npm.cmd run test:browser` 真实 Chromium 专项通过；完整 `npm.cmd test` 运行 161 项，161 项通过、0 项失败、0 项跳过，耗时约 139.2 秒。最终 4000 文件冷 API 约 433.7 ms、热 API 约 266.7 ms、前端树渲染约 39.8 ms；复杂历史文件打开约 325.1 ms、最大事件循环延迟约 61.3 ms。
- 仓库反复切换约 9.7 秒，编辑器连续开关 30 次约 3.4 秒，`resize` 监听器保持 `4 -> 4`，DOM 和 GC 后堆边界稳定。

### Notes
- `server.js`：将工作区文件快照 LRU 上限提高到 8192。
- `server/repository-worktree-service.js`：过滤未跟踪索引路径、按安全长度分批读取已跟踪索引，并发生成内容快照。
- `tests/worktree-refresh.test.js`：覆盖未跟踪路径过滤、Windows 命令长度边界和异步快照缓存。
- `tests/browser-performance.test.js`：增加 4000 文件冷/热 API 与快照一致性回归。
- `docs/ARCHITECTURE.md`、`docs/CONTINUE.md`：记录性能边界、实现约束、实测结果和后续优化顺序。
- `progress.md`：追加本轮实现、验证、资源清理和回滚方式。
- 回滚点为 `70848e1`；提交前可执行 `git restore -- server.js server/repository-worktree-service.js tests/worktree-refresh.test.js tests/browser-performance.test.js docs/ARCHITECTURE.md docs/CONTINUE.md progress.md`；本任务提交位于 HEAD 时可执行 `git revert --no-edit HEAD`。

## 2026-08-06 - Task: 验证真实 Release 升级并增加下载字节进度与瞬时重试

### What was done
- 在独立浅层官方仓库中，从带应用内 updater 的 `0.2.0` 历史提交真实更新到 GitHub Release `v0.2.1`，验证旧服务退出、新服务恢复、HEAD/版本/分支/工作区和候选引用清理。
- 根据真实 fetch 约 18.8 秒的瓶颈，在准备阶段解析 Git 对象百分比与已接收字节，并在安装 POST 等待期间向设置页持续提供状态。
- 对连接重置、超时、DNS/TLS、RPC/early EOF 等瞬时 fetch 失败增加最多 3 次有限重试；重试前清理候选引用，非瞬时错误和所有写入步骤保持原来的一次执行与安全停止规则。
- 前端每 250 ms 轮询准备状态，显示百分比、KiB/MiB、对象数量或重试次数；补齐英文文案，服务重启后的六阶段进度与失败恢复状态保持不变。

### Testing
- 真实官方升级：`c05f57c` / `0.2.0` 成功更新到 `v0.2.1` / `37a5b7c`；Release 检查约 0.7 秒、准备 fetch 约 18.8 秒、安装请求到新服务成功约 20.6 秒。
- 升级后 HEAD 与 Release Tag 一致、`package.json` 为 `0.2.1`、分支仍为 `main`、工作区干净、候选更新引用为空；新服务报告当前版本 `0.2.1` 且没有可用更新。测试 PID、状态文件和临时目录均已清理。
- 更新与布局专项回归运行 46 项，46 项通过；国际化回归运行 4 项，4 项通过。新增回归覆盖 Git fetch 百分比/字节解析、一次连接重置后成功重试、准备状态先于预检写入和前端等待期间轮询。
- `npm.cmd test` 完整运行 163 项，163 项通过、0 项失败、0 项跳过，耗时约 144.2 秒；真实 Chromium 复杂历史文件打开约 288.3 ms、最大事件循环延迟约 71.8 ms。
- 4000 文件冷/热 API 约 454.7/259.0 ms，前端树渲染约 45.7 ms；仓库浸泡切换约 10.5 秒，编辑器连续开关 30 次约 3.2 秒，`resize` 监听器保持 `4 -> 4`，DOM 和 GC 后堆边界稳定。

### Notes
- `app-self-update.js`：流式解析 Git fetch 进度、记录已接收字节，并为瞬时网络错误增加候选引用清理和有限重试。
- `server/update-service.js`：在预检/fetch 开始前写入准备状态，并持续保存结构化下载进度。
- `public/js/app/init.js`、`public/js/panels/settings.js`：格式化下载大小、生成中文进度文案，并在安装请求等待期间轮询状态。
- `public/js/i18n-catalog.js`：补齐下载、对象进度和重试英文文案。
- `tests/app-self-update.test.js`、`tests/layout-ui.test.js`：覆盖解析、重试、状态 API、安全边界和前端进度。
- `README.md`、`docs/ARCHITECTURE.md`、`docs/CONTINUE.md`：记录使用方式、实现边界、真实 Release 证据和当前验证限制。
- `progress.md`：追加本轮实现、验证、资源清理和回滚方式。
- 回滚点为 `0b26135`；提交前可执行 `git restore -- README.md app-self-update.js server/update-service.js public/js/app/init.js public/js/panels/settings.js public/js/i18n-catalog.js tests/app-self-update.test.js tests/layout-ui.test.js docs/ARCHITECTURE.md docs/CONTINUE.md progress.md`；本任务提交位于 HEAD 时可执行 `git revert --no-edit HEAD`。

## 2026-08-06 - Task: 收尾验证 Release 下载进度流

### What was done
- Git stderr 进度流只解析已经收到完整 CR/LF 结尾的行，进程结束时再处理最后一段，避免网络分块恰好落在百分比或字节数字中间时产生短暂错误进度。

### Testing
- `node --check app-self-update.js` 通过。
- 更新、布局、便携运行时和国际化专项合并运行 55 项，55 项通过。
- `npm.cmd test` 完整运行 163 项，163 项通过、0 项失败、0 项跳过，耗时约 144.8 秒；真实 Chromium 复杂历史文件打开约 320.1 ms、最大事件循环延迟约 111.7 ms。
- 4000 文件冷/热 API 约 613.4/353.7 ms，前端树渲染约 63.7 ms；测试结束后未发现命令行包含 `forkline-upload` 或 `server.js` 的 Node 进程。
- `git diff --check` 通过，仅显示仓库既有的 LF/CRLF 转换提醒。

### Notes
- `app-self-update.js`：保留不完整 stderr 分块并仅在完整进度行到达后解析。
- `progress.md`：追加最终回归和测试服务清理证据。
- 回滚点为 `0b26135`；提交前可执行 `git restore -- app-self-update.js progress.md`（只回滚本条收尾改动会同时丢失此前尚未提交的同文件改动，不建议拆分执行）；本任务提交位于 HEAD 时可执行 `git revert --no-edit HEAD`。

## 2026-08-06 - Task: 优化大工作区文件树监听与重复渲染

### What was done
- 将工作区、暂存区和右侧详情文件树改为根级 click/dblclick/contextmenu 事件委托；每个长期容器只绑定一次，容器重用时更新当前模式配置。
- 保留目录折叠、多选、双击编辑、历史文件双击对照和工作区右键菜单行为，并把工作区选中标记限制在两个变更容器内查询。
- 删除重复的 `renderWorkingFiles()` 计算和全部成对调用，工作区签名、筛选、计数与树渲染统一由一次 `renderStage()` 完成。
- 真实 Chromium 性能回归增加文件树新增监听器计数，锁定三次大列表重绘最多只补齐两个容器的 6 个根监听。

### Testing
- 修改前 4000 文件基线：冷/热 API 约 399.5/241.7 ms，树渲染约 35.4 ms、筛选约 16.9 ms、恢复约 38.9 ms、最大事件循环停顿约 329.8 ms，文件树约 16615 个节点。
- 修改后独立真实 Chromium 回归：冷/热 API 约 392.6/247.3 ms，树渲染约 31.7 ms、筛选约 17.4 ms、恢复约 33.4 ms、最大停顿约 317.9 ms，新增根监听 6 个。
- 文件树/工作区/布局专项运行 73 项，73 项通过；新增动态回归覆盖容器重复绑定、最新模式切换、工作区选择、双击编辑、右键菜单和目录折叠。
- `npm.cmd test` 完整运行 165 项，165 项通过、0 项失败、0 项跳过，耗时约 117.3 秒；其中 4000 文件完整回归冷/热 API 约 443.9/262.0 ms、树渲染约 32.3 ms、筛选约 16.1 ms、恢复约 32.8 ms、最大停顿约 310.7 ms、新增根监听 6 个。
- 完整回归中的复杂历史文件打开约 158.7 ms、最大事件循环延迟约 41.2 ms；仓库切换、编辑器监听器、DOM 和堆边界稳定。测试结束后未发现命令行包含 `forkline-upload` 或 `server.js` 的 Node 进程。

### Notes
- `public/js/features/file-tree.js`：增加容器级事件委托、最新模式配置和工作区范围内选中标记。
- `public/js/features/worktree-changes.js`、`public/js/app/init.js`、`public/js/features/git-actions.js`、`public/js/features/worktree-refresh.js`、`public/js/panels/stashes.js`：删除重复工作区渲染调用，只保留 `renderStage()`。
- `tests/file-editor-ui.test.js`、`tests/worktree-refresh.test.js`：覆盖委托监听复用、工作区/提交交互和单次渲染契约。
- `tests/browser-performance.test.js`：记录并限制大文件树重绘新增监听器数量。
- `docs/ARCHITECTURE.md`、`docs/CONTINUE.md`：记录事件委托边界、前后性能数据和下一项分批渲染方向。
- `progress.md`：追加本轮实现、验证、资源清理和回滚方式。
- 回滚点为 `818e729`；提交前可执行 `git restore -- public/js/features/file-tree.js public/js/features/worktree-changes.js public/js/app/init.js public/js/features/git-actions.js public/js/features/worktree-refresh.js public/js/panels/stashes.js tests/file-editor-ui.test.js tests/worktree-refresh.test.js tests/browser-performance.test.js docs/ARCHITECTURE.md docs/CONTINUE.md progress.md`；本任务提交位于 HEAD 时可执行 `git revert --no-edit HEAD`。

## 2026-08-06 - Task: 分批渲染大工作区文件树

### What was done
- 工作区与暂存区超过 800 个文件时只渲染首批，接近滚动底部或点击“继续显示”后按 800 个继续加载；两个区域分别保存显示上限，切换仓库时重置。
- 新批次按目录路径增量合并到现有文件树，不重建已显示节点；目录数量继续按完整文件集合计算，筛选和远处已选文件仍可直接显示。
- 保留目录折叠、多选、双击编辑、右键菜单、当前 Diff 和现有 Git 操作语义；文件树根节点增加一个被动 scroll 委托监听。
- 真实 Chromium 性能回归增加首批行数/节点数、筛选末尾文件、滚动加载完整列表、批次数和监听器边界。

### Testing
- `node --check public/js/features/file-tree.js` 与 `node --check public/js/features/worktree-changes.js` 通过。
- 文件编辑器、工作区刷新、布局和国际化专项运行 78 项，78 项通过、0 项失败。
- `npm.cmd run test:browser` 运行 1 项，1 项通过：4000 文件初始/最终行数 `800/4000`，初始/最终树节点 `3338/16615`，首批渲染约 `10.7 ms`、筛选约 `9.1 ms`、恢复约 `13.1 ms`，加载全部约 `484.7 ms / 4` 批，最大停顿约 `124.2 ms`，新增根监听 8 个；DOM document、节点和监听器保持 `1/2079/147 -> 1/2079/147`。
- `npm.cmd test` 完整运行 165 项，165 项通过、0 项失败、0 项跳过，耗时约 114.4 秒；其中 4000 文件首批渲染约 `10.2 ms`、筛选约 `6.8 ms`、恢复约 `9.2 ms`、加载全部约 `482.9 ms / 4` 批，最大停顿约 `128.7 ms`。
- 测试只使用随机端口和临时仓库；完成后未发现命令行包含 `forkline-upload` 或 `server.js` 的 Node 进程，未使用或修改 `D:\桌面\GitTest`。

### Notes
- `public/js/core.js`、`public/js/features/repositories.js`：保存并在切换仓库时重置工作区/暂存区显示上限。
- `public/js/features/file-tree.js`：增加完整目录计数、批次目录合并、继续显示按钮委托和底部滚动加载。
- `public/js/features/worktree-changes.js`：按区域切片渲染、维护批次上限并在增量加载时保留当前 Diff。
- `public/js/i18n-catalog.js`、`public/styles.css`：增加中英文加载文案和紧凑的继续显示按钮布局。
- `tests/browser-performance.test.js`、`tests/file-editor-ui.test.js`：覆盖批次规模、完整加载、末尾筛选和第四个根监听。
- `docs/ARCHITECTURE.md`、`docs/CONTINUE.md`：记录分批渲染边界、性能数据和当前大仓库结论。
- `progress.md`：追加本轮实现、验证、资源清理和回滚方式。
- 回滚点为 `2ab21be`；提交前可执行 `git restore -- public/js/core.js public/js/features/file-tree.js public/js/features/repositories.js public/js/features/worktree-changes.js public/js/i18n-catalog.js public/styles.css tests/browser-performance.test.js tests/file-editor-ui.test.js docs/ARCHITECTURE.md docs/CONTINUE.md progress.md`；本任务提交位于 HEAD 时可执行 `git revert --no-edit HEAD`。

## 2026-08-06 - Task: 增强冲突文件三栏编辑器

### What was done
- 冲突文件读取 Git index stage 2/3，分别提供当前版本和对方版本，并把真实工作区作为可编辑的合并结果。
- 普通冲突显示“当前版本 / 合并结果 / 对方版本”三栏，左右差异块可应用到中间；保存只写工作区，不自动暂存。
- 超长或差异复杂的冲突自动使用三个轻量 CodeMirror，并按滚动比例同步；关闭、切换文件或仓库时解除监听并清理旧实例。
- 修正冲突块按钮观察器的重复 DOM 写入，避免 MutationObserver 回调触发自身导致页面卡死。
- 真实浏览器性能回归增加小冲突应用与保存、25,000 行冲突滚动、连续开关和实例释放检查。

### Testing
- `node --check` 检查服务端、文件编辑器、国际化和测试脚本，全部通过。
- `node --test --test-name-pattern="worktree file editor returns current and incoming conflict versions" tests/git-api.test.js` 运行 1 项真实 Git 专项，1 项通过。
- `node --test --test-concurrency=1 tests/file-editor-ui.test.js tests/layout-ui.test.js tests/i18n.test.js` 运行 71 项，71 项通过。
- `npm.cmd run test:browser` 运行 1 项真实 Chromium 回归并通过：小冲突打开约 `115.6 ms`，25,000 行冲突约 `171.7 ms`，连续开关 8 次约 `887.5 ms`，最大事件循环延迟约 `53.4 ms`。
- `npm.cmd test` 完整运行 165 项，165 项通过、0 项失败、0 项跳过，耗时约 118 秒；其中小冲突打开约 `111.5 ms`，大冲突约 `161.4 ms`，8 次开关约 `856.7 ms`，最大延迟约 `62.7 ms`。
- `git diff --check` 通过；测试结束后未发现相关 Node、Edge、Chrome 进程或 `forkline-browser-performance-*` 临时目录，未使用或修改 `D:\桌面\GitTest`。

### Notes
- `server/file-editor-service.js`：读取冲突文件的 stage 2/3 版本并复用统一的编码和大小边界。
- `public/index.html`：增加三栏冲突编辑器的“合并结果”标题节点。
- `public/js/core.js`：注册合并结果标题元素。
- `public/js/features/file-editor-utils.js`：规范化冲突版本响应数据。
- `public/js/features/file-editor-actions.js`：创建轻量三栏、同步滚动并管理冲突块应用按钮。
- `public/js/features/file-editor-window.js`：保存和恢复第三栏视图，并在销毁时解除三栏资源。
- `public/js/features/file-editor.js`：选择普通三栏或复杂文件轻量三栏并更新冲突模式文案。
- `public/js/i18n-catalog.js`：增加三栏冲突编辑器中英文文案。
- `public/styles.css`：增加三栏标题、普通 MergeView 和轻量三栏布局与配色。
- `tests/git-api.test.js`：验证 stage 2/3 内容及冲突结果保存。
- `tests/file-editor-ui.test.js`：固定三栏初始化、按钮文案、布局和轻量路径接线。
- `tests/browser-performance.test.js`：增加真实冲突仓库、应用保存、25,000 行滚动和连续开关回归。
- `README.md`：更新冲突编辑器使用方式和“保存后再暂存”流程。
- `docs/ARCHITECTURE.md`：记录 stage 2/3、三栏模式、轻量降级和资源释放边界。
- `docs/CONTINUE.md`：更新当前实现说明并记录真实浏览器性能数据。
- `progress.md`：追加本轮实现、验证、资源清理和回滚方式。
- 回滚点为 `15078cd`；提交前可执行 `git restore -- README.md docs/ARCHITECTURE.md docs/CONTINUE.md public/index.html public/js/core.js public/js/features/file-editor-actions.js public/js/features/file-editor-utils.js public/js/features/file-editor-window.js public/js/features/file-editor.js public/js/i18n-catalog.js public/styles.css server/file-editor-service.js tests/browser-performance.test.js tests/file-editor-ui.test.js tests/git-api.test.js progress.md`；本任务提交位于 HEAD 时可执行 `git revert --no-edit HEAD`。

## 2026-08-06 - Task: 增加界面诊断与慢编辑器自动降级

### What was done
- 浏览器在本地记录超过 200 ms 的主线程阻塞、未处理界面错误和异步错误，最多保留最近 40 条；刷新页面后仍可查看、复制或清空。
- 普通 MergeView 创建超过 250 ms 时立即释放并重建为轻量双栏或三栏，同一浏览器会话再次打开相同仓库、版本和文件快照时直接使用轻量模式。
- 自动降级保留普通工作区右栏编辑和保存能力；诊断数据只保存在当前浏览器，不上传服务器，不触发 Git 操作。
- 操作日志页增加界面诊断列表、复制和清空入口，并补齐中英文状态提示。

### Testing
- 新增界面诊断单元测试运行 3 项，3 项通过；编辑器、布局和国际化专项运行 74 项，74 项通过。
- `npm.cmd run test:browser` 运行 1 项真实 Chromium 回归并通过：人为增加约 300 ms MergeView 构建后首次约 308.5 ms 完成自动降级，同一文件再次打开约 84.1 ms，两次均为两个 CodeMirror、零个 MergeView。
- `npm.cmd test` 完整运行 168 项，168 项通过、0 项失败、0 项跳过；小冲突文件约 101.3 ms，25,000 行冲突约 179.1 ms，DOM、监听器和堆浸泡边界保持稳定。
- 语法检查全部通过；测试只使用随机端口和系统临时仓库，未使用或修改 `D:\桌面\GitTest`。测试结束后相关 Node/Chromium 进程与 `forkline-browser-performance-*` 临时目录均为 0。

### Notes
- `public/js/app/performance-diagnostics.js`：增加本地界面错误、Long Task 和慢文件降级记忆。
- `public/index.html`、`public/js/app/events.js`、`public/js/panels/logs.js`、`public/styles.css`：加载诊断模块，并增加操作日志查看、复制和清空交互。
- `public/js/features/file-editor.js`、`public/js/features/file-editor-actions.js`、`public/js/features/file-editor-window.js`：测量 MergeView 构建时间，执行自动降级并保留工作区编辑能力。
- `public/js/i18n-catalog.js`：增加界面诊断和慢响应降级的中英文文案。
- `tests/ui-diagnostics.test.js`、`tests/browser-performance.test.js`、`tests/file-editor-ui.test.js`：覆盖诊断持久化、复制报告、真实浏览器降级和资源释放。
- `README.md`、`docs/ARCHITECTURE.md`、`docs/CONTINUE.md`：更新用户入口、模块顺序、行为边界和验证数据。
- `progress.md`：追加本轮实现、验证、资源清理和回滚方式。
- 回滚点为 `41bdbd5`；提交前可执行 `git restore -- README.md docs/ARCHITECTURE.md docs/CONTINUE.md public/index.html public/js/app/events.js public/js/features/file-editor-actions.js public/js/features/file-editor-window.js public/js/features/file-editor.js public/js/i18n-catalog.js public/js/panels/logs.js public/styles.css tests/browser-performance.test.js tests/file-editor-ui.test.js progress.md && git clean -f -- public/js/app/performance-diagnostics.js tests/ui-diagnostics.test.js`；本任务提交位于 HEAD 时可执行 `git revert --no-edit HEAD`。

## 2026-08-06 - Task: 增加仓库渐进式打开

### What was done
- 网页主动打开或恢复最近仓库时先读取仓库、分支、同步摘要和当前分支历史，首屏绘制后再补齐工作区、Tag、储藏、工作树、子模块、恢复点和分支整理状态。
- 全量状态返回时保留载入期间已经切换的查看引用、提交选择和历史分页；工作区使用明确的载入占位，不会把未读取状态误报为没有修改。
- 详情补齐期间统一拒绝除新打开仓库外的 POST 写请求；补齐失败后继续阻止写入，并提示重新打开仓库。
- 保留原 `/api/sync-state` 轻量字段契约，渐进首屏只在内部按需携带分支列表，不改变现有 Git 操作语义。

### Testing
- `node --check server.js`、`node --check server/repository-state-service.js` 和 `node --check public/js/features/repositories.js` 通过；`git diff --check` 通过。
- 前端与状态专项运行 71 项，71 项通过；真实 Git 渐进打开专项运行 1 项，1 项通过。
- `npm.cmd run test:browser` 独立真实 Chromium 回归运行 1 项并通过：3012 条提交、4000 个工作区文件仓库首屏约 `164.5 ms`，完整详情约 `793.3 ms`，文件数 `0 -> 4000`；12 次仓库切换约 `7.14 s`。
- `npm.cmd test` 完整运行 171 项，171 项通过、0 项失败、0 项跳过，耗时约 136.3 秒；同机高负载下渐进首屏约 `619.2 ms`、完整详情约 `1415.6 ms`，仍低于 `1500 / 5000 ms` 回归门限。
- 连续开关历史文件编辑器 30 次后，`resize` 监听器保持 `4 -> 4`，DOM 保持 `1/2091/149 -> 1/2091/149`，GC 后堆约 `3.7 MiB -> 3.8 MiB`。测试使用随机端口和系统临时仓库；结束后相关 Node / Edge / Chrome 进程和性能临时目录均为 0，未使用或修改 `D:\桌面\GitTest`。

### Notes
- `server.js`：让打开仓库接口接收显式渐进模式。
- `server/repository-service.js`：按打开选项选择首屏状态或完整状态。
- `server/repository-state-service.js`：增加渐进首屏状态并保持轻量同步接口字段兼容。
- `public/js/api.js`：详情载入或失败期间统一拦截仓库写请求。
- `public/js/app/init.js`：最近仓库恢复先绘制首屏，再并行补齐完整状态。
- `public/js/core.js`：记录仓库详情是否仍在载入。
- `public/js/features/repositories.js`：编排渐进打开、过期响应丢弃、状态合并和失败处理。
- `public/js/features/worktree-changes.js`：显示工作区载入或失败状态，并禁用依赖完整快照的操作。
- `public/js/i18n-catalog.js`：补充渐进载入和失败提示的中英文文案。
- `tests/api-repo-context.test.js`：覆盖载入期间的 POST 写入拦截和允许的新打开请求。
- `tests/browser-performance.test.js`：覆盖首屏先显示、4000 文件后续补齐和仓库切换性能边界。
- `tests/git-api.test.js`：用真实临时 Git 仓库验证首屏历史与延后工作区状态。
- `tests/layout-ui.test.js`：覆盖启动恢复、指定引用和载入期间用户选择保留。
- `tests/recovery-policy-ui.test.js`：适配启动流程中的渐进状态标记。
- `README.md`：说明打开仓库时的两阶段载入和写操作边界。
- `docs/ARCHITECTURE.md`：记录状态分层、合并规则、失败状态和请求保护。
- `docs/CONTINUE.md`：更新当前能力、回归数量和两种负载下的性能数据。
- `progress.md`：追加本轮实现、验证、资源清理和回滚方式。
- 回滚点为 `4919b1c`；提交前可执行 `git restore -- README.md docs/ARCHITECTURE.md docs/CONTINUE.md public/js/api.js public/js/app/init.js public/js/core.js public/js/features/repositories.js public/js/features/worktree-changes.js public/js/i18n-catalog.js server.js server/repository-service.js server/repository-state-service.js tests/api-repo-context.test.js tests/browser-performance.test.js tests/git-api.test.js tests/layout-ui.test.js tests/recovery-policy-ui.test.js progress.md`；本任务提交位于 HEAD 时可执行 `git revert --no-edit HEAD`。

## 2026-08-07 - Task: 建立代码即真源的界面设计系统基线

### What was done
- 基于现有六套主题、CSS Token 和组件类建立 `docs/DESIGN_SYSTEM.md`，明确唯一可信来源、Token 分层、组件目录、AI 修改流程和最大化/竖屏/窄屏/高 DPI 验收矩阵；不引入 Figma、前端框架或整体样式拆分。
- 将主按钮文字、重命名状态和警告图标的四处固定十六进制语义色无损收口为 CSS Token，实际颜色和交互保持不变。
- 增加设计系统自动守卫，检查文档入口、六主题 Token 契约、共享组件选择器和普通 CSS 规则中的十六进制语义色。
- 新正式工作区使用 CRLF 后暴露两处文件编辑器测试函数截取失败；正则改为同时兼容 CRLF/LF，只修正测试可移植性，没有修改编辑器实现。

### Testing
- `node --check tests/design-system.test.js` 通过；`git diff --check` 通过，仅输出工作区现有 LF/CRLF 转换提示。
- `node --test --test-concurrency=1 tests/file-editor-ui.test.js tests/design-system.test.js tests/themes.test.js tests/layout-ui.test.js` 运行 75 项，75 项通过、0 项失败。
- `npm.cmd test` 完整运行 175 项，175 项通过、0 项失败、0 项跳过，耗时约 121.7 秒。
- 真实 Chromium 回归中复杂文件打开约 `172.1 ms`，3012 条提交渲染 17 行和 105 个图谱元素；4000 文件分批载入约 `600.5 ms / 4` 批，最大事件循环延迟约 `163.2 ms`；渐进打开首屏约 `178.7 ms`、完整详情约 `799.6 ms`。
- 大/小仓库切换 12 次后连续开关历史编辑器 30 次，`resize` 监听器保持 `4 -> 4`，DOM 保持 `1/2091/149 -> 1/2091/149`，GC 后堆约 `3.7 MiB -> 3.8 MiB`。
- 本轮临时 `5299` 服务 PID `38224` 已停止，端口确认无监听。内置浏览器控制连接中断，因此没有单独完成截图人工复核；本轮四处样式替换使用完全相同的颜色值，自动真实 Chromium 回归已通过。
- 系统临时目录仍有一个 `2026-08-04` 的旧 `forkline-operation-cancel-tpGSA5` 目录，本轮未创建也未删除。

### Notes
- `public/styles.css`：增加四个语义色 Token，并替换对应固定颜色引用。
- `docs/DESIGN_SYSTEM.md`：新增 Forkline 界面设计系统、编码约束、AI 流程和视觉验收矩阵。
- `tests/design-system.test.js`：新增主题、组件和颜色 Token 自动守卫。
- `tests/file-editor-ui.test.js`：让两处函数截取正则兼容 Windows CRLF 和 LF。
- `README.md`：在开发文档入口中加入界面设计系统。
- `docs/CONTINUE.md`：同步设计系统基线、测试可移植性和完整验证结果。
- `progress.md`：追加本轮实现、验证、资源清理和回滚方式。
- 回滚点为 `e6e8537`；提交前执行 `git restore -- README.md docs/CONTINUE.md progress.md public/styles.css tests/file-editor-ui.test.js`，再执行 `Remove-Item -LiteralPath docs/DESIGN_SYSTEM.md,tests/design-system.test.js`；本任务提交位于 HEAD 时可执行 `git revert --no-edit HEAD`。

## 2026-08-07 - Task: 发布 Forkline v0.3.0

### What was done
- 将正式版本从 `0.2.1` 更新为 `0.3.0`，并以当前 `main` 作为 `v0.3.0` Tag 和 GitHub Release 的发布目标。
- 发布说明归纳 `v0.2.1` 之后的长任务进度与取消、精细 Diff、三栏冲突编辑、大仓库性能、恢复保护、认证诊断、在线更新恢复、渐进打开、自动降级诊断和设计系统基线。
- 按本次要求不构建或上传安装包、EXE 或便携附件；Release 仅使用 GitHub 自动生成的源码压缩包。

### Testing
- `npm.cmd test` 完整运行 175 项，175 项通过、0 项失败、0 项跳过，耗时约 136.5 秒。
- 真实 Chromium 回归中复杂文件打开约 `231.5 ms`，最大事件循环延迟约 `70.5 ms`；3012 条提交首屏为 17 行和 105 个图谱元素。
- 4000 文件工作区冷/热 API 约 `442.6/259.8 ms`，首批渲染约 `11.6 ms`，滚动加载全部约 `750.9 ms / 4` 批；渐进打开首屏约 `182.8 ms`，完整详情约 `861.4 ms`。
- 仓库切换 12 次约 `7.83 s`，编辑器开关 30 次后 `resize` 监听器保持 `4 -> 4`，DOM 保持 `1/2091/149 -> 1/2091/149`，GC 后堆约 `3.7 MiB -> 3.8 MiB`。
- 测试结束后相关 Node / Edge / Chrome 进程和 `forkline-browser-performance-*`、`forkline-progressive-open-*` 临时目录均为 0。

### Notes
- `package.json`：将 Forkline 正式版本更新为 `0.3.0`。
- `docs/CONTINUE.md`：更新当前回归数量并记录 v0.3.0 发布范围、附件边界和性能验证。
- `progress.md`：追加本轮版本发布、验证和回滚方式。
- 回滚点为 `0c9b152`；创建 Tag 前可执行 `git restore -- package.json docs/CONTINUE.md progress.md`；本任务提交位于 HEAD 时可执行 `git revert --no-edit HEAD`，已经发布后不得移动或强制覆盖 `v0.3.0`，应发布更高修订版本修正。

## 2026-08-07 - Task: 增加 Windows 便携包并补充 v0.3.0 Release 附件

### What was done
- 增加 Windows 便携构建脚本，从正式 Tag 创建 `main` 浅层仓库，保留官方 `origin`，下载并校验固定 Node.js Windows x64 运行时，再生成包含隐藏 `.git` 的 ZIP 和 SHA256 文件。
- 便携启动器和运行时只写入包内 `.git/info/exclude`，不修改发布 Tag 的跟踪文件，也不让 Forkline 自身工作区变脏；系统 Git 继续负责仓库操作、凭据和 SSH。
- 增加 GitHub Release 自动构建工作流；正式 Release 发布或手动指定已有 Tag 时，构建并上传 ZIP、SHA256 和 workflow artifact。
- 为现有 `v0.3.0` Release 构建、验证并上传 Windows x64 便携 ZIP 和 SHA256 附件。

### Testing
- PowerShell Parser 检查 `scripts/build-portable.ps1` 通过；便携专项运行 2 项，2 项通过。
- `npm.cmd test` 完整运行 176 项，176 项通过、0 项失败、0 项跳过，耗时约 131.9 秒。
- 实际 ZIP 为 `35,872,015` 字节，SHA256 为 `ef88c0a29bedfb1a0142ff92883bf813bcbced0c8cf993ec837779fc861ce702`；本地 `.sha256` 内容与重新计算结果一致。
- 解压后的仓库为 `main`，HEAD 为 `074fae641f3a0e659aa648e882be8e5853b3902b`，`origin` 为官方地址，`--is-shallow-repository = true` 且 `git status` 为空。
- 内置 Node.js `v24.13.0` 在随机端口 `57468` 启动 Forkline 并返回 HTTP 200；对 PID `20104` 使用 `taskkill /T /F` 后端口确认关闭，临时解压目录已删除。
- GitHub Release 中 ZIP 为 uploaded 状态、大小 `35,872,015` 字节，asset digest 与本地 SHA256 完全一致；SHA256 附件同时上传成功。

### Notes
- `.gitignore`：忽略本机构建输出目录 `dist/`。
- `.github/workflows/release-portable.yml`：新增正式 Release 和手动 Tag 的 Windows 便携构建、artifact 保存与附件上传。
- `build-portable.cmd`：新增可双击的本地构建入口。
- `scripts/build-portable.ps1`：实现 Tag/版本校验、浅层仓库、官方 Node 校验、便携运行时、干净工作区检查、ZIP 和 SHA256 生成。
- `package.json`：增加 `build:portable` 脚本入口，正式版本仍为 `0.3.0`。
- `tests/portable-runtime.test.js`：固定构建脚本、工作流、Git 更新兼容和 Node SHA 校验契约。
- `README.md`：区分便携包与源码仓库的 Node 要求、启动方式和更新能力。
- `docs/PACKAGING.md`：新增便携包结构、构建流程、更新边界、验证规则和 v0.3.0 实际产物。
- `docs/CONTINUE.md`：更新完整回归数量并记录便携构建、运行验证和 Release 附件。
- `progress.md`：追加本轮实现、验证、发布附件和回滚方式。
- 回滚点为 `074fae6`；提交前可执行 `git restore -- .gitignore README.md package.json tests/portable-runtime.test.js docs/CONTINUE.md progress.md`，并删除 `.github/workflows/release-portable.yml`、`build-portable.cmd`、`docs/PACKAGING.md`、`scripts/build-portable.ps1`；提交位于 HEAD 时可执行 `git revert --no-edit HEAD`。Release 附件需另行执行 `gh release delete-asset v0.3.0 Forkline-v0.3.0-windows-x64.zip -y` 和对应 SHA256 附件删除命令，不得移动 `v0.3.0` Tag。

## 2026-08-09 - Task: 让 Git 安全快照校验失败即停止

### What was done
- 当前分支 HEAD、upstream、工作区、单文件和失效 worktree 快照读取失败时直接中止 Git 写操作，不再把失败结果降级为空状态后继续执行。
- 将 upstream 快照查询改为成功时可明确返回空值的 `for-each-ref`，区分“未设置 upstream”和“Git 查询失败”。
- 增加六条故障注入回归，确认每种快照读取失败后都不会执行后续暂存、取消 upstream 或 worktree 清理命令。

### Testing
- `node --check server/git-operations-service.js` 和 `node --check tests/git-snapshot-guards.test.js` 通过。
- `tests/git-snapshot-guards.test.js` 专项 `6/6` 通过。
- `tests/backend-services.test.js`、`tests/git-snapshot-guards.test.js` 和 `tests/git-api.test.js` 合计 `40/40` 通过，包含真实临时 Git 仓库的暂存、提交、签出、同步、冲突和取消长操作流程。
- 其余非浏览器测试 `141/141` 通过；本轮未运行真实 Chromium，因为没有前端、样式或布局改动。

### Notes
- `server/git-operations-service.js`：让写操作前的 HEAD、upstream、工作区、文件和 worktree 清理快照读取失败即停止。
- `tests/git-snapshot-guards.test.js`：新增六种安全快照读取失败的故障注入测试。
- `docs/ARCHITECTURE.md`：补充 Git 写操作安全门和失败处理约束。
- `docs/CONTINUE.md`：记录本项优化、验证结果和下一项计划。
- `progress.md`：追加本轮实现、验证和回滚方式。
- 保留用户已有的 `pull-latest.cmd` 本地修改，本轮未暂存、未修改。
- 回滚点为 `767cf48`；提交前可执行 `git restore -- server/git-operations-service.js docs/ARCHITECTURE.md docs/CONTINUE.md progress.md` 并删除 `tests/git-snapshot-guards.test.js`；本任务提交位于 HEAD 时可执行 `git revert --no-edit HEAD`。

## 2026-08-09 - Task: 移除远端分支只读浏览的同步网络检查

### What was done
- `/api/state`、`/api/ref-state`、文件历史、逐行追踪和分支比较改为直接解析本地 remote-tracking ref，不再因查看 `origin/<branch>` 同步等待 `git ls-remote` 或隐式抓取。
- 写操作和主动连接诊断继续保留远端存在性检查，远端分支的签出、合并、变基、创建、upstream 与删除安全边界不变。
- 增加远端离线回归，验证已抓取的远端分支在远端不可访问时仍能读取提交、文件历史、逐行结果和比较结果。

### Testing
- 新增定向回归 `1/1` 通过：真实创建并删除临时裸远端后，五个只读 API 均返回 HTTP 200。
- 完整非浏览器测试 `182/182` 通过，0 项失败、0 项跳过，耗时约 169.7 秒。
- `git diff --check` 对本轮文件无新增空白错误；唯一提示来自保留不动的用户文件 `pull-latest.cmd` 原有尾随空格。本轮未运行真实 Chromium，因为没有前端、样式或布局改动。

### Notes
- `server/repository-state-service.js`：移除全量状态和轻量引用状态读取前的远端网络校验。
- `server/repository-history.js`：移除文件历史、逐行追踪和分支比较前的远端网络校验。
- `server/repository-service.js`：删除状态读取服务不再需要的远端校验依赖接线。
- `server.js`：删除历史读取服务不再需要的远端校验依赖接线。
- `tests/git-api.test.js`：新增远端离线后读取本地 remote-tracking ref 的真实 API 回归。
- `docs/ARCHITECTURE.md`：记录只读接口与写操作的远端检查边界。
- `docs/CONTINUE.md`：更新当前回归数量、完成项和下一项计划。
- `progress.md`：追加本轮实现、验证和回滚方式。
- 保留用户已有的 `pull-latest.cmd` 本地修改，本轮未暂存、未修改。
- 回滚点为 `56c1c70`；提交前可执行 `git restore -- server.js server/repository-history.js server/repository-service.js server/repository-state-service.js tests/git-api.test.js docs/ARCHITECTURE.md docs/CONTINUE.md progress.md`；本任务提交位于 HEAD 时可执行 `git revert --no-edit HEAD`。

## 2026-08-09 - Task: 将文件编辑器保存改为原子替换

### What was done
- 工作区文件先写入目标同目录的独占临时文件并刷盘，再通过原子重命名替换目标，避免进程或磁盘写入中断后目标文件只剩部分内容。
- 替换前再次核对目标文件 SHA-256，外部程序在临时文件准备期间修改目标时停止保存并保留外部内容。
- 失败路径统一关闭并删除临时文件；正常保存继续保留 UTF-8、GBK/GB18030、BOM、换行和 1 MiB 编辑边界，不自动执行暂存。

### Testing
- `node --check server/file-editor-service.js` 和 `node --check tests/file-editor-atomic-save.test.js` 通过。
- 原子保存故障注入 `2/2` 通过，覆盖临时文件部分写入后失败、替换前目标被外部修改，并确认原文件与临时文件清理结果。
- 现有 UTF-8、GBK/GB18030 和冲突文件保存真实 API 回归 `3/3` 通过。
- 完整非浏览器测试 `184/184` 通过，0 项失败、0 项跳过，耗时约 180.1 秒。本轮未运行真实 Chromium，因为没有前端、样式或布局改动。

### Notes
- `server/file-editor-service.js`：增加同目录临时文件、刷盘、二次快照校验、原子替换和失败清理。
- `tests/file-editor-atomic-save.test.js`：新增写入中断与保存过程外部修改的故障注入测试。
- `docs/ARCHITECTURE.md`：记录文件编辑器原子保存和失败边界。
- `docs/CONTINUE.md`：更新当前回归数量、完成项和下一项计划。
- `progress.md`：追加本轮实现、验证和回滚方式。
- 保留用户已有的 `pull-latest.cmd` 本地修改，本轮未暂存、未修改。
- 回滚点为 `3ac8b94`；提交前可执行 `git restore -- server/file-editor-service.js docs/ARCHITECTURE.md docs/CONTINUE.md progress.md` 并删除 `tests/file-editor-atomic-save.test.js`；本任务提交位于 HEAD 时可执行 `git revert --no-edit HEAD`。

## 2026-08-09 - Task: 收紧 Forkline 本地 API 请求边界

### What was done
- 在任何静态资源、更新接口或 Git API 路由执行前校验 Host，只允许当前端口的 `127.0.0.1`、`localhost` 和 `::1`，阻止 DNS 重绑定使用其他域名访问本地服务。
- `/api/*` 拒绝非本地同源 Origin 和非同源 Fetch Metadata；无浏览器来源头的本机 CLI/测试调用保持兼容，POST 的 `application/json` 边界不变。
- JSON 与静态资源增加同源资源和防 MIME 嗅探响应头，静态页面禁止被 iframe 嵌入；新增中英文安全错误文案。

### Testing
- 本地请求安全专项 `1/1` 通过，覆盖非法 API/静态 Host、跨站 Origin、same-site/cross-site Fetch Metadata、跨站 POST、同源请求、`localhost` 别名、响应安全头和英文错误。
- `tests/i18n.test.js` 与 `tests/api-repo-context.test.js` 合计 `7/7` 通过。
- 完整非浏览器测试 `185/185` 通过，0 项失败、0 项跳过，耗时约 175.5 秒；最终 authority 严格化后再次运行安全专项 `1/1` 通过。本轮未运行真实 Chromium，因为没有布局或交互改动。

### Notes
- `server.js`：增加本地 Host、Origin、Fetch Metadata 校验和响应安全头。
- `public/js/i18n-catalog.js`：增加非法 Host 与非法请求来源的英文文案。
- `tests/git-api.test.js`：增加真实 HTTP 请求边界回归和原始 Host 请求辅助。
- `docs/ARCHITECTURE.md`：记录本地服务同源模型、CLI 兼容和响应头规则。
- `docs/CONTINUE.md`：更新当前回归数量、完成项和下一项计划。
- `progress.md`：追加本轮实现、验证和回滚方式。
- 保留用户已有的 `pull-latest.cmd` 本地修改，本轮未暂存、未修改。
- 回滚点为 `5919af8`；提交前可执行 `git restore -- server.js public/js/i18n-catalog.js tests/git-api.test.js docs/ARCHITECTURE.md docs/CONTINUE.md progress.md`；本任务提交位于 HEAD 时可执行 `git revert --no-edit HEAD`。

## 2026-08-09 - Task: 将仓库重状态改为按页签加载

### What was done
- 保留 `/api/state` 默认全量响应，同时增加核心模式；仓库启动与渐进打开的第二阶段只读取工作区、Tag、历史、分支和同步数据，跳过当前页面未使用的分支整理、完整 worktree、子模块、储藏和恢复点读取。
- 增加五个仓库详情区块接口，分支整理、工作树、子模块、储藏和恢复点仅在对应右侧页签首次打开或手动刷新时读取；各面板显示读取中、失败和重试状态。
- 前端按仓库路径和请求编号丢弃被后发请求替代或切仓后返回的旧详情，手动刷新只合并当前区块；核心状态继续携带失效 worktree 清理快照，保留左侧分支操作的安全校验。

### Testing
- 所有改动脚本通过 `node --check`；核心状态命令守卫专项 `8/8` 通过，确认不会执行 stash、子模块、`branch --merged`、恢复点读取或 worktree/submodule 增强。
- 真实临时 Git 仓库专项验证核心响应、五个详情区块、默认全量兼容、英文错误和失效 worktree 安全快照；渐进打开定向回归 `1/1` 通过。
- 前端渐进合并与旧响应竞争专项 `2/2` 通过；国际化、布局与安全快照组合专项 `48/48` 通过。
- 完整非浏览器回归 `187/187` 通过，0 项失败、0 项跳过。本轮未运行真实 Chromium，避免重复使用已知会影响 Codex 稳定性的浏览器验证方式。
- `git diff --check` 对本轮文件无新增空白错误；全仓唯一提示仍来自保留不动的用户文件 `pull-latest.cmd` 原有尾随空格。

### Notes
- `server/repository-state-service.js`：增加核心状态分支、五个详情区块读取，并保留 worktree 清理安全快照。
- `server/repository-service.js`：向仓库服务外观暴露详情区块读取能力。
- `server.js`：接入 `details=core` 和 `/api/state-details` 路由。
- `public/js/core.js`：增加仓库详情请求编号和加载状态。
- `public/js/app/init.js`：启动时改用核心状态响应。
- `public/js/features/repositories.js`：编排详情懒加载、区块合并、加载占位、失败重试和旧响应丢弃。
- `public/js/features/folder-command.js`：切换右侧页签时触发对应详情读取。
- `public/js/features/context-menus.js`：分支右键入口复用统一页签切换和加载逻辑。
- `public/js/app/events.js`：接入详情区块失败后的重试按钮。
- `public/js/panels/workspaces.js`：让分支整理、工作树和子模块面板按需读取并局部刷新。
- `public/js/panels/stashes.js`：让储藏面板在首次打开时读取列表。
- `public/js/panels/recovery.js`：让恢复点列表先按需读取，再沿用独立 reflog 懒加载。
- `public/js/i18n-catalog.js`：补充详情区块参数错误的英文文案。
- `tests/backend-services.test.js`：固定核心模式不执行延后 Git 读取和增强步骤。
- `tests/git-api.test.js`：用真实仓库覆盖核心响应、五个详情区块、默认全量兼容和英文错误。
- `tests/layout-ui.test.js`：更新核心状态请求契约并覆盖重复请求与切仓旧响应丢弃。
- `README.md`：更新仓库打开和右侧工具页的加载方式。
- `docs/ARCHITECTURE.md`：记录三层状态模型、接口契约、请求保护和安全快照边界。
- `docs/CONTINUE.md`：更新当前能力、回归数量和下一项优化顺序。
- `progress.md`：追加本轮实现、验证、文件清单和回滚方式。
- 保留用户已有的 `pull-latest.cmd` 本地修改，本轮未暂存、未修改。
- 回滚点为 `016bb96`；提交前可执行 `git restore -- README.md server.js server/repository-service.js server/repository-state-service.js public/js/core.js public/js/app/init.js public/js/app/events.js public/js/features/context-menus.js public/js/features/folder-command.js public/js/features/repositories.js public/js/i18n-catalog.js public/js/panels/recovery.js public/js/panels/stashes.js public/js/panels/workspaces.js tests/backend-services.test.js tests/git-api.test.js tests/layout-ui.test.js docs/ARCHITECTURE.md docs/CONTINUE.md progress.md`；本任务提交位于 HEAD 时可执行 `git revert --no-edit HEAD`。
## 2026-08-10 - Task: 文件编辑器与 CodeMirror 资源按需加载

### What was done

- 将 CodeMirror 样式、语言模式、MergeView 和五个文件编辑器模块从首屏移到首次打开文件时加载；所有入口共用一个进行中的加载任务，避免连续操作重复请求。
- 编辑器专属事件延后到资源就绪后绑定一次；失败资源可单独重试，仓库切换、滚动和窗口缩放在编辑器尚未加载时保持安全。
- 首屏声明资源从 71 个、1,874,043 字节降到 37 个、908,884 字节，减少 34 个请求和 965,159 字节。

### Testing

- `node --check`：加载器、事件、文件树、上下文菜单、仓库切换和相关测试文件通过。
- 加载器、编辑器、布局和国际化专项：`75/75` 通过。
- 完整非浏览器回归：`189/189` 通过，0 失败、0 跳过。
- `npm run test:browser`：真实 Chromium `1/1` 通过；首屏编辑器资源为 0，首次打开后 35 个资源就绪，复杂历史文件打开约 236.0 ms，最大事件循环延迟约 42.3 ms，30 次开关后 DOM、监听器和堆边界稳定。

### Notes

- `public/index.html`：移除首屏 CodeMirror 和编辑器模块声明，加入轻量加载器入口。
- `public/js/features/file-editor-loader.js`：新增资源顺序、共享加载任务、失败重试、延迟事件绑定和统一打开入口。
- `public/js/app/events.js`：首屏只绑定编辑触发入口，未加载时安全跳过编辑器菜单清理。
- `public/js/features/file-tree.js`、`public/js/features/context-menus.js`：工作区和历史文件入口改用懒加载门面。
- `public/js/features/repositories.js`：仓库切换在编辑器未加载时不调用不存在的销毁函数。
- `public/js/i18n-catalog.js`：增加编辑器资源加载失败英文提示。
- `tests/file-editor-loader.test.js`、`tests/file-editor-ui.test.js`、`tests/browser-performance.test.js`：覆盖并发共享、失败重试、首屏无编辑器资源和首次真实加载。
- `README.md`、`docs/ARCHITECTURE.md`、`docs/CONTINUE.md`：记录用户行为、加载顺序、验证结果和后续缓存任务。
- 回滚点为本轮开始前 `dbc4640`；需要撤销本项时，对包含本记录的提交执行 `git revert <commit>`。
## 2026-08-10 - Task: 静态资源 ETag 与安全重验证缓存

### What was done

- 静态资源增加弱 ETag、Last-Modified 和 `private, no-cache`，允许浏览器保存本地副本但强制每次向当前服务重验证。
- 匹配 ETag 或修改时间时直接返回 `304`，避免重复读取和传输正文；首次请求、旧 ETag 和文件变化继续返回完整 `200` 响应。
- JSON API 保持 `no-store` 且不返回 ETag，现有同源、防嗅探、禁止嵌入和静态路径边界不变。

### Testing

- `node --check server.js tests/git-api.test.js` 通过。
- 缓存与本地请求边界专项：`1/1` 通过，覆盖首次 200、ETag 304、修改时间 304、旧 ETag 200 和 API no-store。
- 完整非浏览器回归：`189/189` 通过，0 失败、0 跳过。
- `npm run test:browser`：真实 Chromium `1/1` 通过；复杂历史文件打开约 274.9 ms，最大事件循环延迟约 58.4 ms，大历史、大工作区、渐进打开及编辑器浸泡边界稳定。

### Notes

- `server.js`：静态文件改为元数据预检、条件请求判断和 304 响应；JSON 响应缓存策略未改变。
- `tests/git-api.test.js`：扩展本地请求边界集成测试，固定静态缓存与 API 不缓存契约。
- `docs/ARCHITECTURE.md`、`docs/CONTINUE.md`：记录缓存策略、更新安全边界、验证结果和下一项优化。
- `progress.md`：追加本轮实现、验证、文件清单和回滚方式。
- 回滚点为本轮开始前 `5bd0589`；需要撤销本项时，对包含本记录的提交执行 `git revert <commit>`。

## 2026-08-10 - Task: 英文词典按需加载

### What was done

- 默认中文首屏改用轻量国际化门面，不再请求或解析完整英文词典；恢复英语设置或第一次切换英语时才载入词典。
- 并发英语请求共享同一个加载任务，失败资源会移除并允许重试；启动和设置页语言切换等待词典就绪后再继续渲染。
- 服务端继续直接使用完整词典，语言持久化、英文错误和原始 Git 数据保护语义保持不变；首屏声明资源保持 37 个，体积从 908,884 字节降到 731,088 字节。

### Testing

- `node --check`：国际化加载器、运行时、启动、事件和相关测试文件通过。
- 国际化与相关专项：`82/82` 通过。
- 完整非浏览器回归：`193/193` 通过，0 失败、0 跳过。
- `npm run test:browser`：真实 Chromium `1/1` 通过；中文首屏英文词典资源为 0，切换英语后为 1 且文案正确，最终重跑中复杂历史文件打开约 304.8 ms，最大事件循环延迟约 92.2 ms，30 次编辑器开关后的 DOM、监听器和堆边界稳定。

### Notes

- `public/index.html`：首屏词典脚本改为轻量加载器。
- `public/js/i18n-loader.js`：新增中文原文门面、英文词典按需载入、并发共享和失败重试。
- `public/js/i18n.js`：语言初始化和切换改为等待对应词典后应用。
- `public/js/bootstrap.js`、`public/js/app/events.js`：启动和设置页接入异步语言切换。
- `public/js/i18n-catalog.js`：增加词典加载失败的英文提示。
- `tests/i18n-loader.test.js`、`tests/i18n.test.js`、`tests/browser-performance.test.js`：覆盖中文首屏无词典请求、英语并发加载、失败重试、持久化恢复和真实浏览器资源边界。
- `README.md`、`docs/ARCHITECTURE.md`、`docs/CONTINUE.md`：记录用户行为、运行时加载顺序、验证结果和下一项性能门限。
- `progress.md`：追加本轮实现、验证、文件清单和回滚方式。
- 回滚点为本轮开始前 `bb31117`；需要撤销本项时，对包含本记录的提交执行 `git revert <commit>`。

## 2026-08-10 - Task: 增加首屏资源性能门限

### What was done

- 新增首屏资源自动回归，直接解析默认页面声明的本地样式和脚本，检查重复、路径范围、文件存在性、资源数量和总字节。
- 将中文默认首屏限制为最多 37 个资源、总量不超过 750 KiB，并明确禁止完整英文词典、CodeMirror 和文件编辑器实现模块重新进入启动路径。
- 当前基线保持 37 个资源、731,088 字节；门限允许小幅正常增长，但大资源回流必须显式修改测试和文档。

### Testing

- `node --check tests/startup-resource-budget.test.js` 通过。
- 首屏资源门限专项：`2/2` 通过，实测 37 个资源、731,088 字节。
- 完整非浏览器回归：`195/195` 通过，0 失败、0 跳过。
- 本项只增加测试和文档，没有修改运行时代码，因此未重复启动真实 Chromium；上一项浏览器回归 `1/1` 已通过。

### Notes

- `tests/startup-resource-budget.test.js`：新增首屏资源解析、数量/体积门限和懒加载资源守卫。
- `README.md`、`docs/ARCHITECTURE.md`、`docs/CONTINUE.md`：记录测试入口、架构边界、当前基线和调整规则。
- `progress.md`：追加本轮实现、验证、文件清单和回滚方式。
- 回滚点为本轮开始前 `120724c`；需要撤销本项时，对包含本记录的提交执行 `git revert <commit>`。

## 2026-08-10 - Task: 准备 Forkline v0.3.1 发布

### What was done

- 将正式版本从 `0.3.0` 更新为 `0.3.1`，汇总自 `v0.3.0` 以来的安全、可靠性和首屏性能改进。
- 更新 Windows 便携包示例，明确 `v0.3.1` 起由 GitHub Release 工作流自动构建并上传 ZIP 与 SHA256。
- 发布范围不增加新功能代码；中文默认首屏当前为 37 个资源、731,088 字节，较优化前减少 34 个请求和 1,142,955 字节。

### Testing

- `npm.cmd test`：发布前完整回归 `196/196` 通过，0 失败、0 跳过；包含真实 Chromium `1/1`。
- Chromium 实测复杂历史文件打开约 300.5 ms、最大事件循环延迟约 90.4 ms；3012 提交、4000 文件、渐进打开和 30 次编辑器开关边界稳定。
- 首屏资源门限在完整回归中确认 37 个资源、731,088 字节。
- `node --test tests/portable-runtime.test.js`：便携包契约 `2/2` 通过。
- `scripts/build-portable.ps1` 通过 PowerShell 语法解析，`package.json` 版本确认为 `0.3.1`。

### Notes

- `package.json`：正式版本更新为 `0.3.1`。
- `docs/PACKAGING.md`：更新便携包示例和自动附件构建起始版本。
- `docs/CONTINUE.md`：记录发布范围、首屏优化汇总和 Release 附件流程。
- `progress.md`：追加发布准备、验证、文件清单和回滚方式。
- 回滚点为本轮开始前 `dd44b70`；发布 Tag 创建后不得移动 Tag，代码回滚应发布新的修复版本。

## 2026-08-10 - Task: 发布 Forkline v0.3.1

### What was done

- 在已验证提交 `e144fc1` 上创建并推送注释标签 `v0.3.1`，发布为 GitHub Latest Release。
- Release 自动触发 Windows 便携包工作流，成功构建并上传 ZIP 与 SHA256 附件。
- 核对本地/远端标签对象、目标提交、工作流步骤、附件大小和两层 SHA256，确认正式发布链路完整。

### Testing

- GitHub Release：`v0.3.1` 已发布，非草稿、非预发布，并标记为 Latest。
- 本地与远端标签对象均为 `3941bf4d2a1accfeceacab4279690afe994a0165`，均指向 `e144fc1afedeb6efbffc5834438347511c1a4342`。
- GitHub Actions `31352410934` 的检出、构建、工作流附件上传和 Release 附件上传步骤全部成功。
- ZIP 大小 `35,977,719` 字节；GitHub 资产摘要和下载校验文件中的 SHA256 均为 `387f6b4b9e5332bb165dc347a97b5717b7667a8163e65045535b25245c9bfff8`。
- `.sha256` 附件自身 SHA256 为 `1e2c6c4a7dc79d5a97a08b86c1ad471d2fb991fe56667b4ddb1e7fce675a9e81`，与 GitHub 资产摘要一致。

### Notes

- `docs/PACKAGING.md`：记录 v0.3.1 实际便携包大小、SHA256、工作流和下载入口。
- `docs/CONTINUE.md`：记录正式 Tag、Release、Actions 和附件核验结果。
- `progress.md`：追加正式发布证据、文件清单和不可移动 Tag 边界。
- 正式 Tag 与 Release 不回退、不移动；如发布内容存在问题，最小修复方式是从当前 `main` 发布新的补丁版本。仅撤销本轮发布记录文档时，可对包含本记录的提交执行 `git revert <commit>`。
## 2026-08-10 - Task: 修复历史文件对照窗口拉伸后的黑色空块

### What was done

- 修正延迟加载的 CodeMirror MergeView 样式覆盖问题，使历史文件左右对照编辑器随浮窗高度同步伸缩，不再固定为 `350px`。
- 增加真实浏览器拉伸回归：先把窗口缩到 `520px`，再拉高到 `780px`，逐层检查内容区、MergeView 和左右 CodeMirror 的实际高度。

### Testing

- 修复前真实 Chromium 稳定复现：内容区从 `376px` 增长到 `635px`，左右 CodeMirror 仍停在 `350px`；新增回归按预期失败。
- `node --test tests/file-editor-ui.test.js`：`31/31` 通过。
- `npm.cmd run test:browser`：真实 Chromium `1/1` 通过。
- `npm.cmd test`：完整回归 `196/196` 通过，0 失败、0 跳过。

### Notes

- `public/styles.css`：提高文件编辑器内 MergeView 和 CodeMirror 高度规则的选择器优先级，覆盖延迟加载资源中的固定高度。
- `tests/browser-performance.test.js`：增加历史文件对照窗口缩小再拉大的真实高度断言。
- `tests/file-editor-ui.test.js`：固定项目高度规则必须高于 CodeMirror MergeView 默认样式的契约。
- `docs/CONTINUE.md`：记录问题原因、修复行为和验证结果。
- `progress.md`：追加本轮实现、验证、文件清单和回滚方式。
- 回滚点为本轮开始前 `c607f2c`；提交前可执行 `git restore -- public/styles.css tests/browser-performance.test.js tests/file-editor-ui.test.js docs/CONTINUE.md progress.md`，提交后可对包含本记录的提交执行 `git revert <commit>`。

## 2026-08-10 - Task: 为双栏文件对照增加滚动条改动位置标记

### What was done

- 在普通双栏文件对照的旧版、新版滚动区域分别增加红色和绿色差异位置标记。
- 点击标记可跳到对应差异块，悬停可查看两侧起始行和改动行数。
- 编辑内容导致 MergeView 差异变化时自动刷新标记，并在关闭或重建编辑器时清理监听和节点。
- 保持复杂文件、大文件轻量模式和三栏冲突编辑原有路径，不为这些场景重新计算完整差异。

### Testing

- `node --test tests/file-editor-ui.test.js`：`32/32` 通过。
- `npm.cmd run test:browser`：真实 Chromium `1/1` 通过；缩小对照窗口后两侧标记均位于轨道内，点击旧版标记后滚动位置大于 `0`。
- `npm.cmd test`：完整回归 `197/197` 通过，0 失败、0 跳过。

### Notes

- `public/js/features/file-editor-actions.js`：根据 MergeView 现有差异块生成双侧标记并处理点击跳转和动态刷新。
- `public/js/features/file-editor.js`：在普通双栏对照创建完成后启用标记监听，并保存相关生命周期状态。
- `public/js/features/file-editor-window.js`：关闭或重建编辑器时解绑差异监听、取消待执行刷新并移除标记。
- `public/styles.css`：增加滚动区域定位条及旧版红色、新版绿色标记样式。
- `tests/browser-performance.test.js`：增加真实浏览器中的标记数量、边界、标题和点击滚动回归。
- `tests/file-editor-ui.test.js`：增加双侧标记、颜色、监听和清理契约。
- `docs/CONTINUE.md`：记录功能行为、性能边界和验证结果。
- `progress.md`：追加本轮实现、验证、文件清单和回滚方式。
- 回滚点为本轮开始前 `c607f2c`；提交前可执行 `git restore -- public/js/features/file-editor-actions.js public/js/features/file-editor.js public/js/features/file-editor-window.js public/styles.css tests/browser-performance.test.js tests/file-editor-ui.test.js docs/CONTINUE.md progress.md`，提交后可对包含本记录的提交执行 `git revert <commit>`。

## 2026-08-10 - Task: 修复对照窗口提前显示和改动标记偏移

### What was done

- 文件内容、MergeView、慢文件自动降级和布局刷新全部完成后才显示编辑浮窗，避免用户看到尚未准备好的窗口并误认为页面卡死。
- 使用不可见但参与布局的准备状态，保证 CodeMirror 在显示前即可获得真实窗口尺寸。
- 将标记轨道位置与点击跳转统一为同一滚动目标公式，并在窗口拉伸后重新计算标记位置。
- 隐藏准备期间仍保留关闭和失效结果清理能力，避免仓库切换或读取失败留下编辑器状态。

### Testing

- 修复前真实 Chromium 稳定复现：接口仍在等待时浮窗已经显示；标记轨道比例为 `0.328`，点击后的真实滚动比例为 `0.233`。
- `node --test tests/file-editor-ui.test.js`：`33/33` 通过。
- `npm.cmd run test:browser`：真实 Chromium `1/1` 通过；读取期间浮窗不可见，完成后正常显示，标记比例与实际滚动比例误差小于 `0.03`。
- `npm.cmd test`：完整回归 `198/198` 通过，0 失败、0 跳过；普通文件打开约 `111.0 ms`，慢文件首次降级约 `307.9 ms`。

### Notes

- `public/js/features/file-editor-actions.js`：统一标记轨道比例和点击跳转的滚动目标计算，并延后初始标记刷新。
- `public/js/features/file-editor-window.js`：CodeMirror 尺寸刷新后立即重新定位改动标记。
- `public/js/features/file-editor.js`：增加完整准备后显示的打开时序，并支持清理尚未显示的编辑器状态。
- `public/styles.css`：增加编辑浮窗准备状态的不可见布局样式。
- `tests/browser-performance.test.js`：增加延迟接口和标记滚动比例的真实浏览器回归。
- `tests/file-editor-ui.test.js`：增加完整准备后显示、统一滚动公式和刷新时机契约。
- `docs/CONTINUE.md`：记录问题原因、修复行为、实测偏移和性能结果。
- `progress.md`：追加本轮实现、验证、文件清单和回滚方式。
- 回滚点为本轮开始前 `c607f2c`；提交前可执行 `git restore -- public/js/features/file-editor-actions.js public/js/features/file-editor.js public/js/features/file-editor-window.js public/styles.css tests/browser-performance.test.js tests/file-editor-ui.test.js docs/CONTINUE.md progress.md`，提交后可对包含本记录的提交执行 `git revert <commit>`。

## 2026-08-10 - Task: 建立不使用浏览器内核的原生桌面首版

### What was done

- 在保留现有 Web 版的前提下新增 C# / .NET 8 / Avalonia 原生桌面工程，不使用 Chromium、WebView、本地 HTTP 服务或 Python。
- 完成中文三栏响应式界面，可选择本地仓库并浏览本地/远端分支、提交历史、变更文件和旧版/新版文本。
- Git 读取、解析和文本解码放在后台执行；仓库、分支、提交和文件切换会取消旧请求并终止仍在运行的 Git 进程树。
- 增加 UTF-8、UTF-16、GB18030 文本读取，以及二进制和超过 4 MiB 文本的性能保护提示。
- 增加 `native\start-native.cmd` 开发启动入口，并记录当前范围、构建方式和下一里程碑。

### Testing

- `.NET SDK 8.0.423`：安装并由 `dotnet --info` 确认。
- `dotnet build native\Forkline.Native\Forkline.Native.csproj --no-restore`：成功，0 警告、0 错误。
- `D:/桌面/GitTest` 真实运行：读取 9 个本地/远端引用、当前分支 20 条提交和首条提交 7 个变更文件；新增、删除文件的新旧内容与缺失提示正确。
- Windows 200% DPI 视觉检查：最大化约 `1453×865` 逻辑视口和约 `1050×700` 逻辑窄窗口均无文字重叠、按钮越界或栏位覆盖；长分支名 `origin/local_debug` 完整显示。
- Windows 无障碍接口快速选择 `local_debug → origin/main → 123`：最终引用为 `123`、20 条提交、7 个文件，进程 `Responding=True`。
- 最终测试窗口和临时截图均已关闭或删除；没有遗留 Forkline 原生测试进程。

### Notes

- `.gitignore`：忽略 .NET `bin/obj` 和 Visual Studio 临时目录。
- `native/Forkline.Native/`：新增原生应用、中文界面、MVVM 状态、Git 后台服务和数据模型。
- `native/start-native.cmd`：新增开发期双击启动入口，并支持传入仓库路径。
- `docs/NATIVE_DESKTOP.md`：记录技术基线、当前功能、性能边界和下一里程碑。
- `README.md`：增加简短的原生桌面预览入口。
- `docs/CONTINUE.md`：追加原生首版实现与真实高 DPI 验证结果。
- `progress.md`：追加本轮实现、验证、文件清单和回滚方式。
- 回滚方式：删除 `native/` 和 `docs/NATIVE_DESKTOP.md`，并执行 `git restore -- .gitignore README.md docs/CONTINUE.md progress.md`；若后续已提交，则执行 `git revert <commit>`。

## 2026-08-10 - Task: 精修 Avalonia 原生界面并增加 UI 缩放

### What was done

- 将 Web 版深色 Token、控件层次和主工作区密度映射到 Avalonia，精修标题栏、输入框、按钮、标签页、列表选中态、提交详情和底部三栏工作台。
- 使用自绘标题栏替代系统标题栏，并补齐最小化、最大化/还原、关闭和标题区域拖动。
- 增加 `75%`、`80%`、`90%`、`100%`、`110%` 五档 UI 缩放，默认 `90%`；缩放同时调整布局可用空间，不修改 Windows 系统缩放。
- 有效宽度低于 `900` 时把固定右侧详情栏改为可呼出的覆盖面板；底部三栏使用横向滚动保留完整业务结构，避免低分辨率下文字重叠。

### Testing

- `dotnet build native\Forkline.Native\Forkline.Native.csproj --no-restore`：通过，0 警告、0 错误。
- `dotnet format native\Forkline.Native\Forkline.Native.csproj --no-restore --verify-no-changes`：通过。
- `git diff --check`：无空白错误；仅报告工作区现有 LF/CRLF 转换提示。
- 使用 `D:\桌面\GitTest` 在 Windows 200% DPI 下实际载入 4 个本地分支、远端分支、提交图和 4 个工作区文件；最大化、约 `1050×700` 和约 `800×700` 逻辑窗口均无文字重叠或控件越界。
- Windows 无障碍接口实测缩放到 `75%`、恢复到 `90%`，并在约 `800×700` 窗口打开/关闭详情覆盖面板；状态和交互均正确。
- Forkline 原生测试窗口已关闭，所有临时验收截图已删除。

### Notes

- `native/Forkline.Native/App.axaml`：增加 Web 风格主题资源、渐变表面、控件状态、标签页、滚动条和窗口按钮样式。
- `native/Forkline.Native/Views/MainWindow.axaml`：重排主界面、自绘标题栏、底部缩放控制、紧凑详情入口和可滚动三栏工作台。
- `native/Forkline.Native/Views/MainWindow.axaml.cs`：增加窗口控制、五档 UI 缩放和紧凑详情覆盖逻辑。
- `docs/NATIVE_DESKTOP.md`：记录当前只读工作区范围、界面映射、缩放档位和窄窗口行为。
- `docs/CONTINUE.md`：追加原生界面精修、真实高 DPI 验证和下一里程碑。
- `progress.md`：追加本轮实现、验证、文件清单和回滚边界。
- 回滚方式：提交后对包含本轮改动的提交执行 `git revert <commit>`；提交前 `native/` 仍包含上一轮未提交成果，禁止直接删除目录或执行整体 `git restore`，应仅反向撤销本记录列出的三个原生界面文件和两段文档增量。

## 2026-08-11 - Task: 放弃 Avalonia 并建立 Electron 桌面试用外壳

### What was done

- 放弃需要维护第二套界面和功能的 Avalonia 方向，改为 Electron 直接承载现有 Forkline Web 界面与 Git 后端。
- Electron 自动选择空闲本机端口、启动 `server.js`、支持启动参数打开仓库，并在最后一个窗口关闭时终止后台服务。
- 渲染进程启用上下文隔离、关闭 Node 集成并开启沙箱；外部链接交给系统浏览器，Windows 顶栏保留原生窗口控制区。
- 增加双击启动入口、试用文档和外壳契约测试；现有 Web 启动和便携包流程保持不变。

### Testing

- `node --check electron/main.js`：通过。
- `node --check electron/preload.js`：通过。
- `node --test tests/electron-shell.test.js`：`2/2` 通过。
- `npm.cmd install --save-dev electron@latest`：未完成；首次受沙箱外 npm 缓存写入权限限制，申请联网安装后又被权限审核服务 `503 Service Unavailable` 阻断。
- 因 Electron 尚未安装，真实窗口、`D:/桌面/GitTest` 自动载入和退出后端口释放仍未验证，不能标记为可发布桌面版本。

### Notes

- `package.json`：指定 Electron 主进程入口并增加桌面启动命令。
- `electron/main.js`：新增单实例窗口、本机服务生命周期、启动仓库和外部链接边界。
- `electron/preload.js`：为复用的 Web 界面标记 Electron 运行环境。
- `start-electron.cmd`：新增桌面版双击启动入口和缺少依赖时的中文提示。
- `public/styles.css`：把 Web 顶栏设为可拖动区域，并为 Windows 原生窗口按钮预留空间。
- `tests/electron-shell.test.js`：增加安全配置、服务退出和标题栏交互区域契约。
- `README.md`、`docs/ELECTRON_DESKTOP.md`、`docs/CONTINUE.md`：记录 Electron 试用方式、运行边界和未完成的真实验收。
- `progress.md`：追加本轮实现、验证缺口、文件清单和回滚方式。
- Avalonia 产品源码已删除；`native/` 仅剩忽略的 `obj` 构建缓存，递归清理同样被权限审核服务 `503` 阻断，不影响 Electron 源码和 Git 状态判断。
- 提交前回滚时，先删除 `electron/`、`start-electron.cmd`、`docs/ELECTRON_DESKTOP.md` 和 `tests/electron-shell.test.js`，再执行 `git restore -p -- package.json README.md public/styles.css docs/CONTINUE.md progress.md` 逐块撤销本轮修改；不得整体恢复这些共享脏文件。

## 2026-08-11 - Task: 完成 Electron 安装、Windows 启动修复和真实窗口验收

### What was done

- 安装并锁定 Electron `43.3.0`，生成依赖锁文件和完整 Windows x64 运行目录。
- 修复 Windows/npm 把带引号仓库路径继续作为含引号字符串传入的问题，真实中文路径可在启动阶段正确识别。
- 修复双击脚本的 UTF-8、BOM 和 LF 换行兼容问题，使 `cmd.exe` 能稳定执行中文提示与括号命令块。
- 通过开发命令和最终双击入口分别启动 Electron，确认自动打开 `GitTest`、关闭窗口结束后台服务，并保留最终窗口供用户查看。

### Testing

- `npm.cmd install --save-dev electron@latest`：安装 Electron `43.3.0`，新增 13 个包，审计 14 个包，`0` 个漏洞。
- Electron Windows x64 运行包通过镜像完整下载；`electron.exe` 大小为 `225441792` 字节。
- `node --check electron/main.js`：通过。
- `node --test tests/electron-shell.test.js`：`4/4` 通过，覆盖隔离配置、标题栏交互区、带引号中文路径和批处理 UTF-8 CRLF 契约。
- `npm.cmd run desktop -- "D:\桌面\GitTest"`：真实启动成功；API 确认仓库为 `D:/桌面/GitTest`、分支为 `123`。
- `start-electron.cmd "D:\桌面\GitTest"`：最终用户入口真实启动成功；不再输出内部批处理命令，API 再次确认仓库和分支正确。
- Windows 200% DPI 窗口截图为 `1453×865`；现有 Web 排版、中文字体、分支标签和提交图无重叠，Electron 进程 `Responding=True`。
- 退出后随机端口 `54786`、`52228`、`51608` 均确认关闭；最终窗口使用 `53876` 并按用户试用需求保留运行。

### Notes

- `package.json`、`package-lock.json`：锁定 Electron 开发依赖和完整依赖树。
- `electron/main.js`：改为使用独立的启动仓库路径解析器。
- `electron/startup-repository.js`：新增 Windows 外层引号清理和启动仓库识别。
- `tests/electron-shell.test.js`：新增中文路径与 Windows 批处理编码、换行回归。
- `start-electron.cmd`：固定 UTF-8 代码页、无 BOM UTF-8 和 CRLF，保留中文缺少依赖提示。
- `README.md`、`docs/ELECTRON_DESKTOP.md`、`docs/CONTINUE.md`：更新为已完成开发态真实验收，并保留正式打包边界。
- `progress.md`：追加本轮安装、修复、真实证据、文件清单和回滚方式。
- 当前仍未加入正式安装包、代码签名和 Electron 自动更新；这三项不能因开发态窗口可用而视为完成。
- 提交前回滚时，删除 `electron/`、`start-electron.cmd`、`docs/ELECTRON_DESKTOP.md`、`tests/electron-shell.test.js` 和 `package-lock.json`，再执行 `git restore -p -- package.json README.md public/styles.css docs/CONTINUE.md progress.md` 逐块撤销本轮修改；`node_modules/` 可单独删除且不影响源码。共享脏文件禁止整体恢复。

## 2026-08-11 - Task: 修正 Electron 顶部栏排版并增加持久界面缩放

### What was done

- Electron 桌面窗口增加 `75%`、`80%`、`90%`、`100%`、`110%` 五档界面缩放，新安装默认 `90%`。
- 在设置页加入桌面专用缩放选择，并支持 `Ctrl+-`、`Ctrl++`、`Ctrl+0` 快捷键；缩放结果写入用户偏好文件并在下次启动恢复。
- 调整 Electron 中等逻辑宽度下的顶部栏断点和原生窗口按钮预留空间，使仓库、搜索和同步操作在缩放后保持紧凑对齐。

### Testing

- `node --check electron/main.js`：通过。
- `node --check electron/preload.js`：通过。
- `node --test tests/electron-shell.test.js`：`6/6` 通过，覆盖缩放归一化、步进、持久化、设置入口和顶部栏断点。
- `node --test tests/layout-ui.test.js tests/i18n.test.js tests/i18n-loader.test.js`：`46/46` 通过。
- 真实 Electron 验证：`75%` 时逻辑宽度 `1920px`，操作区右边界 `1770px`，保留 `150px` 原生按钮区域；`90%` 时逻辑宽度 `1600px`、顶部栏约 `104px`，设置页 `90%` 按钮正确选中。

### Notes

- `electron/desktop-zoom.js`：新增缩放档位、默认值、步进和用户偏好读写。
- `electron/main.js`、`electron/preload.js`：接入启动恢复、IPC、快捷键和渲染层最小桥接。
- `public/js/core.js`、`public/js/panels/settings.js`、`public/js/app/events.js`、`public/js/i18n-catalog.js`：增加桌面缩放状态、设置入口、交互和中英文文案。
- `public/styles.css`：增加缩放选项样式和 Electron 中等逻辑宽度顶部栏布局。
- `tests/electron-shell.test.js`：增加桌面缩放和顶部栏契约回归。
- `README.md`、`docs/ELECTRON_DESKTOP.md`、`docs/CONTINUE.md`：记录桌面缩放用法、持久化位置和真实验收结果。
- `progress.md`：追加本轮实现、验证、文件清单和回滚方式。
- 回滚时删除 `electron/desktop-zoom.js`，并逐块撤销上述共享文件中的本轮缩放增量；不得整体恢复这些文件，以免覆盖工作区中尚未提交的 Electron 外壳和历史文件性能改动。

## 2026-08-11 - Task: 将 Electron 原生窗口按钮移入独立标题栏

### What was done

- 将 Windows 最小化、最大化和关闭按钮从业务顶部栏覆盖区域移到最上方独立标题栏。
- 把 Electron 页面明确分成独立标题栏、业务顶部栏和工作区三行，删除业务操作区为系统按钮硬留的 `150px` 和 `160px` 空位。
- 原生标题栏覆盖高度随界面缩放同步调整，使五档缩放下系统按钮始终与独立标题栏对齐。

### Testing

- 修复前 `node --test tests/electron-shell.test.js`：新增独立标题栏回归按预期失败，`5/6` 通过。
- `node --check electron/main.js`：通过。
- `node --test tests/electron-shell.test.js`：`6/6` 通过。
- `node --test tests/layout-ui.test.js tests/i18n.test.js tests/i18n-loader.test.js`：`46/46` 通过。
- 真实 Electron `90%`：页面逻辑宽度 `1800px`，独立标题栏 `40px`，业务顶部栏范围为 `40px` 至约 `144px`，工作区从约 `144px` 开始。
- 真实 Electron `75%`：页面逻辑宽度 `1920px`，独立标题栏 `40px`，业务顶部栏范围为 `40px` 至 `144px`，工作区从 `144px` 开始；缩放偏好最终恢复为 `90%`。

### Notes

- `electron/main.js`：按界面缩放计算并同步 Windows 原生标题栏覆盖高度。
- `public/styles.css`：增加独立拖动标题栏和三行页面结构，移除系统按钮对业务顶部栏的覆盖式留白。
- `tests/electron-shell.test.js`：把标题栏契约改为独立行、业务栏下移和旧留白移除。
- `docs/ELECTRON_DESKTOP.md`、`docs/CONTINUE.md`：更新桌面标题栏行为和真实缩放验证结果。
- `progress.md`：追加本轮实现、验证、文件清单和回滚方式。
- 回滚时仅反向撤销上述五个文件中的本轮独立标题栏增量；这些文件同时包含尚未提交的 Electron 外壳、缩放和其他工作区改动，禁止整体恢复。

## 2026-08-11 - Task: 校准 Electron 右上角原生按钮与独立标题栏

### What was done

- 取消按界面缩放手工计算 Windows 原生标题栏高度，避免 DPI 和页面缩放叠加后出现小数像素偏差。
- Windows 原生按钮区恢复固定 `40px`，页面独立标题栏改为直接采用 Electron 提供的 `titlebar-area-height` 环境值。
- 保留独立标题栏、业务顶部栏、工作区三行结构，只修正右上角系统按钮与标题栏边界的校准方式。

### Testing

- 修复前 `node --test tests/electron-shell.test.js`：新增系统环境高度回归按预期失败，`5/6` 通过。
- `node --check electron/main.js`：通过。
- `node --test tests/electron-shell.test.js`：`6/6` 通过。
- `node --test tests/layout-ui.test.js tests/i18n.test.js tests/i18n-loader.test.js`：`46/46` 通过。
- 真实 Electron `75%`：系统标题栏环境值约 `54px`，业务顶部栏起点为 `54px`。
- 真实 Electron `90%`：系统标题栏环境值为 `45px`，业务顶部栏起点约为 `45px`；验证后恢复用户原有 `75%` 偏好。

### Notes

- `electron/main.js`：原生标题栏使用固定标准高度，不再随 Web 缩放手工重算。
- `public/styles.css`：独立标题栏高度改为 `env(titlebar-area-height, 40px)`。
- `tests/electron-shell.test.js`：增加系统标题栏环境值契约并禁止恢复手工高度计算。
- `docs/ELECTRON_DESKTOP.md`、`docs/CONTINUE.md`：更新右上角原生按钮校准机制和真实测量结果。
- `progress.md`：追加本轮实现、验证、文件清单和回滚方式。
- 回滚时仅反向撤销上述五个文件中的本轮校准增量；共享脏文件禁止整体恢复。

## 2026-08-11 - Task: 减少 Electron 开发修改触发的混合 DPI 指针异常

### What was done

- 增加仅开发态启用的 `public/` 文件监听，把连续保存合并为一次现有页面热刷新，不再为样式和前端脚本修改反复关闭、创建和最大化 Electron 窗口。
- 保持普通桌面启动、后台 Git 服务和正式打包行为不变；Electron 主进程或服务端改动仍明确要求手动重启。
- 将当前诊断结论记录为 Windows 双屏混合 DPI 下的指针缓存触发问题，避免把系统指针异常误判为页面持续高负载。

### Testing

- `node --check electron/main.js`、`node --check electron/renderer-reloader.js`、`node --check tests/electron-shell.test.js`：通过。
- `node --test --test-concurrency=1 tests/electron-shell.test.js`：`8/8` 通过，覆盖开发开关、打包禁用、连续变化去抖和停止监听。
- 真实运行 `npm.cmd run desktop:dev -- "D:\桌面\GitTest"`：创建和删除临时前端探针均触发窗口内刷新；主 Electron PID 保持 `24136`，后台服务 PID 保持 `11616`，随机端口保持 `51124`，当前仓库和 `123` 分支未变化。
- 临时探针文件已删除；测试窗口和随机端口在本轮结束前关闭并复查。

### Notes

- `package.json`：增加仅供开发使用的 `desktop:dev` 启动命令。
- `electron/main.js`：接入开发态监听、现有页面无缓存刷新和退出清理。
- `electron/renderer-reloader.js`：新增开发开关判断与连续文件变化去抖监听。
- `tests/electron-shell.test.js`：增加热刷新启用边界和监听生命周期回归。
- `docs/ELECTRON_DESKTOP.md`：记录热刷新命令、适用范围和仍需重启的文件类型。
- `docs/CONTINUE.md`：记录指针异常证据、缓解策略和真实进程验证。
- `progress.md`：追加本轮实现、验证、文件清单和回滚方式。
- 回滚点为本轮开始前 `c607f2c`；删除 `electron/renderer-reloader.js`，并逐块撤销上述共享文件中的本轮热刷新增量。当前 Electron 文件仍包含此前未提交成果，禁止整体删除 `electron/` 或整体恢复共享文件；提交后应对包含本记录的提交执行 `git revert <commit>`。

## 2026-08-11 - Task: 记忆 Electron 上次屏幕与窗口状态

### What was done

- Electron 首次启动继续使用默认最大化，后续启动恢复上次所在显示器、普通窗口尺寸和最大化状态，不再固定回到主屏后重新最大化。
- 恢复前校验当前显示器工作区；上次屏幕断开时丢弃失效坐标，窗口超过当前低分辨率工作区时自动收回可见范围。
- 移动、拉伸、最大化和还原事件使用延迟合并保存，关闭窗口前立即刷新；最大化时保存可还原尺寸，避免下次普通窗口误用整屏矩形。

### Testing

- 先增加窗口状态模块回归并确认因模块不存在而失败，再实现后转为通过。
- `node --check electron/main.js`、`node --check electron/desktop-window-state.js`、`node --check tests/electron-shell.test.js`：通过。
- `node --test --test-concurrency=1 tests/electron-shell.test.js`：`12/12` 通过，覆盖双屏工作区收回、拔屏回退、状态读写和主窗口生命周期接入。
- 真实双屏工作区：主屏 `0,0 / 1440x852`，左侧竖屏 `-864,-102 / 864x1488`。普通窗口在竖屏移动、拉伸并等待写入后，状态文件保存 `x=-820`、`y=-300`、`802x901`、非最大化；重开后渲染层为 `-827,-300 / 820x912`，仍位于竖屏。
- 把同一竖屏普通尺寸标记为最大化后重开，渲染层边界为 `-864,-640 / 864x1489`，与竖屏报告的可用区域完全一致，设备像素比为 `0.9375`；仓库保持 `D:/桌面/GitTest`、分支 `123`。
- 测试后恢复原有主屏最大化窗口偏好；Electron 进程、调试端口 `9333` 和最后一个随机服务端口 `53386` 均确认关闭。

### Notes

- `electron/desktop-window-state.js`：新增窗口状态校验、跨屏工作区收回及 JSON 读写。
- `electron/main.js`：接入窗口状态恢复、事件合并保存和关闭前刷新。
- `tests/electron-shell.test.js`：增加双屏、拔屏、持久化和主进程生命周期回归。
- `README.md`：补充桌面版会记住上次窗口状态的用户说明。
- `docs/ELECTRON_DESKTOP.md`：记录保存位置、恢复规则和手动重置方式。
- `docs/CONTINUE.md`：记录双屏真实验证数据、仓库保持和资源清理结果。
- `progress.md`：追加本轮实现、验证、文件清单和回滚方式。
- 回滚点为本轮开始前 `c607f2c`；删除 `electron/desktop-window-state.js`，并逐块撤销上述共享文件中的本轮窗口状态增量。当前 Electron 与文档仍包含此前未提交成果，禁止整体删除目录或整体恢复共享文件；提交后应对包含本记录的提交执行 `git revert <commit>`。

## 2026-08-11 - Task: 增加 Electron 页面恢复并隔离 Git 状态警告

### What was done

- 增加 Electron 页面无响应和渲染进程崩溃处理，短暂停顿先等待，只在用户明确选择后重载或退出。
- 让页面持续上报当前仓库、文件编辑器和提交草稿的未保存状态，弹窗会在重载前明确说明丢失风险。
- 审计全部直接 `git status` 调用，把成功命令的 stderr 警告与机器可解析的 stdout 分开，避免警告被当成工作区文件。
- 稳定真实 Chromium 性能回归的启动、CDP 超时、关闭和诊断输出，并隔离自动化测试的 Git 配置目录。
- 用语义主题变量替换 Electron 标题栏剩余的硬编码颜色，保持六套皮肤契约一致。

### Testing

- `node --test tests/backend-modules.test.js`：`3/3` 通过，包括直接 `git status` 调用的 stdout-only 守卫。
- `node --test tests/electron-shell.test.js`：`19/19` 通过，覆盖无响应延迟、恢复取消、未保存内容提示、崩溃原因和主进程接线。
- `node --test tests/design-system.test.js`：`4/4` 通过。
- `npm.cmd run test:browser`：真实 Chromium `1/1` 通过；3012 条历史渲染约 `4.6 ms`，4000 文件渐进首屏约 `162 ms`、完整详情约 `727 ms`，30 次编辑器开关后 DOM 和监听器无增长。
- `node --test tests/git-api.test.js`：本轮正常桌面权限基线 `29/29` 通过；完成调用点审计后，受限环境中除进程树取消外的 `28/28` 均通过。唯一环境缺口为沙箱拒绝 `taskkill /T /F`，错误文本为“拒绝访问”。
- `npm.cmd test`：`217/218` 通过；唯一失败与上述沙箱 `taskkill` 权限一致，其他 Web、Electron、Git、更新、主题和性能回归通过。
- 所有 `[DEBUG-fetch-cancel]` 临时诊断输出已删除。

### Notes

- `electron/renderer-health.js`：新增恢复状态归一化、无响应延迟、崩溃原因和用户选择控制。
- `electron/main.js`：接入页面无响应、恢复、渲染进程停止和恢复状态 IPC。
- `electron/preload.js`：在隔离桥接中增加有限的恢复状态上报接口。
- `public/js/core.js`：生成有界的桌面恢复快照并避免重复上报。
- `public/js/app/events.js`、`public/js/app/init.js`、`public/js/bootstrap.js`、`public/js/features/file-editor-window.js`、`public/js/features/file-editor.js`、`public/js/features/git-actions.js`：在提交草稿、编辑器和仓库状态变化时同步恢复快照。
- `public/styles.css`：使用语义颜色变量完善 Electron 标题栏的多主题契约。
- `server/git-branch-service.js`、`server/git-history-service.js`、`server/git-operations-service.js`、`server/git-worktree-service.js`、`server/repository-history.js`、`server/repository-state-service.js`、`server/repository-submodule-service.js`、`server/repository-worktree-service.js`：机器解析的 Git 状态调用只读取 stdout。
- `tests/backend-modules.test.js`：增加全部直接 `git status` 调用的静态契约守卫。
- `tests/electron-shell.test.js`：增加页面健康、恢复风险和 Electron 事件接线回归。
- `tests/browser-performance.test.js`：稳定 Chromium/CDP 生命周期、超时诊断和真实工作区数量断言，并隔离 Git 配置。
- `tests/git-api.test.js`：隔离 Git 的 XDG 配置目录。
- `README.md`、`docs/ELECTRON_DESKTOP.md`、`docs/CONTINUE.md`：记录桌面恢复行为、Git 警告隔离、性能数据和已知验证环境限制。
- `progress.md`：追加本轮实现、测试证据、文件清单和回滚边界。
- 回滚点为本轮开始前 `c607f2c`。提交前应仅逐块撤销本记录列出的健康保护、Git 输出隔离和测试稳定化增量，不得整体恢复共享脏文件或删除整个 `electron/`；提交后应对包含本记录的提交执行 `git revert <commit>`。
- 资源清理：确认无项目测试进程，端口 `5177`、`5287`、`5288` 均已关闭，并删除全部匹配的 Forkline 浏览器性能和取消用例临时目录。
- 旧 `native/` 目录删除前已确认没有 `bin/obj` 之外的文件；删除后路径不存在，没有触及 Electron 或共享 Web 源码。

## 2026-08-11 - Task: 降低大型工作区静默刷新开销

### What was done

- 5 秒静默轮询携带当前工作区快照；文件没有变化时，后端只返回快照和未完成 Git 操作状态，不再传输完整文件对象。
- 前端优先使用服务端工作区快照判断变化，无变化时保留现有文件树；未完成操作变化时只更新冲突/继续操作横幅，不重建文件列表或当前 Diff。
- 手动刷新、文件内容变化和储藏列表读取继续返回完整状态，保持原有文件树层级、暂存、储藏和冲突处理语义。

### Testing

- 先增加工作区轻量响应、文件变化回退完整响应、静默轮询跳过渲染和操作横幅更新回归，并确认旧实现 `7/11` 通过、4 项按预期失败；实现后 `tests/worktree-refresh.test.js` 为 `11/11` 通过。
- `node --test --test-concurrency=1 --test-name-pattern="worktree polling returns a compact unchanged response" tests/git-api.test.js`：`1/1` 通过，真实临时 Git 仓库验证无变化短响应和继续编辑后的完整响应。
- `npm.cmd run test:browser`：真实 Chromium `1/1` 通过；4000 文件完整响应约 `1,012,121` 字节，无变化响应 `121` 字节，文件树首批 800 个并可继续载入全部 4000 个，最大事件循环延迟约 `114 ms`。
- `npm.cmd test`：`222/223` 通过；唯一失败仍为受限环境中 Windows 长时间 fetch 取消测试等待进程树退出超时，本轮新增和其余 Web、Electron、Git、主题、更新及性能回归全部通过。尝试在正常桌面权限下单独复跑时，权限审批服务返回 `503 auth_unavailable`，因此未能在本轮重新取得该环境证据。
- `node --check public/js/features/worktree-refresh.js`、`node --check public/js/features/worktree-changes.js`、`node --check server/repository-worktree-service.js`、`node --check server.js`、`node --check tests/browser-performance.test.js`：通过。
- `git diff --check`：通过，仅有仓库既有的 LF/CRLF 提示；端口 `5177`、`5287`、`5288` 均未监听。

### Notes

- `public/js/features/worktree-refresh.js`：静默请求携带快照，处理 `unchanged` 响应并避免文件树重绘。
- `public/js/features/worktree-changes.js`：签名优先使用服务端快照，并支持只替换未完成操作横幅。
- `server/repository-worktree-service.js`：匹配 `expectedSnapshot` 时返回轻量状态，储藏请求保持完整响应。
- `server.js`：把工作区接口的 `expectedSnapshot` 查询参数传给仓库服务。
- `tests/worktree-refresh.test.js`：增加快照签名、静默轮询、操作横幅和储藏完整响应回归。
- `tests/git-api.test.js`：增加真实仓库无变化/继续编辑接口回归。
- `tests/browser-performance.test.js`：验证 4000 文件无变化响应体积和现有完整文件树性能边界。
- `README.md`、`docs/CONTINUE.md`：记录自动刷新行为、完整请求边界和真实性能数据。
- `progress.md`：追加本轮实现、验证、文件清单和回滚方式。
- 回滚点为本轮开始前 `c607f2c`；提交前应只逐块撤销本记录列出的工作区轮询增量，不得整体恢复共享脏文件。提交后应对包含本记录的提交执行 `git revert <commit>`。

## 2026-08-11 - Task: 降低大型工作区空闲扫描频率

### What was done

- 对 4000 文件热刷新做分段基准，确认剩余主要成本是逐文件元数据检查，而不是 `git status`、响应体解析或文件树首屏渲染。
- 仅当工作区达到 800 个文件且连续没有变化时，把自动轮询从 5 秒逐步退避到 10、20、30 秒；重新聚焦、检测到变化或小工作区继续使用 5 秒。
- 保持手动刷新、Git 操作后刷新、文件内容快照、冲突横幅和完整工作区状态语义不变，没有采用会连续阻塞 Node 线程的同步文件读取，也没有依赖可能漏事件的文件监听缓存。

### Testing

- 临时 4000 文件基准中，`git status` 三次约 `59-78 ms`，热 `readWorkingStatus` 约 `192 ms`，不同异步并发下 4000 次 `stat` 约 `183-200 ms`；同步 `stat` 约 `139 ms`，但会整段阻塞 Node 线程，因此未采用。完整热读取约 `255-398 ms`，无变化响应保持 `121` 字节。临时基准脚本和系统临时仓库均已删除。
- 先修改退避回归并确认旧实现 `8/12` 通过、4 项按预期失败；实现后 `node --test --test-concurrency=1 tests/worktree-refresh.test.js` 为 `12/12` 通过。
- `npm.cmd run test:browser`：真实 Chromium `1/1` 通过；4000 文件完整/无变化响应仍为 `1,012,121/121` 字节，首批 800 个文件和后续 4 批完整载入、仓库切换、编辑器连续开关、DOM、监听器和 GC 后堆边界均通过。
- `npm.cmd test`：`223/224` 通过；唯一失败仍是受限环境中 Windows 长时间 fetch 取消测试等待进程树退出超时，新增退避以及其余 Web、Electron、Git、更新、主题和真实性能回归全部通过。
- 首屏性能门限通过：默认资源 `37` 个、`738,688` 字节，未把编辑器或英文词典重新放回启动路径。

### Notes

- `public/js/features/worktree-refresh.js`：增加大工作区无变化轮询退避、刷新结果分类和重新聚焦立即检查。
- `tests/worktree-refresh.test.js`：覆盖小工作区固定 5 秒、大工作区退避上限、变化复位、隐藏页面停扫和重新聚焦刷新。
- `README.md`、`docs/CONTINUE.md`：记录退避条件、时间序列、响应边界、性能依据和当前回归基线。
- `progress.md`：追加本轮实现、基准、验证、文件清单和回滚方式。
- 回滚点为本轮开始前 `c607f2c`；提交前只撤销本记录列出的自动轮询退避增量，不得整体恢复包含其他未提交成果的共享文件。提交后应对包含本记录的提交执行 `git revert <commit>`。
- 资源清理：完整测试曾留下两个 `forkline-operation-cancel-*` 临时目录；逐项确认没有 `slow-ssh.pid` 或测试助手进程后按明确路径删除。最终工作区扫描、浏览器性能和取消测试临时目录均为 0，Node 监听端口为 0，`5177`、`5287`、`5288` 均未监听。

## 2026-08-11 - Task: 降低大型工作区文件树滚动载入停顿

### What was done

- 保持工作区文件树首屏显示 800 个文件，把后续滚动续载从每批 800 个缩小为每批 400 个，避免一次向页面追加过多文件行。
- 对工作区目录组增加布局和绘制隔离，并让 Chromium 跳过屏幕外文件行的实际绘制；完整 DOM、目录归纳、折叠、选择、双击和全部文件访问保持不变。
- 增加真实浏览器回归，记录每批同步处理、帧完成时间和事件循环延迟，并守卫单帧追加上限及屏幕外绘制跳过状态。

### Testing

- 先运行 `npm.cmd run test:browser`，确认旧实现因单帧追加 800 行按预期失败；修复后连续三次真实 Chromium 回归均为 `1/1` 通过。
- 4000 文件夹具中，未启用屏幕外绘制跳过时完整续载约 `916 ms`、最大事件循环延迟约 `227 ms`；最终两次专项复测约为 `623-629 ms`、`89-100 ms`。完整回归内再次测得约 `638 ms`、`115 ms`，首屏仍为 800 行，8 批后完整访问 4000 行。
- `node --test --test-concurrency=1 tests/worktree-refresh.test.js`：`12/12` 通过；`node --check public/js/features/worktree-changes.js` 和 `node --check tests/browser-performance.test.js`：通过。
- `npm.cmd test`：`223/224` 通过；唯一失败仍是受限环境中 Windows 长时间 fetch 取消测试等待进程树退出超时，本轮工作区、浏览器、Electron、Git、主题和更新相关回归均通过。
- `git diff --check`：通过，仅有仓库既有的 LF/CRLF 提示。项目 Node 监听端口、`5177`、`5287`、`5288` 均为空；完整测试遗留的唯一 `forkline-operation-cancel-*` 临时目录已按明确路径删除。

### Notes

- `public/js/features/worktree-changes.js`：拆分首屏文件上限和后续续载批次，分别保持 800 和 400。
- `public/styles.css`：为工作区目录组增加布局/绘制隔离，并为屏幕外文件行启用 `content-visibility`。
- `tests/browser-performance.test.js`：增加分批载入诊断、400 行上限和屏幕外绘制状态回归。
- `README.md`、`docs/CONTINUE.md`：记录大型工作区渐进显示方式、行为边界和真实性能数据。
- `progress.md`：追加本轮实现、验证、文件清单和回滚方式。
- 回滚点为本轮开始前 `c607f2c`；提交前只逐块撤销本记录列出的文件树续载和绘制优化，不得整体恢复包含其他未提交成果的共享文件。提交后应对包含本记录的提交执行 `git revert <commit>`。

## 2026-08-11 - Task: 降低首屏资源并按需加载设置与储藏面板

### What was done

- 审计大工作区后端读取后，实测把 Node 文件系统线程池提高到 16 没有稳定收益，因此没有引入全局线程数调整或额外资源占用。
- 把设置和储藏面板从默认首屏脚本清单移出，新增共享右栏面板加载器；第一次打开对应页签时才加载真实模块，后续直接复用。
- 同一面板的并发渲染只插入一个脚本；加载失败会移除失败资源并显示重试入口，用户切到其他页后完成的旧加载不会覆盖当前右栏。

### Testing

- 先修改首屏资源与模块顺序回归，确认旧实现为 `38/40`，两项按预期失败；实现后加载器、布局和首屏资源专项为 `42/42` 通过。
- 中文首屏从 `37` 个资源、`738,911` 字节降到 `36` 个资源、`718,820` 字节，减少 `20,091` 字节；设置与储藏实现文件不再出现在首屏清单。
- `npm.cmd run test:browser`：真实 Chromium `1/1` 通过；启动时设置/储藏渲染函数和资源均不存在，首次打开分别约 `12-23 ms`，连续两次渲染各只加载一个脚本，DOM、监听器和 GC 后堆边界保持稳定。
- `npm.cmd test`：`225/226` 通过；唯一失败仍是受限环境中 Windows 长时间 fetch 取消测试等待进程树退出超时，设置、储藏、Electron、Git、主题、更新和其余真实性能回归全部通过。
- `node --check public/js/panels/inspector-panel-loader.js`、`node --check tests/browser-performance.test.js` 和 `git diff --check`：通过，仅有仓库既有的 LF/CRLF 提示。
- 线程池对照使用 `UV_THREADPOOL_SIZE=16` 运行真实 Chromium，4000 文件完整/无变化 API 约 `419/261 ms`，与默认线程池约 `432-447/252-259 ms` 没有稳定差异，因此未保留该实验。

### Notes

- `public/index.html`：首屏改为加载共享右栏面板加载器，不再直接加载设置和储藏实现。
- `public/js/panels/inspector-panel-loader.js`：新增设置/储藏模块的按需、去重、失败重试和切页保护。
- `public/js/panels/inspector.js`：设置和储藏页签改走共享按需加载入口。
- `public/js/i18n-catalog.js`：增加通用面板加载与失败提示的英文翻译。
- `tests/inspector-panel-loader.test.js`：覆盖并发去重和失败后重试。
- `tests/startup-resource-budget.test.js`、`tests/layout-ui.test.js`、`tests/browser-performance.test.js`：守卫首屏排除项、脚本顺序和真实浏览器首次加载行为。
- `README.md`、`docs/CONTINUE.md`、`docs/ARCHITECTURE.md`：记录用户行为、性能数据和新的脚本加载顺序。
- `progress.md`：追加本轮实现、验证、文件清单和回滚方式。
- 回滚点为本轮开始前 `c607f2c`；提交前只逐块撤销本记录列出的按需面板加载增量，不得整体恢复包含其他未提交成果的共享文件。提交后应对包含本记录的提交执行 `git revert <commit>`。

## 2026-08-11 - Task: 按需加载标签面板并继续降低首屏资源

### What was done

- 把标签面板加入现有共享右栏加载器，从默认首屏脚本清单移除 `tags.js`；第一次打开“标签列表”时才载入，后续直接复用。
- 保留标签列表选择、按钮操作和标签行右键菜单的原有行为；加载器仍提供并发去重、失败重试和切页保护。
- 首屏资源守卫新增标签模块排除项，布局和真实浏览器回归同步固定新的加载边界。

### Testing

- 加载器、布局和首屏资源专项：`43/43` 通过；中文首屏为 `35` 个资源、`712,397` 字节，相比上一基线减少 1 个请求和 `6,423` 字节。
- `npm.cmd run test:browser`：真实 Chromium `1/1` 通过；设置/储藏/标签首次加载约 `11-23 ms`，标签行右键菜单正常，复杂历史文件、大工作区、渐进打开和长时间开关编辑器边界保持稳定。
- `npm.cmd test`：`226/227` 通过；唯一失败仍是受限环境中 Windows 长时间 fetch 取消测试等待进程树退出超时，本轮标签加载、右键操作及其余 Git、Electron、更新和性能回归全部通过。
- `git diff --check` 在本轮收尾检查中执行；仅允许仓库既有的 LF/CRLF 提示，不接受新增空白错误。

### Notes

- `public/index.html`：移除标签实现的首屏脚本声明。
- `public/js/panels/inspector-panel-loader.js`：加入标签面板资源和渲染器定义。
- `public/js/panels/inspector.js`：标签页签改走共享按需加载入口。
- `tests/inspector-panel-loader.test.js`：覆盖标签首次加载及实际复制动作函数可用。
- `tests/startup-resource-budget.test.js`、`tests/layout-ui.test.js`、`tests/browser-performance.test.js`：守卫标签不进入首屏，并验证真实标签渲染和右键菜单。
- `README.md`、`docs/CONTINUE.md`、`docs/ARCHITECTURE.md`：记录用户行为、加载顺序、首屏基线和验证结果。
- `progress.md`：追加本轮实现、验证、文件清单和回滚方式。
- 回滚点为本轮开始前 `c607f2c`；提交前只逐块撤销本记录列出的标签按需加载增量，不得整体恢复包含其他未提交成果的共享文件。提交后应对包含本记录的提交执行 `git revert <commit>`。

## 2026-08-11 - Task: 按需加载分支整理、工作树和子模块面板

### What was done

- 把包含分支整理、工作树和子模块的 `workspaces.js` 从默认首屏脚本清单移出，三个页签第一次打开时才共同加载该模块。
- 为共享右栏加载器增加多页签模块支持；工作区模块加载期间即使用户切换到另一个关联页签，完成后也只渲染当前页，不会回写旧页。
- 保留三个面板的刷新、创建、打开、清理和子模块操作；左侧分支右键菜单继续使用原有独立实现，不受模块拆出影响。

### Testing

- 先增加首屏、加载器和布局回归，旧实现为 `41/44`，三项按预期失败；实现及测试夹具补齐后专项为 `44/44` 通过。
- 中文首屏从 `35` 个资源、`712,397` 字节降到 `34` 个资源、`680,879` 字节，减少 1 个请求和 `31,518` 字节。
- `npm.cmd run test:browser`：真实 Chromium `1/1` 通过；工作区管理模块首次加载约 `11.5 ms`，三个页签复用同一个脚本，复杂文件、3012 条提交、4000 文件工作区和长时间编辑器开关边界稳定。
- `npm.cmd test`：`227/228` 通过；唯一失败仍是受限环境中 Windows 长时间 fetch 取消测试等待进程树退出超时，分支整理、工作树、子模块、Electron、Git 与其余性能回归全部通过。
- `node --check` 与 `git diff --check` 通过；`5177/5287/5288` 和 Node 监听均为 0。完整回归失败项留下 1 个 `forkline-operation-cancel-*` 临时夹具，删除审批服务返回 `503 auth_unavailable`，因此本轮未绕过权限清理，后续获得明确授权后只删除该已验证位于系统 TEMP 内的目录。

### Notes

- `public/index.html`：移除工作区管理模块的首屏脚本声明。
- `public/js/panels/inspector-panel-loader.js`：增加多页签工作区模块定义和当前页签保护。
- `public/js/panels/inspector.js`、`public/js/panels/workspaces.js`：三个页签改走共享按需入口，并由模块按当前页签分派实际渲染器。
- `public/js/i18n-catalog.js`：补充分支与工作区加载提示的英文文案。
- `tests/inspector-panel-loader.test.js`、`tests/layout-ui.test.js`、`tests/startup-resource-budget.test.js`、`tests/browser-performance.test.js`：覆盖模块拆出、共享加载、快速切页、首屏门限和真实浏览器复用。
- `README.md`、`docs/CONTINUE.md`、`docs/ARCHITECTURE.md`：记录用户行为、加载顺序、首屏基线和验证结果。
- `progress.md`：追加本轮实现、验证、文件清单和回滚方式。
- 回滚点为本轮开始前 `c607f2c`；提交前只逐块撤销本记录列出的工作区面板按需加载增量，不得整体恢复包含其他未提交成果的共享文件。提交后应对包含本记录的提交执行 `git revert <commit>`。
- 资源清理：真实浏览器与完整测试服务均已退出，唯一 `forkline-operation-cancel-*` 临时目录已按明确路径删除；项目 Node 监听端口、`5177`、`5287`、`5288` 均为空。

## 2026-08-11 - Task: 按需加载恢复点面板并保留启动保护

### What was done

- 把恢复点页面、列表、筛选、reflog 和页面操作从默认首屏拆出，第一次打开“恢复点”时由共享右栏加载器载入，后续直接复用。
- 把启动、仓库切换、设置页和危险操作需要的恢复策略保留为轻量首屏模块；恢复策略、清理确认和后端候选校验语义不变。
- 清理完成后的选择恢复不再调用按需页面中的筛选函数：原选择仍存在时保留，否则选择新的第一项，消除启动模块对页面模块的反向依赖。
- 中文首屏资源数量保持 34 个，总体积由 680,879 降到 655,389 字节，减少 25,490 字节。

### Testing

- 先确认旧实现的加载器、布局和首屏资源回归为 `42/45`，三项按预期失败；拆分后恢复策略、加载器、布局和首屏资源专项为 `49/49` 通过。
- `node --check public/js/features/recovery-policy.js`、`node --check public/js/panels/recovery.js`：通过；`git diff --check`：通过，仅有仓库既有的 LF/CRLF 提示。
- `npm.cmd run test:browser`：真实 Chromium `1/1` 通过；启动时 `renderRecoveryTab` 未定义、恢复策略已可用，首次打开恢复点页面约 108.2 ms，只加载 1 个恢复资源。复杂文件、3012 条历史、4000 文件工作区和反复开关编辑器边界保持稳定。
- `npm.cmd test`：`228/229` 通过；唯一失败仍是受限环境中 Windows 长时间 fetch 取消测试等待进程树退出超时，本轮恢复策略、恢复点、Electron、Git 与其余性能回归全部通过。
- 测试服务已退出，`5177`、`5287`、`5288` 监听数量均为 0。

### Notes

- `public/js/features/recovery-policy.js`：新增首屏恢复策略、偏好、整理确认和危险操作后清理模块。
- `public/js/panels/recovery.js`：只保留恢复点页面、筛选、reflog 和页面动作。
- `public/js/panels/inspector-panel-loader.js`、`public/js/panels/inspector.js`：增加恢复点模块定义并让恢复页走共享按需入口。
- `public/index.html`：首屏用轻量恢复策略模块替换完整恢复点页面脚本。
- `tests/recovery-policy-ui.test.js`、`tests/inspector-panel-loader.test.js`、`tests/layout-ui.test.js`、`tests/startup-resource-budget.test.js`、`tests/browser-performance.test.js`：固定策略模块边界、恢复页首次加载、首屏排除项和真实 Chromium 行为。
- `README.md`、`docs/CONTINUE.md`、`docs/ARCHITECTURE.md`：同步用户行为、加载顺序、首屏基线和验证结果。
- `progress.md`：追加本轮实现、验证、文件清单和回滚方式。
- 回滚点为本轮开始前 `c607f2c`；提交前只逐块撤销本记录列出的恢复点按需加载增量，不得整体恢复包含其他未提交成果的共享文件。提交后应对包含本记录的提交执行 `git revert <commit>`。
- 旧测试临时目录 `C:\Users\Administrator\AppData\Local\Temp\forkline-operation-cancel-WsjQez` 仍存在但没有进程或端口占用；本轮未绕过此前失败的删除权限审核。

## 2026-08-11 - Task: 按需加载文件历史与逐行追踪

### What was done

- 把文件历史和逐行追踪的渲染、API 请求、刷新与跳转动作从首屏 `inspector.js` 拆到共享按需模块。
- 保留轻量打开入口和原有仓库/引用/文件请求键；重复打开共用同一进行中的 Promise，旧请求丢弃和图谱外提交跳转语义保持不变。
- 文件历史与逐行追踪共用一个资源和加载 Promise；快速切页期间完成的加载只渲染当前页签。
- 中文首屏资源数保持 34 个，总体积由 655,389 降到 646,883 字节，减少 8,506 字节。

### Testing

- `node --check public/js/panels/file-insights.js`、`node --check public/js/panels/inspector.js`、`node --check public/js/panels/inspector-panel-loader.js`：通过。
- `node --test tests\inspector-panel-loader.test.js tests\layout-ui.test.js tests\startup-resource-budget.test.js`：`46/46` 通过；首屏诊断为 34 个资源、646,883 字节。
- `npm.cmd run test:browser`：真实 Chromium `1/1` 通过；启动时文件历史、逐行追踪和共享渲染器均未定义，首次打开 `small.c` 后两页均有记录，只加载 1 个 `fileInsights` 资源，两页合计约 230.5 ms。
- `npm.cmd test`：`229/230` 通过；唯一失败仍是受限 Windows 环境中长时间 fetch 进程树取消后等待响应超时，本轮文件追踪、其他 Git、Electron 与性能回归全部通过。
- 测试服务和项目 Node/Git 进程已退出，`5177`、`5287`、`5288` 监听数均为 0；本轮新生成的两个取消测试临时目录已按明确路径删除。

### Notes

- `public/js/panels/file-insights.js`：新增文件历史与逐行追踪的共享按需实现。
- `public/js/panels/inspector.js`：只保留右栏分派、打开入口和引用选择，移除文件追踪的重实现。
- `public/js/panels/inspector-panel-loader.js`：增加文件历史/逐行追踪共享模块定义。
- `tests/inspector-panel-loader.test.js`、`tests/layout-ui.test.js`、`tests/startup-resource-budget.test.js`、`tests/browser-performance.test.js`：固定按需边界、共享资源、首屏排除项和真实浏览器行为。
- `README.md`、`docs/CONTINUE.md`、`docs/ARCHITECTURE.md`：同步用户行为、加载边界、首屏基线和验证结果。
- `progress.md`：追加本轮实现、测试证据、文件清单和回滚方式。
- 回滚点为本轮开始前 `c607f2c`；提交前只逐块撤销本记录列出的文件追踪按需加载增量，不得整体恢复包含其他未提交成果的共享文件。提交后应对包含本记录的提交执行 `git revert <commit>`。
- 旧临时目录 `C:\Users\Administrator\AppData\Local\Temp\forkline-operation-cancel-WsjQez` 仍存在但没有相关进程或端口占用；本轮没有绕过既有权限边界删除它。

## 2026-08-11 - Task: 按需加载同步页认证与远端诊断

### What was done

- 把 `auth.js` 从默认首屏脚本清单移出，第一次打开“同步情况”时由共享右栏加载器载入，后续直接复用。
- 认证模块继续提供远端列表、连接诊断、认证助手和系统凭据入口；仅增加轻量同步页渲染入口。
- `sync.js` 中的同步状态合并、轻量刷新和推送保护保留在首屏，顶栏和 Git 动作的调用边界不变。
- 中文首屏从 34 个资源、646,883 字节降到 33 个资源、628,513 字节，减少 1 个请求和 18,370 字节。

### Testing

- 先增加同步按需回归，旧实现为 `44/47`，同步加载、首屏脚本排除和资源预算三项按预期失败；实现后 `47/47` 通过。
- `node --check public/js/panels/auth.js`、`node --check public/js/panels/inspector.js`、`node --check public/js/panels/inspector-panel-loader.js`：通过。
- `npm.cmd run test:browser`：真实 Chromium `1/1` 通过；启动时 `renderSyncPanel` 和 `loadAuthDiagnostics` 均未定义，打开同步页后只加载 1 个同步认证资源，页面约 47.8 ms 可用；完整回归内复测约 40.3 ms。
- `npm.cmd test`：`230/231` 通过；唯一失败仍是受限 Windows 环境中长时间 fetch 进程树取消后等待响应超时，本轮同步 API、认证、其他 Git、Electron 与性能回归全部通过。
- 测试服务、项目 Node/Git 进程已退出，`5177`、`5287`、`5288` 监听数均为 0；本轮新生成的取消测试临时目录已按明确路径删除。

### Notes

- `public/index.html`：移除同步认证模块的首屏脚本声明。
- `public/js/panels/auth.js`：增加按需同步页渲染入口，保留认证与远端诊断实现。
- `public/js/panels/inspector.js`、`public/js/panels/inspector-panel-loader.js`：同步页改走共享按需加载入口。
- `tests/inspector-panel-loader.test.js`、`tests/layout-ui.test.js`、`tests/startup-resource-budget.test.js`、`tests/browser-performance.test.js`：覆盖首屏排除、单资源复用、同步页真实渲染和性能基线。
- `README.md`、`docs/CONTINUE.md`、`docs/ARCHITECTURE.md`：同步用户行为、启动/按需边界、首屏基线和验证结果。
- `progress.md`：追加本轮实现、测试证据、文件清单和回滚方式。
- 回滚点为本轮开始前 `c607f2c`；提交前只逐块撤销本记录列出的同步认证按需加载增量，不得整体恢复包含其他未提交成果的共享文件。提交后应对包含本记录的提交执行 `git revert <commit>`。
- 旧临时目录 `C:\Users\Administrator\AppData\Local\Temp\forkline-operation-cancel-WsjQez` 仍存在但没有相关进程或端口占用；本轮没有绕过既有权限边界删除它。

## 2026-08-11 - Task: 将同步页展示整体移入按需模块

### What was done

- 把同步页布局、待拉取/待推送提交列表与预览、upstream、远端管理、PR 入口和认证展示从首屏同步核心移入现有按需模块；第一次打开“同步情况”时一次载入完整页面，后续直接复用。
- 首屏同步核心只保留状态合并、仓库快照校验、轻量刷新和推送保护，顶栏抓取/拉取/推送、命令面板与 Git 动作不依赖同步页面先完成加载。
- 中文首屏资源数保持 33 个，体积从 `628,513` 降到 `615,018` 字节，再减少 `13,495` 字节；相对本轮开始的 `34 / 655,389` 累计减少 1 个请求和 `40,371` 字节。

### Testing

- `node --test tests\inspector-panel-loader.test.js tests\layout-ui.test.js tests\recovery-policy-ui.test.js tests\startup-resource-budget.test.js`：`51/51` 通过，首屏诊断为 33 个资源、615,018 字节。
- `npm.cmd run test:browser`：真实 Chromium `1/1` 通过；完整同步页首次按需加载约 `38-49 ms`，文件历史与逐行追踪约 `198-225 ms`，4000 文件、3012 条提交、编辑器反复开关、DOM、监听器和堆边界均通过。
- `npm.cmd test`：`230/231` 通过；唯一失败仍是受限 Windows 环境中取消长时间 fetch 后等待响应超时，本轮同步、Git、Electron 和真实性能回归其余项目全部通过。
- `node --check public/js/panels/sync.js`、`node --check public/js/panels/auth.js`、`node --check public/js/panels/inspector-panel-loader.js` 和 `git diff --check`：通过，仅有仓库既有的 LF/CRLF 提示。
- 测试服务与项目 Node/Git/SSH 测试进程均已退出，`5177`、`5287`、`5288` 监听数为 0；本轮新生成的 `forkline-operation-cancel-FcxCJN` 已按确认的 TEMP 路径删除，旧目录 `forkline-operation-cancel-WsjQez` 保留。

### Notes

- `public/js/panels/sync.js`：只保留首屏需要的同步状态、轻量刷新和推送保护核心。
- `public/js/panels/auth.js`：承接完整同步页布局、提交预览、upstream/远端、PR 和认证诊断展示。
- `public/js/panels/inspector-panel-loader.js`：同步页加载完成后直接调用按需模块渲染器，保留资源去重、失败重试和快速切页保护。
- `tests/inspector-panel-loader.test.js`、`tests/layout-ui.test.js`、`tests/startup-resource-budget.test.js`、`tests/browser-performance.test.js`：固定完整同步页按需边界、首屏门限和真实浏览器行为。
- `README.md`、`docs/CONTINUE.md`、`docs/ARCHITECTURE.md`：记录同步模块职责、用户加载行为、最终首屏基线和验证结果。
- `progress.md`：追加本轮实现、测试证据、文件清单和回滚方式。
- 回滚点为本轮开始前 `c607f2c`；提交前只逐块撤销本记录列出的同步页展示按需化增量，不得整体恢复包含其他未提交成果的共享文件。提交后应对包含本记录的提交执行 `git revert <commit>`。

## 2026-08-11 - Task: 按需加载分支比较页

### What was done

- 把分支/引用比较页面从默认首屏脚本清单移入现有共享右栏加载器；第一次进入“分支比较”或从分支右键发起比较时才载入，后续复用同一资源。
- 保留首屏 `openCompareBranch()` 和真实比较 API 请求；页面资源与结果无论谁先就绪，都按当前比较状态渲染，交换引用、刷新、提交跳转和文件 Diff 行为不变。
- 中文首屏从 `33` 个资源、`615,018` 字节降到 `32` 个资源、`606,029` 字节，减少 1 个请求和 `8,989` 字节。

### Testing

- 先增加比较页加载器、布局和首屏排除回归，确认旧实现为 `45/48`，三项按预期失败；实现后专项 `48/48` 通过。
- `npm.cmd run test:browser`：真实 Chromium `1/1` 通过；通过 `openCompareBranch("HEAD", "HEAD~1")` 发起真实比较后，首次 API、资源加载和渲染约 `249-291 ms`，比较资源节点保持 1 个。3012 条提交、4000 文件、编辑器浸泡、DOM、监听器和堆边界继续通过。
- `npm.cmd test`：`231/232` 通过；唯一失败仍是受限 Windows 环境中取消长时间 fetch 后等待响应超时，本轮比较页、Git、Electron 和真实性能回归其余项目全部通过。
- `node --check public/js/panels/inspector-panel-loader.js`、`node --check public/js/panels/inspector.js`、`node --check tests/browser-performance.test.js` 和 `git diff --check`：通过，仅有仓库既有的 LF/CRLF 提示。
- 测试服务与项目 Node/Git/SSH 测试进程均已退出，`5177`、`5287`、`5288` 监听数为 0；本轮新生成的 `forkline-operation-cancel-vYkrvN` 已按确认的 TEMP 路径删除，旧目录 `forkline-operation-cancel-WsjQez` 保留。

### Notes

- `public/index.html`：移除分支比较页面的首屏脚本声明。
- `public/js/panels/inspector-panel-loader.js`：增加比较页资源、渲染器和加载状态定义。
- `public/js/panels/inspector.js`：比较页改走共享按需加载入口。
- `tests/inspector-panel-loader.test.js`：覆盖比较资源首次加载、动作函数就绪和重复打开复用。
- `tests/layout-ui.test.js`、`tests/startup-resource-budget.test.js`：守卫比较页不进入首屏，并固定加载器连接和新资源基线。
- `tests/browser-performance.test.js`：从真实比较请求入口验证首次载入、页面渲染、资源复用和性能边界。
- `README.md`、`docs/CONTINUE.md`、`docs/ARCHITECTURE.md`：记录用户行为、模块职责、加载顺序、首屏基线和验证结果。
- `progress.md`：追加本轮实现、测试证据、文件清单和回滚方式。
- 回滚点为本轮开始前 `c607f2c`；提交前只逐块撤销本记录列出的比较页按需加载增量，不得整体恢复包含其他未提交成果的共享文件。提交后应对包含本记录的提交执行 `git revert <commit>`。

## 2026-08-11 - Task: 按需加载操作日志面板并保留取消能力

### What was done

- 把操作日志列表、界面诊断、复制/清空和页面刷新从默认首屏移入共享右栏按需模块；第一次打开“操作日志”时载入，后续复用同一资源。
- 把长时间 Git 操作轮询和取消核心保留在首屏 API 层；日志页面未载入时，克隆窗口和运行中操作提示仍可取消，确认、按钮禁用和结果提示语义不变。
- 中文首屏从 `32 / 606,029` 降到 `31 / 598,497`，减少 1 个请求和 `7,532` 字节；相对 `37 / 738,911` 累计减少 6 个请求和 `140,414` 字节。

### Testing

- `node --check public/js/api.js`、`node --check public/js/panels/logs.js`、`node --check public/js/panels/inspector-panel-loader.js`、`node --check public/js/panels/inspector.js`、`node --check tests/browser-performance.test.js`：全部通过。
- `node --test tests\api-repo-context.test.js tests\inspector-panel-loader.test.js tests\layout-ui.test.js tests\startup-resource-budget.test.js`：`53/53` 通过，首屏诊断为 31 个资源、598,497 字节。
- `npm.cmd run test:browser`：真实 Chromium `1/1` 通过；启动时 `renderLogsTab` 未定义而 `cancelRunningOperation` 已定义，首次打开日志页只载入 1 个日志资源并显示工具栏，九个按需模块合计保持 9 个资源。3012 条提交、4000 文件、编辑器浸泡、DOM、监听器和堆边界继续通过。
- `npm.cmd test`：`233/234` 通过；唯一失败仍是受限 Windows 环境中长时间 fetch 进程树取消后等待响应超时，本轮新增日志按需测试、其他 Git、Electron 与性能回归全部通过。
- `5177`、`5287`、`5288` 无监听；没有遗留的 Forkline Node、Git、Edge 或 Electron 测试进程。

### Notes

- `public/index.html`：移除操作日志页面的首屏脚本声明。
- `public/js/api.js`：承接长操作轮询和取消核心，保证日志模块未载入时仍能取消。
- `public/js/panels/logs.js`：只保留操作日志、界面诊断和页面刷新实现。
- `public/js/panels/inspector-panel-loader.js`、`public/js/panels/inspector.js`：增加日志模块定义并让操作日志页走共享按需入口。
- `tests/api-repo-context.test.js`、`tests/inspector-panel-loader.test.js`、`tests/layout-ui.test.js`、`tests/startup-resource-budget.test.js`、`tests/browser-performance.test.js`：固定取消能力首屏边界、日志资源首开复用、首屏排除项和真实 Chromium 行为。
- `README.md`、`docs/CONTINUE.md`、`docs/ARCHITECTURE.md`：同步用户行为、模块边界、加载顺序、首屏基线和验证结果。
- `progress.md`：追加本轮实现、测试证据、文件清单和回滚方式。
- 回滚点为本轮开始前 `c607f2c`；提交前只逐块撤销本记录列出的操作日志按需加载增量，不得整体恢复包含其他未提交成果的共享文件。提交后应对包含本记录的提交执行 `git revert <commit>`。
- 本轮失败用例生成的 `C:\Users\Administrator\AppData\Local\Temp\forkline-operation-cancel-beLRs5` 仍存在但没有相关进程或端口占用；自动删除权限审核服务暂时不可用，本轮未绕过权限边界处理。旧目录 `forkline-operation-cancel-WsjQez` 继续保留。

## 2026-08-11 - Task: 按需加载右键菜单并继续降低首屏资源

### What was done

- 把完整右键菜单实现移出默认首屏；第一次右键提交、分支、文件、Tag、远端或 reflog 时载入，所有入口共用同一个加载 Promise，失败后可清理资源并重试。
- 把普通提交选择移到首屏历史模块，并把菜单定位、关闭和上下文清理保留在轻量加载器中；左键浏览和文件编辑器专属右键行为保持不变。
- 中文首屏资源数保持 31 个，体积由 598,497 降到 581,019 字节，减少 17,478 字节；相对 37 / 738,911 累计减少 6 个请求和 157,892 字节。

### Testing

- 相关前端和测试脚本 `node --check`：全部通过。
- 右键菜单加载、布局、提交选择、文件编辑和首屏资源专项：`85/85` 通过。
- `npm.cmd run test:browser`：真实 Chromium `1/1` 通过；首次右键菜单约 `10.6 ms`，只载入 1 个资源，后续菜单复用。
- `npm.cmd test`：`238/239` 通过；唯一失败仍是受限 Windows 环境中取消长时间 fetch 后等待响应超时，本轮右键菜单、Git、Electron 和其余性能回归全部通过。
- `5177`、`5287`、`5288` 无监听；本轮新临时目录 `forkline-operation-cancel-HBVdDB` 已清理。旧目录 `forkline-operation-cancel-WsjQez` 与 `forkline-operation-cancel-beLRs5` 保留且没有相关进程或端口占用。

### Notes

- `public/js/features/context-menu-loader.js`：新增首次右键按需加载、资源复用、失败重试以及首屏菜单定位和关闭能力。
- `public/js/features/context-menus.js`、`public/js/features/history-list.js`：完整菜单只保留菜单行为，普通提交选择迁回首屏历史模块。
- `public/index.html`、`public/js/app/events.js`、`public/js/features/branches.js`、`public/js/features/file-tree.js`：首屏改用加载器，提交、分支、文件、Tag、远端和 reflog 入口统一走按需包装函数。
- `tests/context-menu-loader.test.js`、`tests/layout-ui.test.js`、`tests/commit-selection-performance.test.js`、`tests/file-editor-ui.test.js`、`tests/startup-resource-budget.test.js`、`tests/browser-performance.test.js`：覆盖首次加载、并发复用、失败重试、首屏边界和真实浏览器行为。
- `README.md`、`docs/CONTINUE.md`、`docs/ARCHITECTURE.md`：同步用户行为、加载顺序、首屏基线和验证结果。
- `progress.md`：追加本轮实现、测试证据、文件清单和回滚方式。
- 回滚点为本轮开始前 `c607f2c`；提交前只逐块撤销本记录列出的右键菜单按需加载增量，不得整体恢复包含其他未提交成果的共享文件。提交后应对包含本记录的提交执行 `git revert <commit>`。

## 2026-08-11 - Task: 按需加载目录选择与命令面板实现

### What was done

- 把目录读取、目录弹窗、命令搜索和命令执行从默认首屏拆入首次使用资源；点击“选择”或打开命令面板共用同一个加载 Promise，失败后可清理并重试。
- 保留右栏页签切换、上下文判断和详情读取触发在首屏，提交、分支、文件和右侧面板行为不依赖完整目录/命令实现。
- 中文首屏资源数保持 31 个，体积由 581,019 降到 569,571 字节，减少 11,448 字节；相对 37 / 738,911 累计减少 6 个请求和 169,340 字节。

### Testing

- `node --check` 覆盖目录/命令加载器、完整实现、事件绑定、加载器测试、首屏资源测试和真实浏览器测试：全部通过。
- 加载器、同步页上下文、布局和首屏资源专项：`48/48` 通过。
- `npm.cmd run test:browser`：真实 Chromium `1/1` 通过；命令面板首次载入约 `4.1 ms`，完整回归内约 `8.1 ms`，只加载 1 个资源并正常打开和关闭；大历史、大工作区、冲突编辑器与浸泡边界继续通过。
- `npm.cmd test`：`242/243` 通过；唯一失败仍是受限 Windows 环境中取消长时间 fetch 后等待响应超时，本轮目录/命令面板、Git、Electron 和其余性能回归全部通过。
- 本轮新临时目录 `forkline-operation-cancel-IhWXXN` 已按明确路径删除；旧目录 `forkline-operation-cancel-WsjQez` 与 `forkline-operation-cancel-beLRs5` 保留且没有相关进程或端口占用。

### Notes

- `public/js/features/folder-command.js`：改为首屏加载器和右栏上下文模块，提供资源复用、失败重试和轻量入口。
- `public/js/features/folder-command-implementation.js`：承接目录浏览、目录弹窗和命令面板完整实现。
- `public/js/app/events.js`：目录和命令相关事件统一调用按需入口，错误继续使用现有中文提示。
- `tests/folder-command-loader.test.js`、`tests/startup-resource-budget.test.js`、`tests/browser-performance.test.js`：覆盖首屏排除、并发复用、失败重试、右栏上下文保留和真实浏览器首次打开。
- `README.md`、`docs/CONTINUE.md`、`docs/ARCHITECTURE.md`：同步用户行为、模块边界、首屏基线和验证结果。
- `progress.md`：追加本轮实现、测试证据、文件清单和回滚方式。
- 回滚点为本轮开始前 `c607f2c`；提交前只逐块撤销本记录列出的目录/命令面板按需加载增量，不得整体恢复包含其他未提交成果的共享文件。提交后应对包含本记录的提交执行 `git revert <commit>`。

## 2026-08-11 - Task: 按需加载文件编辑器专用样式

### What was done

- 把文件编辑器浮窗、CodeMirror 覆盖和 `720px` 窄屏规则从全局样式表拆到 `public/file-editor.css`，只浏览提交图和工作区时不再请求或解析这部分样式。
- 文件编辑器第一次打开时先等待项目编辑器样式和 CodeMirror 样式全部就绪，再按原顺序载入编辑器脚本；后续打开继续复用同一组资源，失败重试边界不变。
- 中文首屏资源数保持 31 个，体积由 `569,571` 降到 `550,908` 字节，减少 `18,663` 字节；相对 `37 / 738,911` 累计减少 6 个请求和 `188,003` 字节。

### Testing

- 相关脚本 `node --check`：全部通过；文件编辑器、加载器、首屏门限、浏览器性能与设计系统专项此前同轮验证为 `81/81` 通过。
- 文档同步后重跑 `node --test tests\file-editor-ui.test.js tests\file-editor-loader.test.js tests\startup-resource-budget.test.js tests\design-system.test.js`：`42/42` 通过，首屏诊断为 31 个资源、550,908 字节。
- `npm.cmd run test:browser`：真实 Chromium `1/1` 通过；编辑器专用样式只载入 1 份，浮窗布局有效，复杂文件打开约 `266 ms`，连续 30 次开关后的 DOM、监听器和堆无增长。
- `npm.cmd test`：`243/244` 通过；唯一失败仍是受限 Windows 环境中取消长时间 fetch 后等待响应超时，其余 Git、Electron、文件编辑器和性能回归全部通过。
- `git diff --check` 通过，仅有仓库既有的 LF/CRLF 提示；`5177`、`5287`、`5288` 无监听。新临时目录 `forkline-operation-cancel-JVDBZv` 已删除，TEMP 只剩明确保留的 `forkline-operation-cancel-WsjQez` 与 `forkline-operation-cancel-beLRs5`。

### Notes

- `public/file-editor.css`：承接文件编辑器浮窗、CodeMirror 覆盖和窄屏规则。
- `public/styles.css`：移除已迁出的编辑器专用规则，只保留全局主题、布局和通用组件样式。
- `public/js/features/file-editor-loader.js`：首次打开文件时按需加载项目编辑器样式并等待全部样式就绪。
- `tests/file-editor-ui.test.js`、`tests/file-editor-loader.test.js`、`tests/startup-resource-budget.test.js`、`tests/browser-performance.test.js`、`tests/design-system.test.js`：固定样式拆分、首次加载、资源复用、首屏排除、真实浏览器和设计系统边界。
- `README.md`、`docs/CONTINUE.md`、`docs/ARCHITECTURE.md`、`docs/DESIGN_SYSTEM.md`：同步用户行为、加载顺序、样式职责、首屏基线和验证结果。
- `progress.md`：追加本轮实现、测试证据、文件清单和回滚方式。
- 回滚点为本轮开始前 `c607f2c`；提交前只逐块撤销本记录列出的文件编辑器样式按需加载增量，不得整体恢复包含其他未提交成果的共享文件。提交后应对包含本记录的提交执行 `git revert <commit>`。

## 2026-08-11 - Task: 按需加载 Diff 工作台并移除文件单击的隐藏 Diff 请求

### What was done

- 发现工作区和暂存区底部“变更对照”虽已从可见布局移除，但文件单击仍会请求 `/api/worktree-diff` 并在隐藏容器中渲染完整差异；大文件选择因此承担了无效 API、解析和 DOM 成本。
- 文件单击现在只更新选中状态、Diff 范围和右侧文件上下文，不再读取或渲染隐藏 Diff；右键“查看对照”仍按原语义读取差异并打开最大化窗口。
- 新增轻量 Diff 工作台加载器，首屏保留文件列表所需的状态/范围判断和清理函数；第一次显式查看对照时才有序载入按行选择与完整工作台实现，并发入口复用、失败清理和重试边界完整保留。
- 中文首屏从 `31 / 550,908` 降到 `30 / 534,702`，减少 1 个请求和 `16,206` 字节；相对 `37 / 738,911` 累计减少 7 个请求和 `204,209` 字节。

### Testing

- 先增加 Diff 加载器和首屏排除回归，旧实现为 `1/6` 通过、5 项按预期失败；实现后加载器、文件选择、布局、文件编辑和首屏资源专项 `78/78` 通过。
- 相关前端与测试脚本 `node --check` 全部通过。
- `npm.cmd run test:browser`：真实 Chromium `1/1` 通过；文件单击产生 0 个 Diff 请求和 0 个工作台资源，第一次显式打开工作台约 `88.6 ms`，完整回归中约 `89.5 ms`，只载入 2 份实现并正常显示、关闭。
- 同轮 Chromium 复杂历史文件打开约 `258 ms`，3012 条提交渲染约 `4.5-5.4 ms`，4000 文件首批渲染约 `9-11 ms`，30 次编辑器开关后的 DOM、监听器和堆边界稳定。
- `npm.cmd test`：`247/248` 通过；唯一失败仍是受限 Windows 环境中取消长时间 fetch 后等待响应超时，其余 Git、Electron、Diff、文件编辑器和性能回归全部通过。
- `git diff --check` 最终通过，仅有仓库既有的 LF/CRLF 提示；`5177`、`5287`、`5288` 无监听。失败测试新生成的 `forkline-operation-cancel-HZpPqJ` 已在确认位于 TEMP 后删除，TEMP 只剩明确保留的两个旧目录。

### Notes

- `public/js/features/diff-workbench-loader.js`：新增 Diff 状态/范围轻量核心、两份实现的按需加载、并发复用和失败重试。
- `public/index.html`：首屏改载 Diff 加载器，移除 `diff-workbench.js` 与 `diff-selection.js` 的直接声明。
- `public/js/features/diff-workbench.js`、`public/js/features/diff-renderer.js`：完整工作台改为按需实现，基础渲染器可在工作台尚未载入时供同步、储藏和比较页面使用。
- `public/js/features/file-tree.js`、`public/js/features/worktree-changes.js`：文件单击不再自动读取隐藏 Diff，只有已有工作区 Diff 需要刷新时才走加载器。
- `public/js/features/context-menus.js`、`public/js/app/events.js`、`public/js/app/init.js`：查看对照、最大化、按块和按行入口统一等待 Diff 工作台就绪。
- `public/js/i18n-catalog.js`：增加 Diff 工作台加载失败的英文提示。
- `tests/diff-workbench-loader.test.js`、`tests/startup-resource-budget.test.js`、`tests/file-editor-ui.test.js`、`tests/layout-ui.test.js`、`tests/browser-performance.test.js`：覆盖首屏排除、单击零请求、首次加载、失败重试、真实显示关闭和既有 Diff 操作边界。
- `README.md`、`docs/CONTINUE.md`、`docs/ARCHITECTURE.md`：同步用户行为、模块职责、加载顺序、首屏基线和验证结果。
- `progress.md`：追加本轮实现、测试证据、文件清单和回滚方式。
- 回滚点为本轮开始前 `c607f2c`；提交前只逐块撤销本记录列出的 Diff 工作台按需加载与文件单击优化增量，不得整体恢复包含其他未提交成果的共享文件。提交后应对包含本记录的提交执行 `git revert <commit>`。

## 2026-08-11 - Task: 避免最大化工作区 Diff 重复渲染隐藏副本

### What was done

- 用 2500 行真实工作区改动复现显式“查看对照”：旧实现会先在已从布局移除的隐藏容器生成 2513 个行节点，再在最大化弹窗生成首批 1000 个行节点，同一份 Diff 承担两次 DOM 构建和排版。
- 工作区 Diff 继续完整保存活动文件、范围、原始差异和操作反馈，但隐藏宿主现在只清理旧节点，不再生成行 DOM；最大化弹窗成为唯一可见渲染面并继续按最多 1000 行一批加载。
- 文件已经没有剩余改动时采用相同边界；按块/按行暂存、取消暂存、结果提示、目标高亮、加载范围和横纵滚动恢复保持原行为。

### Testing

- 回归断言先在旧实现稳定失败：隐藏容器实际为 2513 行而预期为 0；实现后 `npm.cmd run test:browser` 为 `1/1` 通过，真实数据为源 Diff / 隐藏区 / 弹窗 `2513 / 0 / 1000`，首次工作台加载约 `116.5 ms`。
- `node --check` 通过两个工作台实现和浏览器测试；Diff 加载器、工作区刷新、布局、文件编辑器和首屏资源专项为 `90/90` 通过。
- `npm.cmd test` 为 `247/248` 通过；唯一失败仍是受限 Windows 环境中取消长时间 fetch 后等待响应超时，其余 Git、Electron、Diff、文件编辑器和真实性能回归全部通过。
- `git diff --check` 通过，仅有仓库既有的 LF/CRLF 提示；`5177`、`5287`、`5288` 监听数为 0，浏览器性能临时目录为 0。失败测试新生成的 `forkline-operation-cancel-O782zg` 已在确认位于 TEMP 后删除，只保留既有的 `WsjQez` 与 `beLRs5`。

### Notes

- `public/js/features/diff-workbench.js`：隐藏内联宿主只清理节点，活动 Diff 继续供最大化弹窗渲染。
- `public/js/features/diff-selection.js`：无剩余改动的完成状态也不再写入隐藏 DOM。
- `tests/browser-performance.test.js`：使用 2500 行工作区改动固定单份可见渲染、首批 1000 行和性能诊断输出。
- `README.md`：说明大型 Diff 只在可见窗口生成一份内容。
- `docs/ARCHITECTURE.md`：固定隐藏宿主与最大化弹窗的渲染职责边界。
- `docs/CONTINUE.md`：记录真实行节点数据和保留的操作语义。
- `progress.md`：追加本轮实现、验证、资源清理和回滚点。
- 回滚点为本轮开始前 `c607f2c`；提交前只逐块撤销本记录列出的单份 Diff 渲染增量，不得整体恢复包含其他未提交成果的共享文件。提交后应对包含本记录的提交执行 `git revert <commit>`。

## 2026-08-11 - Task: 按需加载完整 Git 操作实现

### What was done

- 把完整 Git 操作实现移出默认首屏；提交、签出、合并、变基、储藏、远端、单文件和批量文件动作第一次执行时才载入，所有入口共用同一个进行中的 Promise，失败资源会移除并允许重试。
- 首屏继续立即提供当前分支、工作区、未完成操作和远端配置快照，追加状态、文件选择辅助，以及“储藏并签出”返回原分支后的自动恢复，启动与切仓语义保持不变。
- 中文首屏资源数保持 30 个，体积从 `534,702` 降到 `500,063` 字节，减少 `34,639` 字节；相对 `37 / 738,911` 累计减少 7 个请求和 `238,848` 字节。

### Testing

- `node --check` 覆盖 Git 操作加载器、完整实现、国际化目录和三份相关测试脚本：`6/6` 通过。
- `node --test tests\git-actions-loader.test.js tests\startup-resource-budget.test.js`：`6/6` 通过，实测首屏为 30 个资源、500,063 字节；加载器与首屏相关专项此前同轮为 `106/106` 通过。
- `npm.cmd run test:browser`：真实 Chromium `1/1` 通过；完整 Git 操作实现首次载入约 `3.5 ms`，只创建 1 个资源节点，大 Diff、3012 条提交、4000 文件和编辑器浸泡边界同轮继续通过。
- `npm.cmd test`：`251/252` 通过；唯一失败为 `tests/git-api.test.js:1759`，受限 Windows 环境取消长时间 fetch 后等待响应超时，其余 Git、Electron、Diff、文件编辑器和真实性能回归全部通过。
- `git diff --check` 通过，仅有仓库既有的 LF/CRLF 提示；`5177`、`5287`、`5288` 无监听，浏览器性能临时目录为 0。新目录 `forkline-operation-cancel-WQbCxO` 已在确认位于 `%TEMP%` 后删除，只保留既有的 `forkline-operation-cancel-WsjQez` 与 `forkline-operation-cancel-beLRs5`。

### Notes

- `public/js/features/git-actions-loader.js`：新增首屏快照、追加状态、切换储藏恢复辅助和完整 Git 操作的按需加载门面。
- `public/js/features/git-actions.js`：完整实现载入后通过 `ForklineGitActions` 注册可调用动作。
- `public/index.html`：首屏改载 Git 操作加载器，不再直接声明完整实现。
- `public/js/i18n-catalog.js`：增加 Git 操作资源加载失败的英文提示。
- `tests/git-actions-loader.test.js`、`tests/startup-resource-budget.test.js`、`tests/browser-performance.test.js`：覆盖首屏排除、并发复用、失败重试、启动辅助、资源预算和真实浏览器首次载入。
- `README.md`、`docs/ARCHITECTURE.md`、`docs/CONTINUE.md`：同步用户行为、模块边界、加载顺序、首屏基线和验证结果。
- `progress.md`：追加本轮实现、测试证据、文件清单、临时资源清理和回滚方式。
- 回滚点为本轮开始前 `c607f2c`；提交前只逐块撤销本记录列出的 Git 操作按需加载增量，不得整体恢复包含其他未提交成果的共享文件。提交后应对包含本记录的提交执行 `git revert <commit>`。

## 2026-08-11 - Task: 按需加载完整提交操作实现

### What was done

- 把挑选、还原、重置、历史编辑、补丁、Tag、PR 和分支比较等完整提交操作移出默认首屏；第一次使用时载入，所有入口共用同一个进行中的 Promise，失败资源会移除并允许重试。
- 首屏继续提供提交详情和菜单渲染需要的历史编辑配置、队列提交信息、远端提交 URL、复制，以及 Tag 和 merge 主线弹窗关闭辅助；普通提交浏览和详情渲染不依赖完整操作实现提前载入。
- 中文首屏资源数保持 30 个，体积从 `500,063` 降到 `475,114` 字节，减少 `24,949` 字节；相对 `37 / 738,911` 累计减少 7 个请求和 `263,797` 字节。

### Testing

- 新回归先在旧实现稳定失败为 `0/4`；实现后加载器、右键菜单与首屏专项 `10/10` 通过，相关前端、布局、文件编辑器和加载器专项 `110/110` 通过。
- `node --check` 覆盖提交操作加载器、完整实现、事件绑定、国际化目录和四份相关测试脚本：`8/8` 通过。
- `npm.cmd run test:browser`：真实 Chromium `1/1` 通过；完整提交操作实现首次载入约 `3.1-3.2 ms`，只创建 1 个资源节点，分支比较、右键菜单、大 Diff、3012 条提交、4000 文件和编辑器浸泡边界继续通过。
- `npm.cmd test`：`255/256` 通过；唯一失败为 `tests/git-api.test.js:1759`，受限 Windows 环境取消长时间 fetch 后等待响应超时，其余 Git、Electron、提交操作、Diff、文件编辑器和真实性能回归全部通过。
- `git diff --check` 通过，仅有仓库既有的 LF/CRLF 提示；`5177`、`5287`、`5288` 无监听，浏览器性能临时目录为 0。本轮新目录 `forkline-operation-cancel-jr1hwp` 已确认位于 `%TEMP%`，但自动删除审批服务返回 503，未绕过权限处理；既有 `forkline-operation-cancel-WsjQez` 与 `forkline-operation-cancel-beLRs5` 同样保留。

### Notes

- `public/js/features/commit-actions-loader.js`：新增提交详情纯辅助、弹窗关闭能力和完整提交操作的按需加载门面。
- `public/js/features/commit-actions.js`：完整实现载入后通过 `ForklineCommitActions` 注册可调用动作。
- `public/index.html`：首屏改载提交操作加载器，不再直接声明完整实现。
- `public/js/app/events.js`：Tag 表单和历史队列输入统一接收异步加载失败提示。
- `public/js/i18n-catalog.js`：增加提交操作资源加载失败的英文提示。
- `tests/commit-actions-loader.test.js`、`tests/context-menu-loader.test.js`、`tests/startup-resource-budget.test.js`、`tests/browser-performance.test.js`：覆盖首屏排除、并发复用、失败重试、立即可用辅助、加载顺序、资源预算和真实浏览器首次载入。
- `README.md`、`docs/ARCHITECTURE.md`、`docs/CONTINUE.md`：同步用户行为、模块边界、加载顺序、首屏基线和验证结果。
- `progress.md`：追加本轮实现、测试证据、文件清单、临时资源状态和回滚方式。
- 回滚点为本轮开始前 `c607f2c`；提交前只逐块撤销本记录列出的提交操作按需加载增量，不得整体恢复包含其他未提交成果的共享文件。提交后应对包含本记录的提交执行 `git revert <commit>`。

## 2026-08-11 - Task: 按需加载历史编辑计划与队列界面

### What was done

- 把历史编辑计划、队列项和实际执行顺序的完整渲染从默认首屏移入提交操作按需实现；普通提交详情不再承担这部分代码的下载和解析成本。
- 首屏门面仍能立即显示空队列；已有计划、预检结果或非空队列时才载入完整提交操作，并在资源就绪后自动重绘右栏。
- 中文首屏资源数保持 30 个，体积从 `475,114` 降到 `465,507` 字节，减少 `9,607` 字节；相对 `37 / 738,911` 累计减少 7 个请求和 `273,404` 字节。

### Testing

- 历史界面加载器、布局、国际化和首屏资源专项 `119/119` 通过；空队列确认不创建资源，已有历史计划确认只创建 1 个资源并在加载后重绘。
- `npm.cmd run test:browser`：真实 Chromium `1/1` 通过；初始空队列不加载完整提交操作，加载后历史队列实际渲染 1 行，完整提交操作首次载入约 `4.5 ms`；大 Diff、3012 条提交、4000 文件和编辑器浸泡边界继续通过。
- `npm.cmd test`：`256/257` 通过；唯一失败为 `tests/git-api.test.js:1759`，受限 Windows 环境取消长时间 fetch 后等待响应超时，其余 Git、Electron、历史编辑、Diff、文件编辑器和真实性能回归全部通过。
- 本轮新目录 `forkline-operation-cancel-5DpGTF` 已在确认位于 `%TEMP%` 后删除；既有 `forkline-operation-cancel-WsjQez`、`forkline-operation-cancel-beLRs5` 与 `forkline-operation-cancel-jr1hwp` 未改动。

### Notes

- `public/js/panels/inspector.js`：移除首屏历史编辑计划和队列的完整渲染实现。
- `public/js/features/commit-actions.js`：承接历史编辑计划、队列项和执行顺序渲染，并通过 `ForklineCommitActions` 注册。
- `public/js/features/commit-actions-loader.js`：提供空队列快速路径、历史界面加载提示和完成后的右栏重绘。
- `public/js/i18n-catalog.js`：增加历史编辑界面加载提示的英文翻译。
- `tests/commit-actions-loader.test.js`、`tests/browser-performance.test.js`：固定空队列零加载、已有状态自动重绘和真实历史队列渲染。
- `README.md`、`docs/ARCHITECTURE.md`、`docs/CONTINUE.md`：同步用户行为、模块边界、首屏基线和验证结果。
- `progress.md`：仅在末尾追加本轮实现、测试证据、临时资源清理和回滚方式。
- 回滚点为本轮开始前 `c607f2c`；提交前只逐块撤销本记录列出的历史编辑界面按需加载增量，不得整体恢复包含其他未提交成果的共享文件。提交后应对包含本记录的提交执行 `git revert <commit>`。

## 2026-08-11 - Task: 按需加载设置页专用样式

### What was done

- 把设置卡片、更新状态、主题预览、界面缩放和窄右栏规则从全局样式表原样迁入设置页专用样式；图谱、工作区和普通提交详情不再承担这部分下载与解析成本。
- 右栏加载器现在可以并行加载面板脚本和可选样式，等待两者都完成后才渲染；任一资源失败时只清理失败项，重试会复用已经完成的另一项，并发入口继续共用一个 Promise。
- 中文首屏资源数保持 30 个，体积从 `465,507` 降到 `459,624` 字节，净减少 `5,883` 字节；相对 `37 / 738,911` 累计减少 7 个请求和 `279,287` 字节。

### Testing

- 加载器回归先在旧实现稳定为 `8/10`，实现后又捕获到脚本先完成时被样式状态误判的问题；修正为独立判断脚本和样式后，加载器与首屏专项 `12/12` 通过。
- 加载器、布局、设计系统和首屏资源专项 `55/55` 通过，确认设置样式不在 `index.html` 首屏资源中，窄右栏规则仍由专用样式提供。
- `npm.cmd run test:browser`：真实 Chromium `1/1` 通过；设置页首次载入约 `21.5 ms`，完整回归内约 `22.8 ms`，只创建 1 份脚本和 1 份样式。大 Diff、3012 条提交、4000 文件和编辑器浸泡边界继续通过，DOM、监听器和堆没有持续增长。
- `npm.cmd test`：`257/258` 通过；唯一失败为 `tests/git-api.test.js:1759`，受限 Windows 环境取消长时间 fetch 后等待响应超时，其余 Git、Electron、设置页、Diff、文件编辑器和真实性能回归全部通过。
- `5177`、`5287`、`5288` 无监听，浏览器性能临时目录和相关测试进程为 0。本轮新目录 `forkline-operation-cancel-oVOm8k` 已确认位于 `%TEMP%`，但删除审批服务返回 503，未绕过权限处理；既有三个保留目录未改动。

### Notes

- `public/settings.css`：新增设置页卡片、更新状态、主题预览、缩放和窄右栏专用样式。
- `public/styles.css`：移除已经迁出的设置页专用规则，保留主题、主布局和通用组件样式。
- `public/js/panels/inspector-panel-loader.js`：支持面板脚本与可选样式并行加载、完成判定和失败项独立重试。
- `tests/inspector-panel-loader.test.js`、`tests/startup-resource-budget.test.js`：固定双资源复用、样式失败重试和首屏排除边界。
- `tests/layout-ui.test.js`、`tests/design-system.test.js`、`tests/browser-performance.test.js`：从专用样式验证设置组件，并检查真实页面样式完成、加载数量和性能边界。
- `README.md`、`docs/ARCHITECTURE.md`、`docs/DESIGN_SYSTEM.md`、`docs/CONTINUE.md`：同步加载行为、样式职责、首屏基线和验证结果。
- `progress.md`：仅在末尾追加本轮实现、测试证据、临时资源状态和回滚方式。
- 回滚点为本轮开始前 `c607f2c`；提交前只逐块撤销本记录列出的设置页样式按需加载增量，不得整体恢复包含其他未提交成果的共享文件。提交后应对包含本记录的提交执行 `git revert <commit>`。

## 2026-08-11 - Task: 按需加载工作区管理专用样式

### What was done

- 把分支整理、工作树和子模块的摘要、列表、状态与操作布局从全局样式表原样迁入工作区管理专用样式；主图谱、底部工作区和普通提交详情不再承担这部分启动成本。
- 三个右栏页签继续共用一个 `workspaces.js` 模块，并与专用样式并行加载；脚本先完成时等待样式，不会短暂显示无样式页面，后续页签切换复用同一组资源。
- 中文首屏资源数保持 30 个，体积从 `459,624` 降到 `448,632` 字节，减少 `10,992` 字节；相对 `37 / 738,911` 累计减少 7 个请求和 `290,279` 字节。

### Testing

- 加载器回归先在旧实现稳定为 `9/10`，确认旧边界只有脚本；实现后脚本先完成仍不渲染，样式完成后按用户当前页签绘制，加载器与首屏专项 `12/12` 通过。
- 加载器、布局、设计系统和首屏资源专项 `55/55` 通过，确认 `workspaces.css` 不在 `index.html` 首屏资源中，三个面板的核心布局选择器也不再留在全局样式。
- `npm.cmd run test:browser`：真实 Chromium `1/1` 通过；工作区管理首次载入约 `75.0-75.8 ms`，分支整理页面实际为 `grid`，工作树和子模块切换后脚本与样式资源数都保持 1。大 Diff、3012 条提交、4000 文件和浸泡边界继续通过。
- `npm.cmd test`：`257/258` 通过；唯一失败为 `tests/git-api.test.js:1759`，受限 Windows 环境取消长时间 fetch 后等待响应超时，其余 Git、Electron、分支整理、工作树、子模块和真实性能回归全部通过。
- `5177`、`5287`、`5288` 无监听，浏览器性能临时目录和相关测试进程为 0。本轮新目录 `forkline-operation-cancel-IAXRXD` 已在确认位于 `%TEMP%` 后删除；此前保留的四个目录未改动。

### Notes

- `public/workspaces.css`：新增分支整理、工作树和子模块专用样式。
- `public/styles.css`：移除已经迁出的工作区管理规则，继续保留主题、主布局和通用组件样式。
- `public/js/panels/inspector-panel-loader.js`：为 `workspaces` 面板声明专用样式资源，复用既有脚本/样式并行加载和失败重试机制。
- `tests/inspector-panel-loader.test.js`、`tests/startup-resource-budget.test.js`：固定双资源等待、三个页签复用和首屏排除边界。
- `tests/layout-ui.test.js`、`tests/design-system.test.js`、`tests/browser-performance.test.js`：从专用样式验证布局，并检查真实页面完成状态、资源数量和性能边界。
- `README.md`、`docs/ARCHITECTURE.md`、`docs/DESIGN_SYSTEM.md`、`docs/CONTINUE.md`：同步加载行为、样式职责、首屏基线和验证结果。
- `progress.md`：仅在末尾追加本轮实现、测试证据、资源清理和回滚方式。
- 回滚点为本轮开始前 `c607f2c`；提交前只逐块撤销本记录列出的工作区管理样式按需加载增量，不得整体恢复包含其他未提交成果的共享文件。提交后应对包含本记录的提交执行 `git revert <commit>`。

## 2026-08-11 - Task: 按需加载文件追踪与操作日志专用样式

### What was done

- 把文件历史、状态标记、逐行归属，以及 Git 操作日志、运行中操作和界面诊断的专用规则从全局首屏样式原样迁出；主提交图、底部工作区和普通提交详情不再承担这两组样式的下载与解析成本。
- 文件追踪和操作日志现在都并行载入各自脚本与专用样式，等待两者完成后才渲染；文件历史/逐行追踪和日志重复打开继续复用各自唯一的资源与加载 Promise。
- 中文首屏资源数保持 `30` 个，体积从 `448,632` 降到 `439,054` 字节，减少 `9,578` 字节；相对 `37 / 738,911` 累计减少 7 个请求和 `299,857` 字节。

### Testing

- 新增加载器回归先在旧实现稳定为 `8/10`，文件追踪和操作日志各因只有脚本、没有样式资源而按预期失败；实现后脚本先完成仍不渲染，样式完成后才按当前页签显示。
- `node --test --test-concurrency=1 tests/inspector-panel-loader.test.js tests/startup-resource-budget.test.js tests/design-system.test.js tests/layout-ui.test.js`：`56/56` 通过，首屏诊断为 30 个资源、439,054 字节。
- `npm.cmd run test:browser`：真实 Chromium `1/1` 通过；操作日志首次载入约 `16.3 ms`，文件追踪约 `213.0 ms`，两者都各保留 1 份脚本和 1 份样式，九个按需面板合计为 9 份脚本和 4 份专用样式。大 Diff、3012 条提交、4000 文件、编辑器浸泡、DOM、监听器与堆边界继续通过。
- `npm.cmd test`：`258/259` 通过；唯一失败仍是 `tests/git-api.test.js:1759` 在受限 Windows 环境中取消长时间 fetch 后等待响应超时，本轮新增样式加载、其他 Git、Electron 与真实性能回归全部通过。
- `5177`、`5287`、`5288` 无监听，浏览器性能临时目录为 0。本轮新生成的 `forkline-operation-cancel-1kxbKF` 已在确认路径位于 `%TEMP%` 后删除，原有四个保留目录未改动。

### Notes

- `public/file-insights.css`：新增文件历史、状态标记和逐行归属的按需样式。
- `public/logs.css`：新增 Git 操作日志、运行中操作和界面诊断的按需样式。
- `public/styles.css`：移除已经迁出的文件追踪与操作日志规则，继续保留主题、主布局和通用组件样式。
- `public/js/panels/inspector-panel-loader.js`：为文件追踪和操作日志声明专用样式资源，复用既有脚本/样式并行加载、失败重试和快速切页保护。
- `tests/inspector-panel-loader.test.js`、`tests/startup-resource-budget.test.js`：固定双资源等待、复用和首屏排除边界。
- `tests/design-system.test.js`、`tests/layout-ui.test.js`：把两份专用样式纳入设计系统守卫，并固定选择器不回流到全局样式。
- `tests/browser-performance.test.js`：验证真实 Chromium 中两份样式只加载一次且面板实际应用布局。
- `README.md`、`docs/ARCHITECTURE.md`、`docs/DESIGN_SYSTEM.md`、`docs/CONTINUE.md`：同步用户行为、模块职责、加载顺序、首屏基线和验证结果。
- `progress.md`：追加本轮实施、验证、清理和回滚记录。
- 回滚点为本轮开始前 `c607f2c`；提交前只逐块撤销本记录列出的文件追踪与操作日志样式按需加载增量，不得整体恢复包含其他未提交成果的共享文件。提交后应对包含本记录的提交执行 `git revert <commit>`。

## 2026-08-11 - Task: 跨仓库工具面板共享按需样式

### What was done

- 把储藏、Tag、恢复点、同步认证、远端管理和分支比较的完整样式区域从全局首屏样式原样迁出；只浏览提交图、工作区和普通提交详情时不再解析这五个右栏面板的样式。
- 右栏加载器新增共享样式键：五个独立面板脚本共用一个样式节点和一个进行中的样式 Promise。快速切页时脚本完成不会提前显示旧页面，脚本失败重试也不会丢掉仍可复用的共享样式。
- 中文首屏资源数保持 `30` 个，体积从 `439,054` 降到 `415,318` 字节，减少 `23,736` 字节；相对 `37 / 738,911` 累计减少 7 个请求和 `323,593` 字节。

### Testing

- 新增加载器回归先在旧实现稳定为 `5/11`，6 项按预期失败，覆盖缺少专用样式、快速切页重复资源、脚本先完成提前渲染和脚本失败重试边界；实现后 `11/11` 通过。
- 首次 Chromium 回归因测试仓库没有储藏记录而对不存在的 `.stash-layout` 取样式失败；测试夹具改为临时注入一条仅存在于页面状态的储藏记录并在检查后恢复，不修改真实仓库。修正后真实 Chromium `1/1` 通过。
- 完整回归首次发现 `tests/auth-ui.test.js` 仍只从全局样式读取认证规则；守卫改为检查 `repository-panels.css` 并确认规则不回流首屏后，认证、加载器、布局、设计系统和首屏资源专项 `60/60` 通过。
- `npm.cmd run test:browser`：真实 Chromium `1/1` 通过；储藏/Tag/恢复点/同步/比较连续打开后共享样式保持 1 份，九个按需面板合计为 9 份脚本和 5 份样式。大 Diff、3012 条提交、4000 文件、编辑器浸泡、DOM、监听器与堆边界继续通过。
- `npm.cmd test`：`260/261` 通过；唯一失败仍是 `tests/git-api.test.js:1759` 在受限 Windows 环境中取消长时间 fetch 后等待响应超时，本轮新增共享样式、认证、其他 Git、Electron 与真实性能回归全部通过。
- `5177`、`5287`、`5288` 无监听，浏览器性能临时目录为 0。本轮新生成的 `forkline-operation-cancel-eA8Yo0` 与 `forkline-operation-cancel-vnwr6J` 已在确认路径位于 `%TEMP%` 后删除，原有四个保留目录未改动。

### Notes

- `public/repository-panels.css`：新增储藏、Tag、恢复点、同步认证、远端管理和分支比较的共享按需样式。
- `public/styles.css`：移除已经迁出的仓库工具面板规则和对应窄右栏规则，继续保留主题、主布局和通用组件样式。
- `public/js/panels/inspector-panel-loader.js`：新增共享样式键、跨面板样式 Promise 复用和脚本失败时的样式保留。
- `tests/inspector-panel-loader.test.js`、`tests/startup-resource-budget.test.js`：固定跨面板单样式加载、快速切页、失败重试和首屏排除边界。
- `tests/design-system.test.js`、`tests/layout-ui.test.js`、`tests/auth-ui.test.js`：把共享样式纳入设计系统、响应式和认证界面守卫，并确认面板规则不回流全局样式。
- `tests/browser-performance.test.js`：验证真实 Chromium 中五个面板共用一份样式并实际应用布局；无储藏仓库使用可恢复的页面状态夹具。
- `README.md`、`docs/ARCHITECTURE.md`、`docs/DESIGN_SYSTEM.md`、`docs/CONTINUE.md`：同步用户行为、共享样式职责、加载顺序、首屏基线和验证结果。
- `progress.md`：追加本轮实施、验证、清理和回滚记录。
- 回滚点为本轮开始前 `c607f2c`；提交前只逐块撤销本记录列出的仓库工具面板共享样式增量，不得整体恢复包含其他未提交成果的共享文件。提交后应对包含本记录的提交执行 `git revert <commit>`。

## 2026-08-11 - Task: 按需加载目录选择与命令面板专用样式

### What was done

- 把目录选择器和命令面板的专用布局从默认首屏样式迁入独立资源；只浏览提交图、工作区和右栏时不再下载或解析这组弹窗布局。
- 目录与命令门面改为并行载入完整实现和专用样式，等待两者都完成后再打开；失败时只重试失败资源，两个入口和后续打开继续复用同一组资源。
- 中文首屏资源数保持 `30` 个，体积从 `415,318` 降到 `411,319` 字节，净减少 `3,999` 字节；相对 `37 / 738,911` 累计减少 7 个请求和 `327,592` 字节。

### Testing

- 新加载器回归先在旧实现稳定为 `1/5` 通过、4 项失败，覆盖缺少样式资源、脚本先完成提前打开，以及脚本/样式失败后独立重试；实现后 `5/5` 通过。
- `node --check public/js/features/folder-command.js` 通过；加载器、布局、设计系统和首屏资源专项 `53/53` 通过，首屏诊断为 30 个资源、411,319 字节。
- `npm.cmd run test:browser`：真实 Chromium `1/1` 通过；首次载入 1 份脚本和 1 份样式约 `24.5 ms`，完整回归内约 `23.8 ms`，两个弹窗均正常打开、关闭并应用布局，大 Diff、3012 条提交、4000 文件和编辑器浸泡边界继续通过。
- `npm.cmd test`：`262/263` 通过；唯一失败仍是 `tests/git-api.test.js:1759`，受限 Windows 环境取消长时间 fetch 后等待响应超时，其余 Git、Electron、目录/命令弹窗和真实性能回归全部通过。
- `git diff --check` 通过，仅有仓库既有的 LF/CRLF 提示；本轮新目录 `forkline-operation-cancel-T2XQod` 已在确认位于 `%TEMP%` 后删除，浏览器性能临时目录为 0，`5177`、`5287`、`5288` 无监听，原有四个保留目录未改动。

### Notes

- `public/folder-command.css`：新增目录选择器和命令面板的按需内层布局。
- `public/styles.css`：移除已迁出的目录/命令专用规则，保留通用弹窗和菜单提示样式。
- `public/js/features/folder-command.js`：新增脚本与样式并行加载、完成等待和失败项独立重试。
- `tests/folder-command-loader.test.js`：固定双资源复用、样式完成前不打开，以及脚本/样式失败重试边界。
- `tests/startup-resource-budget.test.js`：阻止 `folder-command.css` 回流默认首屏。
- `tests/design-system.test.js`：把目录/命令专用样式纳入设计系统与颜色 Token 守卫。
- `tests/layout-ui.test.js`：验证专用选择器已迁出全局样式，并保留通用弹窗基础。
- `tests/browser-performance.test.js`：验证真实 Chromium 中两份资源只加载一次且两个弹窗实际应用布局。
- `README.md`：同步首次打开行为、失败重试和最新首屏基线。
- `docs/ARCHITECTURE.md`：记录加载器、专用样式职责和通用样式保留边界。
- `docs/DESIGN_SYSTEM.md`：登记目录与命令组件样式的代码来源。
- `docs/CONTINUE.md`：同步当前加载行为、性能数据、回归和环境清理结果。
- `progress.md`：追加本轮实现、测试证据、文件清单和回滚方式。
- 回滚点为本轮开始前 `c607f2c`；提交前只逐块撤销本记录列出的目录/命令样式按需加载增量，不得整体恢复包含其他未提交成果的共享文件。提交后应对包含本记录的提交执行 `git revert <commit>`。

## 2026-08-11 - Task: 按需加载提交操作历史编辑样式

### What was done

- 把历史编辑预检、影响提交列表、队列项和改信息表单从默认首屏样式迁入提交操作专用资源；普通提交浏览继续保留必要按钮、折叠标题、加载容器和空队列提示。
- 提交操作门面改为并行载入完整脚本和专用样式，等待两者都完成后再渲染；脚本或样式失败时只重试失败项，并发入口继续复用同一组进行中资源。
- 中文首屏资源数保持 `30` 个，体积从 `411,319` 降到 `407,579` 字节，净减少 `3,740` 字节；相对 `37 / 738,911` 累计减少 7 个请求和 `331,332` 字节。

### Testing

- 新加载器回归先在旧实现稳定为 `1/6` 通过、5 项失败，覆盖缺少专用样式、脚本先完成提前渲染，以及脚本/样式失败后独立重试；实现后 `6/6` 通过。
- `node --check public/js/features/commit-actions-loader.js` 通过；加载器、布局、设计系统和首屏专项 `60/60` 通过，首屏诊断为 30 个资源、407,579 字节。
- `npm.cmd run test:browser`：真实 Chromium `1/1` 通过；完整回归内提交操作首次载入约 `10.9 ms`，只保留 1 份脚本和 1 份样式。空队列在零按需资源时仍正常显示，完整历史队列实际应用 Grid 布局，大 Diff、3012 条提交、4000 文件和编辑器浸泡边界继续通过。
- `npm.cmd test`：`264/265` 通过；唯一失败仍是 `tests/git-api.test.js:1759`，Windows 取消长时间 fetch 后等待响应超时，其余 Git、Electron、提交操作、历史编辑和真实性能回归全部通过。
- 本轮新生成的 `forkline-operation-cancel-GEwGiC` 已在确认路径位于 `%TEMP%` 后删除；浏览器性能临时目录为 0，`5177`、`5287`、`5288` 无监听，原有 `forkline-operation-cancel-WsjQez`、`forkline-operation-cancel-beLRs5`、`forkline-operation-cancel-jr1hwp`、`forkline-operation-cancel-oVOm8k` 未改动。

### Notes

- `public/commit-actions.css`：新增历史编辑预检、影响提交、队列和改信息表单的按需样式。
- `public/styles.css`：移除已迁出的完整历史编辑规则，保留普通提交操作、折叠标题和加载/空队列基础样式。
- `public/js/features/commit-actions-loader.js`：新增脚本与样式并行加载、完成等待和失败项独立重试。
- `tests/commit-actions-loader.test.js`：固定双资源复用、样式完成前不渲染，以及脚本/样式失败重试边界。
- `tests/startup-resource-budget.test.js`：阻止提交操作专用样式回流默认首屏，并更新资源体积基线。
- `tests/design-system.test.js`、`tests/layout-ui.test.js`：把专用样式纳入设计系统守卫，并固定完整历史编辑选择器的归属。
- `tests/browser-performance.test.js`：验证真实 Chromium 中两份资源只加载一次，空队列保留首屏样式且完整队列应用专用布局。
- `README.md`：同步提交操作首次打开行为和最新首屏基线。
- `docs/ARCHITECTURE.md`：记录提交操作脚本、专用样式和首屏门面的职责边界。
- `docs/DESIGN_SYSTEM.md`：登记历史编辑组件样式的代码来源。
- `docs/CONTINUE.md`：同步当前加载行为、性能数据、回归和环境清理结果。
- `progress.md`：追加本轮实现、测试证据、文件清单和回滚方式。
- 回滚点为本轮开始前 `c607f2c`；提交前只逐块撤销本记录列出的提交操作历史编辑样式增量，不得整体恢复包含其他未提交成果的共享文件。提交后应对包含本记录的提交执行 `git revert <commit>`。

## 2026-08-12 - Task: 按需加载 Diff 工作台专用样式

### What was done

- 把最大化 Diff、逐行/按块操作、结果反馈、目标块高亮和粘性工具栏从默认首屏样式迁入独立资源；首屏只保留弹窗默认隐藏规则，普通浏览不再解析完整工作台布局。
- Diff 门面改为并行载入专用样式与有序脚本链，继续保证选择模块先于工作台实现；三份资源全部完成后才读取或打开对照，脚本或样式失败时只重试失败项。
- 中文首屏资源数保持 `30` 个，体积从 `407,579` 降到 `401,079` 字节，净减少 `6,500` 字节；相对 `37 / 738,911` 累计减少 7 个请求和 `337,832` 字节。

### Testing

- 新加载器回归先在旧实现稳定为 `1/5` 通过、4 项失败，覆盖缺少专用样式、脚本先完成提前执行，以及脚本/样式失败后独立重试；实现后 `5/5` 通过。
- `node --check public/js/features/diff-workbench-loader.js` 通过；加载器、文件编辑、布局、设计系统和首屏专项 `88/88` 通过，首屏诊断为 30 个资源、401,079 字节。
- `npm.cmd run test:browser`：真实 Chromium `1/1` 通过；首次载入约 `117.2 ms`，只保留 2 份脚本和 1 份样式，最大化弹窗实际使用 Grid，行操作工具栏实际使用 Sticky。大 Diff、3012 条提交、4000 文件、编辑器浸泡、DOM、监听器与堆边界继续通过。
- `npm.cmd test`：`266/267` 通过；唯一失败仍是 `tests/git-api.test.js:1759`，Windows 取消长时间 fetch 后等待响应超时，其余 Git、Electron、Diff 工作台、文件编辑器和真实性能回归全部通过。完整回归中的工作台首次载入约 `107.6 ms`。
- 本轮新生成的 `forkline-operation-cancel-KgQY7o` 已在确认路径位于 `%TEMP%` 后删除；浏览器性能临时目录为 0，`5177`、`5287`、`5288` 无监听，原有 `forkline-operation-cancel-WsjQez`、`forkline-operation-cancel-beLRs5`、`forkline-operation-cancel-jr1hwp`、`forkline-operation-cancel-oVOm8k` 未改动。

### Notes

- `public/diff-workbench.css`：新增最大化 Diff、逐行/按块操作、反馈、高亮和减弱动画的按需样式。
- `public/styles.css`：移除已迁出的工作台规则，只保留静态 Diff 弹窗默认隐藏与通用双栏 Diff 基础。
- `public/js/features/diff-workbench-loader.js`：新增样式与脚本链并行加载、完成等待和失败项独立重试。
- `tests/diff-workbench-loader.test.js`：固定三资源复用、脚本顺序、样式完成前不执行，以及脚本/样式失败重试边界。
- `tests/startup-resource-budget.test.js`：阻止 Diff 工作台专用样式回流默认首屏，并更新资源体积基线。
- `tests/design-system.test.js`、`tests/layout-ui.test.js`：把工作台样式纳入设计系统守卫，并固定交互选择器与全局隐藏规则的归属。
- `tests/file-editor-ui.test.js`：让现有 Diff 反馈、目标高亮和最大化布局契约读取新的专用样式来源。
- `tests/browser-performance.test.js`：验证真实 Chromium 中两份脚本和一份样式只加载一次，并确认最大化 Grid 与 Sticky 工具栏实际生效。
- `README.md`：同步 Diff 工作台首次打开行为、失败重试和最新首屏基线。
- `docs/ARCHITECTURE.md`：记录专用样式、有序脚本链、首屏隐藏规则和加载顺序。
- `docs/DESIGN_SYSTEM.md`：登记 Diff 工作台组件样式的代码来源。
- `docs/CONTINUE.md`：同步当前加载行为、性能数据、回归和环境清理结果。
- `progress.md`：追加本轮实现、测试证据、文件清单和回滚方式。
- 回滚点为本轮开始前 `c607f2c`；提交前只逐块撤销本记录列出的 Diff 工作台样式按需加载增量，不得整体恢复包含其他未提交成果的共享文件。提交后应对包含本记录的提交执行 `git revert <commit>`。

## 2026-08-12 - Task: 按需加载右键菜单专用样式

### What was done

- 把右键菜单完整布局迁入独立样式资源；首屏只保留菜单默认隐藏规则，普通提交浏览和工作区刷新不再解析完整右键菜单样式。
- 右键菜单门面改为并行载入完整实现与专用样式，两者全部完成后才显示；脚本或样式失败时只重试失败项。文件编辑器首次打开时复用同一份样式，不加载普通菜单实现。
- `styles.css` 减少 `1,451` 字节；中文首屏保持 `30` 个资源，体积从 `401,079` 降到 `400,983` 字节，净减少 `96` 字节；相对 `37 / 738,911` 累计减少 7 个请求和 `337,928` 字节。

### Testing

- 新加载器回归先在旧实现稳定为 `1/5` 通过、4 项失败，覆盖专用样式缺失、脚本先完成提前显示，以及脚本/样式独立失败重试；实现后菜单与文件编辑器加载专项 `8/8` 通过。
- `node --check public/js/features/context-menu-loader.js` 与 `node --check public/js/features/file-editor-loader.js` 通过；加载器、文件编辑、布局、设计系统和首屏专项 `91/91` 通过，首屏诊断为 30 个资源、400,983 字节。
- `node --test tests/browser-performance.test.js`：真实 Chromium `1/1` 通过；首次右键约 `11.3 ms`，只保留 1 份脚本和 1 份样式，菜单实际显示为 Grid；复杂文件打开约 `272.6 ms`，滚动约 `5.1 ms`，编辑器复用同一份菜单样式。大 Diff、3012 条提交、4000 文件、DOM、监听器和堆边界继续通过。
- `npm.cmd test`：`267/268` 通过；唯一失败仍是 `tests/git-api.test.js:1759`，Windows 取消长时间 fetch 后等待响应超时，其余 Git、Electron、右键菜单、文件编辑器和真实性能回归全部通过。完整回归中的菜单首次载入约 `11.0 ms`。
- 本轮新生成的 `forkline-operation-cancel-WSURJV` 已在确认路径位于 `%TEMP%` 后删除；浏览器性能临时目录为 0，`5177`、`5287`、`5288` 无监听，原有 `forkline-operation-cancel-WsjQez`、`forkline-operation-cancel-beLRs5`、`forkline-operation-cancel-jr1hwp`、`forkline-operation-cancel-oVOm8k` 未改动。

### Notes

- `public/context-menu.css`：新增提交、分支、文件、Tag、远端、reflog 和编辑器右键菜单的按需布局。
- `public/styles.css`：移除完整菜单规则，只保留静态菜单默认隐藏和共享命令提示样式。
- `public/js/features/context-menu-loader.js`：新增脚本与样式并行加载、完成等待、共享样式入口和失败项独立重试。
- `public/js/features/file-editor-loader.js`：文件编辑器资源加载时复用右键菜单样式 Promise。
- `tests/context-menu-loader.test.js`、`tests/file-editor-loader.test.js`：固定双资源复用、样式完成前不显示、编辑器复用和脚本/样式失败重试边界。
- `tests/layout-ui.test.js`、`tests/design-system.test.js`、`tests/startup-resource-budget.test.js`：登记新样式来源，守卫短视口菜单布局并阻止专用样式回流首屏。
- `tests/browser-performance.test.js`：验证真实 Chromium 中菜单脚本与样式各一份、Grid 实际生效，并确认文件编辑器复用样式。
- `README.md`：同步右键菜单首次打开行为和最新首屏基线。
- `docs/ARCHITECTURE.md`：记录菜单样式、加载顺序、文件编辑器复用和失败重试边界。
- `docs/DESIGN_SYSTEM.md`：登记右键菜单组件样式的代码来源。
- `docs/CONTINUE.md`：同步当前加载行为、性能数据、回归和环境清理结果。
- `progress.md`：追加本轮实现、测试证据、文件清单和回滚方式。
- 回滚点为本轮开始前 `c607f2c`；提交前只逐块撤销本记录列出的右键菜单样式按需加载增量，不得整体恢复包含其他未提交成果的共享文件。提交后应对包含本记录的提交执行 `git revert <commit>`。

## 2026-08-12 - Task: 修复受限 Windows 环境中的 Git 操作取消

### What was done

- 修复 Windows 拒绝 `taskkill /T /F` 后取消状态一直停留在 `cancelling` 的问题；权限失败时只对 Forkline 当前操作持有的 Git 子进程发送 `SIGTERM`，并关闭其继承的标准流，让原 `/api/action` 能及时结束。
- 回退严格使用当前操作登记的子进程句柄，不按进程名扫描或终止其他 Git/SSH；`taskkill` 正常可用时继续沿用完整进程树终止行为。
- 新增确定性运行时回归，并同步用户说明、后端边界和继续开发记录。

### Testing

- `node --check server/git-runtime.js` 通过；`node --test tests/git-runtime.test.js` 为 `2/2` 通过，覆盖 `taskkill` 权限失败回退和成功时不手动关闭标准流。
- 修复实现阶段连续两次真实长时间 fetch 取消均在约 `1.17` 秒内返回；最终 `npm.cmd test` 为 `270/270` 通过，完整回归中的真实 fetch 取消约 `1.02` 秒完成。
- `rg -n "DEBUG-cancel-a13f" server tests` 无结果；`git diff --check` 通过，仅显示仓库既有的 LF/CRLF 提示。
- `5177`、`5287`、`5288` 监听数为 0，`forkline-browser-performance-*` 临时目录为 0。本轮遗留的 `forkline-operation-cancel-Af03oJ`、`forkline-operation-cancel-gQ7YDP`、`forkline-operation-cancel-N9PLM3`、`forkline-operation-cancel-voZPel` 已在确认位于 `%TEMP%` 后删除；原有 `WsjQez`、`beLRs5`、`jr1hwp`、`oVOm8k` 四个目录保持不变。

### Notes

- `server/git-runtime.js`：增加 `taskkill` 权限失败时的当前子进程句柄回退，并导出终止辅助函数供测试使用。
- `tests/git-runtime.test.js`：新增 Windows 取消回退与正常 `taskkill` 边界测试。
- `README.md`：说明受限 Windows 环境中的取消行为和不会误杀其他 Git/SSH 的范围。
- `docs/ARCHITECTURE.md`：记录进程句柄回退、标准流解除和进程边界。
- `docs/CONTINUE.md`：更新当前取消能力、`270/270` 回归基线并追加本轮记录。
- `progress.md`：追加本轮实现、验证、临时资源清理和回滚方式。
- 回滚点为本轮开始前 `c607f2c`；提交前只逐块撤销本记录列出的取消修复增量并删除新增测试，不得整体恢复包含其他未提交成果的共享文件。提交后应对包含本记录的提交执行 `git revert <commit>`。

## 2026-08-12 - Task: 接收 Electron 第二实例仓库路径并保护切仓草稿

### What was done

- 修复 Forkline 已运行时再次传入仓库路径只聚焦窗口、目标路径被忽略的问题；第二实例现在复用当前窗口和后台服务，页面未就绪时保留最新路径，初始化完成后交给现有渐进切仓流程。
- 手动切仓、桌面路径、克隆后打开和初始化后打开统一检查文件编辑器与提交信息框；发现未保存内容时列出具体风险并确认，不再直接销毁草稿。
- Windows 同一盘符路径只存在大小写、斜杠方向或末尾斜杠差异时视为当前仓库，不重复提示；未修改其他平台的全局仓库快照比较规则。

### Testing

- 新回归在旧实现稳定为 `63/65`，两项失败分别固定第二实例路径被丢弃和切仓缺少未保存内容保护；实现完成后 Electron 与布局专项为 `68/68` 通过。
- `node --check` 覆盖 Electron 主进程、preload、路径协调器、页面启动、仓库切换、国际化和两份测试脚本：`8/8` 通过。
- `node --test tests/startup-resource-budget.test.js` 为 `2/2` 通过；中文首屏保持 `30` 个资源，体积从 `400,983` 增至 `403,595` 字节，仍低于 `750 KiB` 门限。
- `npm.cmd test` 为 `275/275` 通过。真实 Chromium 中 3012 条历史首绘约 `4.9 ms`，4000 文件渐进首屏约 `153.8 ms`、完整详情约 `702.1 ms`，30 次编辑器开关后 DOM、监听器和堆保持稳定；长时间 fetch 取消约 `1.02` 秒完成。
- `git diff --check` 通过，仅显示仓库既有 LF/CRLF 提示；`5177`、`5287`、`5288` 监听数为 0，`forkline-browser-performance-*` 与 `forkline-electron-*` 临时目录为 0。原有 `WsjQez`、`beLRs5`、`jr1hwp`、`oVOm8k` 四个取消测试目录保持不变。

### Notes

- `electron/repository-open-coordinator.js`：新增第二实例仓库请求的就绪等待、最新路径合并与交付状态机。
- `electron/main.js`：读取第二实例参数、聚焦现有窗口，并在渲染器加载边界更新路径交付状态。
- `electron/preload.js`：新增单向仓库路径订阅接口，不暴露任意 IPC 能力。
- `public/js/bootstrap.js`：启动前登记桌面路径监听，等待异步 `init()` 完成后串行切仓。
- `public/js/features/repositories.js`：统一未保存内容确认，并让克隆/初始化完成后打开复用同一保护。
- `public/js/i18n-catalog.js`：增加切仓风险项目和确认提示的英文文案。
- `tests/electron-shell.test.js`、`tests/layout-ui.test.js`：覆盖第二实例参数、未就绪排队、最新路径合并、启动竞争、未保存内容和 Windows 等价路径。
- `README.md`、`docs/ELECTRON_DESKTOP.md`、`docs/ARCHITECTURE.md`、`docs/CONTINUE.md`：同步用户行为、桌面模块边界、最新回归和首屏基线。
- `progress.md`：追加本轮实现、验证、清理和回滚记录。
- 回滚点为本轮开始前包含取消修复的未提交工作区；提交前只逐块撤销本记录列出的第二实例路径与切仓保护增量，并删除 `electron/repository-open-coordinator.js`，不得整体恢复共享文件。提交后应对包含本记录的提交执行 `git revert <commit>`。

## 2026-08-12 - Task: 优雅关闭 Electron 后台服务及其 Git 子进程

### What was done

- Electron 退出时先通过 IPC 请求后台服务停止，等待关闭完成后再继续退出；只有优雅路径超时才对当前实例持有的服务进程树执行有界兜底。
- 服务端统一处理桌面退出、自更新、父进程断开和终止信号，先停止 HTTP 接入并清理 Git 运行时，再结束服务进程。
- Git 运行时登记普通查询、二进制读取、认证助手 `ssh-add` 探针和可取消操作启动的全部子进程；关闭开始后拒绝新命令，清理范围不扩展到 Forkline 未持有的 Git/SSH，用户主动打开的系统凭据管理器不受影响。

### Testing

- 首轮旧实现专项稳定失败 3 项：缺少 Electron 关闭模块、缺少服务关闭协调器、Git 运行时没有统一关闭入口；边界审查又固定认证探针未登记 1 项。实现后 Electron、Git 运行时、服务关闭和后端装配专项 `33/33` 通过。
- 真实 fork 测试启动独立 HTTP 服务和长运行辅助子进程；发送桌面关闭消息后服务进程与辅助进程 PID 均消失，未使用进程名扫描。
- `node --check` 覆盖 12 个本轮主进程、服务端、测试与真实进程夹具脚本，全部通过。
- `npm.cmd test` 为 `282/282` 通过，包含真实 Chromium 性能回归；中文首屏保持 `30` 个资源、`403,595` 字节。
- `git diff --check` 通过，仅显示仓库既有 LF/CRLF 提示；`5177`、`5287`、`5288` 无监听，系统临时目录只剩原有 `WsjQez`、`beLRs5`、`jr1hwp`、`oVOm8k` 四个取消测试目录。

### Notes

- `electron/main.js`：退出事件改为等待后台服务关闭完成，并保留异常退出提示边界。
- `electron/server-process-shutdown.js`：新增 IPC 优雅关闭、等待和当前服务进程树超时兜底。
- `server.js`：接入统一关闭协调器，并让自更新复用相同关闭流程。
- `server/git-runtime.js`：登记全部 Git 子进程，关闭期间拒绝新命令并定向清理已登记进程。
- `server/shutdown-controller.js`：新增 HTTP、Git 运行时和进程退出的有界协调。
- `server/repository-service.js`、`server/repository-auth-service.js`：把认证助手的 `ssh-add` 探针登记到同一运行时，保留系统凭据管理器的独立窗口行为。
- `tests/electron-shell.test.js`、`tests/git-runtime.test.js`：覆盖桌面优雅退出、超时兜底和普通 Git 查询清理。
- `tests/backend-modules.test.js`：固定认证探针从服务装配到运行时登记的接线边界。
- `tests/server-shutdown.test.js`、`tests/fixtures/shutdown-server-child.js`：覆盖服务关闭顺序、HTTP 超时和真实父子进程退出。
- `README.md`、`docs/ELECTRON_DESKTOP.md`、`docs/ARCHITECTURE.md`、`docs/CONTINUE.md`：同步退出行为、模块边界、验证结果和当前限制。
- `progress.md`：追加本轮实现、验证、资源清理和回滚记录。
- 回滚点为本轮开始前已包含第二实例路径保护的未提交工作区；提交前只逐块撤销本记录列出的退出生命周期增量，并删除 `electron/server-process-shutdown.js`、`server/shutdown-controller.js`、`tests/server-shutdown.test.js` 和 `tests/fixtures/shutdown-server-child.js`，不得整体恢复共享文件。提交后应对包含本记录的提交执行 `git revert <commit>`。

## 2026-08-12 - Task: 让 Electron 应用内更新保持桌面进程监督

### What was done

- 修复 Electron 中“立即更新并重启”只重启后台 `server.js`、更新后服务脱离桌面主进程管理的问题；更新计划现在区分 Web 服务重启和 Electron 桌面重启。
- Electron 后台服务把主进程 PID、可执行文件和应用入口交给更新器。更新准备完成后只通知当前桌面父进程退出，主进程继续使用既有优雅关闭流程清理 HTTP 服务与 Git/SSH 子进程。
- 更新器重新启动 Electron 后等待新窗口健康标记；新实例启动失败或未正常显示时，终止本次启动的进程树、恢复更新前提交并重新打开旧桌面版本。

### Testing

- `node --check` 覆盖 `app-self-update.js`、`server/update-service.js`、`server.js`、`electron/main.js` 和 `electron/self-update-health.js`，全部通过。
- 首次专项运行为 `36/37`，唯一失败准确固定 Electron 主进程尚未传递监督更新元数据；接线完成后 `node --test tests/app-self-update.test.js tests/electron-shell.test.js` 为 `37/37` 通过。
- 真实本地 Git 远端夹具验证新桌面入口成功启动；损坏目标入口场景验证更新失败后代码回退并重新启动旧入口。健康标记同时校验目标版本和实际子进程 PID。
- `npm.cmd test` 为 `286/286` 通过，包含真实 Chromium 性能、完整 Git 操作、Electron 退出和更新恢复回归；总耗时约 `128.7` 秒。
- `git diff --check` 无空白错误，仅显示仓库既有 LF/CRLF 提示。`5177`、`5287`、`5288` 无监听，未发现 Electron 进程；可见 Node 进程路径均属于 Codex 运行时。`%TEMP%` 仍只保留原有 `WsjQez`、`beLRs5`、`jr1hwp`、`oVOm8k` 四个取消测试目录。
- 按用户要求未手动启动真实 Electron 窗口；更新器的进程启动与回退由真实 Node 进程夹具验证，Electron 窗口事件和 IPC 来源限制由静态契约测试覆盖。

### Notes

- `app-self-update.js`：新增 Electron 重启计划、受限健康标记等待、失败进程树清理和旧桌面恢复。
- `electron/self-update-health.js`：新增系统临时目录健康标记的路径限制与写入逻辑。
- `electron/main.js`：传递桌面更新元数据，只接受当前后台子进程的更新就绪消息，并在新窗口可显示后报告健康。
- `server/update-service.js`：把运行壳层元数据写入更新计划，并把完整计划交给关闭调度器。
- `server.js`：识别 Electron 监督运行环境，在桌面模式通知父进程退出，Web 模式继续使用服务关闭协调器。
- `tests/app-self-update.test.js`、`tests/electron-shell.test.js`：覆盖桌面成功重启、失败回退、元数据、消息来源和健康标记边界。
- `README.md`、`docs/ELECTRON_DESKTOP.md`、`docs/ARCHITECTURE.md`、`docs/CONTINUE.md`：同步桌面更新行为、模块边界、正式打包限制和验证结果。
- `progress.md`：追加本轮实现、验证、资源检查和回滚说明。
- 回滚点为本轮开始前已包含 Electron 退出生命周期的未提交工作区；提交前只逐块撤销本记录列出的桌面更新增量并删除 `electron/self-update-health.js`，不得整体恢复共享文件。提交后应对包含本记录的提交执行 `git revert <commit>`。

## 2026-08-12 - Task: 恢复 Electron 页面重载前的未保存草稿

### What was done

- 新增 Electron 主进程内存草稿，受限保存当前仓库的提交摘要、正文、追加状态，以及工作区文件路径、快照、未保存内容和查看位置；不写磁盘，不跨应用重启保留。
- 页面恢复当前仓库后自动恢复提交信息和文件编辑器。文件快照一致时可继续编辑保存；快照变化时改为“磁盘当前版本 / 恢复草稿”只读对照，并保留旧快照防止后续重载误覆盖新内容。
- 区分用户主动放弃与渲染器崩溃：无响应弹窗明确放弃时先清草稿再重载，渲染进程停止后的普通重载保留草稿。

### Testing

- 新回归先因缺少 `electron/renderer-draft-store.js` 稳定失败；实现后 Electron 草稿、IPC、重载选择、提交恢复和快照冲突专项 `29/29` 通过。
- 文件编辑器、布局、国际化和首屏资源专项 `119/119` 通过；中文首屏保持 `30` 个资源、`408,045` 字节，文件编辑器与完整对照资源仍按需加载。
- `npm.cmd test` 为 `290/290` 通过，总耗时约 `128.7` 秒。真实 Chromium 中复杂历史文件、3012 条提交、4000 文件工作区、慢编辑器降级、冲突编辑器和 30 次编辑器开关边界继续通过。
- 修改的 JavaScript 文件均通过 `node --check`；`git diff --check` 无空白错误，仅显示仓库既有 LF/CRLF 提示。
- `5177`、`5287`、`5288` 无监听，没有 Electron 遗留进程；`%TEMP%` 仍只保留原有 `forkline-operation-cancel-WsjQez`、`forkline-operation-cancel-beLRs5`、`forkline-operation-cancel-jr1hwp`、`forkline-operation-cancel-oVOm8k` 四个目录。
- 按约束未手动启动真实 Electron 窗口；页面恢复语义由可执行 VM 行为测试覆盖，真实 Chromium 回归验证现有编辑器和性能边界。

### Notes

- `electron/renderer-draft-store.js`：新增受限字段、`8 MiB` 总量、读取副本和空草稿清除的主进程内存仓库。
- `electron/renderer-health.js`：主动放弃时先清草稿，崩溃重载继续保留，并更新恢复提示。
- `electron/main.js`：装配草稿仓库、当前窗口来源限制和读写 IPC。
- `electron/preload.js`：新增受限的草稿保存与读取接口。
- `public/js/core.js`：新增 `600 ms` 固定节流、草稿采集、初始化后恢复和原始文件快照保留。
- `public/js/bootstrap.js`：等待仓库初始化与草稿恢复完成后再处理桌面第二实例路径。
- `public/js/app/events.js`：追加复选框自动填充提交信息后再同步恢复草稿。
- `public/js/features/file-editor.js`：应用恢复内容，并在磁盘快照变化时建立只读恢复对照。
- `public/js/features/file-editor-window.js`：显示恢复状态、磁盘当前版本和恢复草稿标签。
- `public/js/features/repositories.js`：把只读恢复草稿和待恢复文件纳入未保存内容检查，切换仓库前必须明确确认。
- `public/js/i18n-catalog.js`：补齐恢复提示的英文映射。
- `tests/electron-shell.test.js`：覆盖草稿规范化、容量、复制、重载清除、崩溃保留、提交恢复和文件快照安全。
- `tests/file-editor-ui.test.js`：固定恢复界面的英文文案。
- `tests/layout-ui.test.js`：让桌面路径启动顺序回归包含草稿恢复阶段。
- `README.md`、`docs/ELECTRON_DESKTOP.md`、`docs/ARCHITECTURE.md`、`docs/CONTINUE.md`：同步用户行为、模块边界、限制、回归和环境结果。
- `progress.md`：追加本轮实现、验证、文件清单和回滚说明。
- 回滚点为本轮开始前已包含 Electron 应用内更新监督的未提交工作区；提交前只逐块撤销本记录列出的草稿恢复增量并删除 `electron/renderer-draft-store.js`，不得整体恢复共享文件。提交后应对包含本记录的提交执行 `git revert <commit>`。

## 2026-08-12 - Task: 修复 476px 窄竖屏顶栏按钮被裁切

### What was done

- 在约 `476×1043` 的窄竖屏下复现仓库路径操作组超出视口、最右侧“打开”被页面裁切的问题。
- 宽度不超过 `600px` 时把路径输入与最近仓库保留在第一行，将“选择 / 克隆 / 初始化 / 打开”移到同一框内第二行并平均分配宽度；顶栏同步增高到 `224px`。
- 保留左侧分支栏、中间图谱、底部三栏内部横向滚动和下沉详情栏的既有响应式语义，没有隐藏仓库操作或缩短按钮文字。

### Testing

- 新增真实 Chromium 回归后，旧样式稳定失败：`476px` 视口中的应用外壳扩到 `515px`。
- `node --test tests/layout-ui.test.js`：`48/48` 通过。
- `npm.cmd run test:browser`：真实 Chromium `1/1` 通过；复杂编辑器、3012 条历史、4000 文件工作区和 30 次编辑器开关边界继续通过。
- `npm.cmd test`：完整回归 `291/291` 通过；中文首屏保持 `30` 个资源、`408,990` 字节。
- 真实 `D:/桌面/GitTest` 只读复测：约 `477×1045` CSS 视口中应用外壳和顶栏约 `478px`，仓库操作组最右侧约 `462px`；主区域和详情栏底边仍落在视口内，仓库原有改动未修改。
- `5177`、`5287`、`5288`、`5290`、`5291` 无监听，没有 Forkline Node/Electron 遗留进程；浏览器性能临时目录为 0，系统临时目录仍只保留原有四个 `forkline-operation-cancel-*` 目录。

### Notes

- `public/styles.css`：增加 `600px` 窄屏顶栏、路径栏和仓库操作第二行布局。
- `tests/browser-performance.test.js`：增加精确 `476×1043` 的页面级横向溢出真实浏览器回归。
- `tests/layout-ui.test.js`：固定第二行路径操作、按钮收缩和顶栏高度契约。
- `README.md`：把主要功能说明更新为同时支持竖屏与窄屏布局。
- `docs/CONTINUE.md`：更新回归数量、首屏体积、当前布局基线并追加本轮实测记录。
- `progress.md`：追加本轮实现、验证、环境清理、文件清单和回滚方式。
- 回滚点为本轮开始前已包含 Electron 草稿恢复的未提交工作区；提交前只逐块撤销本记录列出的窄竖屏增量，不得整体恢复这些共享脏文件。提交后应对包含本记录的提交执行 `git revert <commit>`。

## 2026-08-12 - Task: 修复首次打开真实仓库状态不一致并复核窄竖屏

### What was done

- 从示例页首次打开真实仓库时，仓库级清理不再无条件调用尚未载入的文件编辑器搜索模块，避免后台已切仓而页面仍停留在示例仓库。
- 新增直接覆盖“文件编辑器搜索模块未载入”的仓库切换回归，固定这条按需加载边界。
- 在真实 `D:/桌面/GitTest` 上只读复核页面与 API 一致性，并确认约 `477×1045` CSS 竖屏下底部三栏和下沉详情均可完整滚动访问。

### Testing

- 新回归在修复前稳定失败并给出 `resetFileEditorSearchUi is not defined`；最小修复后 `node --test tests/layout-ui.test.js` 为 `49/49` 通过。
- 真实页面与 `/api/state` 均显示 `GitTest`、分支 `123`、29 条图谱记录和 4 个工作区文件，浏览器控制台错误为 0；测试未修改仓库现有内容。
- 窄竖屏中底部工作台内部横向滚动从 `0` 到最大约 `369px` 后可完整显示提交编辑栏；详情正文纵向滚动从 `0` 到最大约 `605px`，检查后均恢复到顶部。
- `npm.cmd test` 为 `292/292` 通过，总耗时约 `129.9` 秒；中文首屏为 `30` 个资源、`409,040` 字节。
- 临时浏览器视口已恢复并结束测试标签；`5177`、`5287`、`5288`、`5292` 监听数量为 0。按约束未启动真实 Electron。

### Notes

- `public/js/features/repositories.js`：在仓库级状态清理中保护按需载入的文件编辑器搜索界面重置函数。
- `tests/layout-ui.test.js`：增加按需搜索模块缺席时清理仓库状态的可执行回归。
- `README.md`：说明首次真实仓库切换的一致性行为并更新首屏资源基线。
- `docs/CONTINUE.md`：更新当前回归数量、首屏体积，并记录真实仓库和竖屏复核结果。
- `progress.md`：追加本轮实现、验证、环境清理、文件清单和回滚方式。
- 鼠标指针异常按用户要求移出本轮范围；未修改 Electron 运行参数，也未启动 Electron。
- 回滚点为本轮开始前已包含窄竖屏顶栏收口的未提交工作区；提交前只逐块撤销本记录列出的仓库切换保护、对应测试和文档增量，不得整体恢复这些共享脏文件。提交后应对包含本记录的提交执行 `git revert <commit>`。

## 2026-08-12 - Task: 把首次真实仓库切换纳入 Chromium 冷启动回归

### What was done

- 真实 Chromium 回归改为使用独立浏览器配置从示例页启动，不再由测试代码提前调用后台 API 打开仓库。
- 首屏确认文件编辑器尚未载入后，通过真实路径输入和“打开”按钮进入临时 Git 仓库；页面和后台仓库、提交图、渐进详情及按钮收尾必须全部一致。
- 保留后续按需模块、复杂文件、3012 条历史、4000 文件工作区和反复切仓性能场景，使冷启动验证成为现有完整性能回归的一部分。

### Testing

- 第一次运行准确暴露旧就绪辅助仍要求“启动时已经是真实仓库”；拆分示例页启动和切仓完成后，第二次运行暴露仓库数据完成与按钮最终恢复之间的正常短暂时序，等待条件据此收紧到完整操作结束。
- `npm.cmd run test:browser` 为 `1/1` 通过；冷启动切仓验证前后端路径一致、示例标记关闭、提交行已渲染、按钮可用、提示无 `is not defined`，同时 CodeMirror、搜索实现和文件编辑器资源仍未预载。
- `npm.cmd test` 为 `292/292` 通过，总耗时约 `129.4` 秒；首屏为 `30` 个资源、`409,040` 字节，复杂文件打开约 `263 ms`，真实性能与浸泡边界保持通过。
- `%TEMP%` 中 `forkline-browser-performance-*` 目录数量为 0，命令行属于本仓库的 `server.js` Node 进程数量为 0；`5177`、`5287`、`5288`、`5292` 监听数量为 0。

### Notes

- `tests/browser-performance.test.js`：把真实浏览器启动流程改为示例页冷启动后通过界面打开临时仓库，并删除不再使用的后台预打开辅助函数。
- `docs/CONTINUE.md`：追加冷启动切仓回归的覆盖范围、性能结果和环境清理证据。
- `progress.md`：追加本轮验证强化、失败收敛过程、文件清单和回滚方式。
- 本轮没有修改产品运行时代码，没有启动真实 Electron，也没有修改 `D:/桌面/GitTest`。
- 回滚点为本轮开始前已包含首次切仓修复和竖屏复核的未提交工作区；提交前只撤销本记录新增的浏览器冷启动回归及文档增量，不得整体恢复共享脏文件。提交后应对包含本记录的提交执行 `git revert <commit>`。

## 2026-08-12 - Task: 阻止按需加载中的旧仓库动作落到新仓库

### What was done

- Git 操作、提交操作、文件编辑器、Diff 工作台和右键菜单入口在等待按需资源前记录仓库路径，资源完成后再次确认仍是同一仓库。
- 如果加载期间发生切仓，旧入口直接结束，不再把仓库 A 的点击、写操作或菜单请求交给仓库 B 的实现。
- 为五类加载器补充确定性竞争回归，固定覆盖资源尚未完成时切仓的边界。

### Testing

- 新增的五条回归在修复前均稳定失败；修复后加载器专项 `28/28` 通过。
- 相关 5 个加载器和 5 个测试文件均通过 `node --check`。
- `npm.cmd test` 为 `297/297` 通过，总耗时约 `129.0` 秒；真实 Chromium `1/1`，复杂文件打开约 `265 ms`，3012 条历史、4000 文件工作区和 30 次编辑器开关边界均通过。
- `git diff --check` 无空白错误，仅有仓库既有 LF/CRLF 提示。
- `%TEMP%` 中 `forkline-browser-performance-*` 目录数量为 0，属于本仓库的 `server.js` Node 进程数量为 0；`5177`、`5287`、`5288`、`5292` 监听数量为 0。

### Notes

- `public/js/features/git-actions-loader.js`：Git 动作按需加载完成后校验仓库快照。
- `public/js/features/commit-actions-loader.js`：提交与历史动作按需加载完成后校验仓库快照。
- `public/js/features/file-editor-loader.js`：工作区和历史文件打开或切换前后校验仓库快照。
- `public/js/features/diff-workbench-loader.js`：Diff 读取、弹窗、逐行和按块动作前后校验仓库快照。
- `public/js/features/context-menu-loader.js`：所有仓库相关右键菜单按需加载完成后校验仓库快照。
- `tests/git-actions-loader.test.js`：覆盖 Git 动作等待实现期间切仓。
- `tests/commit-actions-loader.test.js`：覆盖提交动作等待实现期间切仓。
- `tests/file-editor-loader.test.js`：覆盖文件打开等待资源期间切仓。
- `tests/diff-workbench-loader.test.js`：覆盖 Diff 读取等待资源期间切仓。
- `tests/context-menu-loader.test.js`：覆盖右键菜单等待资源期间切仓。
- `docs/CONTINUE.md`：更新完整回归数量并记录按需动作切仓保护。
- `progress.md`：追加本轮实现、验证、文件清单和回滚边界。
- 本轮没有启动真实 Electron，没有修改 `D:/桌面/GitTest`，也没有处理鼠标指针问题。
- 回滚点为本轮开始前包含冷启动回归的共享未提交工作区；提交前应只反向移除上述五个加载器中的仓库快照校验、五条对应测试及本轮文档增量，不得对这些共享脏文件执行整文件 `git restore`。提交后应对包含本记录的提交执行 `git revert <commit>`。

## 2026-08-12 - Task: 降低大型工作区文件树滚动展开卡顿

### What was done

- 为每个目录节点按完整文件数量写入固有高度，并让工作区和暂存区目录组使用 `content-visibility: auto`。
- 浏览器可以跳过屏幕外整棵目录子树的布局和绘制，同时继续保留首批 800、后续每批 400、完整 DOM、目录归纳、折叠、选择、双击和右键语义。
- 在真实 4000 文件压力回归中增加目录组计算样式契约，防止后续改动退回只逐行隔离的高停顿路径。

### Testing

- 修改前连续四次真实 Chromium 基线中，4000 文件完整展开约 `655-850 ms`，加载阶段最长停顿约 `89-227 ms`，最慢加载帧约 `133-210 ms`。
- 先验证把每批 400 改为 200：完整展开变为约 `1.26 s`，最长停顿仍约 `187 ms`，因此该实验已完整撤回。
- 目录级回归在旧样式下确定性失败为 `visible !== auto`；实现后连续两次独立回归和一次完整回归均通过，完整展开约 `245-253 ms`，最长停顿约 `15-23 ms`，最慢帧约 `34-36 ms`。
- `node --check public/js/features/file-tree.js` 与 `node --check tests/browser-performance.test.js` 通过；`git diff --check` 无空白错误，仅有仓库既有 LF/CRLF 提示。
- `npm.cmd test` 为 `297/297` 通过，总耗时约 `129.0` 秒；复杂文件、冲突编辑器、3012 条历史、渐进切仓、4000 文件和 30 次编辑器开关边界均通过，中文首屏保持 `30` 个资源、`410,717` 字节。
- `%TEMP%` 中 `forkline-browser-performance-*` 目录数量为 0，属于本仓库的 `server.js` Node 进程数量为 0；`5177`、`5287`、`5288`、`5292` 监听数量为 0。

### Notes

- `public/js/features/file-tree.js`：为目录节点写入按完整文件数量估算的固有高度。
- `public/styles.css`：让工作区文件树目录组跳过屏幕外子树的布局和绘制。
- `tests/browser-performance.test.js`：在真实 4000 文件 DOM 中固定目录级渲染隔离契约。
- `README.md`：说明大型工作区按目录跳过屏幕外布局并保留稳定滚动高度。
- `docs/ARCHITECTURE.md`：记录首批/增量数量、目录固有高度和真实性能回归边界。
- `docs/CONTINUE.md`：更新大型工作区当前实现、前后指标和被否决方案。
- `progress.md`：追加本轮诊断、实现、验证、文件清单和回滚边界。
- 本轮没有启动真实 Electron，没有修改 `D:/桌面/GitTest`，也没有处理鼠标指针问题。
- 回滚点为本轮开始前包含按需动作切仓保护的共享未提交工作区；提交前应只反向移除目录固有高度、目录级 `content-visibility`、对应浏览器断言及本轮文档增量，不得对共享脏文件执行整文件 `git restore`。提交后应对包含本记录的提交执行 `git revert <commit>`。

## 2026-08-12 - Task: 降低大型工作区无变化轮询开销

### What was done

- 定位 4000 文件工作区空闲刷新瓶颈：`git status` 约 `57-60 ms`，逐文件元数据快照约 `192-392 ms`。
- 后端为当前仓库增加递归、非持久文件监听，并缓存最近一次完整工作区快照；状态、期望快照、监听代次一致且未超过 60 秒时跳过重复文件扫描。
- 文件事件、Git 状态变化、监听错误、切换仓库或安全期限到达都会完整重扫；监听不可用时自动回退。高频状态读取使用 `GIT_OPTIONAL_LOCKS=0`，避免只读轮询触发可选索引写入。
- 修正状态命令契约测试按单行代码识别的误报，并固定完整调用块、stdout-only 和可选锁参数；真实浏览器回归改为连续采集 5 次无变化请求，并真实修改文件验证监听失效。

### Testing

- `node --test tests/backend-modules.test.js tests/worktree-refresh.test.js`：`18/18` 通过。
- `node --test tests/browser-performance.test.js`：真实 Chromium `1/1` 通过；4000 文件冷 API 约 `450.6 ms`，5 次无变化请求中位数 `61.1 ms`，完整展开约 `257.9 ms`，最长加载停顿约 `21.6 ms`，真实文件修改后下一次请求立即返回新快照。
- `npm.cmd test`：`299/299` 通过，总耗时约 `129.0` 秒；完整回归中的 4000 文件冷 API 约 `456.1 ms`，无变化请求中位数 `60.5 ms`，完整展开约 `244.8 ms`。
- `node --check` 覆盖 `server/repository-worktree-service.js`、`tests/backend-modules.test.js`、`tests/worktree-refresh.test.js` 和 `tests/browser-performance.test.js`，全部通过。
- `git diff --check` 无空白错误，仅有仓库既有 LF/CRLF 提示。
- `%TEMP%` 中 `forkline-browser-performance-*` 目录数量为 0，属于本仓库的 `server.js` Node 进程数量为 0；`5177`、`5287`、`5288`、`5292` 监听数量均为 0。

### Notes

- `server/repository-worktree-service.js`：增加当前仓库文件监听、快照复用、60 秒安全重扫、失败回退和只读 Git 状态参数。
- `tests/worktree-refresh.test.js`：覆盖监听复用、文件事件失效、安全重扫、监听失败回退和状态命令参数。
- `tests/backend-modules.test.js`：让机器可读状态契约检查完整的多行 Git 调用块。
- `tests/browser-performance.test.js`：采集 5 次无变化 API 中位数，并真实修改现有文件验证下一次刷新返回新快照。
- `README.md`：说明后台状态核对、监听辅助复用和 60 秒安全重扫。
- `docs/ARCHITECTURE.md`：记录缓存生效条件、正确性回退和性能回归边界。
- `docs/CONTINUE.md`：更新大型工作区当前实现、前后指标和后续开发基线。
- `progress.md`：追加本轮诊断、实现、验证、环境清理、文件清单和回滚边界。
- 本轮没有启动真实 Electron，没有修改 `D:/桌面/GitTest`，也没有处理鼠标指针问题。
- 回滚点为本轮开始前包含大型工作区目录级渲染隔离的共享未提交工作区；提交前应只反向移除 `repository-worktree-service.js` 中的监听缓存、对应三份测试增量和本轮文档增量，不得对这些共享脏文件执行整文件 `git restore`。提交后应对包含本记录的提交执行 `git revert <commit>`。

## 2026-08-12 - Task: 让大型工作区按变化路径增量刷新快照

### What was done

- 在上一轮无变化快照缓存上继续保存完整文件状态列表、规范化变化路径和是否要求全扫的监听状态。
- Git 状态文本不变时，具体文件事件只重算对应状态项；只有目录事件时重算该目录覆盖的状态项；重复事件和已有具体子路径的祖先事件会合并。
- `.git/index`、`.git/index.lock`、模糊路径、状态变化、监听错误、切仓和 60 秒安全期限继续完整扫描；其他 `.git` 对象事件忽略。增量刷新保留上一次完整扫描时间，不能无限延期安全全扫。
- 增加真实 Git index-only 场景：porcelain 前后都为 `MM note.txt`，只替换 index blob，验证 Forkline 仍立即更新工作区快照。

### Testing

- 新增回归在旧实现稳定失败：工作区专项为 `14/15`，新增测试没有经过快照读取钩子；真实 Chromium 单文件变化刷新为 `422.0 ms`，超过 `300 ms` 门限。
- 实现后 `node --test tests/backend-modules.test.js tests/worktree-refresh.test.js` 为 `19/19` 通过。
- `node --test --test-name-pattern 'worktree polling returns a compact unchanged response' tests/git-api.test.js` 为 `1/1` 通过，真实验证相同 `MM` 状态文本下 index-only 变化仍刷新快照。第一次通过 `cmd` 使用错误引号启动的专项没有输出，已主动终止；确认无遗留进程后使用 PowerShell 正确传参重跑。
- `node --test tests/browser-performance.test.js` 为 `1/1` 通过；4000 文件冷 API 约 `439.8 ms`，无变化中位数 `61.4 ms`，单文件变化从 `422.0 ms` 降到 `71.1 ms`，一次请求即返回新快照。
- `npm.cmd test` 为 `300/300` 通过，总耗时约 `130.7` 秒；完整回归中冷 API 约 `450.5 ms`、无变化中位数 `61.4 ms`、单文件变化 `82.5 ms`。
- `node --check` 覆盖 `server/repository-worktree-service.js`、`tests/worktree-refresh.test.js`、`tests/browser-performance.test.js` 和 `tests/git-api.test.js`，全部通过。
- `git diff --check` 无空白错误，仅有仓库既有 LF/CRLF 提示。
- `%TEMP%` 中浏览器性能、监听事件探针和工作区轮询临时目录数量为 0，属于本仓库的 Node 进程数量为 0；`5177`、`5287`、`5288`、`5292` 监听数量均为 0。

### Notes

- `server/repository-worktree-service.js`：记录监听变化路径，缓存完整文件状态，并按文件或目录增量重算；Git index 与安全边界保持全扫。
- `tests/worktree-refresh.test.js`：覆盖具体文件、父目录、重复事件和 Git index 强制全扫。
- `tests/browser-performance.test.js`：记录单文件变化 API 时长并固定低于 `300 ms` 的真实浏览器门限。
- `tests/git-api.test.js`：增加 porcelain 文本不变的真实 index-only 快照刷新验证。
- `README.md`：说明无变化复用、按路径增量重算和完整扫描边界。
- `docs/ARCHITECTURE.md`：记录监听事件归并、增量快照、索引正确性和 60 秒安全重扫规则。
- `docs/CONTINUE.md`：更新大型工作区当前实现、前后指标和后续开发基线。
- `progress.md`：追加本轮诊断、实现、验证、环境清理、文件清单和回滚边界。
- 本轮没有启动真实 Electron，没有修改 `D:/桌面/GitTest`，没有处理鼠标指针问题，也没有提交或推送。
- 回滚点为本轮开始前已完成无变化轮询快照复用的共享未提交工作区；提交前应只反向移除变化路径集合、增量文件重算、索引强制全扫、对应三份测试增量和本轮文档增量，不得对这些共享脏文件执行整文件 `git restore`。提交后应对包含本记录的提交执行 `git revert <commit>`。

## 2026-08-12 - Task: 降低大型工作区首次冷扫描开销

### What was done

- 保留工作区文件内容 SHA-256、安全路径校验、快照格式和 8192 项 LRU 缓存边界，不以削弱写操作过期保护换取速度。
- 缓存为空时使用同一个文件句柄完成打开、元数据读取、内容读取和关闭，减少每个文件一次独立路径查询；缓存命中继续使用路径 `stat` 快速验证元数据，变化后重新读取并生成新哈希。
- 为 4000 文件真实浏览器场景增加冷 API `350 ms` 门限，并固定首次只打开一个句柄、缓存命中不重复读内容和元数据变化后重新哈希的行为。

### Testing

- 独立 4000 文件微基准中，原 `stat + readFile` 路径为 `353.9-442.8 ms`，单句柄路径为 `180.8-184.9 ms`。
- `node --test tests/worktree-refresh.test.js` 为 `15/15` 通过；工作区安全专项为 `21/21`，真实 Git index-only 专项为 `1/1`。
- `node --test tests/browser-performance.test.js` 为 `1/1` 通过；修复前真实 Chromium 冷 API 为 `460.2 ms`，修复后独立回归为 `307.2 ms`，无变化刷新约 `61.6-62.5 ms`，单文件变化约 `76.9-81.4 ms`，渐进详情约 `650.2 ms`。
- `npm.cmd test` 为 `300/300` 通过，总耗时约 `128.6` 秒；完整回归中的冷 API 为 `306.2 ms`，渐进详情约 `565.5 ms`。
- `node --check` 覆盖 `server/repository-worktree-service.js`、`tests/worktree-refresh.test.js` 和 `tests/browser-performance.test.js`，全部通过。
- `git diff --check` 无空白错误，仅有仓库既有 LF/CRLF 提示。
- `%TEMP%` 中 `forkline-browser-performance-*`、`forkline-cold-hash-*` 和 `forkline-open-dir-*` 临时目录均为 0；已关闭本轮遗留的 Forkline `server.js` 测试服务，`5177`、`5287`、`5288`、`5290`、`5292` 监听均为 0。

### Notes

- `server/repository-worktree-service.js`：让冷缓存文件快照复用单个文件句柄，缓存命中路径和强 SHA-256 语义保持不变。
- `tests/worktree-refresh.test.js`：固定首次句柄打开/关闭次数、缓存命中路径 `stat` 和元数据变化后的重新读取。
- `tests/browser-performance.test.js`：为 4000 文件冷 API 增加低于 `350 ms` 的真实浏览器门限。
- `README.md`：简要说明冷扫描仍保留 SHA-256，并记录真实 4000 文件指标。
- `docs/ARCHITECTURE.md`：记录单句柄读取、缓存命中路径和强快照安全边界。
- `docs/CONTINUE.md`：追加实现、前后性能、回归结果和环境清理证据。
- `progress.md`：追加本轮实现、验证、文件清单和局部回滚边界。
- 本轮没有启动真实 Electron，没有修改 `D:/桌面/GitTest`，没有处理鼠标指针问题，也没有提交或推送。
- 回滚点为本轮开始前已完成变化路径增量快照的共享未提交工作区；提交前只应反向恢复 `worktreeFileSnapshot` 的冷缓存读取分支、对应两份测试增量和本轮四份文档增量，不得对共享脏文件执行整文件 `git restore`。提交后应对包含本记录的提交执行 `git revert <commit>`。

## 2026-08-12 - Task: 并行载入文件编辑器的独立依赖

### What was done

- 定位文件编辑器首次打开的可优化开销：复杂历史文件冷打开约 `283.3 ms`，资源已加载后的普通文件约 `104.5 ms`，加载器此前依次等待 33 份本地脚本。
- 把 CodeMirror 核心、插件和语言模式拆成显式依赖层；同层资源并行请求，`JSX / HTMLMixed / Markdown / Dockerfile / PHP` 仍等待各自基础模式，五个 Forkline 编辑器模块继续按原顺序执行。
- 保留原资源集合、按需加载边界、共享进行中 Promise、切仓过期保护和失败重试语义；当前依赖层失败时不会提前执行后续模块，重试只补失败资源。

### Testing

- 新增分组加载行为测试在旧实现稳定失败为 `4/5`，错误为 `fileEditorScriptResourceGroups is not defined`；实现后 `node --test tests/file-editor-loader.test.js` 为 `5/5` 通过。
- `node --test tests/file-editor-ui.test.js tests/file-editor-loader.test.js tests/startup-resource-budget.test.js` 为 `40/40` 通过，中文首屏仍为 `30` 个资源、`410,922` 字节。
- 优化前真实 Chromium 首次复杂文件为 `283.3 ms`；优化后两次独立回归分别为 `234.1 ms` 和 `213.3 ms`，完整回归为 `212.0 ms`，提升约 `17%-25%`。资源已加载后的普通文件保持 `100.5-111.6 ms`。
- 三次优化后 `npm.cmd run test:browser` / 完整套件中的真实 Chromium 均为 `1/1`；慢编辑器自动降级、冲突编辑器、3012 条历史、4000 文件、渐进打开、30 次编辑器开关、DOM、监听器和堆边界继续通过。
- `npm.cmd test` 为 `301/301` 通过，总耗时约 `127.6` 秒。
- `node --check public/js/features/file-editor-loader.js` 和 `node --check tests/file-editor-loader.test.js` 通过；`git diff --check` 无空白错误，仅有仓库既有 LF/CRLF 提示。
- `%TEMP%` 中 `forkline-browser-performance-*`、`forkline-cold-hash-*` 和 `forkline-open-dir-*` 临时目录均为 0，没有本仓库 Node 测试进程；`5177`、`5287`、`5288`、`5290`、`5292` 监听均为 0。

### Notes

- `public/js/features/file-editor-loader.js`：把 33 份文件编辑器脚本改为依赖分组，同组并行、跨组等待。
- `tests/file-editor-loader.test.js`：增加受控加载器回归，固定同层同时开始和后续依赖层等待行为。
- `README.md`：说明文件编辑器依赖分组并行载入，并更新首屏资源字节基线。
- `docs/ARCHITECTURE.md`：记录 CodeMirror 模式依赖层、Forkline 模块顺序和失败重试边界。
- `docs/CONTINUE.md`：更新当前文件编辑器性能基线并追加实现、回归和环境清理证据。
- `progress.md`：追加本轮诊断、实现、验证、文件清单和局部回滚边界。
- 本轮没有启动真实 Electron，没有修改 `D:/桌面/GitTest`，没有处理鼠标指针问题，也没有提交或推送。
- 回滚点为本轮开始前已完成冷扫描单句柄读取的共享未提交工作区；提交前只应把 `file-editor-loader.js` 恢复为原有平铺资源数组和逐项等待，移除对应分组测试及本轮文档增量，不得对这些共享脏文件执行整文件 `git restore`。提交后应对包含本记录的提交执行 `git revert <commit>`。

## 2026-08-12 - Task: 并行读取分支比较并固定提交快照

### What was done

- 定位分支比较首次打开约 `249.1 ms` 的等待链：当前分支名与 HEAD 状态、共同祖先与左右独有提交数此前分别串行等待。
- 把两组彼此独立的只读 Git 信息改为并行读取；基准和目标解析完成后，后续共同祖先、计数、独有提交日志与 Diff 全部使用固定提交 SHA，避免同一次比较混入分支引用移动后的状态。
- 保留响应中的基准、目标引用名、中文错误提示、独有提交上限和用户可读命令展示，不改变比较页交互与 Git 语义。

### Testing

- 新增确定性服务回归在旧实现稳定失败为 `false !== true`，同时固定前置读取并发、拓扑读取并发和所有后续 Git 范围使用已解析 SHA；实现后专项 `1/1` 通过。
- 沙箱内 Node 子进程读取 `D:/桌面/GitTest/.git/objects` 被系统拒绝，确认不是产品错误后，在获准的只读环境重跑真实接口。`main` 对 `local_debug` 连续 6 次均返回基准独有 9 个提交，耗时为 `160.3-168.8 ms`，相对本轮修改前约 `249.1 ms` 降低约 `32%-36%`；测试前后未写入该仓库。
- `node --test --test-concurrency=1 tests/repository-history-performance.test.js tests/git-api.test.js` 为 `31/31` 通过；`node --check server/repository-history.js` 通过。
- `npm.cmd test` 为 `302/302` 通过，总耗时约 `128.7` 秒。真实 Chromium 中分支比较页首次 API、资源和渲染合计约 `189.4 ms`，大型历史、4000 文件工作区、编辑器浸泡、Electron、Git 操作与安全边界继续通过。
- `git diff --check` 无空白错误，仅有仓库既有 LF/CRLF 提示；临时测量脚本已删除，属于本仓库的 `server.js` Node 进程为 0，`5177`、`5287`、`5288`、`5290`、`5292`、`5294` 均无监听。

### Notes

- `server/repository-history.js`：并行读取分支比较的独立信息，并让后续比较命令使用固定提交 SHA。
- `tests/repository-history-performance.test.js`：新增受控 Promise 回归，固定并发开始顺序和提交快照范围。
- `README.md`：说明分支比较的等待优化、快照一致性和真实接口指标。
- `docs/ARCHITECTURE.md`：记录 `/api/compare` 的并行读取与固定 SHA 边界。
- `docs/CONTINUE.md`：更新当前分支比较实现、性能基线和完整回归数量。
- `progress.md`：追加本轮诊断、实现、验证、文件清单和局部回滚边界。
- 本轮没有启动真实 Electron，没有修改 `D:/桌面/GitTest`，没有处理鼠标指针问题，也没有提交或推送。
- 回滚点为本轮开始前已完成文件编辑器依赖并行载入的共享未提交工作区；提交前只应恢复 `readCompare` 原有串行等待和引用名范围、移除 `repository-history-performance.test.js` 及本轮四份文档增量，不得对共享脏文件执行整文件 `git restore`。提交后应对包含本记录的提交执行 `git revert <commit>`。

## 2026-08-12 - Task: 复用逐行追踪的文件存在性检查

### What was done

- 拆分“文件历史 / 逐行追踪”的真实接口耗时，确认文件历史为 `80.0-86.0 ms`，逐行追踪为 `113.2-116.8 ms`；正常文件路径中存在两次完全相同的 `cat-file -e ref:file`。
- 文件路径解析现在同时返回目标文件是否已经存在于指定引用；逐行追踪直接复用该结果，只在未找到时继续检查父提交。
- 保留工作区重命名旧路径解析、父提交回溯、无提交分支中文提示、逐行内容上限和 API 返回结构，不改变文件历史行为。

### Testing

- 新回归在旧实现稳定为 `1/2`，失败为存在性检查 `2 !== 1`；实现后 `tests/repository-history-performance.test.js` 为 `2/2` 通过，并确认正常文件不触发工作区状态读取。
- 在获准的只读环境对 `D:/桌面/GitTest` 连续复测：文件历史保持 `79.0-83.3 ms`，逐行追踪降到 `79.1-82.7 ms`，相对修改前降低约 `28%-32%`；每次均返回相同的 9 行归属结果，测试前后未写入仓库。
- `npm.cmd run test:browser` 为 `1/1` 通过；“文件历史 + 逐行追踪”首次资源、两次 API 和渲染合计约 `174.6 ms`，修改前完整回归约 `206.9 ms`。完整套件中的同项为 `179.4 ms`。
- `node --test --test-concurrency=1 tests/repository-history-performance.test.js tests/git-api.test.js` 为 `32/32` 通过，覆盖正常引用、无提交分支提示、离线远端引用和完整 Git 工作流。
- `npm.cmd test` 为 `303/303` 通过，总耗时约 `127.4` 秒；真实 Chromium、Electron、布局、编辑器、Git 操作、4000 文件工作区和安全边界继续通过。
- `node --check` 覆盖 `server/repository-history.js` 和 `tests/repository-history-performance.test.js`；`git diff --check` 无空白错误，仅有仓库既有 LF/CRLF 提示。临时测量脚本已删除，属于本仓库的 `server.js` Node 进程为 0，`5177`、`5287`、`5288`、`5290`、`5292`、`5294`、`5295` 均无监听。

### Notes

- `server/repository-history.js`：让文件路径解析携带引用存在性结果，逐行追踪复用后再决定是否检查父提交。
- `tests/repository-history-performance.test.js`：增加正常文件只执行一次存在性检查的确定性回归。
- `README.md`：说明逐行追踪的重复 Git 读取优化和真实接口指标。
- `docs/ARCHITECTURE.md`：记录文件路径解析与逐行追踪之间的存在性复用边界。
- `docs/CONTINUE.md`：更新逐行追踪、文件追踪面板性能和完整回归数量。
- `progress.md`：追加本轮诊断、实现、验证、文件清单和局部回滚边界。
- 本轮没有启动真实 Electron，没有修改 `D:/桌面/GitTest`，没有处理鼠标指针问题，也没有提交或推送。
- 回滚点为本轮开始前已完成分支比较并行读取的共享未提交工作区；提交前只应移除路径解析结果中的 `existsAtRef`、恢复逐行追踪的第二次存在性检查、移除对应测试及本轮四份文档增量，不得对共享脏文件执行整文件 `git restore`。提交后应对包含本记录的提交执行 `git revert <commit>`。

## 2026-08-12 - Task: 合并分支比较快照并同轮读取结果

### What was done

- 继续拆解分支比较等待链：上一轮仍依次经历当前分支状态、两侧引用解析、共同祖先/计数、日志/Diff 四轮 Git 等待。
- 有效引用现在用一次 `rev-parse` 快照展开取得基准 SHA、目标 SHA 和共同祖先；左右计数、两侧最多 40 条日志、文件列表和完整 Diff 随后同轮启动，所有范围继续固定使用解析后的 SHA。
- 快照展开失败时回退到原有逐项引用校验并保留“比较基准 / 比较目标”中文提示；没有共同祖先时继续使用双点 Diff，不改变返回结构、提交上限或界面行为。

### Testing

- 新并发和回退回归在旧实现为 `1/3`，分别因结果读取仍等待计数、未先尝试快照展开而失败；实现后加上无共同祖先覆盖，`tests/repository-history-performance.test.js` 为 `4/4` 通过。
- 在获准的只读环境对 `D:/桌面/GitTest` 连续 6 次复测，`main` 对 `local_debug` 均返回基准独有 9 个提交、相同两侧 SHA、共同祖先和空文件差异；接口由上一版 `160.3-168.8 ms` 降到 `125.9-135.2 ms`，相对最初约 `249.1 ms` 总体降低约 `46%-49%`。不存在的目标仍返回 HTTP 400 和原中文提示，测试前后未写入仓库。
- `npm.cmd run test:browser` 为 `1/1` 通过；比较页首次 API、按需资源和渲染合计约 `153.7 ms`，完整套件中为 `164.7 ms`，上一轮为 `189.4-208.4 ms`。
- `node --test --test-concurrency=1 tests/repository-history-performance.test.js tests/git-api.test.js` 为 `34/34` 通过，覆盖远端引用、完整 Git 工作流、有效快路径、无效引用回退和无共同祖先范围。
- `npm.cmd test` 为 `305/305` 通过，总耗时约 `127.1` 秒；真实 Chromium、Electron、布局、编辑器、Git 操作、4000 文件工作区和安全边界继续通过。
- `node --check` 覆盖 `server/repository-history.js` 和 `tests/repository-history-performance.test.js`；`git diff --check` 无空白错误，仅有仓库既有 LF/CRLF 提示。临时测量脚本已删除，属于本仓库的 `server.js` Node 进程为 0，`5177`、`5287`、`5288`、`5290`、`5292`、`5294`、`5295`、`5296` 均无监听。

### Notes

- `server/repository-history.js`：增加分支比较单次快照展开、带标签回退和结果命令同轮读取。
- `tests/repository-history-performance.test.js`：固定快照命令、并发波次、无效引用回退和无共同祖先双点范围。
- `README.md`：更新分支比较快路径、错误回退和累计真实性能指标。
- `docs/ARCHITECTURE.md`：记录 `/api/compare` 的快照展开、固定 SHA、并发结果读取和回退边界。
- `docs/CONTINUE.md`：更新分支比较当前实现、性能基线和完整回归数量。
- `progress.md`：追加本轮诊断、实现、验证、文件清单和局部回滚边界。
- 本轮没有启动真实 Electron，没有修改 `D:/桌面/GitTest`，没有处理鼠标指针问题，也没有提交或推送。
- 回滚点为本轮开始前已完成逐行追踪存在性复用的共享未提交工作区；提交前只应恢复分支比较的两次独立 `rev-parse`、单独 `merge-base`、计数后再启动日志/Diff 的顺序，移除对应两条测试和本轮四份文档增量，不得对共享脏文件执行整文件 `git restore`。提交后应对包含本记录的提交执行 `git revert <commit>`。

## 2026-08-12 - Task: 复用历史文件父提交并验证真实双击首开

### What was done

- 提交详情和基础提交读取现在把第一父提交写入按仓库隔离的 512 项 LRU；历史文件读取优先复用，首次未命中仍执行一次 `rev-list --parents` 并回填，根提交空父值同样可复用。
- 真实 Chromium 性能场景改为先选中提交、进入右侧“文件”页，再对 `complex.c` 文件行触发实际 `dblclick` 委托，覆盖用户真实入口而不是直接调用编辑器函数。
- 分段记录编辑器资源、提交文件 API 和双栏构建耗时。当前 60000 行历史文件首开已稳定约 `187-190 ms`，因此没有引入约 887 KiB 的 CodeMirror 生成 bundle；其最多影响约 50 ms 资源阶段，却会增加生成文件和校验维护成本。

### Testing

- `node --test --test-concurrency=1 tests/file-editor-performance.test.js tests/repository-history-performance.test.js` 为 `7/7` 通过，覆盖缓存命中、首次未命中、回填复用、提交详情预热、分支比较和逐行追踪边界。
- 独立 `npm.cmd run test:browser` 为 `1/1` 通过；真实列表双击复杂文件约 `187.4 ms`，提交文件 API `49.3 ms`，资源 `49.1 ms / 36` 请求，估算双栏构建 `89.0 ms`，最大事件循环延迟 `42.6 ms`。
- `npm.cmd test` 为 `308/308` 通过，总耗时约 `126.4` 秒；完整回归中的复杂文件首开约 `190.2 ms`，提交文件 API `52.5 ms`，最大事件循环延迟 `49.3 ms`，3012 条历史、4000 文件工作区、冲突编辑器、30 次编辑器开关、DOM、监听器和堆边界继续通过。
- `node --check` 覆盖 `server.js`、两个历史文件服务和三份相关测试；`git diff --check` 无空白错误，仅有仓库既有 LF/CRLF 提示。
- `%TEMP%` 中 `forkline-browser-performance-*` 临时目录、本仓库 Node 测试进程以及 `5177`、`5287`、`5288`、`5290`、`5292`、`5294`、`5295`、`5296` 监听均为 0。

### Notes

- `server/repository-history.js`：增加按仓库和提交 SHA 隔离的第一父提交 LRU，并在提交详情和基础提交读取后填充。
- `server/file-editor-service.js`：历史文件读取优先使用父提交缓存，未命中时保留原 Git 解析和回填路径。
- `server.js`：把仓库历史服务的父提交缓存延迟接入文件编辑服务，保持现有服务初始化顺序。
- `tests/repository-history-performance.test.js`：固定提交详情读取会记住第一父提交。
- `tests/file-editor-performance.test.js`：覆盖缓存命中跳过 Git，以及首次未命中只解析和回填一次。
- `tests/browser-performance.test.js`：通过右侧提交文件树真实双击入口测量复杂历史文件首开，并输出资源、API 和构建分段。
- `README.md`：说明右侧文件页与历史文件双击之间的父提交复用和真实性能结果。
- `docs/ARCHITECTURE.md`：记录 512 项缓存键、根提交空值、未命中回退和文件内容读取边界。
- `docs/CONTINUE.md`：追加实现、真实性能、完整回归、资源合并取舍和环境清理证据。
- `progress.md`：追加本轮实现、验证、文件清单和局部回滚边界。
- 本轮没有启动真实 Electron，没有修改 `D:/桌面/GitTest`，鼠标指针问题按用户要求不处理，也没有提交或推送。
- 回滚点为本轮开始前已完成分支比较快照合并的共享未提交工作区；提交前只应移除第一父提交缓存与三处接线、两条缓存回归、真实双击性能增量及本轮文档内容，不得对共享脏文件执行整文件 `git restore`。提交后应对包含本记录的提交执行 `git revert <commit>`。

## 2026-08-12 - Task: 避免渐进切仓重复读取核心状态

### What was done

- 为渐进打开增加专用补充接口，只读取首屏缺失的完整分支元数据、Tag、worktree 占用和工作区快照，不再重复当前分支、HEAD、远端、同步和提交历史。
- 前端把补充结果合并到已经显示的渐进首屏，保留用户当前查看引用、提交选择和历史分页，并清除延迟页签的空占位，保证对应页签仍按需读取。
- 保留 `/api/state?details=core` 的冷启动兼容用途，以及切仓写操作阻止、仓库上下文校验、旧响应丢弃和错误提示边界。

### Testing

- 新增的服务单元、真实 Git API 和前端状态专项为 `3/3` 通过；旧实现分别稳定失败于缺少方法、接口 `404` 和旧核心状态请求。
- 独立真实 Chromium `1/1` 通过：12 次切仓从修改前约 `5152.1 ms` 降到 `4683.2 ms`，补充阶段中位从约 `320.5 ms` 降到 `288.4 ms`。
- 完整 `npm.cmd test` 为 `309/309` 通过，总耗时约 `125.4` 秒；完整回归中的 12 次切仓为 `4706.2 ms`，补充接口中位 `283.4 ms`，渐进首屏/完整补齐约 `153.9/498.0 ms`。
- 相关脚本通过 `node --check`，`git diff --check` 无空白错误，仅保留仓库既有 LF/CRLF 提示。测试后相关临时目录、本仓库 Node 进程以及 `5177`、`5287`、`5288`、`5290`、`5292`、`5294`、`5295`、`5296` 监听均为 0。

### Notes

- `server/repository-state-service.js`：新增只补渐进首屏缺失数据的 `readOpenDetails()`。
- `server/repository-service.js`：导出仓库打开补充读取能力。
- `server.js`：接入带仓库上下文校验的 `GET /api/open-details`。
- `public/js/features/repositories.js`：改用补充接口并合并渐进首屏状态。
- `public/js/app/init.js`：同步新的补充加载函数参数。
- `tests/backend-services.test.js`：固定补充读取只执行五类必要 Git 命令。
- `tests/git-api.test.js`：覆盖补充接口返回范围和延迟字段边界。
- `tests/layout-ui.test.js`：验证首屏数据、当前引用和历史在补充阶段保持不变。
- `tests/browser-performance.test.js`：记录补充接口分段耗时并禁止切仓回退到完整核心状态。
- `README.md`：说明渐进打开不再重复读取首屏数据。
- `docs/ARCHITECTURE.md`：记录两个状态接口的职责和前端合并边界。
- `docs/CONTINUE.md`：追加实现、性能、回归和环境清理证据。
- `progress.md`：追加本轮闭环记录。
- 本轮没有启动真实 Electron，没有修改 `D:/桌面/GitTest`，没有处理鼠标指针问题，也没有提交或推送。
- 回滚点为本轮开始前已完成历史文件父提交缓存的共享未提交工作区；提交前只应移除 `readOpenDetails()`、路由/导出/前端接线、四份对应测试增量和本轮文档增量，不得对共享脏文件执行整文件 `git restore`。提交后应对包含本记录的提交执行 `git revert <commit>`。

## 2026-08-12 - Task: 复用最近仓库的工作区快照

### What was done

- 取消切到不同仓库时对绝对路径文件哈希 LRU 的无差别清空；缓存仍由 8192 项上限约束，命中时继续核对文件元数据。
- 把单一 worktree watcher/read cache 改为按仓库路径隔离的两项 LRU；切回最近仓库可复用，后台文件事件仍会让对应仓库增量刷新，第三个仓库进入时关闭最久未用 watcher，仓库上下文清空时关闭全部。
- 渐进补充接口改用 watcher 支持的工作区读取缓存；只读状态命令统一设置 `GIT_OPTIONAL_LOCKS=0`，避免 Git 自己刷新索引触发强制全扫。Git 写操作仍走原有新鲜强快照校验。

### Testing

- 新红测在旧实现分别稳定失败为文件哈希 LRU 被清空、切回仓库重复计算 `2 !== 1`，以及补充接口缺少 `GIT_OPTIONAL_LOCKS=0`；实现后缓存、后台事件、两项淘汰和全部关闭边界通过。
- 工作区/后端/真实 Git 专项 `56/56` 通过；覆盖普通暂存/提交/丢弃、stash、冲突、同步和写前安全快照，没有用读取缓存替代写操作复核。
- 独立真实 Chromium `1/1` 通过：渐进补齐约 `316.4 ms`，12 次切仓 `3613.3 ms`，补充阶段中位 `88.7 ms`。
- 完整 `npm.cmd test` 为 `311/311` 通过，总耗时约 `124.8` 秒；完整 Chromium 对应为 `324.8 ms / 3636.6 ms / 89.4 ms`，补充阶段相对上一轮约降低 `68%`。
- 真实浏览器回归新增补充阶段中位 `< 200 ms` 门限。测试后相关临时目录、本仓库 Node 进程以及 `5177`、`5287`、`5288`、`5290`、`5292`、`5294`、`5295`、`5296` 监听均为 0。

### Notes

- `server/repository-service.js`：切仓不再清空绝对路径文件哈希 LRU。
- `server/repository-worktree-service.js`：增加两仓库 watcher/read cache LRU、后台事件隔离、淘汰关闭和缓存读取路径。
- `server/repository-state-service.js`：渐进补充接口使用工作区读取缓存，只读状态命令禁止可选索引写入。
- `tests/backend-services.test.js`：固定文件哈希 LRU、缓存读取入口和只读 status 环境边界。
- `tests/worktree-refresh.test.js`：覆盖切回复用、后台事件失效、第三仓库淘汰和全部关闭。
- `tests/browser-performance.test.js`：为切仓补充阶段增加真实性能门限。
- `README.md`：说明最近仓库工作区快照复用及失效条件。
- `docs/ARCHITECTURE.md`：记录两项 LRU、watcher 生命周期、可选锁和写前安全边界。
- `docs/CONTINUE.md`：追加诊断、实现、性能、回归和环境清理证据。
- `progress.md`：追加本轮闭环记录。
- 本轮没有启动真实 Electron，没有修改 `D:/桌面/GitTest`，没有处理鼠标指针问题，也没有提交或推送。
- 回滚点为本轮开始前已完成渐进打开补充接口的共享未提交工作区；提交前只应恢复切仓清空、单 watcher/read cache 和普通只读 status 选项，移除三条缓存回归、浏览器门限及本轮文档增量，不得对共享脏文件执行整文件 `git restore`。提交后应对包含本记录的提交执行 `git revert <commit>`。

## 2026-08-12 - Task: 减少仓库打开和提交详情的 Git 进程波次

### What was done

- 当前分支优先从 worktree 的 `.git/HEAD` 读取，异常结构保留原 Git 回退；渐进打开复用已取得的分支，避免同步状态再次查询。
- 同步状态复用 tracking 中的 upstream、ahead、behind、gone 和 remote-tracking SHA；完整快照存在时不再重复执行 upstream 解析或领先/落后统计。
- 提交详情把元数据、正文、父提交合并为一次读取，并与第一父提交文件清单、可选 Diff 同轮启动；合并提交和历史文件父提交缓存语义保持不变。
- 为仓库打开、提交详情和补充接口增加真实性能门限，并同步更新使用与架构文档。

### Testing

- 新红测在旧实现稳定失败为 HEAD 文件未使用、渐进打开分支读取 `2 !== 1`、tracking 数量未复用，以及提交文件/Diff 未在元数据等待期间启动；实现后全部通过。
- 后端/工作区/提交详情专项 `34/34` 通过；真实 Git 的渐进打开、同步状态、提交文件和合并历史流程 `4/4` 通过。
- 两次独立真实 Chromium `1/1` 均通过：第一轮 `3209.7 ms / 140.8 ms / 64.6 ms`，最终轮 12 次切仓约 `2783.0 ms`、`/api/open` 中位 `105.9 ms`、提交详情中位 `65.0 ms`。完整套件内对应为 `2830.3 / 107.4 / 64.4 ms`。
- 完整 `npm.cmd test` 为 `314/314` 通过，总耗时约 `119.8` 秒；性能门限为 `/api/open < 140 ms`、`/api/open-details < 200 ms`、`/api/commit < 100 ms`。

### Notes

- `server/repository-service.js`：增加 `.git/HEAD` 当前分支快速路径和原 Git 回退。
- `server/repository-state-service.js`：渐进打开复用分支，并向同步详情传递 tracking 与远端 SHA 快照。
- `server/repository-worktree-service.js`：完整同步快照存在时跳过重复 upstream 和领先/落后 Git 读取。
- `server/repository-history.js`：提交元数据、文件清单和可选 Diff 改为同轮读取。
- `tests/backend-services.test.js`：覆盖 HEAD 快速路径、渐进分支复用和同步快照传递。
- `tests/worktree-refresh.test.js`：覆盖完整 tracking 快照不再启动额外 Git 命令。
- `tests/repository-history-performance.test.js`：覆盖提交详情三路读取并发与父提交缓存。
- `tests/git-api.test.js`：覆盖真实合并提交仍按第一父提交返回文件与 Diff。
- `tests/browser-performance.test.js`：固定打开仓库、补充接口和提交详情中位性能门限。
- `README.md`：补充仓库首屏和提交详情的快照复用及当前性能数据。
- `docs/ARCHITECTURE.md`：记录 HEAD、tracking、远端 SHA 和提交详情并发契约。
- `docs/CONTINUE.md`：追加诊断、实现、性能和完整回归证据。
- `progress.md`：仅在末尾追加本轮闭环记录。
- 本轮没有启动真实 Electron，没有修改 `D:/桌面/GitTest`，鼠标指针问题按用户要求不处理，也没有提交或推送。
- 回滚点为上一节“复用最近仓库的工作区快照”完成后的共享未提交工作区；提交前只应移除本节列出的快速路径、快照字段、并发提交读取、对应红测/门限和文档增量，不得对共享脏文件执行整文件 `git restore`。提交后应对包含本记录的提交执行 `git revert <commit>`。
- 最终检查中相关 Node/Chromium 进程、三类性能临时目录和 `5177`、`5287`、`5288`、`5290`、`5292`、`5294`、`5295`、`5296` 监听均为 0；临时性能分析脚本已删除。

## 2026-08-12 - Task: 合并仓库引用快照并减少状态读取 Git 进程

### What was done

- 渐进首屏和默认完整状态使用一次保留 `branch.sort` 的 `git branch --all` 格式化快照，同时取得本地/远端分支、tracking、提交元数据和远端 SHA，不再为同一批引用重复启动独立 Git 命令。
- 渐进补充接口把 tracking、分支元数据和 Tag 合为一次引用查询，并让工作区快照在 `git status` 返回后立即开始；原有 API 字段、分支/Tag/Git 安全语义保持不变。
- 收紧真实 Chromium 中仓库打开与补充接口性能门限，并更新使用说明、架构约束和续开发记录。

### Testing

- 红测先分别确认补充接口仍有 3 次 `for-each-ref`、渐进首屏和核心状态仍有重复分支引用命令；实现后 `tests/backend-services.test.js` 为 `12/12` 通过。
- 真实 Git 的渐进打开专项和优化状态专项分别为 `1/1` 通过；本轮未修改 `D:/桌面/GitTest`。
- 独立波次测量：补充接口旧五进程中位 `65.7 ms`、新三进程 `54.1 ms`；完整状态旧四引用进程中位 `56.5 ms`、新单引用进程 `45.5 ms`。临时测量脚本运行后已删除。
- 两轮独立 `npm.cmd run test:browser` 均为 `1/1` 通过；最终 12 次切仓约 `2603.6 ms`，`/api/open` 中位 `99.2 ms`、`/api/open-details` 中位 `80.3 ms`、`/api/commit` 中位 `55.7 ms`，4000 文件渐进首屏/完整补齐约 `114.7/247.3 ms`。
- 最终完整 `npm.cmd test` 为 `314/314` 通过，耗时约 `118.1` 秒；完整 Chromium 中 12 次切仓约 `2596.4 ms`，`/api/open` 中位 `100.1 ms`、`/api/open-details` 中位 `80.8 ms`、`/api/commit` 中位 `55.1 ms`，收紧后的 `<130/<150/<100 ms` 门限全部通过。4000 文件渐进首屏/完整补齐约 `113.5/255.5 ms`，30 次编辑器开关后的 DOM、监听器和堆边界继续稳定。
- `node --check` 覆盖服务实现和两份相关测试；`git diff --check` 无空白错误，仅保留仓库既有 LF/CRLF 提示。
- 最终检查中 `forkline-browser-performance-*`、`forkline-open-dir-*`、`forkline-cold-hash-*` 临时目录均为 0，没有指向本仓库或浏览器性能夹具的 Node/Chromium 进程；`5177`、`5287`、`5288`、`5290`、`5292`、`5294`、`5295`、`5296` 均无监听，临时性能脚本为 0。

### Notes

- `server/repository-state-service.js`：增加统一引用快照格式与拆分逻辑，并接入渐进首屏、补充详情和默认状态。
- `tests/backend-services.test.js`：固定单引用查询、分支排序入口、tracking、远端 SHA、Tag 和核心状态边界。
- `tests/browser-performance.test.js`：收紧 `/api/open` 与 `/api/open-details` 中位耗时门限。
- `README.md`：更新引用快照复用和当前真实 Chromium 指标。
- `docs/ARCHITECTURE.md`：记录统一引用快照、并行工作区读取和不可退化的 Git 语义。
- `docs/CONTINUE.md`：追加诊断、实现、性能和验证证据。
- `progress.md`：仅在末尾追加本轮闭环记录。
- 本轮未启动真实 Electron，未处理鼠标指针问题，未提交或推送。
- 回滚点为上一节“减少仓库打开和提交详情的 Git 进程波次”完成后的共享未提交工作区；提交前只应移除本节列出的统一引用快照、三条红测/门限和文档增量，不得对共享脏文件执行整文件 `git restore`。提交后应对包含本记录的提交执行 `git revert <commit>`。

## 2026-08-12 - Task: 缩短 Git 操作完成后的仓库状态回填

### What was done

- 常用 Git 操作结束后统一读取轻量核心仓库状态，不再等待分支整理、工作树、子模块、储藏和恢复点等延迟区块；图谱、同步摘要、Tag、工作区和未完成操作状态仍会立即更新。
- 核心状态响应确认仍属于原仓库后，使旧详情请求失效并清空详情加载缓存；切仓期间返回的旧响应不会影响新仓库，当前打开的延迟页签会按需重新读取。
- 提交/同步、冲突继续或中止、远端管理三条常用动作改为复用统一回填入口；工作区专用刷新和动作直接返回的状态保持原路径。

### Testing

- 新增专项回归在旧实现稳定失败为 `2/3`，修复后 `tests/action-state-refresh.test.js` 为 `3/3` 通过；覆盖 `details=core` URL、详情请求失效、切仓隔离和三条常用动作不再直读完整状态。
- `node --check` 覆盖 `public/js/core.js`、`public/js/features/git-actions.js` 和浏览器性能测试；相邻动作、仓库上下文和工作区回归 `26/26` 通过。
- 独立真实 Chromium `1/1` 通过，只观察到 `/api/state?ref=main&details=core`，状态回填约 `57.3 ms`；复杂文件、冲突编辑器、3012 条历史、4000 文件和 30 次编辑器开关边界继续通过。
- 完整 `npm.cmd test` 为 `317/317` 通过，耗时约 `105.6` 秒；完整 Chromium 中状态回填约 `58.9 ms`，首屏资源保持 `30` 个、`411,226` 字节。

### Notes

- `public/js/core.js`：统一动作状态入口改为核心状态请求，并使原仓库的旧详情请求失效。
- `public/js/features/git-actions.js`：提交/同步、仓库未完成操作和远端管理复用统一状态入口。
- `tests/action-state-refresh.test.js`：新增动作回填、详情缓存失效和切仓隔离专项。
- `tests/browser-performance.test.js`：在真实 Chromium 中固定核心状态请求 URL、缓存失效和实际耗时。
- `README.md`：补充操作完成后轻量回填的用户可感知行为。
- `docs/ARCHITECTURE.md`：记录统一入口、详情请求失效和不可退化的专用刷新契约。
- `docs/CONTINUE.md`：追加诊断、实现、性能和完整回归基线。
- `progress.md`：仅在末尾追加本轮闭环记录。
- 本轮未启动真实 Electron，未修改 `D:/桌面/GitTest`，未处理鼠标指针问题，也未提交或推送。
- 回滚点为上一节“合并仓库引用快照并减少状态读取 Git 进程”完成后的共享未提交工作区；提交前只应移除本节列出的轻量动作回填、专项/浏览器断言和文档增量，不得对共享脏文件执行整文件 `git restore`。提交后应对包含本记录的提交执行 `git revert <commit>`。
- 最终清理确认 `forkline-browser-performance-*` 临时目录为 0、Node 监听服务为 0，`5177`、`5287`、`5288`、`5290`、`5292`、`5294`、`5295`、`5296` 均无监听。

## 2026-08-12 - Task: 使用页面品牌标识作为 Forkline 桌面图标

### What was done

- 按页面左上角现有品牌标识制作可维护的 SVG、高清透明 PNG 和 Windows 多尺寸 ICO，保留青绿到珊瑚色渐变、两枚节点和斜向分支线。
- Electron 窗口、任务栏和桌面快捷方式统一使用 Forkline 品牌图标，不再显示 Electron 默认图标。

### Testing

- `electron/assets/forkline-icon.png` 验证为 `512x512`、32 位透明 PNG，角落透明、主体不透明；人工检查渐变、节点、连线和小尺寸识别度正常。
- `electron/assets/forkline-icon.ico` 验证为标准 ICO，包含 `16/20/24/32/40/48/64/128/256` 九档尺寸。
- `node --test tests/electron-shell.test.js` 为 `30/30` 通过，覆盖图标文件结构、尺寸列表和 Electron 窗口引用。本轮没有启动真实 Electron，也没有修改 `D:/桌面/GitTest`。
- 完整 `npm.cmd test` 为 `318/318` 通过，耗时约 `107.5` 秒；真实 Chromium、Git 操作、Electron 外壳、文件编辑器、布局和性能边界全部通过。
- 最终检查中相关 Node/Chromium 进程、性能临时目录以及 `5177`、`5287`、`5288`、`5290`、`5292`、`5294`、`5295`、`5296` 监听均为 0。

### Notes

- `electron/assets/forkline-icon.svg`：页面品牌标识的可维护矢量源图。
- `electron/assets/forkline-icon.png`：Electron 非 Windows 窗口和高清预览图标。
- `electron/assets/forkline-icon.ico`：Windows 窗口、任务栏、快捷方式和后续安装包图标。
- `electron/main.js`：为 `BrowserWindow` 指定平台对应的 Forkline 图标。
- `tests/electron-shell.test.js`：固定图标资源结构、多尺寸 ICO 和窗口引用契约。
- `docs/ELECTRON_DESKTOP.md`：补充桌面图标用途和手工快捷方式配置说明。
- `docs/CONTINUE.md`：追加图标实现与验证基线。
- `progress.md`：仅在末尾追加本轮闭环记录。
- 回滚时只移除上述三份图标资源、`electron/main.js` 的图标路径与窗口配置、对应测试和本轮文档增量；不得对共享脏文件执行整文件 `git restore`。提交后应对包含本记录的提交执行 `git revert <commit>`。

## 2026-08-12 - Task: 将 Forkline 图标升级为三节点分叉

### What was done

- 把原有两节点连线改为三节点 Git 分叉，使用左侧纵向主线和右上曲线支线增强产品辨识度，保留既有渐变、圆角底板和主题适配。
- 页面左上角、Electron 窗口、任务栏和桌面快捷方式继续共用同一品牌结构；重新生成高清 PNG 和九档 Windows ICO。

### Testing

- 新契约在旧实现稳定失败为 SVG 节点数量 `2 !== 3`；实现后验证 SVG 包含三枚节点、两条线，页面 CSS 包含一条分叉轮廓和三枚径向节点。
- `16/32/64px` ICO 帧放大检查均能辨认主线、支线和三枚节点；高清 PNG 验证为 `512x512`、32 位透明图。
- 真实 Chromium 中页面标识为 `30x30`，三节点渐变和 `clip-path` 分叉均实际生效；截图确认顶部栏没有尺寸或排版变化。
- `node --test tests/electron-shell.test.js tests/design-system.test.js tests/layout-ui.test.js` 为 `83/83` 通过。临时浏览器页和 `5298` 服务已关闭，未启动真实 Electron，未修改 `D:/桌面/GitTest`。
- 完整 `npm.cmd test` 为 `318/318` 通过，耗时约 `108.3` 秒；真实 Chromium、Git 操作、Electron 外壳、文件编辑器、布局和性能边界全部通过。
- 最终检查中相关 Node/Chromium 进程、性能临时目录和常用测试端口均为 0；小尺寸预览临时文件已删除。

### Notes

- `public/styles.css`：把页面品牌标识改为三节点分叉结构。
- `electron/assets/forkline-icon.svg`：更新可维护矢量源图。
- `electron/assets/forkline-icon.png`：重新生成三节点高清透明图标。
- `electron/assets/forkline-icon.ico`：重新生成九档 Windows 图标。
- `tests/electron-shell.test.js`：固定三节点、两条线、页面分叉轮廓和三枚节点契约。
- `docs/ELECTRON_DESKTOP.md`：说明新图标的主线与支线语义。
- `docs/CONTINUE.md`：追加设计、渲染和专项验证基线。
- `progress.md`：仅在末尾追加本轮闭环记录。
- 回滚时只恢复上述品牌图形、三份生成资源、对应契约和本轮文档增量；不得对共享脏文件执行整文件 `git restore`。提交后应对包含本记录的提交执行 `git revert <commit>`。

## 2026-08-12 - Task: 修复带远端仓库在请求失败后无法打开

### What was done

- 仓库打开接口遇到一次浏览器级瞬时网络错误时自动重试；原始 `Failed to fetch` 统一转换为明确的中文“无法连接 Forkline 本地服务”。
- 渐进打开的详情请求失败后自动回退到当前引用的本地核心 Git 状态，成功时正常结束载入并保留中文降级提示；回退也失败时仍保留提交历史，只继续保护依赖可靠工作区快照的写操作。
- Electron 通过启动参数预加载仓库失败时不再终止整个应用，而是照常打开窗口并把仓库路径交给页面重试。打开与降级过程不执行隐式 `git fetch`。

### Testing

- 新增前端红测在旧实现稳定失败：详情请求抛出 `Failed to fetch` 后没有本地回退，`state.repoHydrating` 永久保持为真；修复后正常渐进打开、本地回退和双重失败保护 `3/3` 通过。
- API/Electron 专项验证 `6/6` 通过，覆盖网络错误中文化、`/api/open` 单次重试、详情回退、历史保留和 Electron 启动降级。
- 真实 Git 临时仓库删除本地裸远端后，渐进打开、`/api/open-details`、本地核心状态、`origin/feature` 提交历史、文件历史、逐行追踪和分支比较全部通过；未使用或修改 `D:/桌面/GitTest`。
- 完整 `npm.cmd test` 为 `322/322` 通过，耗时约 `110.8` 秒；真实 Chromium、Electron 外壳、Git 操作、离线远端、布局与性能边界全部通过。相关 JavaScript `node --check` 和本轮文件 `git diff --check` 通过，仅有仓库既有的 LF/CRLF 提示。

### Notes

- `public/js/api.js`：中文化浏览器网络错误，并只对幂等的仓库打开入口自动重试一次。
- `public/js/features/repositories.js`：增加详情失败后的本地核心状态回退、降级提示和双重失败保护。
- `electron/main.js`：启动仓库预加载失败时保留应用窗口并交给页面重试。
- `public/js/i18n-catalog.js`：补充本地服务和仓库降级提示的英文词条。
- `tests/api-repo-context.test.js`：固定网络错误中文化和仓库打开单次重试。
- `tests/layout-ui.test.js`：固定正常渐进打开、详情失败回退和双重失败时历史可浏览。
- `tests/electron-shell.test.js`：固定 Electron 启动预加载失败的非致命处理。
- `tests/git-api.test.js`：扩展远端离线真实仓库的渐进打开和本地详情读取验证。
- `README.md`、`docs/ARCHITECTURE.md`、`docs/CONTINUE.md`、`docs/ELECTRON_DESKTOP.md`：记录用户行为、状态契约、继续开发基线和桌面启动边界。
- `progress.md`：仅在末尾追加本轮闭环记录。
- 本轮未提交、未推送，也未修改共享工作区中的其他任务内容。
- 回滚时只逆向移除上述打开重试、本地回退、Electron 非致命预加载、对应测试和本轮文档增量；共享工作区已有大量未提交修改，不得对这些文件执行整文件 `git restore`。提交后应对包含本记录的提交执行 `git revert <commit>`。

## 2026-08-12 - Task: 准备 Forkline v0.4.0 发布

### What was done

- 将正式版本更新为 `0.4.0`，收口 Electron 源码桌面能力、Web 性能优化、远端离线打开降级和标题栏皮肤联动。
- Windows 原生标题栏通过受限 IPC 使用当前皮肤的顶部背景色和文字色，最小化、最大化、关闭按钮在切换皮肤及启动恢复皮肤时同步变化；浏览器版不受影响。
- 更新 README、Electron 桌面说明、便携包说明和继续开发记录，明确本次自动发布 Web 便携 ZIP，Electron 安装包仍不在发布范围。

### Testing

- 标题栏联动先以失败测试复现，修复后主题与 Electron 专项 `35/35` 通过。
- `node --check` 覆盖主题脚本、Electron 主进程和 preload；本轮相关文件 `git diff --check` 通过，仅保留仓库既有 LF/CRLF 提示。
- 完整 `npm.cmd test` 为 `324/324` 通过，0 项失败、0 项跳过，总耗时约 `112.8` 秒。
- 真实 Electron 在 `D:/桌面/GitTest` 中启动成功；从深色切换浅色后，页面和 Windows 原生标题栏按钮区域实际同步换色。验收服务和窗口随后关闭，未修改测试仓库内容。

### Notes

- `package.json`、`package-lock.json`：版本更新为 `0.4.0`，保留 Electron 依赖与入口。
- `public/js/app/layout-utils.js`：应用皮肤后同步桌面标题栏颜色。
- `electron/preload.js`、`electron/main.js`：增加受限标题栏主题 IPC、颜色校验和 Windows 原生覆盖更新。
- `tests/themes.test.js`、`tests/electron-shell.test.js`：覆盖六套皮肤、浏览器无桌面接口、IPC 与原生标题栏调用。
- `README.md`、`docs/ELECTRON_DESKTOP.md`、`docs/PACKAGING.md`、`docs/CONTINUE.md`：记录发布范围、桌面标题栏行为和附件边界。
- `progress.md`：仅在末尾追加本轮发布准备记录。
- 异常未跟踪文件 `n+fs.statSync(p.join('public'` 不属于项目，不纳入提交或 Release。
- 回滚点为 `v0.3.1` 后当前共享未提交工作区；发布提交后应执行 `git revert <release-commit>` 形成新修复版本，不得移动已经发布的 `v0.4.0` 标签。

## 2026-08-12 - Task: 正式发布 Forkline v0.4.0

### What was done

- 将发布准备提交 `ba897f0d67a53b7c67437a4ae195c1447e211d53` 推送到 `origin/main`，创建并推送不可移动的注释标签 `v0.4.0`。
- 创建 GitHub 正式 Release `Forkline v0.4.0` 并设为 Latest，发布说明覆盖 Electron 源码桌面版、性能优化、远端离线打开和更新监督边界。
- 等待 Windows 便携包自动工作流完成，确认 ZIP 与 SHA256 两个附件均已上传；重新下载附件并核对实际哈希。

### Testing

- 发布前完整自动回归为 `324/324` 通过；Electron、主题与便携专项为 `37/37` 通过，JavaScript 语法和 Git 差异检查通过。
- GitHub Actions `31575254040` 成功完成，`windows-portable` 作业耗时约 `47` 秒，构建、工作流附件和 Release 附件步骤全部通过。
- Release 状态确认不是草稿或预发布；附件 `Forkline-v0.4.0-windows-x64.zip` 为 `36,486,187` 字节，校验文件为 `99` 字节。
- 校验文件内容与本机重新下载 ZIP 的 SHA256 均为 `8df2ba3da1c32be4fa5653cc72d447bfaaae67c4e31add36c54d59d18cd43343`。

### Notes

- `docs/PACKAGING.md`：追加 v0.4.0 实际附件、大小、SHA256、工作流和 Release 地址。
- `docs/CONTINUE.md`：追加发布提交、不可移动标签、正式 Release 和后续版本边界。
- `progress.md`：仅在末尾追加本轮正式发布闭环与验证证据。
- 异常未跟踪文件 `n+fs.statSync(p.join('public'` 仍未删除、未暂存、未提交，也未进入 Release。
- 回滚方式：发布结果记录提交可执行 `git revert <documentation-commit>`；发布版本本身不得移动或删除 `v0.4.0` 标签，代码问题应从 `main` 创建修复提交并发布新版本。

## 2026-08-12 - Task: 收口 Forkline v0.4.1 当前用户安装与安全更新边界

### What was done

- Windows x64 NSIS 安装器固定为当前用户安装，保留安装向导和目录选择，不允许切换到全局安装或请求提权；桌面和开始菜单快捷方式仍默认创建，卸载继续保留 Forkline 用户数据。
- 安装版继续通过固定 GitHub provider 和受限 IPC 检查、下载、安装正式 Release；源码 Electron、Web 源码克隆和 Web 便携版继续使用原有 Git 快进更新。
- 安装包下载完成后，主进程先读取后台服务的权威操作状态；仍有 Git 操作时取消安装，空闲时才优雅停止后台服务及其持有的 Git/SSH 子进程，避免在推送、变基或仓库写入中途强制中断。
- 重新构建并核对安装器、blockmap、`latest.yml`、ASAR 内容和 GitHub 更新 provider；本机 D 盘安装、启动、关闭和卸载验收仍等待旧 C 盘验证安装的卸载许可，未提前记为完成。

### Testing

- 当前用户安装契约先在旧配置上稳定失败，加入 NSIS `customInstallMode` 后 `tests/installer-package.test.js` 为 `2/2` 通过；安装更新专项与 Electron 外壳合计 `39/39` 通过。
- 完整 `npm.cmd test` 为 `335/335` 通过，0 项失败、0 项跳过；`npm.cmd audit --audit-level=low` 为 0 个已知漏洞。
- `node --check` 覆盖 Electron 主进程、preload、安装更新控制器和相关页面脚本；`package.json`、`package-lock.json`、Release 工作流 YAML 解析和 `git diff --check` 均通过。
- 最终本机构建产物为 `Forkline-Setup-0.4.1-windows-x64.exe`，大小 `100,683,225` 字节，SHA-256 为 `b5f03c77dd9b1b1bafcca960c32566eaa2fd72af55a6c3a2bc0aaf05e12bb3d4`；blockmap SHA-256 为 `c672053c46e07e12ccd277e564ee02890d2b35d2da9ad7a40f87e99a57bcc611`，`latest.yml` SHA-256 为 `a7e7f21a3eafe1b011772b19e9da76390060a0d28577329306d14858ceca7df1`。
- ASAR 内版本为 `0.4.1`、入口为 `electron/main.js`，源码与打包后的主进程 SHA-256 一致；`app-update.yml` 固定 `AsphyxiaChoke/Forkline` GitHub provider。安装器签名状态如实为 `NotSigned`。
- 异常未跟踪文件 `n+fs.statSync(p.join('public'` 的 SHA-256 仍为 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`，未删除、未修改、未暂存、未提交。

### Notes

- `package.json`：加入 Electron 安装器依赖、构建与 GitHub 发布配置，并固定当前用户 NSIS 安装模式。
- `package-lock.json`：锁定 Electron Builder 与 Electron Updater 依赖树。
- `.github/workflows/release-installer.yml`：新增正式 Release 后的 Windows x64 安装器构建、测试、校验与附件上传流程。
- `electron/installer.nsh`：通过 NSIS 宏强制当前用户安装。
- `electron/installer-update-controller.js`：实现可单测的安装版检查、下载、停服与安装状态机。
- `electron/main.js`：接入安装更新控制器、受限 IPC、活跃 Git 操作门禁与后台服务安全停止。
- `electron/preload.js`：只暴露固定的安装更新状态、检查、安装和订阅接口。
- `public/js/app/init.js`、`public/js/bootstrap.js`、`public/js/core.js`、`public/js/panels/settings.js`：按运行形态分流安装版与 Git 更新，并复用设置页更新入口和进度展示。
- `public/js/i18n-catalog.js`：补充安装更新状态和失败提示的英文词条。
- `tests/installer-package.test.js`、`tests/installer-update-controller.test.js`、`tests/electron-shell.test.js`、`tests/i18n.test.js`、`tests/layout-ui.test.js`：覆盖安装器配置、更新状态机、IPC、停服门禁、翻译和设置页行为。
- `README.md`、`docs/ELECTRON_DESKTOP.md`、`docs/PACKAGING.md`：记录安装、更新、未签名风险、Release 附件和验证边界。
- `progress.md`：仅在末尾追加本轮已完成实现和当前待验收状态。
- 提交前回滚时只应逆向移除本节列出的 v0.4.1 安装器、更新控制器、页面分流、测试和文档增量，不得使用整仓库清理或触碰异常未跟踪文件。提交后应执行 `git revert <v0.4.1-release-commit>` 创建后续修复提交；不得移动或覆盖 `v0.4.0` 或之后发布的不可变标签。

## 2026-08-12 - Task: 补齐 Forkline v0.4.1 续做文档与发布前复核

### What was done

- 在续做文档末尾追加 v0.4.1 Windows x64 当前用户安装版的实现边界、安装更新停服顺序、Release 工作流、未签名风险和不可变版本规则。
- 明确真实本机验收尚未完成：旧 C 盘验证版仍保留，最终目标为 `D:\Forkline`；没有把自动测试、打包检查或旧安装现场替代为真实 D 盘安装、启动、退出和卸载结论。
- 重新核对当前工作区、安装器版本与签名、异常未跟踪文件、测试残留和 GitHub 发布边界；没有删除旧安装、没有运行安全界面、没有提交、推送、打标签或创建 Release。

### Testing

- 安装器、安装更新控制器与 Electron 外壳专项 `41/41` 通过；完整 `npm.cmd test` `335/335` 通过，0 项失败、0 项跳过，耗时约 `105.7` 秒。
- `npm.cmd audit --audit-level=low` 返回 0 个已知漏洞；Electron 主进程、preload、安装更新控制器和更新页面脚本均通过 `node --check`，`git diff --check` 无空白错误。
- 安装器文件版本与产品版本均为 `0.4.1`，SHA-256 仍为 `b5f03c77dd9b1b1bafcca960c32566eaa2fd72af55a6c3a2bc0aaf05e12bb3d4`，签名状态仍为 `NotSigned`。
- 测试后常用 Forkline 测试端口均无监听，没有浏览器性能夹具、测试临时目录或 Forkline 应用进程残留；`D:\Forkline` 仍不存在，证明本轮没有提前执行安装。
- 异常未跟踪文件 `n+fs.statSync(p.join('public'` 仍为 0 字节，SHA-256 仍为 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`，未删除、未修改、未暂存、未提交。

### Notes

- `docs/CONTINUE.md`：追加 v0.4.1 实现事实、构建证据、D 盘真实验收门槛和发布后新补丁版本边界。
- `progress.md`：仅在末尾追加本轮文档补齐与复核记录。
- 下一验证点：取得用户对卸载 `C:\Users\Administrator\AppData\Local\Programs\Forkline` 旧验证版的明确许可后，保留 `%APPDATA%\forkline`，再把最终安装版装到 `D:\Forkline` 完成 GUI 闭环。
- 回滚方式：仅反向删除本轮在 `docs/CONTINUE.md` 与 `progress.md` 末尾新增的两个章节；不得使用 `git clean`、整仓库回退或触碰异常未跟踪文件。

## 2026-08-13 - Task: 复核 Forkline v0.4.1 最终安装器并更正发布证据

### What was done

- 重新审计安装版更新控制器、受限 IPC、当前用户 NSIS 配置、Release 工作流和安装前停服边界；确认安装更新只在后台服务优雅退出后继续，超时或失败时取消安装，普通关闭仍保留仅针对当前实例进程树的有界清理。
- 将续做文档中的旧安装器大小、SHA-256、blockmap、`latest.yml` 以及过时停服描述更正为最终构建事实，没有把尚未完成的 D 盘安装验收写成成功。
- 核对 GitHub 当前仍以 `v0.4.0` 为 Latest，远端不存在 `v0.4.1` 标签，`origin/main` 仍停留在本轮基线；没有提交、推送、创建标签或 Release。

### Testing

- `npm.cmd test` 完整运行 `336/336` 通过，0 项失败、0 项跳过、0 项取消，耗时约 `104.9` 秒；覆盖真实 Chromium 性能、Electron 外壳、安装更新状态机、真实 Git 工作流和关停清理。
- `npm.cmd audit --audit-level=low` 返回 0 个已知漏洞；相关 Electron/页面脚本通过 `node --check`，`package.json` 与 `package-lock.json` 通过 Node JSON 解析，`npm.cmd ls --depth=0` 正常，`git diff --check` 无空白错误。
- 最终安装器为 `100,683,489` 字节，SHA-256 `e3cc3224423828738b2014c8fc9b6477cff4b59f15aa7099c32757f6fe83aae9`，签名状态 `NotSigned`；blockmap SHA-256 为 `76f7b54aaa8a179099f71ac63c0bc7ba17aba2002565b4082c215503c8573ca3`，`latest.yml` SHA-256 为 `4faf37ca4799de382f443eb5ba3a89643a4c047f76fd8abb661cb5a9e2e18933`，其中安装器大小和 SHA-512 与文件逐字节一致。
- 测试后没有 Forkline 应用或本仓库 Node 测试进程残留，`D:\Forkline` 仍不存在，独立 SSH 隧道 PID `24996` 仍运行。
- 异常未跟踪文件 `n+fs.statSync(p.join('public'` 仍为 0 字节，SHA-256 仍为 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`，未删除、未修改、未暂存、未提交。

### Notes

- `docs/CONTINUE.md`：更正最终构建哈希、大小和安装更新停服边界，继续保留 D 盘真实验收门槛。
- `progress.md`：仅在末尾追加本轮发布前审计、验证和未完成边界。
- 下一验证点：经用户即时确认后卸载 `C:\Users\Administrator\AppData\Local\Programs\Forkline` 旧验证版，保留 `%APPDATA%\forkline`，再把最终安装版装到 `D:\Forkline` 完成安装、启动、退出和卸载闭环。
- 回滚方式：仅反向删除本轮在 `docs/CONTINUE.md` 中更正的两条发布准备说明及本节追加记录；不得使用 `git clean`、整仓库回退或触碰异常未跟踪文件。提交后应使用 `git revert <v0.4.1-release-commit>` 创建后续修复提交，不得移动任何已发布标签。

## 2026-08-13 - Task: 验证 Forkline v0.4.1 安装到 D 盘并正常启动退出

### What was done

- 经用户确认卸载 C 盘旧验证版，并核对 `%APPDATA%\forkline` 用户数据及关键文件哈希保持不变。
- 从普通文件资源管理器启动最终安装器，覆盖安装到 `D:\Forkline`；确认真实用户桌面、开始菜单快捷方式和 HKCU 卸载登记均指向 D 盘安装目录。
- 启动最终安装版并打开设置页，确认版本、更新状态和高 DPI 最大化布局；随后通过窗口关闭按钮正常退出，验证后台服务和 Electron 进程完成清理。
- 首次由 Codex 应用上下文直接启动安装器时，Windows 将开始菜单入口虚拟化到 Codex 私有目录；没有把该结果误报为真实用户安装，改从 Explorer 重新覆盖安装后才通过验收。Codex 私有目录中的测试快捷方式尚未删除，避免超出删除授权。

### Testing

- `D:\Forkline\Forkline.exe` 文件版本为 `0.4.1`、产品版本为 `0.4.1.0`；真实 HKCU 卸载项显示 `Forkline 0.4.1`，卸载命令为 `"D:\Forkline\Uninstall Forkline.exe" /currentuser`。
- `D:\桌面\Forkline.lnk` 与 `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Forkline.lnk` 的目标、工作目录和图标均指向 `D:\Forkline`。
- 主窗口正常渲染，高 DPI 最大化状态下无可见文字重叠或横向溢出；设置页显示当前版本 `v0.4.1`，远端尚无 v0.4.1 时正确显示“暂时无法检查更新”。
- 运行时后台服务在随机回环端口监听；正常关闭后 `D:\Forkline\Forkline.exe` 进程和对应监听端口全部消失，真实 HKCU 登记及安装目录仍保留。
- `%APPDATA%\forkline` 中 `desktop-preferences.json`、`desktop-window-state.json`、`.updaterId` 和 `Preferences` 的 SHA-256 与卸载前一致；独立 SSH 隧道当前 PID `8592` 全程保持运行。

### Notes

- `docs/CONTINUE.md`：更新真实 D 盘安装、启动、更新状态和正常退出的当前验收事实，并明确卸载验证仍未完成。
- `progress.md`：仅在末尾追加本轮实机安装与退出验证记录。
- 下一验证点：经用户即时确认后卸载 `D:\Forkline`，确认安装目录、快捷方式和 HKCU 登记被移除且 `%APPDATA%\forkline` 保留；若需最终保留，再经确认从 Explorer 重装到 `D:\Forkline`。
- 回滚方式：仅反向删除本轮在 `docs/CONTINUE.md` 中更新的验收说明及本节追加记录；不得清理安装现场、异常未跟踪文件或其他用户数据。提交后应使用 `git revert <v0.4.1-release-commit>` 创建后续修复提交，不得移动已发布标签。

## 2026-08-13 - Task: 完成 Forkline v0.4.1 卸载与重装实机闭环

### What was done

- 经用户即时授权并由用户完成 `D:\Forkline` 验证版卸载，确认程序目录、真实用户桌面和开始菜单快捷方式、HKCU 卸载登记均已移除。
- 核对卸载没有删除 `%APPDATA%\forkline` 用户数据，也没有影响独立 SSH 隧道或仓库中的受保护异常未跟踪文件。
- 经用户即时授权后，从普通文件资源管理器启动最终安装器并重新安装到 `D:\Forkline`；确认当前用户安装登记、快捷方式、版本和运行状态均正确。
- 重装后启动主窗口并通过窗口关闭按钮正常退出，最终保留可用的 D 盘安装状态，没有自动处理或绕过任何 Windows 安全界面。

### Testing

- 卸载后 `D:\Forkline`、`D:\桌面\Forkline.lnk`、真实开始菜单 `Forkline.lnk` 和 Forkline HKCU 卸载项均不存在，Forkline 进程数为 0。
- 卸载后 `%APPDATA%\forkline` 仍存在；`desktop-preferences.json`、`desktop-window-state.json`、`.updaterId` 和 `Preferences` 的 SHA-256 分别保持为 `326886b370dc6365ba8016545bcac8fa99362fcc510294f30c269fd43370797d`、`ecf2fc3578912b36f92960edbab8a59685fc504051fc1611963e5ac142150ebf`、`c07fea97aa9c6ca163b062cd682f5f3c0bee4958e257d16cd2733e088aef0731`、`7dae01d1517b257d3859e625eee32f48765fa9c620c4c4cc6fae8eac0299aa07`。
- 重装后 `D:\Forkline\Forkline.exe` 文件版本为 `0.4.1`、产品版本为 `0.4.1.0`；HKCU 卸载命令为 `"D:\Forkline\Uninstall Forkline.exe" /currentuser`，桌面和开始菜单快捷方式的目标、工作目录与图标均指向 `D:\Forkline`。
- 重装启动时后台服务在 `127.0.0.1:50597` 监听；正常关闭后全部 D 盘 Forkline 进程和该监听端口消失，安装目录、真实 HKCU 登记与快捷方式继续保留。
- 独立 SSH 隧道 PID `8592` 在卸载、重装、启动和退出后均保持运行；异常未跟踪文件 `n+fs.statSync(p.join('public'` 仍为 0 字节，SHA-256 仍为 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`。
- 实机闭环后再次执行完整 `npm.cmd test`，最终结果为 `336/336` 通过，0 项失败、0 项跳过，耗时约 `112.6` 秒；`npm.cmd audit --audit-level=low` 为 0 个已知漏洞，`npm.cmd ls --depth=0` 正常，相关 JavaScript、JSON、YAML 和 `git diff --check` 全部通过。
- `latest.yml` 通过 YAML 结构化解析核验：版本 `0.4.1`、安装器文件名、`100,683,489` 字节和 SHA-512 均与最终 EXE 一致；EXE SHA-256 仍为 `e3cc3224423828738b2014c8fc9b6477cff4b59f15aa7099c32757f6fe83aae9`，签名状态仍为 `NotSigned`。
- `D:\Forkline\resources\app.asar` 与 `dist\installer\win-unpacked\resources\app.asar` 的 SHA-256 均为 `65187bcaad734da9aac155eebc9bef8925e181af507034fe4de21582a09dde95`；ASAR 内版本、入口、依赖元数据正确，Electron 主进程、preload、停服逻辑、安装更新控制器、NSIS 脚本及相关页面脚本与当前源码逐字节一致。

### Notes

- `docs/CONTINUE.md`：将 v0.4.1 真实本机验收状态更新为卸载、数据保留、重装、启动与退出完整通过。
- `progress.md`：仅在末尾追加本轮卸载与重装实机闭环证据。
- 最终现场保留 `D:\Forkline` 当前用户安装版；未删除 Codex 私有目录中的既有测试快捷方式，避免超出本轮安装与卸载目标范围。
- 回滚方式：仅反向恢复 `docs/CONTINUE.md` 中本轮验收状态文字并删除 `progress.md` 末尾本节；不得卸载最终保留的 D 盘应用、清理用户数据或触碰异常未跟踪文件。提交后应使用 `git revert <v0.4.1-release-commit>` 创建后续修复提交，不得移动任何已发布标签。

## 2026-08-13 - Task: 修复 v0.4.1 安装器工作流的 Windows 临时路径别名

### What was done

- 保留已经推送的 `v0.4.1` 注释标签和正式 Release，不移动、不覆盖既有发布提交；确认 Web 便携包工作流成功，安装器工作流首次运行只在自动测试阶段失败，尚未生成安装器附件。
- 从失败日志收敛根因：GitHub Windows runner 的默认临时目录以 `RUNNER~1` 8.3 短路径传给测试，而 Git 返回同一目录的 `runneradmin` 长路径，导致自更新根目录检查和仓库请求上下文保护把同一物理目录误判为不同路径。
- 只在安装器工作流的自动测试步骤把 `TEMP` 与 `TMP` 固定为 GitHub `runner.temp`，不修改安装器、更新控制器或产品运行时路径语义；加入契约测试固定该 CI 边界。
- 计划在修复提交推送后通过 `workflow_dispatch` 输入不可变标签 `v0.4.1` 重新运行安装器工作流，成功后再下载并核验全部 Release 附件。

### Testing

- 首次安装器工作流 `31661242135` 的失败日志确认 `36` 项失败，重复证据为请求路径 `C:\Users\RUNNER~1\AppData\Local\Temp\...` 与服务端路径 `C:/Users/runneradmin/AppData/Local/Temp/...`；构建、校验和附件上传步骤均被跳过。
- Web 便携包工作流 `31661242086` 成功完成，已上传 `Forkline-v0.4.1-windows-x64.zip` 与对应 SHA256 文件。
- 新增契约在发布提交的旧工作流内容上红测确认不匹配，修复后 `tests/installer-package.test.js` 为 `2/2` 通过；Release 工作流 YAML 结构化解析和 `git diff --check` 通过。
- 修复后完整 `npm.cmd test` 再次 `336/336` 通过，0 项失败、0 项跳过，耗时约 `116.9` 秒；重新调度结果将在修复提交推送后补充，未把尚未重跑的安装器工作流记录为成功。

### Notes

- `.github/workflows/release-installer.yml`：仅为自动测试步骤固定 GitHub runner 的长路径临时目录。
- `tests/installer-package.test.js`：固定安装器工作流必须显式设置 `TEMP` 与 `TMP` 为 `runner.temp`。
- `docs/PACKAGING.md`：说明 CI 临时路径别名及其与正式运行时边界的区别。
- `docs/CONTINUE.md`：记录首次失败证据、不可变标签边界和既有标签重跑方案。
- `progress.md`：仅在末尾追加本轮诊断与修复记录。
- 回滚方式：对本轮工作流修复提交执行 `git revert <workflow-fix-commit>`；不得移动 `v0.4.1` 或 `v0.4.0` 标签，也不得删除已上传的便携包附件。异常未跟踪文件仍须保持未暂存、未提交。

## 2026-08-13 - Task: 修复 v0.4.1 安装器重跑的浏览器性能测试竞态

### What was done

- 复核安装器工作流 `31661932844` 的首次运行和失败重试；两次均为 `335/336`，唯一失败稳定在小文件历史对照的 MergeView 数量断言，确认上一轮 Windows 临时路径修复已经生效。
- 收敛根因：GitHub runner 上首次 MergeView 构建超过产品既有 `250 ms` 保护阈值，Forkline 正确自动降级为轻量双栏，但正常交互测试没有隔离该机器性能分支。
- 修正真实 Chromium 测试夹具：正常 MergeView 交互段临时绕开自动降级，随后恢复真实保护，并继续用注入 `300 ms` 延迟的既有场景验证自动降级、诊断记录和记忆重开；没有修改产品阈值或运行时行为。
- 安装器工作流仅在手动重跑不可变 `v0.4.1` 时借用默认分支的修正测试文件，测试结束立即恢复 Tag 内容，再继续构建；产品源码、打包输入及 `v0.4.1`、`v0.4.0` 标签均保持不变。

### Testing

- 安装器工作流 `31661932844` attempt 1 与 attempt 2 均稳定复现同一失败：`tests/browser-performance.test.js:977` 的 `0 !== 1`；其余 `335` 项通过，构建与附件步骤均未执行。
- 修正后 `tests/installer-package.test.js` 为 `2/2` 通过，浏览器性能专项为 `1/1` 通过；专项同时确认正常 MergeView、慢构建自动降级、诊断记录和记忆重开。
- 修正后完整 `npm.cmd test` 为 `336/336` 通过，0 项失败、0 项跳过，耗时约 `105.0` 秒；`node --check` 与 `git diff --check` 通过。
- 异常未跟踪文件 `n+fs.statSync(p.join('public'` 仍为 0 字节，未删除、未修改、未暂存、未提交；发布标签仍分别指向 `v0.4.1@7ccf2d1` 与 `v0.4.0@ba897f0`。

### Notes

- `.github/workflows/release-installer.yml`：为不可变 `v0.4.1` 手动重跑增加测试夹具借用与测试后恢复步骤。
- `tests/browser-performance.test.js`：隔离正常 MergeView 交互与慢构建自动降级两条真实行为。
- `tests/installer-package.test.js`：固定既有标签重跑必须只借用测试文件并在构建前恢复 Tag 内容。
- `docs/PACKAGING.md`：记录失败根因、测试边界和不可变标签重跑方式。
- `docs/CONTINUE.md`：追加第二阶段诊断、当前验证结果与下一发布落点。
- `progress.md`：仅在末尾追加本轮诊断、修复和验证证据。
- 回滚方式：提交前仅对上述六个文件执行 `git restore --source=HEAD --worktree -- <file>`；提交后执行 `git revert <this-task-commit>`。不得使用整仓库清理，不得移动发布标签或触碰异常未跟踪文件。

## 2026-08-13 - Task: 校准安装器共享 runner 的浏览器计时预算

### What was done

- 重跑安装器工作流 `31663491437`，确认修正后的 MergeView 正常交互与慢构建自动降级均已越过；兼容测试文件在失败后也按 `always()` 成功恢复，构建步骤没有执行。
- 新的唯一失败为 GitHub 共享 Windows runner 上 4000 文件冷扫描 `816.4 ms`，而本机固定门限为 `350 ms`；同轮复杂编辑器、冲突编辑器和 Git 读取整体约比本机慢 2 到 3 倍，未出现功能、数据量、DOM 或 UI 卡顿断言失败。
- 仅为安装器工作流设置白名单环境值 `FORKLINE_BROWSER_PERFORMANCE_SCALE=3`，测试代码只有在值恰好为 `3` 时缩放五个 Git/磁盘严格计时预算；默认开发与本机回归仍为原 `1x` 门限。
- 未缩放功能结果、文件数、响应体、DOM 上限、UI 主线程延迟或自动降级断言；未修改产品代码、安装器内容、更新逻辑或发布标签。

### Testing

- Run `31663491437` 为 `335/336`，唯一失败证据为 `tests/browser-performance.test.js:1605` 的冷扫描 `816.4 ms`；测试后恢复步骤成功，构建、校验和附件上传均未执行。
- 工作流契约 `2/2`、JavaScript 语法、YAML 结构和 `git diff --check` 通过。
- `3x` 环境真实 Chromium 专项 `1/1` 通过，随后与工作流相同环境的完整回归 `336/336` 通过，0 项失败、0 项跳过，耗时约 `107.6` 秒。
- 默认严格 `1x` 真实 Chromium 专项再次 `1/1` 通过；4000 文件冷扫描约 `287.9 ms`，继续满足原 `350 ms` 门限。

### Notes

- `.github/workflows/release-installer.yml`：为共享安装器 runner 显式设置三倍 Git/磁盘计时预算。
- `tests/browser-performance.test.js`：加入严格白名单预算因子，并只应用到五个 Git/磁盘计时断言。
- `tests/installer-package.test.js`：固定工作流必须显式声明三倍预算。
- `docs/PACKAGING.md`：说明共享 runner 预算与本机严格门限的边界。
- `docs/CONTINUE.md`：追加第三阶段失败证据、修复方式和下一验证点。
- `progress.md`：仅在末尾追加本轮诊断、变更和验证证据。
- 回滚方式：提交前仅恢复本节列出的六个文件增量；提交后执行 `git revert <this-task-commit>`。不得移动 `v0.4.1`、`v0.4.0` 或清理异常未跟踪文件。

## 2026-08-13 - Task: 完成 Forkline v0.4.1 正式发布验收

### What was done

- 确认安装器工作流 `31663989923` 成功完成 `336/336` 自动回归、Tag 测试文件恢复、NSIS 构建、校验文件生成以及 Release 附件上传。
- 从 GitHub 正式 Release 重新下载全部六个附件，逐项核对大小、GitHub digest、附件校验文件和 `latest.yml`；如实保留未签名风险。
- 启动最终保留在 `D:\Forkline` 的安装版，设置页确认当前和最新版本均为 `v0.4.1`，没有触发更新安装；通过窗口关闭按钮正常退出。
- 明确国内下载加速不能修改不可变 `v0.4.1`，后续补丁版本需保持官方元数据和 SHA-512 为信任根，国内节点只传输安装器并在失败时回退官方源。

### Testing

- Release 为 Latest、非草稿、非预发布，六个附件齐全；本机重新下载后的 SHA-256 均与 GitHub digest 一致。
- EXE `100,594,372` 字节，SHA-256 `e376110142f8a1b5b96eeb5db8e815cc988f90c8112fa7bff3572a3819c313ce`；ZIP `36,583,817` 字节，SHA-256 `a91a2c0129d43d99f540968676372e3258aa68cf11b22c62b28883c622ac30ee`，两者均匹配各自 `.sha256` 内容。
- blockmap、EXE 校验文件、ZIP 校验文件和 `latest.yml` 的 SHA-256 分别为 `d257df1d0f90786cb43de4b1bfc0f8fedad7815373c770d9d85d4f668c9e0697`、`def6f3aff8db326c801369dcb83bb65975debc7ca3fcc0633da774e1d11369e0`、`a41c240ec0f996b649a0a1eeb52f476003d88c0f46777b14118956e68f770e97`、`b0d45ee8146b348d151c2673399ee972cea1858c36e1555a42334350b470ecf3`。
- `latest.yml` 的版本、文件名、大小和 SHA-512 与下载 EXE 一致；`Get-AuthenticodeSignature` 返回 `NotSigned`。
- 安装版设置页显示“已是最新版本”，当前版本和最新版本均为 `v0.4.1`；关闭后 Forkline/Electron/后台服务进程、监听端口和本仓库 Node 测试进程均为 0，`D:\Forkline` 安装及 HKCU 卸载登记继续保留。
- `v0.4.1` 与 `v0.4.0` 目标提交未移动；受保护异常文件仍为 0 字节，SHA-256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`，未删除、未修改、未暂存、未提交。

### Notes

- `docs/PACKAGING.md`：追加 v0.4.1 正式工作流、六附件哈希、`latest.yml`、签名和安装版验收结果。
- `docs/CONTINUE.md`：追加最终发布状态、不可变标签、D 盘现场以及后续国内更新加速的安全边界。
- `progress.md`：仅在末尾追加本轮发布验收证据。
- 回滚方式：对本轮文档提交执行 `git revert <this-task-commit>`；不得移动或覆盖 `v0.4.1`、`v0.4.0`，不得卸载最终保留的 `D:\Forkline`，不得触碰受保护异常未跟踪文件。

## 2026-08-13 - Task: 为 Forkline v0.4.2 安装版加入国内更新加速

### What was done

- 将应用版本升至 `0.4.2`，保持源码克隆、Electron 源码版和 Web 便携版的 Git 快进更新不变；仅为打包后的 Windows NSIS 安装版接入可单测的自定义更新器。
- 安装版继续从 GitHub 官方 Release 获取版本和 `latest.yml`，只把与版本严格匹配的 Forkline Windows x64 EXE 与 blockmap 改写到 `https://ghfast.top/`；渲染页仍只能使用固定受限 IPC，不能传入镜像、URL 或可执行文件路径。
- 加速节点失败或代理内容未通过官方 SHA-512 校验时，沿用 `electron-updater` 的失败缓存清理，再禁用差分下载并回退 GitHub 官方完整 EXE；用户主动取消下载时不回退。安装前仍先检查 Git 操作，再优雅停止后台服务和它持有的 Git/SSH 子进程。
- 补充用户、Electron、打包与续接文档，明确 `v0.4.1` 首次升级 `v0.4.2` 仍走官方源；安装 `v0.4.2` 后的后续安装版应用内更新才启用国内加速，并继续如实标注未签名风险。

### Testing

- 加速器专项 `5/5` 通过；其中真实 `ForklineNsisUpdater` 回归会先写入失败的代理临时文件，确认 `electron-updater` 清理后按顺序请求代理 URL 与官方 URL，并最终落盘通过官方 SHA-512 的安装器。Electron/安装器相关专项 `47/47` 通过。
- 完整回归最终 `341/341` 通过，0 项失败、0 项跳过，耗时约 `104.8` 秒。首轮唯一失败是既有 4000 文件冷扫描 `351.9 ms` 比默认 `350 ms` 门限多 `1.9 ms`；未修改代码或门限，默认 `1x` 专项复跑为 `302.8 ms`，最终全量为 `299.5 ms`。
- `node --check`、`git diff --check`、版本一致性和 Release 工作流 YAML 解析通过；`npm.cmd audit --audit-level=low` 为 0 个已知漏洞，`npm.cmd ls --depth=0` 正常。
- 本机构建生成 `Forkline-Setup-0.4.2-windows-x64.exe`：`100,683,918` 字节，文件/产品版本均为 `0.4.2`，SHA-256 `c0515e225c1c644a9832756899fd435b5baf54819a1137fcab56a994b4cc8009`，SHA-512 `yjizj0Z98Tpsj7wJTgeE5aLuK3M/ZLcPLLxNMI8OGvy/Z+T/gc7XHguICKZ1hLoF4aBdL0ZNsBBlsu0s1TXQCg==`，签名状态 `NotSigned`。
- blockmap 为 `105,652` 字节、SHA-256 `ba009299e9eea589d17986b4e9058138be21d488c701300e3fb4a8d34467e32e`；`latest.yml` 为 `369` 字节、SHA-256 `d0dbe0c6dc6586c891a6c4ec69a8068722cf40e31160f5eaa77c047a797362f3`，其版本、文件名、大小和 SHA-512 与 EXE 一致。
- ASAR 内 Electron 主进程、加速器、安装更新控制器和 preload 与源码逐字节一致；打包后的 `package.json` 保留 `0.4.2`、`electron/main.js` 和 `electron-updater` 运行依赖，只按 electron-builder 预期移除脚本、开发依赖与构建配置。
- `ghfast.top` 对正式 v0.4.1 安装器资产的 `0-1023` 字节范围请求返回 `206 Partial Content`，总大小 `100594372` 与官方附件一致；代理完整 v0.4.2 附件和 SHA-512 需在 Release 工作流上传后复核。
- 测试后更新器临时目录、Forkline 仓库 Node/Electron 进程和常用测试端口均为 0。受保护异常文件 `n+fs.statSync(p.join('public'` 仍为 0 字节，SHA-256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`，未删除、未修改、未暂存、未提交。

### Notes

- `electron/installer-update-accelerator.js`：新增白名单下载改写、取消识别、官方完整下载回退和自定义 NSIS updater。
- `electron/main.js`：Windows 安装版改用自定义 updater，其他平台继续使用原 updater。
- `tests/installer-update-accelerator.test.js`：覆盖白名单、官方校验信息保留、真实失败缓存清理与官方回退、取消和非白名单边界。
- `tests/electron-shell.test.js`、`tests/installer-package.test.js`：固定主进程接线与 `0.4.2` 打包契约。
- `package.json`、`package-lock.json`：发布版本同步为 `0.4.2`。
- `README.md`、`docs/ELECTRON_DESKTOP.md`、`docs/PACKAGING.md`、`docs/CONTINUE.md`：记录用户更新方式、信任边界、发布验证和续接状态。
- `progress.md`：仅在末尾追加本轮实现、验证、文件清单和回滚信息。
- 回滚方式：提交前仅恢复本节列出的源码、测试、版本和文档文件；提交后执行 `git revert <v0.4.2-release-commit>` 创建后续修复提交。不得移动 `v0.4.0` 或 `v0.4.1` 标签，不得使用 `git clean`、`git add .` 或触碰受保护异常文件。

## 2026-08-13 - Task: 完成 Forkline v0.4.2 正式发布与 D 盘安装终验

### What was done

- 确认 `v0.4.2` 正式 Release 为 Latest、非草稿、非预发布，安装器和便携包工作流均在不可变标签提交上成功；重新核对正式六附件、GitHub digest、校验文件、`latest.yml` 和未签名状态。
- 核对国内代理的正式 EXE、blockmap 和便携 ZIP 与官方附件一致；保留官方 `latest.yml` 与 SHA-512 作为信任根，未把当前不存在的 `v0.4.3` 虚构为一次实际软件内升级。
- 用户把正式安装器安装到 `D:\Forkline` 后，完成当前用户卸载登记、桌面/开始菜单快捷方式、用户数据保留、安装后 ASAR、设置页版本状态以及正常退出无残留终验。
- 最终保留可用的 `D:\Forkline` v0.4.2 安装版；源码克隆、Electron 源码版和 Web 便携版仍沿用原 Git 快进更新，后续 NSIS 应用内更新才优先使用国内加速。

### Testing

- GitHub Release <https://github.com/AsphyxiaChoke/Forkline/releases/tag/v0.4.2> 为 Latest，安装器工作流 `31670594368` 和便携包工作流 `31670594400` 均为 `success`，两者 `headSha` 均为 `125e65b2efb38806b43a00e38613a63b63df86e7`。
- 正式 EXE 为 `100,595,414` 字节、SHA-256 `a01deabc74b1f3b0b9a9506fee8b17cdec99567f8ec48c6b6fd6cfebf10fb1ac`；blockmap 为 `105,775` 字节、SHA-256 `3aa3cf7e9724cc0fd9dd97c024c78585471b6192adad89b0c36d2a4cd9653777`；便携 ZIP 为 `36,612,928` 字节、SHA-256 `69208264366207f2f3cf320fb0c964e7a16ef0138888b635e5b950baa64fefb0`。
- EXE 校验文件和 ZIP 校验文件的 SHA-256 分别为 `5043f944124e118a45b33d2adf313cb29dce5ad4969f76c93c555fd503015752`、`9f0e39237ba77c03c496644cb2a25cb69695c631c50272c87fe277bda2eb0a50`；`latest.yml` 为 `369` 字节、SHA-256 `fd1454bbf138f39d2793b8cd062a59a0c35f267fb9644465fb1075d7d0b56bdd`。六个本机文件与 GitHub digest 一致，EXE/ZIP 计算值匹配各自校验文件。
- `latest.yml` 的版本、文件名、大小和 SHA-512 `+Z5Wptfey84ZbBrWZRMedT4ZOxLBR9HdTvQjxeVfarCYHOg1w4lyNDoczTjH7xGHxK/OsmcVUWCppWEMlwsNbQ==` 与正式 EXE 一致；`Get-AuthenticodeSignature` 返回 `NotSigned`。国内代理完整附件校验通过，其中代理 blockmap SHA-256 与官方值相同。
- `D:\Forkline\Forkline.exe` 文件版本 `0.4.2`、产品版本 `0.4.2.0`；HKCU 卸载项显示 `Forkline 0.4.2`，命令为 `"D:\Forkline\Uninstall Forkline.exe" /currentuser`；`D:\桌面\Forkline.lnk` 和开始菜单 `Forkline.lnk` 的目标、工作目录及图标均指向 `D:\Forkline`。
- `%APPDATA%\forkline` 保留，关键文件 `desktop-preferences.json`、`desktop-window-state.json`、`.updaterId` 和 `Preferences` 仍存在；其中既有偏好、更新器 ID 和 Preferences 的 SHA-256 与安装前记录一致。
- 安装后 `D:\Forkline\resources\app.asar` 的 `package.json` 版本为 `0.4.2`，入口为 `electron/main.js`，保留 `electron-updater ^6.8.9`；加速器包含固定 `https://ghfast.top/` 白名单前缀和 `ForklineNsisUpdater`。主进程、preload、安装更新控制器和加速器与 `v0.4.2` 标签源码在换行归一化后逐字节一致。
- 设置页显示“已是最新版本”，当前版本和最新版本均为 `v0.4.2`；正常点击窗口关闭后，Forkline/Electron/后台服务进程和监听端口均为 0，原回环端口只剩无所属进程的 `TIME_WAIT`，安装目录和 HKCU 登记继续保留。
- 文档落账前 `main`、`origin/main` 和 `v0.4.2` 均指向 `125e65b2efb38806b43a00e38613a63b63df86e7`；`v0.4.1` 与 `v0.4.0` 仍分别指向 `7ccf2d145b8d78cc3c5b01c59dc2650dfd299df9`、`ba897f0d67a53b7c67437a4ae195c1447e211d53`。受保护异常文件仍为 0 字节、SHA-256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`，未删除、未修改、未暂存、未提交。

### Notes

- `docs/PACKAGING.md`：追加 v0.4.2 正式工作流、六附件校验、国内代理证据、未签名风险和 D 盘安装终验。
- `docs/CONTINUE.md`：把 v0.4.2 状态从发布准备更新为正式发布与本机验收完成，并保留后续版本和不可变标签边界。
- `progress.md`：仅在末尾追加本轮正式发布、D 盘安装、设置页和退出验收证据。
- 回滚方式：对本轮文档验收提交执行 `git revert <this-task-commit>`；不得移动或覆盖 `v0.4.2`、`v0.4.1`、`v0.4.0`，不得卸载最终保留的 `D:\Forkline`，不得触碰受保护异常未跟踪文件。

## 2026-08-13 - Task: 修复 Forkline 普通工作区文件无法查看并准备 v0.4.3

### What was done

- 通过工具函数红测和真实 Chromium 场景稳定复现普通工作区文件双击后出现 `Cannot read properties of null (reading 'ours')`，确认非冲突文件的合法 `conflictVersions: null` 被前端直接解引用是唯一根因。
- 以最小改动让冲突版本归一化兼容显式 `null`，并将应用版本升至 `0.4.3`；未改变文件内容、Git 操作、冲突编辑、Web 菜单、便携版 Git 更新或 NSIS 更新语义。
- 新增工具函数与真实浏览器回归，完成专项、完整自动测试、依赖审计、语法/差异检查和本机 NSIS 构建；本机 ASAR 已确认包含修复且与源码一致。
- 保留 `v0.4.0`、`v0.4.1`、`v0.4.2` 不可变标签和受保护异常未跟踪文件，未执行破坏性 Git 清理或无差别暂存。

### Testing

- 文件编辑器与安装器契约专项 `36/36` 通过；完整 `npm.cmd test` 为 `342/342`，0 失败、0 跳过，耗时约 `105.9` 秒。真实 Chromium 回归确认普通工作区文件编辑窗打开、`conflict === false`、MergeView 正常且无原 TypeError。
- `npm.cmd audit --audit-level=low` 为 0 个已知漏洞；`npm.cmd ls --depth=0` 正常，Electron `43.3.0`、electron-builder `26.15.3`、electron-updater `6.8.9` 均完整。
- `node --check`、版本一致性、`git diff --check` 通过；`v0.4.0`、`v0.4.1`、`v0.4.2` 仍分别指向 `ba897f0d67a53b7c67437a4ae195c1447e211d53`、`7ccf2d145b8d78cc3c5b01c59dc2650dfd299df9`、`125e65b2efb38806b43a00e38613a63b63df86e7`。
- 本机构建的 EXE 为 `100,684,036` 字节，文件/产品版本均为 `0.4.3`，SHA-256 `557b02835430ef1b489a7424a5f71c1f3ef40eda4b86d2b4540cdeac650532f5`，SHA-512 `Ur2w8Z+465eyhp4z8jvuzbEZTDGJzxL7FP4TisUD6i7vhWDqpepmB73NnL1RuDhCwk9eVfcGZd9QR/OoSSvSKA==`，签名状态 `NotSigned`。
- blockmap 为 `105,574` 字节、SHA-256 `126077949fcc2b0224da88a53f623d98a06344a7e937b1c0d6332e08c05355bd`；`latest.yml` 为 `369` 字节、SHA-256 `9c2ee4710117029e452dc282b0de694aee5ae34e1038bdfeb0f50b20883ebde6`，其中版本、文件名、大小和 SHA-512 与 EXE 一致。
- ASAR 内 `package.json` 版本为 `0.4.3`，入口为 `electron/main.js`，保留 `electron-updater ^6.8.9`；`file-editor-utils.js` 包含空值修复，并与源码在换行归一化后完全一致。
- 官方 Electron CDN 首次本机构建连接后临时文件持续为 0 字节；终止已核实的本轮构建进程后，仅用 electron-builder 命令行临时指定现有 Electron 运行时成功构建，未改正式配置。受保护异常文件仍为 0 字节、SHA-256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`，未删除、未修改、未暂存、未提交。

### Notes

- `public/js/features/file-editor-utils.js`：兼容 API 对普通文件返回的显式空冲突版本。
- `tests/file-editor-ui.test.js`：增加 `null` 冲突版本的工具函数回归。
- `tests/browser-performance.test.js`：增加真实 Chromium 双击普通工作区文件并打开编辑器的回归。
- `package.json`、`package-lock.json`：发布版本同步为 `0.4.3`。
- `tests/installer-package.test.js`：固定安装器发布版本契约为 `0.4.3`。
- `docs/CONTINUE.md`、`docs/PACKAGING.md`：记录根因、边界、验证结果和发布续接点。
- `progress.md`：仅在末尾追加本轮实现、验证、文件清单和回滚信息。
- 回滚方式：提交前只恢复本节列出的九个任务文件；提交后执行 `git revert <v0.4.3-release-commit>` 创建后续修复提交。不得移动既有标签，不得使用 `git clean`、`git add .` 或触碰受保护异常未跟踪文件。

## 2026-08-13 - Task: 修正 v0.4.3 安装器工作流的普通文件浏览器回归

### What was done

- 诊断正式安装器 Run `31676525204` 的唯一失败：共享 runner 上普通小文件首次 MergeView 构建触发既有慢构建保护，产品正确降级为两个轻量 CodeMirror 窗格，但新增测试只允许一个 MergeView。
- 将回归收紧到真实业务结果：普通工作区文件必须成功打开、保持非冲突状态、没有原空值 TypeError，并允许 MergeView 或产品既有的轻量双栏两种正常渲染。
- 扩展手动安装器工作流兼容路径，在不移动 `v0.4.3` 标签的前提下，测试阶段借用默认分支修正后的浏览器测试，测试后恢复标签内容再构建产品。

### Testing

- 与 GitHub 工作流一致的 `FORKLINE_BROWSER_PERFORMANCE_SCALE=3` 真实 Chromium 专项通过；本机严格 `1x` 首轮唯一失败是既有 4000 文件冷扫描 `407.8 ms` 超过 `350 ms`，未修改产品或门限，严格复跑以 `286.8 ms` 通过。两轮都已通过修正后的普通文件打开场景。
- 最终完整 `npm.cmd test` 为 `342/342`，0 失败、0 跳过，耗时约 `109.5` 秒；其中 4000 文件冷扫描为 `326.4 ms`。安装器工作流契约随完整回归通过，`git diff --check` 在提交前复核。
- 正式工作流仍需在 `v0.4.3@76fc807e94c9d4dd46afdb36721867180de4cd91` 上完成测试、恢复、构建和附件上传后才算通过。
- 便携包 Run `31676525235` 已成功并上传 ZIP 与 SHA-256；安装器首轮未进入构建步骤，因此 Release 当时只有两个便携附件，没有把不完整发布误报为完成。

### Notes

- `tests/browser-performance.test.js`：允许普通文件编辑器的 MergeView 或合法轻量双栏渲染，同时保留原故障断言。
- `.github/workflows/release-installer.yml`：让 `v0.4.3` 手动重跑借用并恢复修正后的浏览器测试。
- `tests/installer-package.test.js`：固定兼容重跑与恢复契约。
- `docs/CONTINUE.md`、`docs/PACKAGING.md`：记录首轮失败证据、产品/测试边界和不可变标签策略。
- `progress.md`：仅在末尾追加本轮诊断、验证计划、文件清单和回滚信息。
- 回滚方式：提交前只恢复本节列出的六个文件；提交后执行 `git revert <workflow-fix-commit>`。不得移动 `v0.4.3` 或其他既有标签，不得清理受保护异常未跟踪文件。

## 2026-08-13 - Task: 修复 Electron 最近仓库跨重启丢失并准备 v0.4.4

### What was done

- 确认随机回环端口让 Electron 每次启动进入不同浏览器来源，而最近仓库此前保存在来源隔离的 `localStorage` 中；旧记录仍存在于用户 LevelDB，并非仓库或用户数据被删除。
- 为 Electron 增加稳定最近仓库文件、首次旧来源迁移和固定受限 IPC；记录按时间合并、路径去重并限制为 `10` 条。Web 和 Web 便携版继续使用原 `localStorage`，现有菜单、Git 语义和更新分流不变。
- 将版本升至 `0.4.4`，补齐存储、迁移、Electron 壳、启动顺序、布局与安装器契约回归，并恢复本机构建验证后遗留的根 `package.json` 临时精简状态，只保留版本差异。
- 完成 `D:\Forkline` 覆盖安装、最近仓库迁移、随机端口重启、普通工作区文件打开、快捷方式、当前用户卸载登记、卸载保留用户数据和重装终验；最终保留可用的 v0.4.4 安装版。

### Testing

- 最近仓库、Electron 壳、布局和安装器专项 `91/91` 通过；最终完整 `npm.cmd test` 为 `347/347`，0 失败、0 跳过，耗时约 `108.4` 秒。`git diff --check` 在文档修改前通过，提交前将再次复核。
- 首次正式用户数据迁移生成 `%APPDATA%\forkline\desktop-recent-repositories.json`，恢复 `4` 条真实仓库记录；首次服务端口 `65214`，重启后端口 `59745`，路径和分支集合及界面下拉记录仍完整。
- 真实安装版打开普通修改文件 `配置文件5 (2) - 副本.txt` 用时 `234 ms`，`conflict === false`、编辑器完成显示、内容长度 `104`，无页面错误；验证了 v0.4.3 普通文件修复没有回归。
- 安装前 `%APPDATA%\forkline` 与备份 `C:\Users\Administrator\AppData\Local\Temp\forkline-v0.4.4-preinstall-backup-835ed3f3825a4639878d4ce8dfdde4ef` 均为 `1945` 个文件、`41,163,416` 字节。卸载后程序目录、桌面/开始菜单快捷方式和 HKCU 登记均移除，稳定 JSON SHA-256 仍为 `bdb869af1e5c72933e77629e19217632ab24ca405be6ac538c527d56c7146922` 且保留 `4` 条记录；重装后文件/产品版本、登记、快捷方式和仓库恢复均正确，退出后进程与端口为 0。
- 本机 EXE 为 `100,600,510` 字节，SHA-256 `22566fbc3b815df033d582627ab7fd21bd5cad8bce193f70ced7ae32a86948fe`，SHA-512 `xu8Por6RG4THQnBKFZK7WLBAU+QwbiMOj2t0uRYYh62Pbmc57rJyANC9WJe0vCeYoDZ8ykRZrzZ1cF/gPLSUPA==`，签名状态 `NotSigned`；blockmap 为 `105,720` 字节、SHA-256 `8b2e89fb948687a9951e908e8de8594c57297632d2f37b67ee9353448c962275`；`latest.yml` 为 `369` 字节、SHA-256 `06f18a93ef228ef24e89b1425bab18869533ac6d78852e074cc0af620e46d24e`，其中 SHA-512 与 EXE 一致。
- 本地 `win-unpacked` 和最终 `D:\Forkline\resources\app.asar` 的版本、入口、`electron-updater` 依赖及稳定存储模块均核对通过。受保护异常文件仍为 0 字节，SHA-256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`，未删除、未修改、未暂存、未提交。

### Notes

- `electron/recent-repository-store.js`：新增稳定记录规范化、文件读写、旧随机端口来源发现和一次性迁移。
- `electron/main.js`：登记最近仓库固定 IPC，在后台服务启动前执行迁移，并保护隐藏迁移窗口关闭时的应用生命周期。
- `electron/preload.js`：只新增固定的桌面最近仓库读取和写入接口。
- `public/js/features/repositories.js`：Electron 使用稳定记录，Web 继续使用 `localStorage`，并统一最多 `10` 条和清除提示。
- `public/js/bootstrap.js`：在仓库恢复前等待桌面最近记录初始化。
- `public/js/i18n-catalog.js`：同步最近仓库清除和保存失败的英文文案。
- `tests/recent-repository-store.test.js`：覆盖随机端口持久化、Web 边界、记录规范化和旧来源迁移。
- `tests/electron-shell.test.js`：固定稳定文件、受限 IPC、迁移期生命周期和启动顺序。
- `tests/layout-ui.test.js`：为异步最近记录初始化补齐布局测试上下文。
- `tests/installer-package.test.js`：固定发布版本为 `0.4.4`。
- `package.json`：发布版本升至 `0.4.4`，保留完整脚本、开发依赖和 NSIS 构建配置。
- `package-lock.json`：同步根包版本为 `0.4.4`。
- `docs/ELECTRON_DESKTOP.md`：说明稳定文件、首次迁移、安全边界和 Web 行为不变。
- `docs/ARCHITECTURE.md`：记录稳定存储模块、主进程/preload 接口和初始化顺序。
- `docs/PACKAGING.md`：追加 v0.4.4 本机产物、安装/卸载验收和正式工作流边界。
- `docs/CONTINUE.md`：追加 v0.4.4 发布续接状态、真实记录和剩余远端验证。
- `progress.md`：仅在末尾追加本轮实现、验证、文件清单和回滚信息。
- 回滚方式：提交前只恢复本节列出的 17 个任务文件；发布提交后执行 `git revert <v0.4.4-release-commit>` 创建后续修复提交。不得移动既有标签，不得使用 `git clean`、`git add .`，不得触碰受保护异常文件；如需恢复安装前用户数据，可先关闭 Forkline，再从上述备份目录按原路径复制回 `%APPDATA%\forkline`。

## 2026-08-13 - Task: 完成 Forkline v0.4.4 正式发布与远端附件验收

### What was done

- 将发布提交推送到 `origin/main`，创建并推送固定指向该提交的注释标签 `v0.4.4`，发布 GitHub Release；没有移动或覆盖任何既有标签，也没有上传本机验证产物冒充正式附件。
- 等待安装器与便携包两条 Release 工作流完成，确认它们均从不可变标签提交构建；重新取得并核对正式六附件、GitHub digest、两个校验文件、`latest.yml`、安装器版本与未签名状态。
- 通过 `ghfast.top` 下载正式 EXE 和 blockmap，确认国内节点内容与 GitHub 官方附件一致；保留官方 Release 元数据和 SHA-512 作为信任根。
- 最终保留 `D:\Forkline` v0.4.4 与 `4` 条稳定最近仓库记录，应用和后台服务均已退出；受保护异常未跟踪文件继续原样保留。

### Testing

- `main`、`origin/main` 和 `v0.4.4` 在发布时均解引用到 `21e66ccbe372d69f18b9761118c6da20088cb5b4`；远端注释标签对象为 `a18b1f5c23d99b4f462dedabd285f7b8798dadb0`。`v0.4.0` 至 `v0.4.3` 标签未移动。
- Release <https://github.com/AsphyxiaChoke/Forkline/releases/tag/v0.4.4> 为 Latest、非草稿、非预发布。安装器 Run `31687442333` 与便携包 Run `31687442202` 均为 `success`，`headSha` 均为发布提交；安装器工作流自动测试为 `347/347`，0 失败、0 跳过，耗时约 `135.7` 秒。
- 正式 EXE 为 `100,597,262` 字节、SHA-256 `3d3c893e7db8d3406c51a569b6a1fb94ecc859185f3caf26137ca1be149e5f12`；blockmap 为 `105,889` 字节、SHA-256 `acefb4b803110a3df74b46ed8198d5be7733086fcdc5a27bcea74b67d2e8d281`；便携 ZIP 为 `36,646,273` 字节、SHA-256 `6d13e5cfd1beda161561c2a657bd003ced732204324dfaaf2d140c9c41059222`。
- EXE 校验文件、ZIP 校验文件和 `latest.yml` 分别为 `102`、`99`、`369` 字节，SHA-256 分别为 `84bbdf631c4e2ecfe0ec3c77558443aec5f03a4826f5cad38c514a6d32fa3319`、`ccb667f144342247c80b6555278e3fba179d510a85df1a36299b404bd44356df`、`167500b1669e2bb94be31b53e8ff3fa2321e58498314f49a884a3af9779d80a6`。六附件均匹配 GitHub digest，EXE/ZIP 均匹配各自校验文件。
- `latest.yml` 的版本、文件名、`100597262` 字节大小及 SHA-512 `2dGtVBSwNffb8kHvGvNcxFom4l5rHf2/+An93NFu0cUfoaqdNxrNLOWSbHvsqOP/4O9JDyipIl3F4epxEDOq+w==` 与正式 EXE 一致；EXE 文件版本为 `0.4.4`、产品版本为 `0.4.4`，Authenticode 为 `NotSigned`。
- 国内节点完整 EXE 与 blockmap 的大小和 SHA-256 均匹配官方附件；便携 ZIP 可正常列目录并包含 `.git`、`runtime`、源码、文档与启动脚本，继续保留 Web 便携版 Git 快进更新形态。
- `D:\Forkline\Forkline.exe` 文件版本为 `0.4.4`、产品版本为 `0.4.4.0`，HKCU 卸载项为 `Forkline 0.4.4`；当前应用、Electron、后台服务进程和监听端口均为 0。稳定最近仓库 JSON 仍包含 `4` 条记录。
- 文档提交前受保护异常文件仍为 0 字节、SHA-256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`，未删除、未修改、未暂存、未提交。

### Notes

- `docs/PACKAGING.md`：追加 v0.4.4 正式工作流、六附件、校验链、国内节点、未签名风险和最终安装状态。
- `docs/CONTINUE.md`：把 v0.4.4 从发布准备更新为正式发布验收完成，并记录后续不可变标签边界。
- `progress.md`：仅在末尾追加本轮发布操作、正式验收证据、文件清单和回滚方式。
- 回滚方式：对本轮文档验收提交执行 `git revert <this-task-commit>`；不得移动或覆盖 `v0.4.4` 及任何既有标签，不得卸载最终保留的 `D:\Forkline`，不得触碰受保护异常未跟踪文件。

## 2026-08-13 - Task: 修复 Electron 界面偏好跨随机端口丢失并准备 v0.4.5

### What was done

- 确认 Electron 每次启动使用不同回环端口时，主题、语言、布局、恢复策略、签出储藏记录和界面诊断仍保存在来源隔离的 `localStorage`，因此更新或重启后会读取到另一来源；旧数据并未被删除。
- 为安装版增加 `%APPDATA%\forkline\desktop-ui-preferences.json`、固定白名单键、保守旧来源迁移和当前主窗口限定 IPC；Web 和 Web 便携版继续使用原生 `localStorage`，现有菜单、Git 语义和更新分流不变。
- 修正单值上限必须按 UTF-8 实际字节而非 JavaScript 字符数计算的问题，并让较大的中文诊断集合按字节裁掉最旧记录、优先保存最新诊断，避免主进程拒绝整个值。
- 将版本升至 `0.4.5`，补齐稳定存储、迁移、启动期诊断、Electron 壳、布局、favicon 和安装器契约回归；完成本机构建以及 `D:\Forkline` 覆盖安装、随机端口重启、卸载保留用户数据和重装终验。

### Testing

- 稳定偏好、Electron 壳、布局和诊断专项 `97/97` 通过；最终完整 `npm.cmd test` 为 `356/356`，0 失败、0 跳过，耗时约 `115.2` 秒。
- 真实 Chromium 复杂历史文件首次打开约 `197.3 ms`；4000 文件冷扫描约 `334.6 ms`，仍低于 `350 ms` 门限。原普通文件查看回归继续通过，未出现 `Cannot read properties of null (reading 'ours')`。
- `npm.cmd audit --audit-level=low` 为 0 个已知漏洞；`npm.cmd ls --depth=0` 正常，Electron `43.3.0`、electron-builder `26.15.3`、electron-updater `6.8.9` 均完整。全部本轮 JavaScript 文件通过 `node --check`，`package.json`、`package-lock.json` 和根包版本均为 `0.4.5`。
- 本机 EXE 为 `100,602,897` 字节、SHA-256 `5e3b305a16642de99499966ef6fc761a0401fff46fab1df555cf4daa32ac6989`、SHA-512 `9ejiZp4fvwKYobJ4gUEa2WrdUu/LcSkxfMijglEonY7RojOUJ1YdTSNYAcBg+aB0zlSBLfwJ+hY+UG84CQnslA==`，签名状态 `NotSigned`；blockmap 为 `105,810` 字节、SHA-256 `f27d0a28b85d638a9518e1814cd078a39e361033d71cad8eea33825e1e5505e2`；`latest.yml` 为 `369` 字节、SHA-256 `d1af6313f083201220bd2783c1b3dbc3dd340e871df979ed53a10e3122267638`，版本、文件名、大小和 SHA-512 与 EXE 一致。
- 本机构建只在当前命令行临时使用 `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/` 解决官方 Electron ZIP 0 字节下载，没有写入正式配置。安装后 `D:\Forkline\Forkline.exe` 文件版本 `0.4.5`、产品版本 `0.4.5.0`；随机端口 `61975 → 53882` 后中文、深色、`75%`、`4` 条最近仓库和普通文件查看均保留，退出后无 Forkline 或后台服务进程残留。
- 提交前差异检查、保护文件索引检查和既有标签位置将在本条日志追加后再次单独复核。受保护异常文件当前仍为 0 字节、SHA-256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`，未删除、未修改、未暂存、未提交。

### Notes

- `electron/desktop-preference-store.js`：新增稳定偏好白名单、UTF-8 字节限制、文件读写、保守旧来源迁移和诊断合并。
- `electron/main.js`：登记当前主窗口限定的固定偏好 IPC，并在正常主窗口启动前完成旧来源迁移。
- `electron/preload.js`：只新增固定的偏好读取、写入和删除接口。
- `public/js/desktop-preference-storage.js`：为 Electron 提供稳定偏好读写门面，并让普通 Web 环境继续使用原 `localStorage`。
- `public/js/bootstrap.js`：在语言、主题、布局、恢复策略和诊断初始化前等待稳定偏好读取。
- `public/js/app/layout-utils.js`：让主题、布局尺寸和历史列宽通过稳定偏好门面读写。
- `public/js/app/performance-diagnostics.js`：保留启动期诊断，初始化后合并历史，并按 UTF-8 字节裁掉最旧的大记录。
- `public/js/features/git-actions-loader.js`：让首屏签出储藏记录使用稳定偏好门面。
- `public/js/features/git-actions.js`：让完整 Git 动作实现中的签出储藏记录使用稳定偏好门面。
- `public/js/features/recovery-policy.js`：让按仓库恢复点策略使用稳定偏好门面。
- `public/js/i18n.js`：让语言恢复和切换使用稳定偏好门面。
- `public/index.html`：在既有启动顺序中加入桌面偏好门面，并声明 Forkline favicon。
- `public/favicon.svg`：新增复用三节点分叉品牌标识的浏览器图标。
- `tests/desktop-preference-store.test.js`：覆盖白名单、UTF-8 大小边界、唯一时间证据迁移和失败重试。
- `tests/desktop-preference-storage.test.js`：覆盖随机回环来源变化后的稳定偏好和 Web `localStorage` 边界。
- `tests/electron-shell.test.js`：固定受限偏好 IPC、迁移调用、启动顺序和 favicon 契约。
- `tests/ui-diagnostics.test.js`：覆盖启动错误合并及较大中文诊断按字节保留最新记录。
- `tests/layout-ui.test.js`：补齐稳定诊断初始化后的启动布局测试上下文。
- `tests/installer-package.test.js`：固定安装器发布版本为 `0.4.5`。
- `package.json`：将应用和安装器发布版本升至 `0.4.5`。
- `package-lock.json`：同步根包与锁文件版本为 `0.4.5`。
- `docs/ELECTRON_DESKTOP.md`：说明稳定偏好文件、安全边界、迁移规则和 Web 行为不变。
- `docs/ARCHITECTURE.md`：记录稳定偏好模块、主进程/preload 接口、加载顺序和诊断持久化边界。
- `docs/PACKAGING.md`：追加 v0.4.5 本机构建、安装/卸载终验、国内构建镜像和正式发布边界。
- `docs/CONTINUE.md`：追加 v0.4.5 当前完成状态、验证证据和不可变标签续接点。
- `progress.md`：仅在末尾追加本轮实现、验证、文件清单和回滚信息。
- 回滚方式：发布提交后执行 `git revert <v0.4.5-release-commit>` 创建后续回滚提交；不得移动或覆盖 `v0.4.5` 及任何既有标签，不得使用 `git clean`、`git add .`，不得触碰受保护异常未跟踪文件。若只需回滚本机安装，可在关闭 Forkline 后使用 `D:\Forkline\Uninstall Forkline.exe` 卸载程序，用户数据默认继续保留。

## 2026-08-13 - Task: 完成 Forkline v0.4.5 正式发布与远端附件验收

### What was done

- 将 v0.4.5 发布提交推送到 `origin/main`，创建固定指向该提交的远端注释标签并发布 GitHub Release；没有移动或覆盖任何既有标签，也没有上传本机验证产物冒充正式附件。
- 等待安装器和便携包两条 Release 工作流完成，确认它们均从不可变标签提交构建；核对正式六附件、GitHub digest、两个校验文件、`latest.yml`、安装器版本和未签名状态。
- 通过 `ghfast.top` 下载正式 EXE、blockmap 和便携 ZIP，确认国内节点内容与 GitHub 官方 digest 一致；保留官方 Release 元数据、SHA-512 和校验文件作为信任根。
- 最终保留 `D:\Forkline` v0.4.5 与既有稳定用户数据，应用和后台服务均已退出；受保护异常未跟踪文件继续原样保留。

### Testing

- `main`、`origin/main` 和 `v0.4.5` 均解引用到 `dec62991b1768e3970e754aef334223acd609894`；远端注释标签对象为 `ebb92b8dc6f27a3e4d8ae9eef39dd0898bca9e8e`。`v0.4.0` 至 `v0.4.4` 标签未移动。
- Release <https://github.com/AsphyxiaChoke/Forkline/releases/tag/v0.4.5> 为 Latest、非草稿、非预发布。安装器 Run `31705019886` 和便携包 Run `31705019861` 均为 `success`，`headSha` 均为发布提交；安装器工作流自动测试为 `356/356`，0 失败、0 跳过，耗时约 `132.7` 秒。
- 正式 EXE 为 `100,599,666` 字节、SHA-256 `12a13f9d9e021486d66da05ec46816e37808f7bf8e46e538068a4295ff2fa34b`；blockmap 为 `105,744` 字节、SHA-256 `b73ccd0fc0289c1b8f1d1941ef14e40b980e324b285abc1ee5932b44007f05f2`；便携 ZIP 为 `36,675,747` 字节、SHA-256 `f02bf39c9261f773b33d6b8cc2c9455a71745feab53792ca14c47c32d0335750`。
- EXE 校验文件、ZIP 校验文件和 `latest.yml` 分别为 `102`、`99`、`369` 字节，SHA-256 分别为 `8b933cd6d4f3033ba02b87841a36fa05e686f36be999a2e65cf272094fc8b2b2`、`c56cc9b744f8b77a85bd9fb470c63d64a9b510d9a3aad13d33bfbed5568039f2`、`9e14bf1b7e82b9f2efdd941d130420098d50f2e881577bafff21eb46440f37ec`。六附件全部匹配 GitHub digest，EXE/ZIP 也分别匹配各自校验文件。
- `latest.yml` 的版本、文件名、`100599666` 字节大小和 SHA-512 `MxWpKFYAXIO585TJ/tkPb5XqmlFCgj9Dh9gTLXDwWYlSvRUHX8FQpGZMukPcVRTpXxB1V/BgGR3f3rEKIvWm/g==` 与正式 EXE 一致；EXE 文件版本和产品版本均为 `0.4.5`，Authenticode 为 `NotSigned`。
- 国内节点完整 EXE、blockmap 和便携 ZIP 的大小与 SHA-256 均匹配官方 digest；便携 ZIP 可正常列目录并包含 `.git`、`runtime`、源码、文档和启动脚本，继续保留 Web 便携版 Git 快进更新形态。
- 文档提交前受保护异常文件仍为 0 字节、SHA-256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`，未删除、未修改、未暂存、未提交。

### Notes

- `docs/PACKAGING.md`：追加 v0.4.5 正式工作流、六附件、校验链、国内节点、未签名风险和最终安装状态边界。
- `docs/CONTINUE.md`：把 v0.4.5 从发布准备更新为正式发布验收完成，并记录 Git 传输失败时使用官方 Git Data API 创建同等注释标签的证据。
- `progress.md`：仅在末尾追加本轮发布操作、正式验收证据、文件清单和回滚方式。
- 回滚方式：对本轮文档验收提交执行 `git revert <this-task-commit>`；不得移动或覆盖 `v0.4.5` 及任何既有标签，不得卸载最终保留的 `D:\Forkline`，不得触碰受保护异常未跟踪文件。
## 2026-08-13 - Task: Prepare Forkline v0.4.6 desktop preference reliability release

### What was done

- Corrected the settings copy so Electron identifies Forkline local user data as the persistence location while Web and Web portable builds retain the browser-storage wording; completed the English translations.
- Made Electron preference mutations serialize per key, restore the last confirmed value when IPC rejects or returns `false`, prevent an older failure from undoing a later queued change, and notify the UI when the latest change cannot be persisted.
- Replaced direct preference JSON overwrites with same-directory temporary writes followed by rename, preserving the previous complete file and removing the temporary file after an interrupted write.
- Raised the application and installer contract version from `0.4.5` to `0.4.6`, and documented the unchanged Git, portable-update, NSIS updater, domestic acceleration, unsigned-installer, and immutable-tag boundaries.

### Testing

- `node --test --test-concurrency=1 tests/desktop-preference-storage.test.js tests/desktop-preference-store.test.js tests/settings-preference-copy.test.js tests/layout-ui.test.js` -> `65/65` passed, 0 failed and 0 skipped.
- The consecutive-write-failure regression was first observed failing with the optimistic value `graphite` instead of the last confirmed value `forest`; after the queue/confirmed-value fix the same regression passes.
- Full syntax, dependency, complete regression, installer build, package metadata, local `D:\Forkline` upgrade, signed-state and release-asset verification remain required before this task can be treated as released.

### Notes

- `package.json` - advanced the application and installer version to `0.4.6`.
- `package-lock.json` - synchronized the root package and workspace package versions to `0.4.6`.
- `electron/desktop-preference-store.js` - writes a complete temporary JSON file before replacing the stable preference file.
- `public/js/bootstrap.js` - subscribes to desktop preference persistence failures and shows the user warning.
- `public/js/desktop-preference-storage.js` - serializes per-key writes, tracks confirmed values, rolls back failed latest mutations and exposes a bounded failure subscription.
- `public/js/i18n-catalog.js` - adds complete English text for the Electron persistence descriptions and failure warning.
- `public/js/panels/settings.js` - separates Electron user-data copy from Web browser-storage copy.
- `tests/desktop-preference-storage.test.js` - covers rejection rollback, stale failure ordering, consecutive failures and failure subscriptions.
- `tests/desktop-preference-store.test.js` - fault-injects an interrupted temporary write and verifies the previous file remains intact.
- `tests/installer-package.test.js` - updates the installer version contract to `0.4.6`.
- `tests/layout-ui.test.js` - verifies the user-facing persistence failure warning and cleanup subscription.
- `tests/settings-preference-copy.test.js` - verifies Electron/Web wording separation and English translations.
- `README.md` - explains Electron persistence, rollback and atomic replacement behavior.
- `docs/ELECTRON_DESKTOP.md` - records per-key persistence ordering, user-visible failure handling and stable-file replacement.
- `docs/PACKAGING.md` - records the v0.4.6 release scope and immutable unsigned-release boundary.
- `docs/ARCHITECTURE.md` - documents the confirmed-value storage facade, atomic desktop store and regression seams.
- `docs/CONTINUE.md` - appends the v0.4.6 continuation and remaining validation gates.
- `progress.md` - appends this implementation and validation record without rewriting earlier history.
- Protected untracked file `n+fs.statSync(p.join('public'` remains outside the change list and must not be staged, modified or removed.
- Rollback before release: restore only the files listed above from `fe444115d72fecffa184c378c7ea6ecfb4bd9e76`, leaving the protected untracked file untouched. After release: revert the v0.4.6 release commit with a new commit and publish a new patch version; do not move an existing tag.

## 2026-08-14 - Task: 完成 Forkline v0.4.6 本机构建与安装发布门禁

### What was done

- 完成 v0.4.6 完整自动回归、依赖审计、安装器元数据和本机产物验真，并使用未签名安装器覆盖安装到 `D:\Forkline`。
- 验证设置页版本与稳定偏好恢复、4 条最近仓库、普通工作区文件查看、当前用户卸载登记、桌面/开始菜单快捷方式、安装版 ASAR 和正常退出无残留。
- 对首轮覆盖后卸载登记仍显示 `0.4.4` 的现场进行最小化诊断；排除硬编码、重复键、旧安装器元数据和注册表权限后，用同一哈希安装器完整覆盖复现，退出码 `0` 且登记立即更新为 `0.4.6`，因此未增加冗余产品代码。

### Testing

- 偏好、设置页和布局专项 `65/65` 通过。首轮完整回归 `363/364` 的唯一失败为 4000 文件冷扫描 `408.1 ms > 350 ms`；同一真实 Chromium 专项为 `274.8 ms`，后续两次完整回归均为 `364/364`，冷扫描分别为 `295.4 ms` 和提交前最终复核的 `298.6 ms`。
- `npm.cmd audit --audit-level=low` 为 0 个已知漏洞；`npm.cmd ls --depth=0` 确认 Electron `43.3.0`、electron-builder `26.15.3`、electron-updater `6.8.9` 完整。Node 语法、JSON、`git diff --check` 和调试残留扫描均通过。
- 安装器为 `100,603,608` 字节，SHA-256 `a3cc78668d820dce2c929c7b555489ae1e8ce42d8bfe2719b647d791518e7df1`，SHA-512 `3uV7GHgHBsGhO5ITclZoEYF7l/SNE5ap+en4D7tjvR7iPP2p5Mv2wAYN5bTu9jBWJZ1hVOUZ89KuzTJTflQfpw==`，Authenticode 为 `NotSigned`。blockmap SHA-256 为 `e189897ff0f785784915f6ada8fa5670d41b63991badec6f4173ea24121de771`，`latest.yml` SHA-256 为 `3306ca8a9d866ae9aca9ee9a6901d1d1a88df667f5e7770c74178e06edc6728d`；版本、文件名、大小和 SHA-512 均一致。
- 最终安装版程序版本 `0.4.6`、产品版本 `0.4.6.0`，HKCU 登记为 `Forkline 0.4.6`，桌面和开始菜单快捷方式均指向 `D:\Forkline`。设置页当前/最新均为 `v0.4.6`，显示“已是最新版本”，中文、深色、`75%`、4 条最近仓库和本机用户数据文案均正确。
- 普通未暂存文件 `配置文件5 (2) - 副本.txt` 两次打开成功，未出现 `Cannot read properties of null (reading 'ours')`。稳定偏好文件与备份 SHA-256 均为 `9e7e3e89a26e2c7ff9111ed9f30fef71ff402dff6f0fef09a4933d1ead36d10c`；测试脏文件与备份 SHA-256 均为 `f22338f52ef95050d4924a8bc990ad23d16052814e6c8cef4169d2f0b9b40f9`。
- 安装目录 ASAR SHA-256 为 `00100eadda9ac7c016464cce235c0070cadf22b18f35b57f846ae86973d26a85`，内部版本、入口和 `electron-updater` 依赖正确，本轮 5 个关键脚本与工作树逐字节一致。通过窗口关闭按钮退出后，安装目录相关应用、后台服务、Git/SSH 子进程和监听端口均为 `0`。
- 受保护异常未跟踪文件继续为 0 字节、SHA-256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`，未删除、未修改、未暂存、未提交。

### Notes

- `docs/PACKAGING.md`：追加 v0.4.6 本机产物、覆盖安装、登记诊断、设置页、数据哈希、ASAR 和退出验收证据。
- `docs/CONTINUE.md`：把 v0.4.6 更新为本机发布门禁完成，并记录提交、正式工作流和软件内更新剩余步骤。
- `progress.md`：仅在末尾追加本轮本机构建与安装验收、测试证据、文件清单和回滚方式。
- 回滚方式：提交前只删除上述三个文件末尾新增的 `2026-08-14`/`v0.4.6 本机安装验收` 段落；发布提交后执行 `git revert <v0.4.6-release-commit>` 创建新提交，不得移动 `v0.4.6` 或任何既有标签。若需要恢复安装前用户数据，先确认 Forkline 已退出，再从 `C:\Users\Administrator\AppData\Local\Temp\forkline-v0.4.6-local-e2e-535f22f8b3c84a1486468531338a4306` 按原路径恢复；不得触碰受保护异常文件。

## 2026-08-14 - Task: 完成 Forkline v0.4.6 正式发布、软件内更新终验与缓存清理

### What was done

- 核实不可移动的 `v0.4.6` 注释标签、正式 Release、安装器/便携包工作流和六个附件，并记录 GitHub digest、官方更新元数据、国内节点校验和未签名风险。
- 把正式 v0.4.5 覆盖安装到 `D:\Forkline`，通过 Electron CDP 的真实设置入口执行“立即更新并重启”，再对更新后的 v0.4.6 设置页、最近仓库、界面偏好、安装登记和正常退出进行终验；全程未使用 Computer Use。
- 删除本轮临时验收脚本、Playwright 下载缓存、v0.4.5 安装器、用户数据备份和已消费的 updater `pending` 副本；保留 updater 当前差分基线，并追加说明旧临时备份路径已经失效。

### Testing

- 当前完整 `npm.cmd test` 为 `364/364` 通过，0 失败、0 跳过，总耗时约 `114.8` 秒；真实 Chromium 4000 文件冷扫描为 `328.7 ms`，低于 `350 ms` 门限。
- `v0.4.6`、`HEAD` 和执行文档收尾前的 `origin/main` 均解引用到 `14193fcc33c4c39f4349e729e34ee3dfbdbd9369`。便携包工作流 `31763297562` 与安装器工作流 `31763297556` 均为 `success`，`headSha` 均为该发布提交。
- 正式 EXE、blockmap、便携 ZIP 的大小/SHA-256 分别为 `100,600,231`/`46d3f83bae1eae2c88155644e3c90536a9ff03fc44b5465791b71c96588f2b0a`、`105,772`/`b4588204e11b0f740578296a8793bfccbc21b1376757e1c6b99d528a12c8c9f9`、`36,699,971`/`a246f885605d9e31687952c9a4d9a70f5277fd1f1106385128c068b56132e3ca`；六附件全部匹配 GitHub digest，`latest.yml` 的 SHA-512 与正式 EXE 一致，Authenticode 为 `NotSigned`。
- 正式 v0.4.5 安装器通过实时 GitHub digest 和 SHA-256 `12a13f9d9e021486d66da05ec46816e37808f7bf8e46e538068a4295ff2fa34b` 验真后覆盖成功，程序和 HKCU 登记均为 `0.4.5`。CDP 更新前确认 `currentVersion=0.4.5`、`latestVersion=0.4.6`、`installMode=nsis` 和 4 条最近仓库；界面下载进度达到 `85%` 后旧实例退出，最终程序与 HKCU 登记均为 `0.4.6`。
- 更新器 `installer.exe` 和已消费的 pending EXE 均为 `100,600,231` 字节、SHA-256 `46d3f83bae1eae2c88155644e3c90536a9ff03fc44b5465791b71c96588f2b0a`。首次验收脚本因未采到退出前的瞬时第 4 阶段而保守报错，但磁盘版本、登记、缓存安装器和随后独立 CDP 启动共同证明产品更新成功；未把验收脚本时序误判为产品缺陷。
- 更新后 CDP 确认当前/最新均为 `v0.4.6`、“已是最新版本”、Electron 本机数据文案、中文、深色、`75%`、当前仓库和 4 条最近仓库正确。`desktop-ui-preferences.json`、`desktop-preferences.json`、`desktop-window-state.json` 更新前后 SHA-256 不变；最近仓库的路径、名称和分支语义一致，只更新当前条目的 `lastOpened`。通过页面关闭后安装目录进程及相关 Node/Git/SSH 子进程为 `0`。
- 清理目标共 `308,663,903` 字节（约 `294.4 MiB`），删除后 `%TEMP%` 的 `forkline-*` 项为 `0`，updater `pending` 不存在，当前差分基线仍存在。受保护异常文件仍为 0 字节、SHA-256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`，未删除、未修改、未暂存、未提交。

### Notes

- `docs/PACKAGING.md`：追加 v0.4.6 正式工作流、六附件、信任链、软件内更新、用户数据和缓存清理终验。
- `docs/CONTINUE.md`：把 v0.4.6 从“本机发布门禁完成”更新为正式发布和软件内更新全闭环，并使旧临时备份路径失效说明生效。
- `progress.md`：仅在末尾追加本轮正式发布终验、CDP 更新证据、缓存清理、文件清单和回滚方式。
- 回滚方式：对本轮文档收尾提交执行 `git revert <this-doc-closure-commit>`；该操作只回滚文档，不得移动或覆盖 `v0.4.6` 及任何既有标签，也不会卸载已经验证的 `D:\Forkline` v0.4.6。临时备份和缓存已按用户要求删除，不能通过文档回滚恢复；受保护异常文件不得触碰。

## 2026-08-14 - Task: 补充 Forkline v0.4.6 更新后延迟自动重启终验

### What was done

- 在文档收尾推送后的最终进程复核中发现更新器延迟启动了新的 Forkline 进程树；主进程命令行为 `Forkline.exe --updated`，确认这是 `autoRunAppAfterInstall` 的预期更新后自动重开，而不是用户手动启动或后台残留。
- 对自动重开的主窗口发送正常关闭，并修正发布验收文档，使“自动重开已发生”和“最终正常退出无残留”两个时序都得到准确记录。

### Testing

- 延迟自动重开进程树共 `5` 个 Forkline 进程，均位于 `D:\Forkline`，主进程 PID `30052` 带 `--updated` 参数并持有可见主窗口，子进程分别为 GPU、NetworkService、后台服务和 renderer。
- `CloseMainWindow()` 返回 `True`；安装目录进程树在 `20` 秒门限内归零，实际立即检查为 `0`，继续等待 `30` 秒仍为 `0`，未发生二次拉起。
- 最终安装版仍为文件版本 `0.4.6`、产品版本 `0.4.6.0`，HKCU 登记为 `Forkline 0.4.6`；`v0.4.6` 标签继续固定在 `14193fcc33c4c39f4349e729e34ee3dfbdbd9369`，未修改产品代码或 Release 资产。

### Notes

- `docs/CONTINUE.md`：补充 updater 延迟 `--updated` 自动重开及最终正常关闭后 30 秒无残留的时序证据。
- `docs/PACKAGING.md`：修正软件内更新验收说明，区分首次 CDP 终验关闭与 updater 后续自动重开。
- `progress.md`：仅在末尾追加本轮延迟重启诊断、验证证据、文件清单和回滚方式。
- 回滚方式：对本轮文档修正提交执行 `git revert <this-delayed-restart-doc-commit>`；不得回滚或移动 `v0.4.6` 标签，不得卸载最终保留的 `D:\Forkline` v0.4.6，不得触碰受保护异常未跟踪文件。

## 2026-08-14 - Task: Prepare Forkline v0.4.7 Electron 43.4.0 reliability release and clean validation cache

### What was done

- Advanced the application and installer contract from `0.4.6` to `0.4.7` and upgraded Electron from `43.3.0` to `43.4.0`, incorporating confirmed Windows shutdown/restart and rapid-menu-switch crash fixes without changing Forkline product logic.
- Revalidated source Electron, the local unsigned installer, overwrite install, uninstall with user-data retention, clean reinstall to `D:\Forkline`, repository/file viewing, shortcuts, current-user registration and graceful shutdown.
- Preserved the existing Web, Git fast-forward, portable, NSIS updater, domestic acceleration, unsigned-release and immutable-tag boundaries; cleaned only this task's generated validation/build caches after their evidence was recorded.

### Testing

- Electron/installer focused regressions were `37/37`; the final `npm.cmd test` was `364/364`, 0 failed and 0 skipped, with total duration about `119.5` seconds. The real Chromium 4000-file cold scan was `311.8 ms`, below the `350 ms` limit.
- `npm.cmd audit --audit-level=low` reported 0 vulnerabilities. `npm.cmd outdated --cache dist\npm-outdated-cache --prefer-online` completed with no outdated dependencies, and `npm.cmd ls --depth=0` confirmed Electron `43.4.0`, electron-builder `26.15.3` and electron-updater `6.8.9`.
- Electron's official `v43.4.0` notes confirm fixes for a Windows logoff/shutdown/restart browser-process crash, a heavy-load rapid-menu-switch crash, and upstream Chromium/ANGLE/V8 fixes. Source CDP reported `Electron/43.4.0`, `currentVersion=0.4.7`, `installMode=git`; packaged CDP reported `Electron/43.4.0`, `currentVersion=0.4.7`, `installMode=nsis`. The formal repository and `package.json` opened without new diagnostics or console errors.
- The local EXE was `100,615,388` bytes with SHA-256 `792de7e45b9da71bd4972118f06f4e87095dde2cd53cadfed174730151933063`, SHA-512 `7AFrbWfTgP11sbUU7NAVxdbDPNvLZSJ/6DyVLlV9hM7AdrWi+D0PljgfB7MFZVRQEnTBjrdE9kTcLsQjGLI5PA==` and Authenticode `NotSigned`. The blockmap SHA-256 was `a1445919b41e9b8a46abbccf7e3508ae5966d74667d56a5f6474ac76d032e1e2`; `latest.yml` SHA-256 was `59301b2bf6a44a4b8b6fbd6b21e4d6e49841395ffcf755585feb1b790333a551`; the ASAR SHA-256 was `9b5ea34efa8432a8dfbf313e6146866eb51d5fc524c168a973f878698097a0b1`.
- The v0.4.6 overwrite install, uninstall and fresh v0.4.7 install all exited `0`. Final `D:\Forkline\Forkline.exe` has file version `0.4.7`, product version `0.4.7.0`; HKCU shows `Forkline 0.4.7`, both shortcuts target `D:\Forkline`, and no Forkline process remained after normal exit.
- Stable UI and zoom preference hashes matched their pre-install backups. The window state changed only through normal launches, while all 5 recent repository paths, names and branches remained identical and only the current repository `lastOpened` changed.
- Removed `474,254,953` bytes (about `452.3 MiB`) of exact task-owned `dist` build output, CDP/ASAR scripts, test profiles, validation backup and one-time npm cache. The v0.3.0 portable ZIP/checksum, installed v0.4.7, user data and updater differential baseline remain; the real updater has no `pending` directory.
- The pre-commit index contained exactly the 8 named target files. A local `main` release commit was created; GitHub authentication remains invalid, so no push, v0.4.7 tag or Release has been created yet.
- Protected untracked file `n+fs.statSync(p.join('public'` remains 0 bytes with SHA-256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`; it was not deleted, modified, staged or committed.

### Notes

- `package.json` - advances the application and installer version to `0.4.7` and Electron to `^43.4.0`.
- `package-lock.json` - synchronizes the root version and resolved Electron `43.4.0` package.
- `tests/installer-package.test.js` - fixes the release contract at `0.4.7` and Electron `^43.4.0`.
- `README.md` - explains the Electron runtime reliability update and unchanged product boundaries.
- `docs/ELECTRON_DESKTOP.md` - records the v0.4.7 runtime scope and unchanged IPC/security boundary.
- `docs/PACKAGING.md` - records the local build, install lifecycle, data-retention, cache-cleanup and remaining formal-release gates.
- `docs/CONTINUE.md` - records the current verified continuation point and invalid GitHub credential blocker.
- `progress.md` - appends this implementation, verification, cleanup, file list and rollback record without rewriting history.
- Rollback before release: restore only the files listed above from `7c3c1ae000c76a97cc0eb32ac87c005d9cb6dcd3`, leaving the protected untracked file untouched. After release: revert the v0.4.7 release commit with a new commit and publish a later patch; never move `v0.4.7`, `v0.4.6` or any existing tag. Deleted temporary caches and validation backups are not recoverable through Git rollback; current user data remains installed and preserved.

## 2026-08-14 - Task: 完成 Forkline v0.4.7 正式发布、软件内更新终验与缓存清理

### What was done

- 核实 v0.4.7 不可移动注释标签、正式 Release、安装器/便携包工作流和六个正式附件，记录 GitHub digest、官方更新元数据、未签名风险和便携包内容边界。
- 把正式 v0.4.6 安装到 `D:\Forkline`，通过 Electron CDP 的真实设置入口执行“立即更新并重启”，验证国内加速下载、旧实例退出、安装、`--updated` 自动重开、最终设置页、最近仓库和文件查看；全程未使用 Computer Use。
- 恢复本轮验收产生的界面长任务诊断，精准删除验证目录和 updater 已消费副本；保留 v0.3.0 正式便携产物、v0.4.7 安装、真实用户数据和 updater 差分基线。

### Testing

- 发布提交 `90a0d7071f354a66d0a40a3ae1679984757c9cd2` 已推送；安装器工作流 `31780695796` 与便携包工作流 `31780695825` 均为 `success`，正式回归 `364/364` 通过。Release 为 Latest、非草稿、非预发布，`v0.4.7` 标签未移动。
- 正式 EXE/blockmap/便携 ZIP 的大小和 SHA-256 分别为 `100,612,066`/`d52eec77a9953819ee879be666ffec02222f8e5ffd63eda67ebeed6f5e26d5c3`、`105,351`/`da17581b906a1209cb0ac05fdd223eb50d2042cae03dce3c83d0fa213bf3bb9a`、`36,718,092`/`4b3082ca0a5657aaad3af1a636c5cce7d17a581f8aff317c3e7df19580d54715`；六附件全部匹配 GitHub digest。`latest.yml` SHA-256 为 `6cb5f5c13c651710a68e25e633501d9c281b0edef632023dad3897254f909d48`，SHA-512 与正式 EXE 一致，Authenticode 为 `NotSigned`。
- 更新前真实设置页确认 `currentVersion=0.4.6`、`latestVersion=0.4.7`、`installMode=nsis`、5 条最近仓库和可点击更新按钮。点击确认后下载从 `0%` 到 `100%`，旧实例退出；最终文件版本和 HKCU 登记均为 `0.4.7`，自动重开主进程命令行包含 `--updated`。
- Chromium 全局网络日志捕获 `ghfast.top` 的正式 blockmap `200` 响应和安装器字节范围请求。updater 缓存 EXE 为 `100,612,066` 字节，SHA-256 `d52eec77a9953819ee879be666ffec02222f8e5ffd63eda67ebeed6f5e26d5c3`，SHA-512 `kn2kYPBIV+oSHA6128wssEKfFyhm7058zyiJj0HO/smgo1Uz5kHExiKmaAIX2tUqGmNJJAZF2fqINM396GLUZA==`，签名状态 `NotSigned`。
- 更新后 CDP 确认用户代理包含 `Electron/43.4.0`，设置页当前/最新均为 `v0.4.7` 且“已是最新版本”。真实工作区 0 字节未跟踪文件打开和关闭成功，状态为 `UTF-8 · LF · 0 B`，冲突版本已归一化，无新增错误诊断或控制台错误；受保护文件仍为 0 字节、原写入时间和 SHA-256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`。
- `desktop-preferences.json` 与备份哈希一致；本轮新增的 7 条长任务诊断已原子恢复，`desktop-ui-preferences.json` 最终 SHA-256 为 `9e7e3e89a26e2c7ff9111ed9f30fef71ff402dff6f0fef09a4933d1ead36d10c`。5 条最近仓库的路径、名称和分支完全一致，只更新当前仓库 `lastOpened`；窗口状态只发生正常启动关闭变化。
- 正常关闭最终实例后 Forkline 进程立即为 `0`，等待 `30` 秒仍为 `0`。删除验证目录 `475,272,394` 字节和 updater `pending` `100,717,658` 字节，合计 `575,990,052` 字节；删除后两处均不存在，updater 安装器/`current.blockmap` 基线和两份 v0.3.0 正式便携产物仍存在。

### Notes

- `docs/PACKAGING.md`：追加 v0.4.7 正式工作流、六附件、国内加速运行时网络证据、软件内更新、数据保留、退出和缓存清理终验。
- `docs/CONTINUE.md`：把 v0.4.7 从本机发布门禁更新为正式发布和软件内更新完整闭环，并说明后续只能发布新补丁版本。
- `progress.md`：仅在末尾追加本轮正式发布终验、CDP 更新、文件查看、数据恢复、缓存清理、文件清单和回滚方式。
- 回滚方式：对本轮文档收尾提交执行 `git revert <this-v0.4.7-doc-closure-commit>`；该操作只回滚上述三个文档，不得移动或覆盖 `v0.4.7`、`v0.4.6` 或任何既有标签，也不得卸载最终保留的 `D:\Forkline` v0.4.7。临时验证目录、备份和 updater `pending` 已按用户要求删除，不能通过 Git 回滚恢复；受保护异常未跟踪文件不得修改、暂存、提交或删除。

## 2026-08-14 - Task: 提交详情正文随完整消息自动展开

### What was done

- 保留右侧提交详情正文框原有 `132px` 可用最小高度，移除 `220px` 最大高度限制，并让正文框按完整提交消息自动向下撑开。
- 正文超过原上限后不再依赖框内纵向滚动；摘要、历史改写保存、提交操作、右侧详情面板整体滚动和 Git 语义保持不变。
- 补充布局回归并同步继续开发文档，明确后续不得重新引入正文最大高度。

### Testing

- 修改前运行 `node --test tests/layout-ui.test.js`：新增回归稳定为 `51/52`，唯一失败是正文框缺少无上限内容尺寸规则；修改后该文件 `52/52` 通过。
- 使用真实 Edge 打开独立临时 Git 仓库，先选择短正文提交并切换提交详情；长正文包含 276 个字符和 10 段内容，正文框实际 `clientHeight = scrollHeight = 453px`、外框约 `455px`，计算样式为 `field-sizing: content`、`max-height: none`，超过旧 `220px` 上限后仍完整展示。
- 运行完整 `npm.cmd test`：`364/364` 通过，0 失败、0 跳过，总耗时约 `116.3` 秒；真实 Chromium 历史文件、3012 条提交、4000 文件工作区、Electron、安装器更新和 Git 集成回归均通过。
- 本轮 Playwright 浏览器、页面快照和临时测试仓库均已关闭或删除；正式仓库受保护异常未跟踪文件保持未修改、未暂存、未提交。

### Notes

- `public/styles.css`：让历史提交正文输入框保留最小高度并按完整内容自动展开，取消原最大高度限制。
- `tests/layout-ui.test.js`：固定正文框最小高度、内容尺寸和无最大高度的布局契约。
- `docs/CONTINUE.md`：更新提交详情正文区域的当前布局行为和整体滚动边界。
- `progress.md`：仅在末尾追加本轮实现、验证、清理、文件清单和回滚方式。
- 回滚方式：提交前执行 `git restore -- public/styles.css tests/layout-ui.test.js docs/CONTINUE.md progress.md`；若本轮之后单独提交，则执行 `git revert <该提交哈希>`。两种方式都不得触碰异常未跟踪文件 `n+fs.statSync(p.join('public'`。

## 2026-08-24 - Task: 工作区与暂存区支持目录批量选择

### What was done

- 为工作区和暂存区的层级文件树增加独立的目录选择控件，支持全选、取消全选和部分选中状态；目录折叠与目录选择互不冲突。
- 目录选择按当前筛选范围更新完整选择集合，隐藏在虚拟化批次之外的文件也会被纳入批量操作；选择过程只更新现有 DOM 行和操作按钮状态，不触发整棵文件树重建。
- 调整虚拟化上限计算，使目录批量选择不会因最后一个隐藏选中文件而扩展到全量；单文件选择仍能保留目标行可见，并同步更新中文/英文提示、README 和继续开发记录。

### Testing

- `node --check public\\js\\features\\file-tree.js` 通过。
- `node --check public\\js\\features\\worktree-changes.js` 通过。
- `node --test tests\\file-editor-ui.test.js`：`35/35` 通过；覆盖目录全选/取消、隐藏文件选择不触发重建、单文件选择仍可扩展到目标行。
- `npm.cmd run test:browser`：`1/1` 通过；真实 Chromium 4000 文件工作区确认初始/目录选择后仍为 `800` 行，目录选择集合为 `4000` 个，虚拟化上限保持 `800`，取消后选择数为 `0`；冷扫描约 `283.0 ms`，批量加载最终 `4000` 行，监听器新增 `0`。

### Notes

- `public/js/features/file-tree.js`：增加目录选择控件、目录范围选择和三态视觉状态更新。
- `public/js/features/worktree-changes.js`：让虚拟化上限只为当前单文件选择保留可见范围，避免目录批量选择扩展全量渲染。
- `public/styles.css`：增加目录选择控件及三态勾选样式。
- `public/js/i18n-catalog.js`：补充中英文目录选择提示。
- `tests/file-editor-ui.test.js`：新增目录批量选择和虚拟化边界回归。
- `tests/browser-performance.test.js`：新增真实 4000 文件目录选择与虚拟化验收。
- `README.md`：说明目录批量选择和大工作区渲染边界。
- `docs/CONTINUE.md`：追加 v0.4.8 目录选择实现和验证结论。
- `progress.md`：追加本轮实现、测试、文件清单和回滚点。
- 回滚方式：本轮尚未单独提交；如继续发布，随 v0.4.8 发布提交形成回滚点，之后使用 `git revert <v0.4.8 发布提交>` 回滚本轮整体变更。回滚或提交时均不得触碰、暂存或删除异常未跟踪文件 `n+fs.statSync(p.join('public'`。

## 2026-08-24 - Task: 文件夹打开入口解析仓库边界

### What was done

- 文件夹选择器现在从当前浏览目录向上解析最近的 Git 仓库根目录；唯一直接子仓库容器自动进入该仓库，多仓库容器返回候选并保持打开按钮禁用，不再把容器目录误当作仓库。
- 文件夹“打开”操作改用后端解析出的仓库根目录；无仓库和多仓库情况分别给出明确提示，Web、便携版和 Electron 共用同一语义。

### Testing

- 当前完整回归 `npm.cmd test`：`383/383` 通过，0 失败、0 跳过；其中包含仓库子目录、唯一容器、多仓库歧义和文件夹打开分流回归。
- `tests/api-repo-context.test.js` 与 `tests/folder-command-loader.test.js` 的仓库解析和打开入口专项回归通过。

### Notes

- `server/repository-browse-service.js`：增加最近仓库根目录、唯一容器和多仓库候选解析。
- `public/js/api.js`：传递浏览结果中的仓库根目录与候选信息。
- `public/js/features/folder-command-implementation.js`：按解析结果启用或禁用打开入口并显示提示。
- `public/js/features/repositories.js`：复用解析后的仓库路径打开目录。
- `tests/api-repo-context.test.js`、`tests/folder-command-loader.test.js`：覆盖解析与 UI 分流边界。
- `docs/CONTINUE.md`、`progress.md`：记录产品边界和验证结论。
- 回滚方式：提交前执行 `git restore -- server/repository-browse-service.js public/js/api.js public/js/features/folder-command-implementation.js public/js/features/repositories.js tests/api-repo-context.test.js tests/folder-command-loader.test.js docs/CONTINUE.md progress.md`；不得触碰异常未跟踪文件 `n+fs.statSync(p.join('public'`。

## 2026-08-24 - Task: Diff 弹窗关闭后的焦点恢复

### What was done

- 最大化 Diff 记录打开前焦点；关闭或按 Escape 后优先恢复仍有效的打开控件，右键入口若原焦点属于其他文件则按当前 Diff 文件和范围恢复对应文件行。
- 保留现有最大化渲染、横向滚动、滚动位置恢复和关闭时清空行 DOM 的行为，不改变 Git 操作语义。

### Testing

- `node --check public\\js\\features\\diff-workbench-loader.js` 通过。
- `node --test tests\\diff-workbench-loader.test.js`：`8/8` 通过，覆盖正常焦点恢复和右键旧焦点不串文件。
- 真实 Chromium 打开正式仓库 `public/js/api.js` 的工作区 Diff：弹窗显示 `scrollWidth=2156`、`clientWidth=1896`；实际横向滚动后 `scrollLeft=260.44775390625`；关闭后弹窗隐藏，焦点恢复到 `data-file=public/js/api.js` 的未暂存文件行。

### Notes

- `public/js/features/diff-workbench-loader.js`：增加焦点记录、有效性判断和当前文件行回退恢复。
- `tests/diff-workbench-loader.test.js`：增加关闭 Diff 后焦点恢复回归。
- `docs/CONTINUE.md`、`docs/ARCHITECTURE.md`：同步 Diff 焦点行为和模块职责。
- `progress.md`：仅在末尾追加本轮实现、验证和回滚点。
- 回滚方式：提交前执行 `git restore -- public/js/features/diff-workbench-loader.js tests/diff-workbench-loader.test.js docs/CONTINUE.md docs/ARCHITECTURE.md progress.md`；若已随 v0.4.8 提交，则执行 `git revert <v0.4.8 发布提交>`，任何方式均不得触碰异常未跟踪文件 `n+fs.statSync(p.join('public'`。

## 2026-08-24 - Task: Forkline v0.4.8 发布前性能与本机安装验收

### What was done

- 在正式仓库当前状态下重新建立大工作区性能基线；确认 `127.0.0.1:5177` 当前无监听者，未触碰交接中要求保护的异常未跟踪文件或其他 PID。此前超过门限的结果未被放宽或通过修改测试掩盖。
- 完成本机 v0.4.8 Windows x64 NSIS 构建，并在独立临时目录完成当前用户安装、启动、后台服务可用、正常关闭、卸载、快捷方式移除和用户数据保留验收；现有 `D:\Forkline` v0.4.7 未被覆盖。

### Testing

- `npm.cmd run test:browser`：`1/1` 通过；4000 文件工作区冷 API `281.8 ms`，低于不可放宽的 `350 ms` 门限；连续无变化 API 中位数 `57.1 ms`，变更后 API `81.6 ms`。
- `npm.cmd test`：`385/385` 通过，0 失败、0 跳过；完整套件中的大工作区冷 API 为 `325.4 ms`，仍低于 `350 ms`。`npm.cmd audit --audit-level=low` 为 0 个漏洞；Node 语法和 `git diff --check` 无错误。
- 本机构建使用 electron-builder `26.15.3`、Electron `43.4.1`。`Forkline-Setup-0.4.8-windows-x64.exe` 为 `104,605,702` 字节，SHA-256 `90a005f85afb508710a0852479f26cc273ea1df0342aa13f5550692258eaae04`，SHA-512 `0D6717BF55C505B19CCC99006353ED56E511FF9A2FC54E80D91EC583F1EFA0B90774EB27C8F5530615E8B035575F0FD906789DF77FCCD0DE706B15980E159EAF`；blockmap 为 `111,627` 字节，SHA-256 `053a0b585820bb3dd7cc3979aef5591c94c16e95c6a3b439935ee40e9388dc65`；`latest.yml` 为 `369` 字节，SHA-256 `02c9395eb8819a48dd886fad96aeb578f45e3471d93dd5cc44fe7a347ffcc35`。`latest.yml` 的版本、文件名、大小和 SHA-512 与 EXE 一致；Authenticode 如实为 `NotSigned`。
- 临时安装目录 `C:\Users\Administrator\AppData\Local\Temp\forkline-v0.4.8-local-e2e` 的安装器退出码为 `0`；实际文件版本 `0.4.8`、产品版本 `0.4.8.0`，HKCU 当前用户登记为 `Forkline 0.4.8`，桌面和开始菜单快捷方式均指向该目录。启动后主窗口标题为 `Forkline Web`，后台服务监听 `57843`，首页和 `/api/state?details=core` 均为 HTTP `200`；正常关闭后安装目录进程树归零。
- 临时卸载器退出码为 `0`；临时安装目录、HKCU 登记和两个快捷方式均已移除，`%APPDATA%\forkline` 仍存在，四个稳定用户数据文件的字节数和 SHA-256 与卸载前一致。
- 受保护异常未跟踪文件仍为 `0` 字节、SHA-256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`，未删除、未修改、未暂存、未提交。GitHub CLI 当前令牌无效，`git ls-remote` 报 `SEC_E_NO_CREDENTIALS`，因此尚未推送、打标签或创建 v0.4.8 Release。

### Notes

- `docs/PACKAGING.md`：追加 v0.4.8 本机产物、安装/启动/卸载和发布前门禁证据。
- `docs/CONTINUE.md`：追加 v0.4.8 当前续接点、性能结论和剩余远端发布门禁。
- `progress.md`：仅在末尾追加本轮诊断、验证、文件清单和回滚点。
- `dist/installer/Forkline-Setup-0.4.8-windows-x64.exe`、`.blockmap`、`latest.yml`、`.sha256`：本机构建验证产物，尚未作为正式 Release 附件发布。
- 回滚方式：提交前执行 `git restore -- docs/PACKAGING.md docs/CONTINUE.md progress.md`；若已提交则执行 `git revert <本轮文档提交>`。不得移动既有标签，不得使用 `git clean`、`git add .` 或触碰异常未跟踪文件。

## 2026-08-24 - Task: 完成 Forkline v0.4.8 正式发布、软件内更新终验与隔离现场清理

### What was done

- 对已发布的 v0.4.8 Release、安装器/便携包工作流、六个附件 digest、`latest.yml` SHA-512 和未签名风险完成收尾记录；`main`、`origin/main`、`v0.4.8` 与既有标签边界保持不变。
- 在不存在 `D:\Forkline` 的事实基础上，使用临时隔离 v0.4.7 安装基线执行真实 Electron 设置页“立即更新并重启”；确认 updater 完成替换后，v0.4.8 页面、后台服务、用户偏好和最近仓库均可用。
- 记录静默安装未生成 HKCU 卸载登记、静默卸载器只移除快捷方式而未清除异常安装目录的现场异常；确认进程归零后删除两处明确的隔离 TEMP 目录，保留真实用户数据和 updater 缓存基线。

### Testing

- 正式发布证据：Release ID `375395807`；安装器工作流 `32681983878`、便携包工作流 `32681983853`；发布提交/标签目标 `377c7fe7c1dc19e4b060894fca55deb00a1ab16f`。正式 EXE 为 `104602003` 字节、SHA-256 `be63579913237ddbdba4b2e8b9af5b1f514aa02b9fa71e942c9abdeb53ccdee1`，blockmap 为 `111478` 字节、SHA-256 `d8d9528ecdfe85b9bdf76a1eb472c30a252510a6808f98267ba7f7957938f8da`，便携 ZIP 为 `36769362` 字节、SHA-256 `3f0e3ec9d4036e9cf044f5b79471d283e35c04aff2528c1cc08f3bae53627489`；其余三个附件 digest 和 `latest.yml` SHA-512 已同步写入 `docs/`。Authenticode 为 `NotSigned`。
- 隔离 v0.4.7 安装器退出码 `0`，更新前真实页面为 `v0.4.7 → v0.4.8`；确认后旧端口 `56299` 释放，更新后安装目录文件/产品版本为 `0.4.8/0.4.8.0`，新服务端口 `59137` 的首页、`/api/state?details=core` 和 `/api/operations` 检查通过，Git/SSH 子进程为 `0`。
- 更新后真实 Electron 设置页显示当前/最新均为 `v0.4.8`、状态“已是最新版本”，中文、深色、`80%` 缩放和最近仓库均保留；正常关闭后 Forkline 进程和监听端口为 `0`。`D:\Forkline` 从始至终不存在，未被覆盖。
- 静默卸载器退出码 `0`；HKCU 卸载登记不存在，快捷方式已移除但异常隔离安装目录仍在，之后仅删除已验证的两处 TEMP 隔离目录。真实 `%APPDATA%\forkline` 仍存在；异常未跟踪文件仍为 0 字节，SHA-256 `e3b0c44298fc1c149af4c8996fb92427ae41e4649b934ca495991b7852b855`，未修改、未暂存、未提交。
- 本轮未重跑自动测试套件；前一条发布前门禁已记录 `npm.cmd test` `385/385` 和浏览器性能专项 `1/1`，本轮专门补充正式 Release 后的软件内更新、重启、用户数据和退出残留验收。

### Notes

- `docs/CONTINUE.md`：追加 v0.4.8 正式 Release、正式附件摘要、隔离更新终验、D:\Forkline 不存在事实和卸载登记异常。
- `docs/PACKAGING.md`：追加 v0.4.8 发布附件、NSIS/便携边界、未签名风险、更新链路和隔离清理结果。
- `progress.md`：追加本轮正式发布终验、测试证据、异常边界、文件清单和回滚点。
- 回滚方式：提交前执行 `git restore -- docs/CONTINUE.md docs/PACKAGING.md progress.md`；提交后使用 `git revert <本轮文档收尾提交>`。该回滚不恢复已删除的隔离临时目录，也不触碰 `%APPDATA%\forkline`、`AppData\Local\forkline-updater`、异常未跟踪文件或任何既有标签。

## 2026-08-24 - Task: Forkline 多项界面问题修复收尾

### What was done

- Git 忙碌提示、更多面板重复选择、工作区/暂存区 Ctrl/Cmd+A、Escape 关闭 Toast、快捷键说明和提交图谱水平滚动已完成收尾。

### Testing

- 8 个本轮源码/测试文件 `node --check` 全部通过。
- 定向回归 `node --test tests\\keyboard-shortcuts.test.js tests\\layout-ui.test.js tests\\api-repo-context.test.js tests\\settings-preference-copy.test.js`：`70/70` 通过。
- 全量回归 `npm.cmd test`：`389/389` 通过，0 失败、0 跳过。
- 浏览器专项 `npm.cmd run test:browser`：`1/1` 通过；4000 文件工作区冷 API `299.4 ms`，低于 `350 ms` 门限；真实 Chromium 的选择器重置、Toast Escape 关闭、历史图谱滚动和大工作区性能均通过。
- `git diff --check` 通过；保护文件 `n+fs.statSync(p.join('public'` 保持 0 字节，SHA-256 为 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`，未被修改、暂存或提交。

### Notes

- `public/js/api.js`：Git 动作名称中文化。
- `public/js/app/events.js`：快捷键分流、Escape Toast 关闭和“更多”选择器重置。
- `public/js/features/file-tree.js`：工作区/暂存区当前筛选范围全选。
- `public/js/features/folder-command.js`：重渲染后保持“更多”选择器占位状态。
- `public/js/i18n-catalog.js`、`public/js/panels/settings.js`、`public/settings.css`：快捷键说明与双语文案。
- `public/styles.css`：提交图谱统一水平滚动边界。
- `tests/api-repo-context.test.js`、`tests/layout-ui.test.js`、`tests/settings-preference-copy.test.js`、`tests/browser-performance.test.js`、`tests/keyboard-shortcuts.test.js`：对应回归覆盖。
- 回滚方式：提交前对以上已跟踪文件执行 `git restore -- <file list>`，按需删除新增的 `tests\\keyboard-shortcuts.test.js`；提交后使用 `git revert <本轮提交>`。不得触碰保护文件、`.playwright-cli/` 或既有标签。

## 2026-08-24 - Task: Forkline v0.4.9 发布前安装器闭环与快捷方式修正

### What was done

- 将 NSIS 桌面快捷方式策略改为 `"always"`，并完成 v0.4.9 安装器重建。
- 完成全新交互式隔离安装、启动、后台服务检查、正常关闭、卸载和快捷方式清理；保留用户手动安装的 `D:\Forkline`。

### Testing

- 安装版 `0.4.9/0.4.9.0`，HKCU 登记 `Forkline 0.4.9`，后台端口 `63247`，窗口响应正常。
- `D:\桌面\Forkline.lnk` 和 `%APPDATA%\\Microsoft\\Windows\\Start Menu\\Programs\\Forkline.lnk` 均正确指向隔离安装目录；正常关闭后进程归零，卸载退出码 `0`，安装目录、登记和快捷方式均已移除。
- 安装器 `104606437` 字节，SHA-256 `09f38e2a9c06ae17038f0716bf41dba7c113ad9379405590a11c7fe961c3f7d3`；blockmap `111630` 字节，SHA-256 `4848f743c97dd40c31919e6426df7f0bd6b17a6f5eedf433f52f64111303a548`；`latest.yml` SHA-256 `b39850cd5deae8a13925e35e6720e44564f77511bc32345f68258c42b23cb243`；签名状态 `NotSigned`。
- Node 语法检查、`git diff --check`、`npm.cmd test` `389/389`、`npm.cmd run test:browser` `1/1` 全部通过。

### Notes

- `package.json`：桌面快捷方式策略从 `true` 改为 `"always"`。
- `tests/installer-package.test.js`：更新安装器契约断言。
- `docs/PACKAGING.md`、`docs/CONTINUE.md`、`progress.md`：追加 v0.4.9 发布前安装器和测试记录。
- 回滚方式：提交前恢复上述文件；提交后执行 `git revert <本轮提交>`。不得使用 `git clean`、`git add .`、`git reset --hard`，不得触碰异常未跟踪文件、`.playwright-cli/` 或既有标签。

## 2026-08-25 - Task: Forkline v0.4.9 正式发布收尾

### What was done

- 创建中文 GitHub Release `v0.4.9`，安装器和便携包工作流均成功，六个正式附件已上传。
- 完成官方 Release 附件重新下载、GitHub digest、两个 `.sha256` 文件、`latest.yml` 和便携 ZIP 内容复核；清理本轮明确创建的下载验证目录。

### Testing

- Release URL：`https://github.com/AsphyxiaChoke/Forkline/releases/tag/v0.4.9`；标签/产品提交：`ea43966a2ff5295aedf528bc3578eb61f5dbcbf5`。
- 工作流 `32747708600`、`32747709108` 均成功；正式六附件本机 SHA-256 与 GitHub API digest 全部一致。
- EXE/ZIP 校验文件分别匹配主附件；`latest.yml` 版本 `0.4.9`、大小 `104603086`、SHA-512 均匹配；便携 ZIP 含 `.git`、`runtime/node.exe`、`Forkline.cmd`、`start.cmd` 和 `docs/`；安装器签名状态 `NotSigned`。
- 异常未跟踪文件长度 `0`、SHA-256 `e3b0c44298fc1c149af4c8996fb92427ae41e4649b934ca495991b7852b855`，未修改、未暂存、未提交；`.playwright-cli/` 未跟踪且未触碰。

### Notes

- `docs/PACKAGING.md`、`docs/CONTINUE.md`、`progress.md`：追加正式发布验收记录。
- 回滚方式：提交前恢复这三份文档；提交后使用 `git revert <本轮文档提交>`。不得删除 Release 附件、移动任何既有标签或触碰保护对象。
- 发布收尾后的 `D:\Forkline` 保留为 v0.4.9 当前用户安装，HKCU 卸载登记和桌面/开始菜单快捷方式均已恢复，目标均指向 `D:\Forkline`，程序版本为 `0.4.9/0.4.9.0`。

## 2026-08-28 - Task: Forkline v0.4.10 修复、安装器验收与发布准备

### What was done

- 修复文件编辑器 Diff 高亮导致的代码文字不清晰问题，并完成页面级“撤销/恢复”闭环：安全的暂存、取消暂存和提交操作支持撤销与恢复；暂存撤销只恢复 Git index，不改动工作区文件；输入框、文本域和 CodeMirror 保持原生编辑撤销行为。
- 将应用、锁文件和安装器契约版本升至 `0.4.10`，同步中文使用说明、架构说明、打包说明和续接记录。
- 生成 Windows x64 NSIS 本机构建包；完成隔离安装文件落地、启动、真实页面版本/标题、后台服务 HTTP `200`、关闭后进程与端口归零验证。现有 `D:\Forkline` v0.4.9 未被覆盖。

### Testing

- `npm.cmd test`：`394/394` 通过，0 失败、0 取消、0 跳过；版本升档后再次运行，命令显示 `forkline@0.4.10`。
- `npm.cmd run test:browser`：`1/1` 通过；4000 文件工作区冷 API `337.4 ms`，低于 `350 ms` 门限。
- `node --check server.js`、`node --check public\\js\\features\\recovery-undo.js`、`node --check public\\js\\app\\events.js` 通过；安装器契约测试通过；`git diff --check` 无差异错误。
- 本机构建：`Forkline-Setup-0.4.10-windows-x64.exe` 为 `104691603` 字节，SHA-256 `5af9f04c0e0348b27bdfbf6fdc91d2f9d1a571864f989ee906a08ec47b678dc7`；blockmap 为 `111514` 字节，SHA-256 `2efb6ab9e451a33ef1461a689d6831bf0027881952c66ddf1cfddd3af9fc2b96`；`latest.yml` 为 `372` 字节，SHA-256 `c8504eb014472df08f633df62559c88755323f820da55b011ca5ce7fc5263ee5`，版本、安装器大小和 SHA-512 均一致；Authenticode 为 `NotSigned`。
- 隔离安装器退出码为 `0`，程序文件/产品版本为 `0.4.10/0.4.10.0`；独立用户数据启动后窗口标题 `Forkline Web`，设置页显示 `v0.4.10`，首页和核心状态接口返回 `200`；关闭后该安装目录 Forkline 进程、后台端口和调试端口均为 `0`。
- 静默卸载器退出码为 `0`，但没有可见 HKCU 卸载登记/快捷方式且隔离目录仍在；已如实标记为安装器现场异常，没有把它写成标准交互式卸载通过。验证结束后仅删除了本轮明确创建的 16 个 TEMP 隔离目录/日志；`D:\Forkline` 仍为 `0.4.9/0.4.9.0`。
- 受保护异常未跟踪文件 `n+fs.statSync(p.join('public'` 保持 0 字节、SHA-256 `e3b0c44298fc1c149af4c8996fb92427ae41e4649b934ca495991b7852b855`，未修改、未暂存、未提交；`.playwright-cli/` 同样未触碰。

### Notes

- `README.md`：补充页面级撤销/恢复行为和输入控件原生撤销边界。
- `docs/ARCHITECTURE.md`：补充 index tree、提交恢复点、快照守卫和撤销/恢复栈交换分层。
- `docs/CONTINUE.md`：追加 v0.4.10 发布准备、测试、安装和已知现场异常。
- `docs/PACKAGING.md`：追加 v0.4.10 本机构建、校验、启动关闭和安装器异常证据。
- `package.json`：版本升至 `0.4.10`。
- `package-lock.json`：同步根包和锁包版本至 `0.4.10`。
- `public/file-editor.css`：降低 Diff 插入/删除高亮不透明度，保留边框、下划线和颜色标识。
- `public/index.html`：增加中文“恢复”按钮。
- `public/js/app/events.js`：绑定撤销/恢复按钮和页面级快捷键，并保留文本编辑原生快捷键。
- `public/js/core.js`：增加恢复状态和 DOM 引用。
- `public/js/features/diff-selection.js`：接入按行暂存/取消暂存恢复点。
- `public/js/features/diff-workbench.js`：接入按块暂存/取消暂存恢复点。
- `public/js/features/file-editor-actions.js`：接入文件编辑器按块/按行暂存恢复点。
- `public/js/features/git-actions.js`：接入全部暂存、文件暂存/取消暂存和批量操作恢复点。
- `public/js/features/recovery-undo.js`：实现页面级 Undo/Redo 控制器、index tree 恢复和提交 recovery ref 恢复。
- `public/js/features/worktree-refresh.js`：工作区快照变化时刷新并失效过期恢复状态。
- `public/js/i18n-catalog.js`：增加撤销/恢复、index 恢复和安装器提示翻译。
- `server.js`：将 index 恢复纳入快照守卫动作集合。
- `server/git-operations-service.js`：为提交和索引操作接入恢复点及恢复接口。
- `server/git-worktree-service.js`：实现 index tree 读取、历史包装和恢复。
- `server/repository-service.js`：增加创建提交前恢复点标签。
- `tests/file-editor-ui.test.js`：覆盖高亮可读性和编辑器恢复行为。
- `tests/git-api.test.js`：覆盖 index/提交撤销恢复的真实 Git API 行为。
- `tests/git-snapshot-guards.test.js`：覆盖恢复前快照守卫。
- `tests/installer-package.test.js`：同步 `0.4.10` 安装器版本契约。
- `tests/keyboard-shortcuts.test.js`：覆盖页面级撤销/恢复快捷键分流。
- `tests/recovery-undo-ui.test.js`：覆盖撤销/恢复控制器、按钮和栈交换行为。
- `progress.md`：仅在末尾追加本轮结果、测试、文件清单和回滚点。
- 回滚方式：提交前对上述本轮已跟踪文件执行 `git restore -- <file list>`；提交后使用 `git revert <本轮提交>`。不得触碰保护文件、`.playwright-cli/`、`D:\Forkline` 或任何既有标签。
- 远端发布卡点：当前 `gh auth status -h github.com` 显示已登录账户令牌无效；认证恢复后再推送、创建不可移动的 `v0.4.10` 标签和 GitHub Release，并核对两条工作流及六个正式附件。

## 2026-08-28 - Task: Forkline v0.4.10 独立编辑器验收与发布收尾准备

### What was done

- 完成当前工作树的独立文件编辑器 Electron 子窗口实际验收：主窗口继续显示 Web 工作台，文件编辑器通过固定受限 IPC 在独立子窗口打开；Web 版原页面编辑器路径保持不变。
- 重建当前 v0.4.10 Windows x64 NSIS 安装器，并在隔离用户数据和临时安装目录中加载正式仓库、打开真实 `package.json`、关闭编辑器子窗口和停止后台服务。
- 如实保留静默 NSIS 卸载现场异常：退出码为 `0`，但没有可见 HKCU 卸载登记且临时安装目录未由卸载器清理；未将其写成标准交互式卸载通过。现有 `D:\Forkline` 和既有开始菜单快捷方式未触碰。

### Testing

- `npm.cmd test`：`398/398` 通过，0 失败、0 取消、0 跳过。
- `npm.cmd run test:browser`：`1/1` 通过；4000 文件工作区冷 API 约 `306.6 ms`，低于 `350 ms` 门限。
- `npm.cmd run build:installer`：成功；安装器 `104609975` 字节，SHA-256 `072C1C0F36731B78ADE0BD07CA94AB8A01C03E78A97A3FE9C1FEB7D3A28A99DF`；blockmap `111642` 字节，SHA-256 `3A252AD32FD662E9DF23B833B03E0B9AF16F1119F1C39AC5F0376A5927B7CA9A`；`latest.yml` `372` 字节，SHA-256 `23D6DAA836E7868451A2423D1978D79008FD6DBB1900CBDBA374D9A271184B53`；Authenticode `NotSigned`。
- 隔离真实 Electron：正式仓库页面显示 `forkline-upload` / `main`；核心状态 HTTP `200`；子窗口标题 `Forkline 编辑器`，URL 含 `fileEditorWindow=1&file=package.json&source=worktree`，状态为真实仓库、文件读取完成、弹层可见、CodeMirror `2` 个；关闭 IPC 返回 `true` 且编辑器页归零；最终临时 Forkline 进程归零、服务端口不再监听。
- 保护校验：异常未跟踪文件保持 0 字节、SHA-256 `e3b0c44298fc1c149af4c8996fb92427ae41e4649b934ca495991b7852b855`，未修改、未暂存、未提交；`.playwright-cli/` 未触碰；`v0.4.9` 解引用仍为 `ea43966a2ff5295aedf528bc3578eb61f5dbcbf5`。

### Notes

- `electron/main.js`：增加独立文件编辑器窗口生命周期、受限 IPC、外部导航和退出联动。
- `electron/preload.js`：增加固定的文件编辑器打开、关闭、上下文和关闭请求接口。
- `electron/file-editor-window.js`：新增文件上下文校验、提交 SHA 校验和内部 URL 编解码。
- `public/file-editor.css`：调整编辑器窗口与 Diff 高亮的桌面显示规则。
- `public/js/app/init.js`、`public/js/bootstrap.js`、`public/js/features/file-editor-loader.js`、`public/js/features/file-editor.js`：接入独立窗口上下文、打开分流、关闭请求和未保存内容确认。
- `tests/electron-shell.test.js`、`tests/file-editor-ui.test.js`、`tests/file-editor-window.test.js`：补充 Electron 外壳、UI 分流、IPC 边界和 URL 编解码回归。
- `docs/ELECTRON_DESKTOP.md`、`docs/PACKAGING.md`、`docs/CONTINUE.md`：追加独立编辑器和本机构建/安装验收证据。
- `progress.md`：仅在末尾追加本轮闭环记录。
- 回滚方式：提交前执行 `git restore -- electron/main.js electron/preload.js public/file-editor.css public/js/app/init.js public/js/bootstrap.js public/js/features/file-editor-loader.js public/js/features/file-editor.js tests/electron-shell.test.js tests/file-editor-ui.test.js docs/ELECTRON_DESKTOP.md docs/PACKAGING.md docs/CONTINUE.md progress.md`，并按需删除新增的 `electron/file-editor-window.js`、`tests/file-editor-window.test.js`；提交后使用 `git revert <本轮提交>`。不得触碰 `n+fs.statSync(p.join('public'`、`.playwright-cli/`、`D:\Forkline` 或任何既有标签。

## 2026-08-28 - Task: Forkline v0.4.10 正式 Release 附件验收与文档收尾

### What was done

- 完成正式 v0.4.10 Release 的六个 Windows x64 附件验收，并将 Release、工作流、校验和便携包内容证据追加到发布文档和续接记录。
- 确认正式 Release 为非草稿、非预发布，`v0.4.10` 标签固定在 `15826d52e341a2fc17ec8855ae9bcde76acec678`，既有 `v0.4.9` 标签未移动。

### Testing

- 安装器工作流 `33134728084`、便携包工作流 `33134728147` 均成功；本地全量自动测试 `398/398`、Issue 定向回归 `195/195` 均通过。
- Release 六附件本机 SHA-256 与 GitHub digest 全部一致：EXE `c9b6be0153ec05663b9a2c4fa7c15d424bd6a7f248169c5e5552b9da06999320`；blockmap `91e1a724995314ef81dadb3c7733ac86b422c932efd10e1780a4024828874878`；EXE 校验文件 `8a627971cfe16d28240b4db963173c9e8fa0ab8c7111ad3e55be63d424805a21`；ZIP `738511f90f0644c8a3a3554142865afb7d53a882f3918c08b1ae26961b6521e7`；ZIP 校验文件 `e85b9cbac41d394feacbf78fe792b3f8ed253a68343d1559438319f5fa848602`；`latest.yml` `09fcf2833c4d2302e48c3da49be6eab8773ddf4614fef1bc324f6b77abf7094d`。
- `latest.yml` 的版本、安装器文件名、大小 `104606321` 和 SHA-512 `sSm6BmOKpqa85ZlDj/VucymFjx10amMHW3xkMpEYDtqltA4YgpCmwRl0ZfJBfLBo1Bqlblm2pkLYftsqgPXt6Q==` 均匹配；便携 ZIP 含 `.git`、`runtime/node.exe`、`Forkline.cmd`、`start.cmd`、源码和 `docs/`；Authenticode 为 `NotSigned`。
- 保护文件 `n+fs.statSync(p.join('public'` 保持 0 字节和 SHA-256 `e3b0c44298fc1c149af4c8996fb92427ae41e4649b934ca495991b7852b855`，未修改、未暂存、未提交；`.playwright-cli/` 仍未跟踪且未触碰。

### Notes

- 修改文件：`docs/PACKAGING.md`：追加正式 Release 六附件、digest、`latest.yml` 和便携 ZIP 验收；`docs/CONTINUE.md`：追加 v0.4.10 发布完成状态和后续边界；`progress.md`：追加本轮验收、测试、保护对象和回滚点。
- 回滚方式：提交前执行 `git restore -- docs/PACKAGING.md docs/CONTINUE.md progress.md`；提交后执行 `git revert <本轮文档收尾提交>`。不删除 Release 附件，不移动 `v0.4.9`、`v0.4.10` 或任何既有标签，不触碰两个未跟踪保护对象。

## 2026-08-28 - Task: Issue #5 工作区和暂存区文件夹式选择

### What was done

- 将工作区和暂存区目录选择从右侧 checkbox 方框改为 Windows 文件夹式目录行：文件夹图标、名称和数量组成可点击的选择行，左侧箭头只负责展开/折叠。
- 保留目录全选/取消选择、部分选择状态、Ctrl/Cmd 多选、Shift 文件范围选择、虚拟化分批渲染和工作区/暂存区 Git 操作语义；提交/同步等只读文件树不显示目录选择控件。
- 同步更新用户说明、架构说明和 UI 回归测试，确保后续不会重新引入 checkbox 语义。

### Testing

- `node --test tests/file-editor-ui.test.js`：`38/38` 通过，覆盖文件夹行按钮、无 checkbox 语义、目录选择事件和完整后代文件选择。
- `npm.cmd test`：`399/399` 通过，0 失败、0 取消、0 跳过。
- `npm.cmd run test:browser`：`1/1` 通过；4000 文件工作区冷 API `288.2 ms`，目录选择后仍保持首批 `800` 行、全部 `4000` 个文件选择和分批追加。
- `node --check public\\js\\features\\file-tree.js`、测试文件语法检查和 `git diff --check` 通过；生产代码和文档中不再使用 `aria-checked`、`role="checkbox"` 或 `tree-folder-check`。

### Notes

- 修改文件：`public/js/features/file-tree.js`：将目录选择渲染为文件夹行并改用 `aria-pressed`；`public/styles.css`：增加 Windows 文件夹图标、选中/混合高亮和目录行布局；`tests/file-editor-ui.test.js`：补目录行交互与视觉契约；`tests/browser-performance.test.js`：同步目录选择状态断言；`README.md`：更新用户操作说明；`docs/ARCHITECTURE.md`：更新文件树职责说明；`progress.md`：追加本轮结果、测试、保护对象和回滚点。
- 回滚方式：提交前执行 `git restore -- public/js/features/file-tree.js public/styles.css tests/file-editor-ui.test.js tests/browser-performance.test.js README.md docs/ARCHITECTURE.md progress.md`；提交后执行 `git revert <本轮提交>`。不得删除、修改、暂存或提交 `.playwright-cli/`、`n+fs.statSync(p.join('public'`，不得移动任何既有标签。

## 2026-08-28 - Task: Forkline v0.4.11 版本升档、安装器与发布准备

### What was done

- 将产品版本升至 `0.4.11`，纳入 Issue #5 文件夹式目录选择修复，并同步安装器契约；保留 Web、源码克隆、便携版和 NSIS 安装版既有更新边界。
- 完成本机构建安装器、版本/元数据校验和隔离安装启动验收；记录本机 GPU 启动兼容性异常及静默 NSIS 登记/卸载异常，未将其误报为标准通过。

### Testing

- `npm.cmd test`：`399/399` 通过，0 失败、0 取消、0 跳过。
- `npm.cmd run test:browser`：`1/1` 通过；4000 文件工作区冷 API `328.4 ms`，低于 `350 ms` 门限。
- `node --check tests\\installer-package.test.js`、`git diff --check` 通过；本机构建的 EXE 为 `104610247` 字节，SHA-256 `44044ad351ea3008f7d78598b9c7f921d1199a6c5c279fa73133bb63fd116064`；blockmap 为 `111564` 字节，SHA-256 `beefa5843fd9ae6437ea46e1c9925de5e68f2ffb6ee8fa1fe021a3d742e93447`；`latest.yml` 为 `372` 字节，SHA-256 `b397b7f7953f5d4b59835ce0a03710378182c48fdc3e2caf9c491c7d896956db`，版本、大小和 SHA-512 一致，Authenticode `NotSigned`。
- 隔离安装退出码 `0`；使用本机兼容性启动参数时首页和 `/api/state?details=core` HTTP `200`，`/api/app-update` 当前版本为 `0.4.11`。无兼容参数启动受到本机 Electron GPU 子进程异常影响；静默卸载退出码 `0` 但未清理临时目录，按已知异常记录。

### Notes

- 修改文件：`package.json`：版本升至 `0.4.11`；`package-lock.json`：同步根包版本；`tests/installer-package.test.js`：同步安装器版本契约；`docs/PACKAGING.md`：追加 v0.4.11 构建、校验和安装现场；`docs/CONTINUE.md`：追加 v0.4.11 发布准备与剩余动作；`progress.md`：追加本轮闭环记录。
- 回滚方式：提交前执行 `git restore -- package.json package-lock.json tests/installer-package.test.js docs/PACKAGING.md docs/CONTINUE.md progress.md`；提交后执行 `git revert <本轮提交>`。不得删除、修改、暂存或提交 `.playwright-cli/`、`n+fs.statSync(p.join('public'`，不得移动任何既有标签或触碰 `D:\Forkline`。

## 2026-08-28 - Task: Forkline v0.4.11 正式 Release 验收

### What was done

- 创建并推送不可移动的 `v0.4.11` 注释标签和中文正式 GitHub Release；两条 Windows x64 工作流均成功，正式附件已完成远端验真。

### Testing

- Release ID `378355055`，状态为正式版、非草稿、非预发布；标签目标为 `330bbf4209e8ad37148b8a9bf01c389fce4d2971`。
- 安装器工作流 `33156145227`、便携包工作流 `33156145225` 均为 `success`。
- 六个附件的本机 SHA-256 均与 GitHub digest 一致：EXE `f975eebc5d4d6a6ecf6efd7c3614d26b5971b6620b175d992bd11e1d6ffacbc9`；blockmap `581d20d371176f6e9f67b2b9414c4cbaa6b5eabcc012b73680405f782ba7b7ff`；EXE 校验文件 `d1970e246629a5923ea0ff2c1e0c3073e3320b92711ccbcbda0da9d6c294e018`；ZIP `bc94b72015dcecdb120a3fcb0f28c9136f9d82eff1137601d32bdcc9feb418d5`；ZIP 校验文件 `0e6e668423516ff971329f449da68af444ec3f9af9721cd3c0d08b0032a7470f`；`latest.yml` `56290878d2ff8917fa4d4c95918b292236b516236017110c1b5f19838ad3a677`。
- `latest.yml` 版本、文件名、安装器大小和 SHA-512 一致；便携 ZIP 内容检查通过，安装器 Authenticode 为 `NotSigned`。本机构建和远端发布说明均保留未签名风险。
- `npm.cmd test`：`399/399`；`npm.cmd run test:browser`：`1/1`；隔离安装启动兼容性验证和静默卸载异常已在前一轮记录。

### Notes

- 修改文件：`docs/PACKAGING.md`：追加 v0.4.11 正式 Release、工作流和六附件验收；`docs/CONTINUE.md`：追加正式发布完成状态；`progress.md`：追加本轮远端验收记录。
- 回滚方式：提交前执行 `git restore -- docs/PACKAGING.md docs/CONTINUE.md progress.md`；提交后执行 `git revert <本轮发布验收文档提交>`。不删除 Release 附件，不移动任何既有标签，不触碰 `.playwright-cli/`、`n+fs.statSync(p.join('public'` 或 `D:\Forkline`。

## 2026-08-30 - Task: Issue #10 便携包与源码压缩包命名区分

### What was done

- 将 Windows Web 便携包命名统一为 `Forkline-v<version>-windows-x64-portable.zip` 及对应 SHA-256 文件，避免与 GitHub 自动生成的 `Source code (zip)` 混淆。
- 收紧便携包 Release 工作流的上传匹配范围，并在 README 和发布文档中说明源码快照不包含 `.git`、内置 Node.js 或 `Forkline.cmd`，不能替代便携包。

### Testing

- 修复前新增命名回归契约按预期失败；修改后 `node --test tests/portable-runtime.test.js` 为 `2/2` 通过。
- 契约覆盖构建脚本、Release 上传路径、README 下载说明和便携包文档命名。

### Notes

- 修改文件：`scripts/build-portable.ps1`：为便携包目录和归档使用明确的 `-windows-x64-portable` 后缀；`.github/workflows/release-portable.yml`：只上传明确命名的便携 ZIP 和校验文件；`tests/portable-runtime.test.js`：增加 Issue #10 命名与源码快照区分回归；`README.md`：说明 Release 便携包下载和启动入口；`docs/PACKAGING.md`：更新便携包产物和 Source code ZIP 边界；`progress.md`：追加本轮闭环记录。
- 回滚方式：提交前执行 `git restore -- scripts/build-portable.ps1 .github/workflows/release-portable.yml tests/portable-runtime.test.js README.md docs/PACKAGING.md progress.md`；提交后执行 `git revert <Issue-10 修复提交>`。不得删除、修改、暂存或提交 `.playwright-cli/`、`n+fs.statSync(p.join('public'`，不得移动既有标签。

## 2026-08-30 - Task: Issue #1 编辑器 Diff 高亮可读性

### What was done

- 降低文件编辑器中整行改动块与行内增删标记的红/绿色背景浓度，解决两层背景叠加后压低语法文字对比度的问题。
- 保留改动块边框、行内下划线和原有语法高亮，补充 Electron 文档说明该可读性边界。

### Testing

- 修复前新增的高亮浓度回归测试按预期失败；修改后 `node --test --test-name-pattern "file editor merge highlights keep syntax text readable" tests/file-editor-ui.test.js` 通过。
- 回归契约确认改动背景浓度为删除 `6%/8%`、新增 `5%/7%`，并确认边框/下划线仍存在。

### Notes

- 修改文件：`public/file-editor.css`：降低 CodeMirror 改动块和行内标记背景浓度；`tests/file-editor-ui.test.js`：增加双层高亮浓度回归断言；`docs/ELECTRON_DESKTOP.md`：说明 Diff 高亮的可读性策略；`progress.md`：追加本轮闭环记录。
- 回滚方式：提交前执行 `git restore -- public/file-editor.css tests/file-editor-ui.test.js docs/ELECTRON_DESKTOP.md progress.md`；提交后执行 `git revert <Issue-1 修复提交>`。不得触碰 `.playwright-cli/`、`n+fs.statSync(p.join('public'` 或任何既有标签。

## 2026-08-30 - Task: Issue #9 独立编辑器窗口按钮重叠

### What was done

- 为 Electron 独立文件编辑器窗口增加与主窗口一致的 Windows 原生标题栏安全区：顶部使用 `titlebar-area-height` 预留拖动区域，编辑器标题栏和业务按钮整体下移到原生最小化、最大化、关闭按钮区域之下。
- 保留编辑器自定义关闭、查找替换和对照模式按钮，Web 浏览器内的浮动编辑器布局不变。

### Testing

- 修复前新增的独立窗口标题栏布局回归测试按预期失败；修改后 `node --test --test-name-pattern "Electron file editor uses a standalone window" tests/file-editor-ui.test.js` 通过。
- 回归契约确认独立窗口包含标题栏占位、拖动区域及连续的标题栏、搜索、对照、编辑区和底栏网格行。

### Notes

- 修改文件：`public/file-editor.css`：为独立编辑器窗口增加原生标题栏占位行并调整各业务区域网格行；`tests/file-editor-ui.test.js`：增加 Issue #9 标题栏布局回归断言；`docs/ELECTRON_DESKTOP.md`：更新主窗口和独立编辑器窗口的标题栏边界；`progress.md`：追加本轮闭环记录。
- 回滚方式：提交前执行 `git restore -- public/file-editor.css tests/file-editor-ui.test.js docs/ELECTRON_DESKTOP.md progress.md`；提交后执行 `git revert <Issue-9 修复提交>`。不得触碰 `.playwright-cli/`、`n+fs.statSync(p.join('public'` 或任何既有标签。

## 2026-08-30 - Task: Issue #1 最新反馈的 Diff 文字对比度

### What was done

- 根据 Issue #1 的最新反馈，保留低浓度改动背景，并让新增/删除标记及其 CodeMirror 语法子节点使用主题已有的高对比 Diff 前景色，避免语法色与同色改动背景叠加后难以阅读。

### Testing

- 修复前新增的前景色回归断言按预期失败；修复后 `node --test --test-name-pattern "file editor merge highlights keep syntax text readable" tests/file-editor-ui.test.js` 通过。
- `npm.cmd test`：`399/399` 通过，0 失败、0 取消、0 跳过。
- `npm.cmd run test:browser`：`1/1` 通过；真实 Chromium 4000 文件冷 API `288.2 ms`，无性能回退。
- `node --check tests/file-editor-ui.test.js` 和 `git diff --check` 通过。

### Notes

- 修改文件：`public/file-editor.css`：为 CodeMirror 新增/删除文本补充高对比 Diff 前景色继承；`tests/file-editor-ui.test.js`：增加前景色与语法子节点继承回归契约；`docs/ELECTRON_DESKTOP.md`：记录 Diff 前景色策略；`progress.md`：追加本轮验证与回滚点。
- 回滚方式：提交前执行 `git restore -- public/file-editor.css tests/file-editor-ui.test.js docs/ELECTRON_DESKTOP.md progress.md`；提交后执行 `git revert <Issue-1 对比度修复提交>`。不得删除、修改、暂存或提交 `.playwright-cli/`、`n+fs.statSync(p.join('public'`，不得移动任何既有标签。

## 2026-08-30 - Task: Forkline v0.4.12 版本准备

### What was done

- 将产品版本从 `0.4.11` 升至 `0.4.12`，同步锁文件和安装器版本契约；将 Issue #10、#9、#1 的已验证修复作为本次发布候选内容。

### Testing

- `node -e` 版本一致性检查通过，`package.json`、`package-lock.json` 和根包版本均为 `0.4.12`。
- `node --test tests/installer-package.test.js tests/portable-runtime.test.js`：`4/4` 通过。
- 版本升档前后的 `npm.cmd test` 均为 `399/399`；版本升档前后的 `npm.cmd run test:browser` 均为 `1/1`。
- `git diff --check` 通过；使用 scoped GitHub 网络路径读取远端 HEAD 成功。

### Notes

- 修改文件：`package.json`：版本升至 `0.4.12`；`package-lock.json`：同步根版本；`tests/installer-package.test.js`：同步安装器版本契约；`docs/PACKAGING.md`、`docs/CONTINUE.md`：记录 v0.4.12 发布边界和续接顺序；`progress.md`：追加本轮版本准备、验证和回滚点。
- 回滚方式：提交前执行 `git restore -- package.json package-lock.json tests/installer-package.test.js docs/PACKAGING.md docs/CONTINUE.md progress.md`；提交后执行 `git revert <v0.4.12 版本准备提交>`。不得删除、修改、暂存或提交 `.playwright-cli/`、`n+fs.statSync(p.join('public'`，不得移动任何既有标签。

## 2026-08-30 - Task: Forkline v0.4.12 本机安装器构建

### What was done

- 使用当前 v0.4.12 工作树成功构建 Windows x64 NSIS 安装器，并确认本机元数据与产物一致；正式发布仍以新标签上的 GitHub Windows 工作流为准。

### Testing

- `npm.cmd run build:installer` 成功；安装器 `Forkline-Setup-0.4.12-windows-x64.exe` 为 `104610372` 字节，SHA-256 `5fdb54c89316c276474cd7b2532265d382196d3f81063daf8352fdbcbd86159f`。
- blockmap 为 `111592` 字节；`latest.yml` 显示版本 `0.4.12`、安装器文件名和大小 `104610372`，SHA-512 与安装器一致。
- `Get-AuthenticodeSignature` 显示 `NotSigned`；未将本机产物宣称为正式 Release 附件。

### Notes

- 修改文件：`docs/PACKAGING.md`、`docs/CONTINUE.md`：记录 v0.4.12 本机安装器构建证据和正式工作流边界；`progress.md`：追加本轮构建验证与回滚点。`dist/installer` 为构建输出，不作为源码变更提交。
- 回滚方式：提交前执行 `git restore -- docs/PACKAGING.md docs/CONTINUE.md progress.md`；提交后执行 `git revert <v0.4.12 本机安装器构建记录提交>`。不得删除、修改、暂存或提交 `.playwright-cli/`、`n+fs.statSync(p.join('public'`，不得移动任何既有标签。

## 2026-08-31 - Task: Forkline v0.4.12 正式发布、Issue 收尾与本机安装启动验收

### What was done

- 完成 Forkline v0.4.12 Windows x64 Electron 独立安装版正式发布；中文 Release 已公开，v0.4.12 注释标签固定指向 b16fa69a5c92403a5acec6a0de8e1eddab7eee9b，旧 v0.4.0 至 v0.4.11 标签未移动。
- 两条 Windows 发布工作流均成功，安装器、blockmap、两个 SHA-256 文件、便携 ZIP 和 latest.yml 共 6 个正式附件已上传并完成远端验真。
- 全部公开 Issue 已收尾：开放 Issue 数为 0；#10、#9、#1 已发布详细修复说明并关闭，#2 至 #8 也均已关闭。修复后分别能够区分源码快照与可运行便携包、避免独立编辑器按钮与原生窗口按钮重叠，并提高 Diff 变更文本和语法子节点的可读性。
- 完成本机安装版启动验收；安装目录保留，按用户要求未执行卸载验证。后续更新边界保持 Web/源码克隆/便携版使用 Git 快进更新，NSIS 安装版使用 electron-updater。

### Testing

- npm.cmd test：399/399 通过，0 失败、0 取消、0 跳过。
- npm.cmd run test:browser：1/1 通过；Issue 定向回归、安装器/便携包契约、Node 语法检查和 git diff --check 均通过。
- GitHub Actions：安装器工作流 33322496291 和便携包工作流 33322496280 均为 success，且均由 v0.4.12 发布事件触发。
- 正式附件本机重新下载复核全部通过：安装器 104606262 字节 / SHA-256 ba35f92178e0adc4c5551045aff04d6e9dc66adf37e93d10894ddea6ee069154；blockmap 111597 字节 / SHA-256 d5dc4c25c543d4770ed35e71aa23b2eeddf8295d6b4c7ba0fb512337f0956295；安装器校验文件 103 字节 / SHA-256 aa5488a333d3de50513b51f4de0d7d5b8a05d3eaa72a6038b58b4fe04f8f9b8b；便携 ZIP 36848843 字节 / SHA-256 d18e0175de9360be57a82321128ec9ae54d2737b159cd3f4b1ae3fe624e55eea；便携 ZIP 校验文件 109 字节 / SHA-256 2fa8c82cf81c5d4ff9acf1f91087e314699c0bf6d3f0f8643bce4ec8bf5ebac1；latest.yml 372 字节 / SHA-256 c8465de4e9d23cfc8d9a4571e5e92ba04b48e7eac4138187c1b57a6ac3c8b9f0。六项均与 GitHub API digest 和远端大小一致。
- latest.yml 版本为 0.4.12，安装器大小为 104606262，SHA-512 为 HoSCCQwFNufkBYjHaioKRJxNeBOeMhU6OnGu/RtgoCbr8GTO86b7CBRwSnBPx5TU+2PvPaCx+DbNqG4TmQdsNg==；便携 ZIP 内容检查确认保留顶层目录下的 .git、runtime/node.exe、Forkline.cmd、start.cmd、package.json 和 docs/。
- 本机隔离安装目录 C:/Users/Administrator/AppData/Local/Temp/forkline-v0.4.12-interactive-final 中 Forkline.exe 产品文件版本为 0.4.12.0，卸载程序已生成；验收期间窗口标题为 Forkline Web，后台监听 127.0.0.1:62430，首页、核心状态、同步状态和操作状态接口均 HTTP 200，正常关闭后进程和服务归零。
- 当前安装目录和卸载程序保留，未执行卸载；这项未执行的流程不宣称为通过或失败。受保护异常未跟踪文件 n+fs.statSync(p.join('public' 长度仍为 0 字节、SHA-256 为 e3b0c44298fc1c149af4c8996fb92427ae41e4649b934ca495991b7852b855；.playwright-cli/ 未修改、未暂存、未提交。

### Notes

- 修改文件：docs/PACKAGING.md：追加正式 Release、6 个附件、Issue 关闭和本机安装启动验收；docs/CONTINUE.md：更新后续接手状态为 v0.4.12 已完成；progress.md：追加本轮完整发布收尾记录。
- 本轮创建的 .gh-config-v0412/ 和 .release-verify-v0412/ 已在确认路径位于正式仓库后删除；受保护的 .playwright-cli/ 和 n+fs.statSync(p.join('public' 未删除。
- 回滚方式：提交前执行 `git restore -- docs/PACKAGING.md docs/CONTINUE.md progress.md`；提交后执行 `git revert <v0.4.12 发布收尾文档提交>`。不得移动任何既有标签，不得删除、修改、暂存或提交受保护对象。

## 2026-08-31 - Task: v0.4.12 发布后性能门禁诊断

### What was done

- 发布和 Issue 收尾状态保持不变；本轮仅对严格性能门禁进行复核，没有修改产品代码、性能阈值或测试断言。
- 排除了旧的 forkline-e2e-0818b Electron 验收进程树；确认其不属于当前 v0.4.12 安装目录，结束该精确识别的测试树后继续复跑。
- 对比 v0.4.11 与 v0.4.12 的变更确认没有 server.js 或 tests/browser-performance.test.js 改动，因此没有把当前主机性能波动误判为 v0.4.12 产品回归。

### Testing

- 严格门禁复跑：`npm.cmd test` 为 398/399，唯一失败为 4000 文件冷 API 372.8 ms；定向 `npm.cmd run test:browser` 为 0/1，冷 API 381.7 ms；清理旧测试树后再次定向复跑为 399.5 ms。
- 诊断倍率复跑：设置项目已有 FORKLINE_BROWSER_PERFORMANCE_SCALE=3 后，`npm.cmd run test:browser` 为 1/1，冷 API 368.8 ms；其余页面、渲染、滚动、工作区刷新和资源指标通过。
- 发布时已有的成功证据仍为 `npm.cmd test` 399/399 与 `npm.cmd run test:browser` 1/1；本轮未修改阈值，当前复跑结果按主机负载相关未通过记录。
- `git diff v0.4.11..v0.4.12 -- server.js server tests/browser-performance.test.js` 无代码差异；`git diff --check` 通过。受保护异常未跟踪文件仍为 0 字节、SHA-256 为 e3b0c44298fc1c149af4c8996fb92427ae41e4649b934ca495991b7852b855，未暂存、未提交。

### Notes

- 修改文件：docs/PACKAGING.md：补充发布后严格性能复核的环境波动说明；docs/CONTINUE.md：记录后续发布前需在低负载环境复核性能门禁；progress.md：追加本轮诊断证据。
- 已结束的精确测试进程树为正式仓库下 forkline-e2e-0818b 临时验收实例；未结束其他 Edge、系统或用户安装进程。未删除当前安装目录、卸载程序、.playwright-cli/ 或异常未跟踪文件。
- 回滚方式：提交前执行 `git restore -- docs/PACKAGING.md docs/CONTINUE.md progress.md`；提交后执行 `git revert <性能门禁诊断文档提交>`。不得修改性能阈值，不得移动任何既有标签。

## 2026-08-31 - Task: 修复文件双击查看偶发卡死

### What was done

- 定位并修复工作区文件单击切换与双击查看在编辑器仍处于读取/准备状态时的并发竞争；同一仓库、文件、来源和查看上下文现在共享一个进行中的打开请求，避免重复销毁和创建编辑器。
- 保持切仓过期保护：仓库路径纳入请求身份，切换仓库或目标文件变化不会错误复用旧请求；Web 页面编辑器和 Electron 独立编辑器窗口共用该保护。
- 增加单元和真实 Chromium 回归，覆盖阻塞文件读取时的快速点击/双击、单击切换与双击打开去重，以及切仓后旧请求隔离。

### Testing

- `node --test tests/file-editor-loader.test.js`：`7/7` 通过。
- `FORKLINE_BROWSER_PERFORMANCE_SCALE=3 npm.cmd run test:browser`：`1/1` 通过；真实 Chromium 场景确认快速点击/双击期间 `openCalls=1`、`/api/worktree-file` 请求数为 `1`，目标文件正常打开且 CodeMirror 双栏为 `2` 个。
- `npm.cmd test`：`400/401` 通过；唯一失败仍为当前主机 4000 文件工作区冷 API 严格门禁（本次 `491.2 ms`，固定阈值 `350 ms`），未修改产品性能阈值。其余新增回归、Electron、Git/API 和 UI 测试均通过。
- `node --check public/js/features/file-editor-loader.js tests/browser-performance.test.js tests/file-editor-loader.test.js` 与 `git diff --check` 通过。
- 受保护未跟踪对象 `.playwright-cli/`、`n+fs.statSync(p.join('public'` 未修改、未暂存、未提交；异常文件仍为 0 字节，SHA-256 为 `e3b0c44298fc1c149af4c8996fb92427ae41e4649b934ca495991b7852b855`。

### Notes

- 修改文件：`public/js/features/file-editor-loader.js`：增加同一打开请求的并发复用并保留仓库快照边界；`tests/file-editor-loader.test.js`：新增打开去重和切仓隔离回归；`tests/browser-performance.test.js`：新增真实快速点击/双击阻塞请求回归；`docs/ARCHITECTURE.md`、`docs/ELECTRON_DESKTOP.md`、`docs/CONTINUE.md`：同步文件编辑器并发打开行为；`progress.md`：追加本轮实现、验证和回滚点。
- 回滚方式：提交前执行 `git restore -- public/js/features/file-editor-loader.js tests/file-editor-loader.test.js tests/browser-performance.test.js docs/ARCHITECTURE.md docs/ELECTRON_DESKTOP.md docs/CONTINUE.md progress.md`；提交后执行 `git revert <本轮文件双击查看修复提交>`。不得删除、修改、暂存或提交 `.playwright-cli/`、`n+fs.statSync(p.join('public'`，不得移动任何既有标签。

## 2026-08-31 - Task: Forkline v0.4.13 版本准备与本机安装器构建

### What was done

- 将应用、锁文件和安装器契约升至 `0.4.13`，保留 v0.4.12 及更早标签；完成 v0.4.13 Windows x64 NSIS 本机构建验收。
- 保持发布边界不变：安装版使用 `electron-updater`，Web/源码克隆/便携版继续使用原 Git 快进更新，安装器仍为当前用户、可选目录、默认桌面和开始菜单快捷方式。

### Testing

- `node -e` 版本一致性检查通过：`package.json`、`package-lock.json` 和根包版本均为 `0.4.13`。
- `node --test tests/file-editor-loader.test.js tests/installer-package.test.js tests/electron-shell.test.js`：`45/45` 通过；相关 Node 语法检查和 `git diff --check` 通过。
- `npm.cmd run build:installer` 成功；`Forkline-Setup-0.4.13-windows-x64.exe` 为 `104610573` 字节，SHA-256 `04869302D471C4DF51A94435C6CC7458E8E2A6F3F2866DD2429A2376AC171A79`；blockmap 为 `111744` 字节，SHA-256 `85B4EF737E25B9BF97F208CB687EA8099B8FF3EFE07AD8C8145A0C11B71DB14A`；`latest.yml` SHA-256 `776DA16DB5CC899CCC22215F97582B91D9443E33F86BB3C9F1661CA0C5584C5D`。
- `latest.yml` 版本为 `0.4.13`，安装器大小 `104610573`，SHA-512 为 `9wDnJNjfgsgvzRsmz6SYgyUeaotqlGCT69XDQ+ji5btuWnq/vPmhQq+HigFJhYS2fwnTBSmZ1vprNSXDXFsjeA==`；产品文件版本为 `0.4.13`，Authenticode 为 `NotSigned`。
- 受保护未跟踪对象 `.playwright-cli/`、`n+fs.statSync(p.join('public'` 未修改、未暂存、未提交；异常文件仍为 0 字节，SHA-256 为 `e3b0c44298fc1c149af4c8996fb92427ae41e4649b934ca495991b7852b855`。

### Notes

- 修改文件：`package.json`、`package-lock.json`：升至 `0.4.13`；`tests/installer-package.test.js`：同步版本契约；`docs/PACKAGING.md`、`docs/CONTINUE.md`、`progress.md`：追加版本准备和本机构建证据。
- 回滚方式：提交前执行 `git restore -- package.json package-lock.json tests/installer-package.test.js docs/PACKAGING.md docs/CONTINUE.md progress.md`；提交后执行 `git revert <本轮 v0.4.13 版本准备提交>`。不得删除、修改、暂存或提交 `.playwright-cli/`、`n+fs.statSync(p.join('public'`，不得移动任何既有标签。
