---
id: opsx-core-rust-fsm
title: opsx-core — Rust-backed lifecycle FSM for OpenSpec enforcement
status: seed
parent: release-milestone-system
tags: [omega, architecture, future]
open_questions:
  - Should the Rust FSM be a library crate that both Omegon and Omega depend on, or an Omega-only component that Omegon never touches?
  - If markdown stays as the display layer, how does bidirectional sync work? Operator edits markdown → sled needs to know. Sled state changes → markdown needs to reflect. Conflict resolution?
jj_change_id: xkosvrtnnlqwqlnspulzvwrwvumrwyqq
---

# opsx-core — Rust-backed lifecycle FSM for OpenSpec enforcement

## Overview

Replace markdown-as-source-of-truth with a Rust state machine that owns the lifecycle. Markdown becomes the UI/display layer, not the authority. Components: lifecycle FSM (statig), task DAG (daggy/dagcuter), spec validator (jsonschema + garde), state store (sled). Scoped to Omega (enterprise orchestrator), not Omegon (single-operator tool). The single-operator workflow stays git-native markdown; the fleet orchestration layer gets enforcement.

## Open Questions

- Should the Rust FSM be a library crate that both Omegon and Omega depend on, or an Omega-only component that Omegon never touches?
- If markdown stays as the display layer, how does bidirectional sync work? Operator edits markdown → sled needs to know. Sled state changes → markdown needs to reflect. Conflict resolution?
