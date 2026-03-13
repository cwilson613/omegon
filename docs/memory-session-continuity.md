---
id: memory-session-continuity
title: "Memory: Session Continuity — Proactive startup injection and recency window"
status: implementing
parent: memory-system-overhaul
open_questions: []
branches: ["feature/memory-session-continuity"]
openspec_change: memory-session-continuity
---

# Memory: Session Continuity — Proactive startup injection and recency window

## Overview

> Parent: [Memory System Overhaul — Reliable Cross-Session Context Continuity](memory-system-overhaul.md)
> Spawned from: "What is the right proactive session-start injection strategy — load recent episodes + recency window + Architecture/Decisions core, and how does this interact with the existing semantic injection on first message?"

*To be explored.*

## Decisions

### Decision: Session start loads three layers before first message: recent episodes + recency window + Architecture/Decisions core

**Status:** decided
**Rationale:** Current injection is reactive — waits for first user message then semantically queries. Fails for continuation questions that assume context. Solution: at session_start inject (1) last 3 episodes (narrative of what was worked on), (2) top 20 facts by last_reinforced DESC regardless of section (recency window), (3) Architecture + Decisions sections always. This reconstructs "where we were" before the user speaks.

### Decision: Semantic retrieval on first message augments the startup payload, not replaces it

**Status:** decided
**Rationale:** Proactive structural load (session start) and reactive semantic retrieval (first message) serve different purposes and must both run. Startup payload gives structural context. Semantic retrieval adds task-specific Constraints/Specs/Known Issues on top. Core sections move from [Constraints, Specs] to [Architecture, Decisions] — those are always loaded. Constraints and Specs are retrieved semantically when relevant.

## Open Questions

*No open questions.*
