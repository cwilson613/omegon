---
id: provider-routing-integrity
title: "Provider routing integrity — release-critical provider architecture and operator honesty"
status: exploring
parent: bridge-provider-routing
tags: [providers, routing, auth, planning, release]
open_questions: []
dependencies: []
related:
  - orchestratable-provider-model
  - openai-provider-identity-and-routing-honesty
  - openai-codex-responses-client
  - provider-landscape-assessment
---

# Provider routing integrity — release-critical provider architecture and operator honesty

## Overview

Cross-cutting planning node for the active provider/routing work that matters to release trust. This node exists to separate three concerns that currently sit side-by-side under bridge-provider-routing: (1) routing/resource architecture, (2) operator-visible provider/auth honesty, and (3) client/substrate implementation and broader provider strategy. For 0.15.4 planning, the critical path is the first two: the harness must route GPT-family requests to executable backends, preserve honest concrete-provider reporting, and make per-task provider selection trustworthy in both interactive and orchestrated flows.

## Decisions

### Decision: provider routing integrity for 0.15.4 is defined by orchestrated routing correctness plus operator-visible honesty

**Status:** decided

**Rationale:** The active provider work has two distinct but coupled release-critical obligations. First, orchestrated routing must select executable concrete provider/model pairs for tasks and cleave children instead of relying on stale single-bridge defaults or invalid fallback strings. Second, every operator-facing surface must report the concrete provider/model/credential path honestly, especially within the OpenAI family where API-key OpenAI and ChatGPT/Codex OAuth are distinct execution paths. Both must hold at once; correct hidden routing without truthful reporting is still a trust failure, and truthful reporting of a broken routing path is still an operational failure.

### Decision: client/substrate nodes remain separate from provider-integrity planning in this pass

**Status:** decided

**Rationale:** `openai-codex-responses-client` and `provider-landscape-assessment` are important context, but they answer different questions from the release-critical provider integrity work. The Codex client is implementation substrate that enables OAuth-backed execution. The landscape assessment is strategic research that shapes longer-term provider coverage. Keeping them related but separate avoids collapsing architecture, operator honesty, implementation mechanism, and market strategy into one node prematurely.
