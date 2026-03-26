---
id: dash-visual-sugar
title: Raised Dashboard Visual Polish — Box Layout + Memory Consolidation
status: implemented
parent: unified-dashboard
open_questions: []
---

# Raised Dashboard Visual Polish — Box Layout + Memory Consolidation

## Overview

Raised mode visual improvements: wrap layout in corner-bounded box (╭╰├│), incorporate git branch into top border and /dash hint into bottom border, eliminate standalone separator + hint lines, consolidate duplicate memory displays into one line showing total stored facts + injection metrics, filter memory extension status in raised mode.

## Decisions

### Decision: Raised mode expands indefinitely; truncate sections with /dashboard hint

**Status:** decided
**Rationale:** Unbounded growth reflects reality — too many nodes/changes is a planning issue not a render bug. Each section (design tree, openspec, branches) truncates at a per-section cap and appends "… N more — /dashboard to expand". Bottom border in raised shows "/dash to compact · /dashboard to expand"; compact keeps "/dash to expand" only.

## Open Questions

*No open questions.*
