---
subsystem: openspec
design_docs:
  - design/openspec-assess-lifecycle-integration.md
  - design/lifecycle-hygiene-verification-substates.md
  - design/assess-bridge-completed-results.md
  - design/lifecycle-reconciliation.md
  - design/post-assess-reconciliation.md
  - design/lifecycle-artifact-versioning.md
openspec_baselines:
  - openspec/assessment-lifecycle.md
  - openspec/lifecycle-status.md
  - lifecycle/post-assess.md
  - lifecycle/reconciliation.md
  - lifecycle/versioning.md
last_updated: 2026-03-10
---

# OpenSpec

> Spec-driven development lifecycle — propose changes, write Given/When/Then specs, generate plans, verify implementations, and archive with delta-merge to baseline.

## What It Does

OpenSpec manages the full lifecycle of code changes through specifications:

1. **Propose** (`/opsx:propose`): Create a change with intent and scope
2. **Spec** (`/opsx:spec` or `generate_spec`): Define behavioral contracts as Given/When/Then scenarios
3. **Fast-forward** (`/opsx:ff`): Generate `design.md` and `tasks.md` from specs
4. **Execute**: `/cleave` parallelizes task execution with spec scenario assignment per child
5. **Verify** (`/assess spec`): Run specs against implementation, report pass/fail per scenario
6. **Archive** (`/opsx:archive`): Delta-merge passing specs into `openspec/baseline/`, archive the change

The `openspec_manage` tool provides agent access to all lifecycle operations. Assessment results are structured JSON with per-scenario verdicts and reconciliation support.

## Key Files

| File | Role |
|------|------|
| `extensions/openspec/index.ts` | Extension entry — 7 slash commands, tool registration, message renderers |
| `extensions/openspec/spec.ts` | Pure domain logic — parse specs, list/get/create changes, archive with delta-merge |
| `extensions/openspec/types.ts` | `ChangeInfo`, `Scenario`, `SpecFile`, `ChangeStage` types |
| `extensions/openspec/archive-gate.ts` | Pre-archive validation — refuses stale lifecycle state |
| `extensions/openspec/reconcile.ts` | Post-assess reconciliation — updates tasks.md and design-tree after review |
| `extensions/openspec/lifecycle-emitter.ts` | Memory lifecycle events on archive |
| `extensions/openspec/lifecycle-files.ts` | Assessment JSON read/write |
| `extensions/openspec/dashboard-state.ts` | Dashboard state emission for active changes |
| `extensions/cleave/openspec.ts` | Cleave integration — `openspecChangeToSplitPlan()`, spec scenario assignment |
| `openspec/baseline/` | Archived spec baselines — the "current truth" of behavioral contracts |

## Design Decisions

- **Specs define what must be true BEFORE code is written**: They are the source of truth for correctness, not post-hoc tests.
- **Delta-merge on archive**: Only changed/new scenarios merge into baseline. Existing baseline scenarios not in the change are preserved. This allows incremental spec evolution.
- **Archive gate refuses stale lifecycle state**: Incomplete tasks or missing design-tree bindings must be reconciled before archive succeeds.
- **Post-assess reconciliation**: After `/assess spec` reveals issues, `reconcile_after_assess` updates tasks.md, design-tree status, and file scope to reflect reality.
- **Assessment results are structured JSON**: Per-scenario pass/fail with evidence, stored in `assessment.json` for programmatic consumption.
- **Lifecycle artifact versioning**: Changes carry assessment history; baselines are append-only within a domain.

## Behavioral Contracts

See `openspec/baseline/openspec/` and `openspec/baseline/lifecycle/` for Given/When/Then scenarios covering:
- Assessment lifecycle stages
- Lifecycle status transitions
- Post-assess reconciliation
- Archive gate validation
- Artifact versioning

## Constraints & Known Limitations

- Slash commands (`/opsx:*`) registered via `pi.registerCommand()`, not `SlashCommandBridge` — not agent-callable via `execute_slash_command`
- Only `/assess` is bridged for agent access
- Spec parsing relies on markdown structure (Given/When/Then headers) — malformed specs may not parse
- Archive requires all scenarios to pass or be explicitly waived

## Related Subsystems

- [Design Tree](design-tree.md) — `implement` action scaffolds OpenSpec changes from decided nodes
- [Cleave](cleave.md) — executes OpenSpec task plans with spec scenario assignment
- [Dashboard](dashboard.md) — displays active change status
- [Slash Command Bridge](slash-command-bridge.md) — `/assess` bridged for agent access
