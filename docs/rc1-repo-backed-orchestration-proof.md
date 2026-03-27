---
id: rc1-repo-backed-orchestration-proof
title: "RC1: repo-backed orchestration proof"
status: exploring
parent: release-0-15-4-trust-hardening
tags: [release, rc1, cleave, verification]
open_questions:
  - "Which real repo-backed task should serve as the rc.1 proof case so it exercises routing, child execution, and final reporting without depending on an artificial scratch scenario?"
  - "What must be true at the end of the proof run for rc.1 acceptance — successful child completion, accurate provider/model reporting, expected file changes or no-op rationale, and no merge/worktree bookkeeping contradiction?"
dependencies: []
related:
  - orchestratable-provider-model
---

# RC1: repo-backed orchestration proof

## Overview

Release-checklist node for the third rc.1 acceptance criterion: at least one realistic repo-backed orchestrated execution path must succeed end-to-end and leave state that matches what the operator sees. This node exists to avoid repeating the false confidence of synthetic scratch probes that do not exercise the full routing, child execution, and reporting path.

## Decisions

### Decision: the rc.1 repo-backed proof case should be a small real-repo task that exercises child routing and reporting without requiring a large merge-risk change

**Status:** decided

**Rationale:** Rc.1 needs a proof case that is real enough to exercise the full path but small enough not to confound routing validation with large implementation risk. The proof task should be a bounded change inside the actual repo — for example, a targeted doc/test/config adjustment or similarly small edit scope — dispatched through the normal orchestration path so provider resolution, child execution, result reporting, and worktree/merge bookkeeping all run against a real project checkout rather than a synthetic scratch directory.

### Decision: rc.1 orchestration proof acceptance requires end-to-end success, truthful provider/model reporting, coherent artifact outcome, and no bookkeeping contradiction

**Status:** decided

**Rationale:** The proof run passes only if all layers agree. Acceptance means: the child run reaches a coherent terminal state, the concrete provider/model reported to the operator matches the executed route, the repo outcome is explainable (expected file changes or a justified no-op), and worktree/merge bookkeeping does not downgrade the run into apparent failure after successful execution. This directly targets the false-negative failure mode seen in earlier cleave investigations.

## Open Questions

- Which real repo-backed task should serve as the rc.1 proof case so it exercises routing, child execution, and final reporting without depending on an artificial scratch scenario?
- What must be true at the end of the proof run for rc.1 acceptance — successful child completion, accurate provider/model reporting, expected file changes or no-op rationale, and no merge/worktree bookkeeping contradiction?
