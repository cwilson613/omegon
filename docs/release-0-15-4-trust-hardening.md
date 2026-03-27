---
id: release-0-15-4-trust-hardening
title: "0.15.4 trust hardening — runtime trust and release integrity"
status: exploring
tags: [release, stabilization, trust, runtime, planning]
open_questions: []
dependencies: []
related:
  - orchestratable-provider-model
  - openai-provider-identity-and-routing-honesty
  - session-secret-cache-preflight
  - harness-diagnostics
  - merge-safety-improvements
  - release-candidate-system
  - update-channels
---

# 0.15.4 trust hardening — runtime trust and release integrity

## Overview

Cross-cutting release-planning umbrella for the 0.15.4 RC series. This node does not replace the existing domain taxonomy; it consolidates the release-critical work needed to make Omegon trustworthy to operate, evaluate, and ship. The core release thesis is: routing is honest, startup is deterministic, failures leave evidence, and release/merge flow resists silent regressions. This umbrella should group the existing critical nodes without collapsing their distinct design questions.

## Decisions

### Decision: 0.15.4 is a trust-and-stability release, not a broad feature release

**Status:** decided

**Rationale:** The design tree currently has enough active fronts that 0.15.4 could sprawl into another long RC train. The release thesis should stay narrow: routing must be honest, startup must be deterministic, failures must leave evidence, and release/merge flow must resist silent regressions. Large new platform surfaces (Omega expansion, tutorial ecosystem, speculative memory systems, cross-instance orchestration) dilute that goal and should not define this release.

### Decision: 0.15.4 release blockers are provider/routing integrity, secret preflight, diagnostics v1, and merge/release safety

**Status:** decided

**Rationale:** The minimum set that makes the harness trustworthy to evaluate and ship is: (1) close out orchestratable-provider-model verification, (2) land OpenAI-family provider identity and routing honesty, (3) implement session secret cache/startup preflight v1 so interactive sessions warm required secrets and headless children never prompt mid-task, (4) ship harness diagnostics v1 so failures leave structured evidence, and (5) implement the actionable merge-safety improvements that catch silent regressions before or immediately after merge. Without these, 0.15.4 remains difficult to trust operationally.

### Decision: update-channels and TUI operator visibility improvements are stretch for 0.15.4, not blockers

**Status:** decided

**Rationale:** Update channels, in-TUI self-update, footer/engine display, and input-area UX improvements can improve operator experience, but they are not the critical path to restoring trust in the harness. They should land in the RC series only if they stay low-risk and directly support runtime honesty or release evaluation. If they threaten schedule or expand scope, they defer without blocking 0.15.4.

### Decision: the 0.15.4 RC sequence should progress integrity first, then determinism, then observability

**Status:** decided

**Rationale:** Use the RC series to stage risk in a rational order. RC1 should validate provider/routing/auth integrity and realistic orchestrated execution. RC2 should harden startup determinism and merge/release safety, including session secret preflight and release guardrails. RC3 should add diagnostics v1 and any low-risk operator visibility improvements needed to inspect runtime truth. Additional RCs, if any, are for stabilization and bugfixes rather than new strategic scope.
