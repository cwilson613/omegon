---
id: agent-assess-tooling-access
title: "Agent harness access to /assess tooling"
status: implementing
parent: cleave-dirty-tree-checkpointing
tags: [harness, assess, tooling, openspec, workflow]
open_questions: []
branches: ["feature/agent-assess-tooling-access"]
openspec_change: agent-assess-tooling-access
---

# Agent harness access to /assess tooling

## Overview

Enable the agent harness to invoke /assess capabilities directly, or expose equivalent first-class tools, so the agent can complete spec and review workflows without handing control back to the operator for command-only steps.

## Research

### Why this gap matters

The current lifecycle expects the agent to propose, spec, implement, and then run `/assess spec` or related review commands before archive, but the harness does not expose `/assess` as an invokable tool. That creates a workflow break where the agent can prepare everything but must hand control back to the operator for a command-only step, weakening autonomy and lifecycle reconciliation.

### Preferred direction

The operator prefers a platform-level bridge for slash commands rather than a one-off `/assess` tool. The bridge should support agent execution of approved slash commands with structured machine-readable results, explicit safety controls, and compatibility with existing operator-facing command UX.

### Structured result shape

A bridged slash command should return a normalized envelope such as `{ command, args, ok, summary, humanText, data, effects, nextSteps }`. `data` holds command-specific structured output (for assessment: findings, severity counts, spec scenarios checked, reopened-work-needed booleans, suggested reconciliation actions). `effects` records observable side effects like files changed, branches created, or lifecycle state touched. `humanText` remains available for logs and interactive rendering, but the agent consumes the structured fields first.

### Safety model

The bridge should not execute arbitrary slash commands by name. Commands opt in through explicit metadata such as `agentCallable`, `resultSchema`, and a side-effect classification (`read`, `workspace-write`, `git-write`, `external-side-effect`, `operator-confirm-required`). The harness tool can then refuse unapproved commands, surface confirmation requirements, and preserve a bounded trust model even though the mechanism is generic.

### Implementation direction

The cleanest architecture is to factor slash-command bodies into shared handlers that return structured results. Existing interactive command registrations then become thin renderers over those handlers, while a new harness tool invokes the same handlers by command id. This avoids parsing terminal text, keeps command behavior consistent across human and agent entrypoints, and lets commands gradually opt into bridge support.

## Decisions

### Decision: Build a general harness bridge for slash commands, not a one-off /assess shim

**Status:** decided
**Rationale:** The underlying gap is broader than assessment. If the harness can only invoke `/assess`, similar lifecycle breaks will recur for other command-only capabilities. A general slash-command bridge with explicit safety boundaries and structured result capture solves the platform problem once and lets agent workflows invoke approved commands without bespoke wrappers for each one.

### Decision: Slash-command bridge should be allowlisted and return structured results

**Status:** decided
**Rationale:** A general slash-command bridge is only safe if commands opt in explicitly. Each bridged command should declare whether it is agent-callable, its side-effect class, and a machine-readable result schema. The harness tool should invoke only allowlisted commands and return a normalized envelope instead of raw terminal text.

### Decision: Assessment commands should expose a first-class structured result contract

**Status:** decided
**Rationale:** The agent must be able to reconcile OpenSpec, design-tree, and follow-up fixes without scraping TUI-oriented prose. Assessment-capable commands should therefore return a structured payload including status, findings, severity summary, suggested next steps, changed file hints, and lifecycle reconciliation signals, while still preserving a human-readable rendering for interactive use.

### Decision: Human-readable command UX and agent execution should share one implementation path

**Status:** decided
**Rationale:** Duplicating command logic into separate slash-command and tool-only implementations would create drift. Commands should execute through shared internal handlers that produce structured results; the interactive slash-command path renders those results for humans, while the harness bridge returns the structured envelope directly to the agent.

### Decision: V1 should prioritize lifecycle-critical commands while keeping the bridge generic

**Status:** decided
**Rationale:** The platform should be generic, but the first commands onboarded to the allowlist should be the ones blocking autonomous workflows today: `/assess spec`, `/assess diff`, `/assess cleave`, and other lifecycle-critical commands that already participate in OpenSpec/design-tree reconciliation. This keeps scope controlled while avoiding a dead-end `/assess`-only solution.

## Open Questions

*No open questions.*

## Implementation Notes

### File Scope

- `extensions/cleave/assessment.ts` (modified) — Inspect whether existing assessment logic can be wrapped as structured tool entrypoints instead of command-only flows
- `extensions/cleave/index.ts` (modified) — Potential place to register agent-safe assessment tools or command bridge wiring
- `extensions/openspec/index.ts` (modified) — Coordinate lifecycle reconciliation after assess results are available programmatically
- `extensions/design-tree/index.ts` (modified) — Optional reconciliation hook if assess results should reopen or update design nodes
- `docs/agent-assess-tooling-access.md` (modified) — Capture design decisions, UX, and safety boundaries for agent-executable assessment
- `extensions/cleave/index.ts` (modified) — Refactor /assess and related command handlers behind shared structured executors and register bridge metadata
- `extensions/types.d.ts` (modified) — Add command metadata for agent-callable slash commands and structured result contracts if the extension API surface needs typing support
- `extensions/lib/slash-command-bridge.ts` (new) — New shared bridge for allowlisted slash-command execution, metadata lookup, normalization, and safety checks
- `extensions/openspec/index.ts` (modified) — Optionally onboard lifecycle commands to the bridge and emit reconciliation hints in structured form
- `extensions/design-tree/index.ts` (modified) — Optionally onboard design-tree lifecycle commands or reopen/update hooks using structured bridge results
- `docs/agent-assess-tooling-access.md` (modified) — Record bridge architecture, result envelope, safety model, and v1 command allowlist

### Constraints

- Assessment entrypoints exposed to the agent must return structured machine-readable results, not require scraping terminal-only output.
- Do not expose arbitrary slash-command execution unless explicit safety boundaries, allowlists, and side-effect semantics are defined.
- The v1 solution should cover the OpenSpec lifecycle gap first: spec assessment and cleave/diff review paths used by the agent workflow.
- Assessment access should preserve existing operator-visible UX while enabling autonomous execution inside the harness.
- Bridged commands must be implemented once and rendered twice: structured result for agents, human text for interactive users.
- Every bridged command must declare an explicit result schema or typed data shape; opaque string-only success responses are insufficient.
- The bridge must refuse commands that are not explicitly allowlisted as agent-callable.
- Commands with destructive or external side effects must surface confirmation requirements through structured metadata rather than silently executing.
