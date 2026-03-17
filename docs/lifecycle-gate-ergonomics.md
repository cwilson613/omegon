---
id: lifecycle-gate-ergonomics
title: Lifecycle gate ergonomics — guardrails not brick walls
status: exploring
parent: directive-branch-lifecycle
tags: [ux, lifecycle, design-tree, openspec, gates, ergonomics]
open_questions:
  - Should the design-spec auto-scaffold on decided be a full spec generation (LLM-driven from doc content) or a minimal stub that satisfies the gate?
  - Should the feature issue_type still require design-spec ceremony, or should the lightweight bypass extend to all types when substance checks pass?
---

# Lifecycle gate ergonomics — guardrails not brick walls

## Overview

The lifecycle gates (set_status(decided), implement) were designed to enforce design rigor but in practice create friction that causes the agent to fight the system rather than flow through it. The gates should be power armor — guiding and supporting the operator — not obstacles that require workarounds.

Observed friction from this session:
- Agent said "The gate system is fighting me" when trying to transition a thoroughly-explored node to decided
- Had to set issue_type to feature, set priority, manually scaffold openspec design spec, then delete it and retry
- Error messages like "Scaffold design spec first via set_status(exploring)" are curt and don't suggest the fastest path forward
- The design-spec-before-decided gate duplicates work when the design exploration is already thorough in the doc itself

The gates should differentiate between "you haven't done the work" and "you've done the work but haven't done the paperwork." The former deserves a hard stop. The latter deserves guidance on how to satisfy the gate with minimum ceremony.

## Research

### Identified friction points in the current gate system

**Gate 1: `set_status(decided)` requires archived design spec**

Current behavior (design-tree/index.ts:800-828):
- Non-lightweight nodes (feature, epic) must have `openspec/design/{id}/` scaffolded AND archived
- If missing: "Cannot mark X decided: scaffold design spec first via set_status(exploring)"
- If active but not archived: "Cannot mark X decided: run /assess design then archive"

Problems:
- A node with thorough research, decisions, and zero open questions in the doc itself STILL fails the gate because the design spec artifact doesn't exist
- The design spec is a separate artifact (`openspec/design/{id}/`) that duplicates what's already in `docs/{id}.md`
- The agent has to create the artifact, immediately archive it, then retry — pure busywork

**Gate 2: `implement` requires decided/resolved status AND archived design spec**

Current behavior (design-tree/index.ts:1138-1179):
- Non-lightweight nodes must pass both the status check and the design spec check
- Double-gating: you need decided (which needs design spec), AND implement rechecks design spec

Problems:
- If the node is resolved (all questions answered, decisions made) but the design spec gate wasn't passed, implement fails with a different error
- The implement gate's design spec check is redundant with the decided gate — if decided passed, the design spec is already archived

**Gate 3: Error messages lack actionable guidance**

Examples of messages that tell you what's wrong but not what to do:
- "Scaffold design spec first via set_status(exploring)" — what does that even mean? What should the agent do next?
- "archive the design change first" — which change? What command?
- "not 'decided' or 'resolved'" — but the node has zero open questions and 5 decisions

**What power-armor gates would look like:**

Instead of hard stops, gates should:
1. **Assess readiness** — check if the SUBSTANCE is there (research, decisions, no open questions) not just the ARTIFACTS
2. **Auto-scaffold when possible** — if the design spec is missing but the doc has sufficient content, create it automatically
3. **Suggest the fastest path** — "Run `design_tree_update set_status decided` — I'll scaffold the design spec for you"
4. **Differentiate ceremony from substance** — missing research = hard stop with guidance; missing artifact = auto-create

### Proposed gate behavior changes

**Principle: substance over ceremony. Automate the paperwork, gate on the thinking.**

### set_status(decided) changes:

1. **Substance check** (keep as hard gate):
   - Open questions > 0 → BLOCK: "Resolve N open questions before deciding"
   - Decisions count = 0 → BLOCK: "Record at least one decision before marking decided"

2. **Artifact check** (downgrade from hard gate to auto-scaffold):
   - Design spec missing → AUTO-CREATE from the doc's content, then proceed
   - Design spec active but not archived → AUTO-ARCHIVE, then proceed
   - Both → scaffold AND archive in one pass

3. **Message improvement**:
   - Old: "Cannot mark X decided: scaffold design spec first via set_status(exploring)"
   - New: "Auto-scaffolded design spec from docs/X.md (3 decisions, 0 open questions). Proceeding to decided."
   - If substance check fails: "Cannot mark X decided: 2 open questions remain. Resolve them first, or use `remove_question` if they're no longer relevant."

### implement changes:

1. **Remove redundant design spec check** — if the node is decided, the decided gate already handled it
2. **Allow resolved status** (already does, but the error message implies otherwise)
3. **Auto-transition resolved → decided** when implement is called on a resolved node with sufficient substance

### Error message template:

All gate rejections should follow this pattern:
```
⚠ {what's blocked}: {why}
→ {what to do next}
```

Examples:
- "⚠ Cannot decide: 2 open questions remain\n→ Resolve them with add_decision/remove_question, or branch child nodes for exploration"
- "⚠ Cannot implement: node is 'exploring', not 'decided'\n→ Resolve open questions and run set_status(decided)"

## Decisions

### Decision: Gate on substance (open questions, decisions), not artifacts (openspec/design/ directory existence)

**Status:** exploring
**Rationale:** The design spec artifact (openspec/design/{id}/) is a formalization of work that already exists in docs/{id}.md. When the doc has thorough research, decisions recorded, and zero open questions, the substance is there — the artifact is paperwork. Auto-scaffolding the artifact from the doc eliminates busywork while preserving the audit trail.

### Decision: Error messages must follow ⚠ what → how pattern with actionable commands

**Status:** exploring
**Rationale:** Current messages like "scaffold design spec first via set_status(exploring)" are cryptic even to the agent that built the system. Every rejection should say what's blocked, why, and exactly what command to run next. The system should feel like power armor giving tactical guidance, not a bureaucrat stamping DENIED.

## Open Questions

- Should the design-spec auto-scaffold on decided be a full spec generation (LLM-driven from doc content) or a minimal stub that satisfies the gate?
- Should the feature issue_type still require design-spec ceremony, or should the lightweight bypass extend to all types when substance checks pass?
