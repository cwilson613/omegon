---
task_id: 0
depth: 1
parent: ../manifest.yaml
siblings: [1:fix-template-storage, 2:fix-minds, 3:fix-index]
tdd: true  # Red→Green→Refactor
---

# Task 0: fix-extraction

## Context Files (Review Before Starting)

- [x] Read `manifest.yaml` for root intent and success criteria
- [x] Check `siblings.yaml` for sibling coordination and dependencies
- [x] Review ancestry chain if at depth > 0

## Mission

Fix critical extraction-related bugs in extraction.ts and index.ts that affect subprocess spawning, concurrent process management, and shutdown handling.

## Scope

**In:**
- extraction.ts: Remove '--' from spawn args, guard against concurrent extractions
- index.ts: Fix Promise.race timer cleanup in session_shutdown handler
- index.ts: Add hasUI guard in updateStatus for print mode compatibility
- index.ts: Set triggerState.isRunning in shutdown extraction path
- index.ts: Remove unused killActiveExtraction import

**Out:**
- Mind-related fixes (handled by sibling task 2)
- Template/storage-related fixes (handled by sibling tasks 1 and 3)
- Variable shadowing and code organization improvements

**Depends on:** None - extraction fixes are independent

**Provides:**
- Fixed extraction subprocess spawning
- Proper concurrent extraction handling
- Clean shutdown process management

## Result

**Status:** PENDING

**Summary:**

**Artifacts:**

**Decisions:**

**Verification:**
- Command: ``
- Output:
- Edge cases:

## Alignment Check (Required)

Before marking COMPLETE, verify:

- **Root Goal**: Does this result fulfill the original goal from manifest.yaml?
- **Success Criteria**: Which criteria from manifest.yaml does this satisfy?
- **Constraints**: Have I violated any constraints from manifest.yaml?
- **Scope Adherence**: Did I stay within my task scope without encroaching on siblings?

**Alignment Summary:** [REQUIRED - explain how this task aligns with root intent]

## Success Criteria

- The '--' is removed from extraction.ts spawn args (Critical Issue 1)
- activeExtractionProc concurrent access is guarded (Critical Issue 2)
- Shutdown timer is properly cleared (Critical Issue 3)
- updateStatus guards ctx.hasUI (Issue 14)
- Shutdown extraction sets triggerState.isRunning (Issue 9)
- Dead killActiveExtraction import removed (Issue 8)

## REMINDER: Orchestrator Contract

The rules in the Orchestrator Contract section above are binding. Update your task file with the correct status when done. Stay within your scope. Do not push branches.