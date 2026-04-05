---
task_id: 0
label: docs-copy
siblings: [1:tui-copy, 2:tests-validate]
---

# Task 0: docs-copy

## Root Directive

> Migrate Omegon docs and in-product copy from /dash framing to /auspex framing, without changing command behavior yet. Update design/docs/tutorial/help text so Auspex is presented as the primary browser surface and /dash remains only compatibility/local context where necessary. Reconcile tests affected by copy changes and validate the touched Rust code/docs.

## Mission

Update long-lived docs that currently frame the browser experience around `/dash` or the embedded web dashboard. Rewrite them to present Auspex as the primary browser surface, while keeping any necessary historical/local compatibility notes. Focus on docs/embedded-web-dashboard.md, docs/display-tool-artifacts.md, docs/native-plan-mode.md, docs/conversation-rendering-engine.md, and other directly relevant docs that mention `/dash` as the primary browser path.

## Scope

- `docs/embedded-web-dashboard.md`
- `docs/display-tool-artifacts.md`
- `docs/native-plan-mode.md`
- `docs/conversation-rendering-engine.md`
- `docs/auspex-ipc-contract.md`

**Depends on:** none (independent)

## Siblings

- **tui-copy**: Update in-product copy in the TUI/tutorial/help surfaces so operator-facing text points to Auspex as the primary browser UI, while leaving current `/dash` command behavior intact as compatibility wording. Focus on core/crates/omegon/src/tui/mod.rs, core/crates/omegon/src/tui/tutorial.rs, and nearby help/command descriptions only.
- **tests-validate**: After docs and TUI copy changes land, reconcile any affected tests/comments and run targeted validation for the touched Rust TUI surfaces. Update only test expectations or comments made stale by the copy migration; do not change command behavior.



## Testing Requirements

### Test Convention

Write tests for new functions and changed behavior — co-locate as *.test.ts


## Contract

1. Only work on files within your scope
2. Follow the Testing Requirements section above
3. If the task is too complex, set status to NEEDS_DECOMPOSITION

## Finalization (REQUIRED before completion)

You MUST complete these steps before finishing:

1. Run all guardrail checks listed above and fix failures
2. Commit your in-scope work with a clean git state when you are done
3. Commit with a clear message: `git commit -m "feat(<label>): <summary>"`
4. Verify clean state: `git status` should show nothing to commit

Do NOT edit `.cleave-prompt.md` or any task/result metadata files. Those are orchestrator-owned and may be ignored by git.
Return your completion summary in your normal final response instead of modifying the prompt file.

> ⚠️ Uncommitted work will be lost. The orchestrator merges from your branch's commits.

## Result

**Status:** PENDING

**Summary:**

**Artifacts:**

**Decisions Made:**

**Assumptions:**
