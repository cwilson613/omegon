---
id: native-plan-mode
title: Native plan mode — structured task decomposition with TUI widget and web dashboard integration
status: exploring
parent: markdown-viewport
dependencies: [embedded-web-dashboard]
related: [mdserve-dioxus-frontend]
tags: [rust, tui, planning, web-dashboard, openspec, design-tree]
open_questions:
  - Should the plan TUI widget live in the dashboard panel, the conversation stream, or both? Dashboard gives persistent visibility; conversation keeps context inline.
  - "The web dashboard currently serves basic HTML via the embedded axum server. What's the frontend stack for the enriched plan/lifecycle view — raw HTML+JS, HTMX, or full Dioxus WASM (mdserve-dioxus-frontend is already a seed node)?"
issue_type: epic
priority: 2
---

# Native plan mode — structured task decomposition with TUI widget and web dashboard integration

## Overview

The Rust TUI needs native task planning — structured decomposition, dependency ordering, interactive approval, and progress tracking. Two surfaces: (1) TUI widget — compact plan view in the conversation or dashboard showing tasks with status badges, dependency arrows, and approve/reject controls. (2) Web dashboard — the existing /dash open command already launches a localhost UI. This should become a rich plan viewer that integrates with the existing OpenSpec and design-tree data. The web surface shows the full design tree, implementation specs with Given/When/Then scenarios, task progress, and plan history. Not a separate planning system — it surfaces the same lifecycle data (design nodes, OpenSpec changes, cleave decomposition) through a visual plan interface. The TUI widget shows the current plan inline; the web dashboard shows the full graph. OpenCrabs' PlanDocument model is a useful reference for the data structure: typed tasks with dependencies, complexity scores, acceptance criteria, and status transitions. But our version should be backed by the existing design-tree + OpenSpec artifacts rather than a separate plan store.

## Open Questions

- Should the plan TUI widget live in the dashboard panel, the conversation stream, or both? Dashboard gives persistent visibility; conversation keeps context inline.
- The web dashboard currently serves basic HTML via the embedded axum server. What's the frontend stack for the enriched plan/lifecycle view — raw HTML+JS, HTMX, or full Dioxus WASM (mdserve-dioxus-frontend is already a seed node)?
