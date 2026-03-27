---
task_id: 0
label: inspect-contrib
siblings: [1:inspect-main]
---

# Task 0: inspect-contrib

## Root Directive

> Minimal internal cleave_run smoke test on real repo files; read-only only; no commits.

## Mission

Read CONTRIBUTING.md and report one concise workflow rule. Do not modify files.

## Scope

- `CONTRIBUTING.md`

**Depends on:** none (independent)

## Siblings

- **inspect-main**: Read core/crates/omegon/src/main.rs and report one concise observation about startup model resolution. Do not modify files.



## Project Guardrails

This task only changes documentation/text files.

Do not run unrelated project-wide build or typecheck commands. Instead:

1. Verify the edited file contents directly
2. Ensure `git status --short` is clean after commit
3. Mention that no automated tests were required for this docs-only change


## Testing Requirements

### Test Convention

No automated tests are required for documentation-only changes; verify the edited files directly and keep the git state clean


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
