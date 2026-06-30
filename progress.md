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
