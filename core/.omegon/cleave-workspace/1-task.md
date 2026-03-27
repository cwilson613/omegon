---
task_id: 1
label: inspect-main
siblings: [0:inspect-contrib]
---

# Task 1: inspect-main

## Root Directive

> Minimal internal cleave_run smoke test on real repo files; read-only only; no commits.

## Mission

Read core/crates/omegon/src/main.rs and report one concise observation about startup model resolution. Do not modify files.

## Scope

- `core/crates/omegon/src/main.rs`

**Depends on:** inspect-contrib

## Siblings

- **inspect-contrib**: Read CONTRIBUTING.md and report one concise workflow rule. Do not modify files.



## Project Guardrails

Before reporting success, run these deterministic checks and fix any failures:

1. **clippy**: `cargo clippy -- -D warnings`

Include command output in the Verification section. If any check fails, fix the errors before completing your task.

## Testing Requirements

### Test Convention

Write tests as #[test] functions in the same file or a tests submodule


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
