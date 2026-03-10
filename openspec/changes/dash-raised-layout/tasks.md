# Raised Dashboard: Horizontal Split Layout — Tasks

## 1. Rendering primitives — new extensions/dashboard/render-utils.ts
<!-- specs: dashboard/layout -->

- [ ] 1.1 Create `extensions/dashboard/render-utils.ts` importing `visibleWidth` and `truncateToWidth` from `@mariozechner/pi-tui`
- [ ] 1.2 Implement `padRight(s: string, width: number): string` — pads to exactly `width` visible columns using `visibleWidth(s)`
- [ ] 1.3 Implement `leftRight(left: string, right: string, width: number): string` — flush-left + flush-right within `width`; falls back to `truncateToWidth(left, width, "…")` if they don't fit
- [ ] 1.4 Implement `mergeColumns(leftLines, rightLines, leftWidth, rightWidth, divider?: string): string[]` — zips two column arrays using `padRight` + `truncateToWidth`; divider defaults to `│`; row count = `Math.max(left.length, right.length)`
- [ ] 1.5 Create `extensions/dashboard/render-utils.test.ts` with tests for:
  - `padRight` with plain text, ANSI SGR color strings, and OSC 8 hyperlink strings — assert `visibleWidth(result) === width`
  - `leftRight` with OSC 8 on both sides — assert `visibleWidth(result) === width` and both substrings are present
  - `mergeColumns` with mismatched row counts — assert every output row has `visibleWidth === leftWidth + 1 + rightWidth`

## 2. Type layer — extend branch data in dashboard state
<!-- specs: dashboard/layout -->

- [ ] 2.1 In `extensions/dashboard/types.ts`: add `branches?: string[]` to the anonymous `nodes[]` item type inside `DesignTreeDashboardState`
- [ ] 2.2 `implementingNodes[].branch` and `DesignTreeFocusedNode.branch` are unchanged — do not duplicate

## 3. Producer — emit branch data from design-tree
<!-- specs: dashboard/layout -->

- [ ] 3.1 In `extensions/design-tree/dashboard-state.ts`: populate `branches: n.branches ?? []` on every entry in the `nodes[]` array inside `emitDesignTreeState()`
- [ ] 3.2 The `implemented`/`deferred` filter already excludes those nodes — verify branch data follows the same filter (it does by construction, but assert it explicitly in a comment)

## 4. Git branch reader utility
<!-- specs: dashboard/layout -->

- [ ] 4.1 In `extensions/dashboard/git.ts`: implement `readLocalBranches(cwd: string): string[]` — reads `.git/refs/heads/` recursively using `fs.readdirSync` (no shell spawn, mirrors pattern in `tree.ts` `readCurrentBranch()`)
- [ ] 4.2 Returns branch names as slash-joined paths relative to `refs/heads/` (e.g. `feature/dash-raised-layout`)
- [ ] 4.3 Sorts: `main`/`master` first, then `feature/*`, then `refactor/*`, then `fix/*`/`hotfix/*`, then rest alphabetically
- [ ] 4.4 Excludes `HEAD` and any non-clean ref name
- [ ] 4.5 Returns `[]` gracefully if `.git/refs/heads/` does not exist (detached HEAD, worktree, etc.)

## 5. Git branch tree renderer
<!-- specs: dashboard/layout -->

- [ ] 5.1 In `extensions/dashboard/git.ts`: implement `buildBranchTreeLines(params: BranchTreeParams, theme: Theme): string[]`
  - `repoName: string` — basename of cwd
  - `currentBranch: string | null`
  - `allBranches: string[]` — from `readLocalBranches()`
  - `designNodes?: Array<{ branches?: string[]; title: string }>` — for annotations
- [ ] 5.2 Single branch: `repoName + " ─── " + styledBranch(b)`
- [ ] 5.3 Multiple branches — line 1: `repoName + " ─┬─ " + styledBranch(branches[0])`; middle lines: `indent + "├─ " + ...`; last line: `indent + "└─ " + ...`
- [ ] 5.4 `indent = " ".repeat(visibleWidth(repoName + " ─"))` — computed once from `repoName` length
- [ ] 5.5 `styledBranch(b)`: current → `theme.fg("success", "● " + b)`; `feature/*` → `theme.fg("accent", b)`; `fix/*`/`hotfix/*` → `theme.fg("warning", b)`; `refactor/*` → dim accent; others → `theme.fg("muted", b)`
- [ ] 5.6 Annotation: for each branch, find first `designNode` where `node.branches?.includes(b)` — if found append `"  ◈ " + node.title` in `theme.fg("dim", ...)`
- [ ] 5.7 Current branch placed first (position 0) regardless of sort; deduplicate — no branch appears twice
- [ ] 5.8 Zero branches: returns `[theme.fg("dim", repoName)]` (just the repo name, no tree characters)

## 6. Raised layout rewrite — footer.ts
<!-- specs: dashboard/layout -->

- [ ] 6.1 Delete `renderRaisedColumns()` entirely — it is dead code with a broken padding implementation
- [ ] 6.2 Replace the body of `renderRaised(width)`:
  - `width >= 120` → `renderRaisedWide(width)`
  - else → `renderRaisedStacked(width)`
- [ ] 6.3 **Remove the `slice(0, 10)` line cap** from `renderRaised` (and any slice in `renderRaisedWide`/`renderRaisedStacked`) — raised mode is intentionally uncapped
- [ ] 6.4 `renderRaisedWide(width)` — 3-zone layout using `mergeColumns` from render-utils:
  - **Zone A** (full width): `buildBranchTreeLines(...)` lines
  - **Zone B** (two columns): `leftWidth = Math.floor((width - 1) / 2)`, `rightWidth = width - leftWidth - 1`; left = design tree + cleave lines; right = openspec lines; merged via `mergeColumns(leftLines, rightLines, leftWidth, rightWidth)`
  - **Zone C** (full width): context gauge · model · thinking line, then `/dash to compact` + pwd line
- [ ] 6.5 `renderRaisedStacked(width)` — extract current stacked logic verbatim, remove its `slice(0, 10)`
- [ ] 6.6 Fix `renderFooterData` stats line (lines 825-826): replace hand-rolled regex width with `leftRight(statsLeft, rightSide, width)` from render-utils

## 7. Tests — footer-raised.test.ts
<!-- specs: dashboard/layout -->

- [ ] 7.1 Test `buildBranchTreeLines` with 0, 1, 2, 3 branches — verify connector chars (`───`, `─┬─`, `├─`, `└─`)
- [ ] 7.2 Test indent = `visibleWidth(repoName + " ─")` columns exactly
- [ ] 7.3 Test annotation appears for a branch matching a design node's `branches[]`
- [ ] 7.4 Test that an OSC 8 hyperlink in a node title does NOT corrupt column alignment (regression for the existing bug)
- [ ] 7.5 Test wide layout: every merged column line has `visibleWidth === width` (no overflow, no under-fill)
- [ ] 7.6 Test `readLocalBranches` with a temp `.git/refs/heads/` directory tree including nested `feature/` subdirs

## 8. Cross-cutting constraints (enforced, not optional)

- [ ] 8.1 Grep `extensions/dashboard/footer.ts` for `.replace(/\\x1b/` and `.length` on non-array variables before commit — must be zero hits
- [ ] 8.2 All column padding goes through `padRight()` or `mergeColumns()` from render-utils
- [ ] 8.3 `renderRaisedColumns` must not exist in the final file
- [ ] 8.4 No `slice(0, N)` in `renderRaised`, `renderRaisedWide`, or `renderRaisedStacked`
