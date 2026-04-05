---
id: conversation-rendering-engine
title: "Conversation Rendering Engine"
status: exploring
tags: [tui, rendering, conversation, artifacts]
open_questions: []
dependencies: []
related:
  - conversation-widget
  - inline-image-rendering
  - display-tool-artifacts
  - embedded-web-dashboard
  - native-plan-mode
---

# Conversation Rendering Engine

## Overview

Own the terminal-side conversation rendering architecture: segment-based rendering, markdown/text layout, tool cards, inline image rendering, display artifacts, and operator-facing visual presentation inside Omegon. This node explicitly excludes the broader browser-based project intelligence portal and auspex-hosted dashboard concerns, which should live outside this rendering-engine scope.

## Research

### Boundary split versus markdown-viewport and Auspex

Boundary cleanup conclusion:
- `conversation-rendering-engine` owns terminal-side conversation rendering inside Omegon: segment architecture, inline images, display artifacts, and operator-facing visual presentation in the TUI conversation stream.
- `embedded-web-dashboard` and `native-plan-mode` remain Omegon-local because they are specifically about the built-in `/dash` surface served from the omegon binary.
- `markdown-viewport` should remain the browser/project-intelligence portal epic derived from mdserve/Auspex, not be repurposed as the terminal rendering umbrella.
- `pikit-auspex-extension`, `mdserve-lifecycle-backend`, `mdserve-dioxus-frontend`, and `mdserve-nix-distribution` belong with the browser/Auspex track, not under terminal conversation rendering.

## Decisions

### Decision: Conversation Rendering Engine is the terminal-side parent for display artifacts

**Status:** decided

**Rationale:** The existing markdown-viewport umbrella had mixed terminal conversation rendering with browser-based project intelligence work. The terminal segment system, inline media, and display tool belong under a narrower parent dedicated to conversation rendering inside Omegon.

### Decision: `markdown-viewport` remains the browser/project-intelligence epic

**Status:** decided

**Rationale:** The existing `markdown-viewport` node is not actually about terminal rendering; its content is a browser-based project intelligence portal derived from mdserve/Auspex. Repurposing it as the terminal rendering parent would reintroduce the same category error. Keep it as the browser portal epic and carve terminal rendering into its own parent.

### Decision: `embedded-web-dashboard` stays Omegon-local, separate from Auspex/mdserve

**Status:** decided

**Rationale:** `embedded-web-dashboard` is specifically the lightweight localhost UI served from the omegon binary for live in-process session state. It is not the same thing as the broader mdserve/Auspex intelligence portal, even though both are browser surfaces. Keep it under Omegon-local design ownership rather than folding it into the external portal track.

### Decision: Auspex backend guarantees live in IPC; `/dash` remains a local browser protocol

**Status:** decided

**Rationale:** The current embedded web control plane in `core/crates/omegon/src/web/api.rs` and `core/crates/omegon/src/web/ws.rs` is intentionally shaped around the built-in dashboard. `/api/state` currently publishes only `design`, `openspec`, `cleave`, and `session`, while the richer Auspex contract lives in the IPC snapshot projection (`core/crates/omegon/src/ipc/snapshot.rs`). Likewise, the embedded WebSocket still speaks legacy snake_case `type` events such as `turn_start`, `turn_end`, `tool_end`, `harness_status_changed`, and `context_updated`, whereas the canonical Auspex event names are the dot-delimited IPC events in `core/crates/omegon/src/ipc/connection.rs`. That split should stay explicit in docs until or unless the web protocol is deliberately brought up to IPC parity.

### Validation note: current embedded web surface versus canonical Auspex contract

Validated against the current code:
- The embedded dashboard HTML in `core/crates/omegon/src/web/assets/dashboard.html` still consumes `state_snapshot`, `turn_start`, and `tool_end` events from the local WebSocket.
- `core/crates/omegon/src/web/ws.rs` accepts only `user_prompt`, `slash_command`, `cancel`, and `request_snapshot` commands.
- `core/crates/omegon/src/web/api.rs` still builds a dashboard-focused snapshot rather than the full IPC `IpcStateSnapshot`.

Conclusion: browser `/dash` consumers should be documented as using a local Omegon dashboard protocol, while Auspex itself should anchor on IPC for canonical backend guarantees.

### Decision: Terminal rendering work moves under `conversation-rendering-engine`

**Status:** decided

**Rationale:** Terminal-side nodes such as conversation-widget, inline-image-rendering, clipboard-image-paste, and display-tool-artifacts form a coherent subsystem around conversation rendering and artifact presentation. They should be grouped under a dedicated terminal rendering parent instead of hanging from the browser portal epic.
