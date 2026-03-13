---
id: memory-pruning-ceiling
title: "Memory: Structural Pruning Ceiling — DB-level decay enforcement and section caps"
status: decided
parent: memory-system-overhaul
open_questions: []
---

# Memory: Structural Pruning Ceiling — DB-level decay enforcement and section caps

## Overview

> Parent: [Memory System Overhaul — Reliable Cross-Session Context Continuity](memory-system-overhaul.md)
> Spawned from: "How do we enforce a structural fact ceiling — DB-level pruning by confidence/age — without losing genuinely durable long-lived facts?"

*To be explored.*

## Decisions

### Decision: Cap effective half-life at 90 days regardless of reinforcement count

**Status:** decided
**Rationale:** Current formula: halfLife = halfLifeDays * reinforcementFactor^(n-1). With reinforcement counts up to 119 and any factor > 1.0 this produces years-long half-lives, making decay functionally inert. Fix: clamp the computed halfLife to a maximum of 90 days. Facts that need to live longer must be explicitly pinned via memory_focus. This gives decay teeth without destroying genuinely durable facts — a fact reinforced every session for 3 months is still around, but it has to keep getting reinforced to stay.

### Decision: Per-section ceiling: when a section exceeds 60 facts, run a targeted LLM archival pass over that section only

**Status:** decided
**Rationale:** A holistic extraction agent can't audit 1273 facts — it only sees the current conversation. A per-section archival pass is tractable: 60 facts fits in context, the agent can reason about what to keep vs archive within that section. Trigger at session_start when section count > 60. Scoped prompt: "here are all 70 Architecture facts, archive the least useful ones to bring the section under 60." Immune: facts in working memory (pinned). This is separate from the confidence-decay mechanism — two independent ceilings.

## Open Questions

*No open questions.*
