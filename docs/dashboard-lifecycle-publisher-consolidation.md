---
id: dashboard-lifecycle-publisher-consolidation
title: Dashboard and lifecycle publisher consolidation
status: implementing
parent: repo-consolidation-hardening
tags: [dashboard, lifecycle, publishers, consolidation, shared-state]
open_questions: []
branches: ["feature/dashboard-lifecycle-publisher-consolidation"]
openspec_change: dashboard-lifecycle-publisher-consolidation
---

# Dashboard and lifecycle publisher consolidation

## Overview

Reduce repeated dashboard-state and lifecycle publication plumbing by extracting a narrower shared publisher/update seam for OpenSpec, design-tree, and cleave status emission.

## Research

### Why this is the next bounded consolidation slice

After canonical lifecycle resolution, the next concentrated duplication is publisher plumbing: OpenSpec and design-tree still call `emitOpenSpecState`/`emitDesignTreeState` across many command/tool paths, and cleave maintains its own adjacent status emission flow. Consolidating publication triggers and shared dashboard-update behavior is smaller and safer than attacking oversized entrypoint decomposition or all model-control responsibilities at once.

### Likely implementation seam

Introduce a small shared publisher module or command-safe refresh helpers that own dashboard-state recomputation and event emission for OpenSpec/design-tree/cleave. Existing extensions would call the shared refresher at mutation boundaries instead of manually invoking emit functions at many sites. The goal is to reduce repeated boilerplate and keep dashboard-facing state refresh semantics consistent without rewriting each extension's domain logic.

## Decisions

### Decision: Consolidate publisher plumbing before attempting large entrypoint decomposition

**Status:** decided
**Rationale:** A shared publisher/refresh seam removes repetitive mutation-boundary boilerplate across OpenSpec and design-tree, improves consistency of dashboard updates, and is much more bounded than splitting several 1.5k-2.8k line extensions all at once.

## Open Questions

*No open questions.*
