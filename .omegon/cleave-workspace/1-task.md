---
task_id: 1
label: workflow-issueing
siblings: [0:runtime-matrix]
---

# Task 1: workflow-issueing

## Root Directive

> Design and implement a dedicated daily provider drift workflow for live upstream endpoint verification against an expected response matrix, using limited-budget provider secrets, with deduplicated GitHub issue creation on true drift. Reuse/repair existing live_upstream_smoke and stale provider-drift workflow where sensible, add tests/docs, and keep release/nightly non-blocking.

## Mission

Inspect and repair/replace the stale provider-drift GitHub Actions workflow. Design the daily control-plane workflow, issue dedupe/update behavior, artifact/log strategy, and docs. Implement the workflow and any helper scripts/files needed for issue creation/reporting without making release/nightly blocking.

## Scope

- `.github/workflows/provider-drift.yml`
- `.github/workflows/nightly.yml`
- `.github/workflows/release.yml`
- `docs/provider-api-drift.md`
- `scripts/`

**Depends on:** none (independent)

## Siblings

- **runtime-matrix**: Inspect and extend the Rust live upstream smoke/drift test surface. Define or add a checked-in expectation matrix and determine the minimal viable assertions for provider-specific endpoint drift (not just round-trip OK), plus tests or validation around the matrix parsing/execution path.



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
