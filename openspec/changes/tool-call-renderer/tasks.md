# Enriched Tool Call Rendering — Tasks

## 1. design_tree + design_tree_update renderers

- [ ] 1.1 `extensions/design-tree/index.ts` — import `Text` from `@cwilson613/pi-tui` (add alongside existing imports)
- [ ] 1.2 Add `renderCall(args, theme)` to `design_tree` registerTool(): show `◈ query` + `args.action` (node/list/frontier/dependencies/children) + `args.node_id` in dim if present
- [ ] 1.3 Add `renderResult` to `design_tree`: collapsed — one-liner summary from result text (first line only, truncated to 80 chars); expanded — full result text; isPartial — `◈ loading…`
- [ ] 1.4 Add `renderCall(args, theme)` to `design_tree_update` registerTool(): action-semantic header using a lookup map per action:
  - `set_status`: `◈ set_status  <node_id>  <old_status(if in args)> → <args.status>`  (no old_status in args, just show `→ <status>`)
  - `add_question`: `◈ add_question  <node_id>  "<args.question truncated to 50>"`
  - `remove_question`: `◈ remove_question  <node_id>  "<args.question truncated to 50>"`
  - `add_decision`: `◈ add_decision  <node_id>  "<args.decision_title truncated to 45>"`
  - `add_research`: `◈ add_research  <node_id>  "<args.heading truncated to 45>"`
  - `implement`: `◈ implement  <node_id>`
  - `create`: `◈ create  <node_id>  "<args.title truncated to 45>"`
  - `focus`/`unfocus`: `◈ focus  <node_id>` / `◈ unfocus`
  - all others: `◈ <args.action>  <args.node_id>`
- [ ] 1.5 Add `renderResult(result, { expanded, isPartial }, theme)` to `design_tree_update`:
  - `isPartial`: return `new Text(theme.fg("dim", "◈ updating…"), 0, 0)`
  - `isError` (detect from `result.isError` or first content line starting with "Error"/"Cannot"): `new Text(theme.fg("error", "✕ ") + theme.fg("dim", firstLine.slice(0,80)), 0, 0)`
  - collapsed final — derive from `result.details` (cast as `Record<string,unknown>`):
    - `set_status`: `◈ → <newStatus>  <id>`  (color newStatus by status: success=decided/implemented, accent=exploring, error=blocked, dim=deferred)
    - `add_question`: `◈ + question  "<question>"  (<totalQuestions> total)`
    - `remove_question`: `◈ − question  "<question>"  (<remainingQuestions> remaining)`
    - `add_decision`: `◈ + decision  "<decision>"  <status>`
    - `add_research`: `◈ + research  "<heading>"`
    - `implement`: `◈ ✓ scaffolded  openspec/changes/<id>/`
    - `create`: `◈ ✓ created  <id>  seed`
    - `focus`: `◈ → focused  <id>`
    - fallback: first line of `result.content[0].text`, truncated to 80
  - `expanded`: `new Text(result.content[0]?.text ?? "", 0, 0)` (full text)

## 2. cleave_run + cleave_assess renderers + dispatcher simplification

- [ ] 2.1 `extensions/cleave/index.ts` — verify `Text` is already imported from `@cwilson613/pi-tui`; add import if missing
- [ ] 2.2 Add `renderCall(args, theme)` to `cleave_run` registerTool(): parse `args.plan_json` safely (try/catch); extract child count; truncate `args.directive` to 60 chars: `⚡ cleave  <N> children  "<directive…>"`
- [ ] 2.3 Add `renderResult(result, { expanded, isPartial }, theme)` to `cleave_run`:
  - `isPartial`: read `details.phase` and `details.children` (cast `result.details as { phase?: string; children?: Array<{label:string; status:string; elapsed?:number; startedAt?:number; lastLine?:string}> }`):
    - phase `"dispatch"` or `undefined`: compute `doneCount`, `runningCount`, `pendingCount`, `failedCount` from children; header line: `⚡ cleave  dispatching  <doneCount>/<total> done`; then per-child rows (up to 8): `  ✓ label (Ns)` / `  ⟳ label` / `  ○ label` / `  ✕ label`; truncate extras with `  … N more`
    - phase `"harvest"` or `"merge"`: `⚡ cleave  merging  <doneCount>/<total> dispatched`
    - phase `"review"`: `⚡ cleave  reviewing  <lastLine from latest running child>`
    - fallback: `⚡ cleave  <result.content[0]?.text ?? "running…">`
  - final (non-partial):
    - success: parse first content line for "N/N merged" or similar; `⚡ cleave  ✓ done  <summary>`
    - if content contains "conflict" or "CONFLICT": `⚡ cleave  ⚠ conflicts  <first conflict file>`
    - isError: `⚡ cleave  ✕ failed  <first error line>`
  - `expanded`: full `result.content[0]?.text` rendered as-is
- [ ] 2.4 Add `renderCall(args, theme)` to `cleave_assess` registerTool(): `◊ assess  "<args.directive truncated to 55>"`
- [ ] 2.5 Add `renderResult` to `cleave_assess`: collapsed — `◊ complexity <score>  → <decision>` using `result.details` (`{ score, decision, pattern }`); expanded — full text
- [ ] 2.6 `extensions/cleave/dispatcher.ts` — simplify the `onUpdate` progress text at line ~588: change `Wave ${waveIdx+1}/${waves.length} (child ${childRange}/${totalChildren}): dispatching ${labels}` to just `dispatching ${labels}` (wave/child counter now rendered by `renderResult` from `details.children`)

## 3. openspec_manage renderer

- [ ] 3.1 `extensions/openspec/index.ts` — import `Text` from `@cwilson613/pi-tui` if not already imported
- [ ] 3.2 Add `renderCall(args, theme)` to `openspec_manage` registerTool(): action-specific headers:
  - `propose`: `◎ propose  <args.name>`
  - `add_spec`: `◎ add_spec  <args.change_name>  <args.domain>`
  - `generate_spec`: `◎ generate_spec  <args.change_name>  <args.domain>`
  - `fast_forward`: `◎ fast_forward  <args.change_name>`
  - `archive`: `◎ archive  <args.change_name>`
  - `status`: `◎ status`
  - `get`: `◎ get  <args.change_name>`
  - others: `◎ <args.action>  <args.change_name ?? "">`
- [ ] 3.3 Add `renderResult(result, { expanded, isPartial }, theme)` to `openspec_manage`:
  - `isPartial`: `◎ running…`
  - collapsed final — from `result.content[0]?.text` first line + key detail from `result.details`:
    - `propose`: `◎ ✓ proposed  <change_name>`
    - `add_spec`: `◎ ✓ spec added  <change_name>/<domain>`
    - `archive`: `◎ ✓ archived  <change_name>`
    - `fast_forward`: `◎ ✓ fast_forward  design.md + tasks.md generated`
    - `status`: first line of content (change count summary)
    - fallback: first line of content text truncated to 80
  - `expanded`: full content text
  - `isError`: `◎ ✕ <first error line>`
