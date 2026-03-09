---
id: operator-capability-profile
title: Operator capability profile — provider login + local hardware assessment
status: implementing
related: [bootstrap, provider-neutral-model-controls, guardrail-capability-probe, cost-reduction]
tags: [models, provider, bootstrap, ux, capabilities, onboarding]
open_questions: []
branches: ["feature/operator-capability-profile"]
openspec_change: operator-capability-profile
---

# Operator capability profile — provider login + local hardware assessment

## Overview

Explore adding an operator profile captured during first-time setup or new-machine setup that records upstream provider availability, login state, and local inference capabilities so pi-kit can avoid harmful fallbacks, choose sane defaults, and tailor routing to the actual machine.

## Research

### Assessment summary

A profile layer would solve two distinct problems that are currently conflated: (1) environment capability discovery and (2) routing policy preferences. Bootstrap already knows how to detect runtime dependencies, provider-neutral controls already persist concrete driver choices, and capability probes already define the scope of startup checks. What is missing is a durable operator-scoped profile that answers: which upstream providers are configured and authorized, which local inference paths are actually acceptable on this hardware, and what fallback rules preserve UX rather than merely maximizing availability.

### Why this is worth doing now

Recent behavior shows that 'best available local model' is not the same as 'acceptable fallback'. A 30B local model that takes minutes to become interactive degrades the harness more than a clean failure or explicit prompt for confirmation. Capturing operator-specific constraints such as 'never auto-fallback to heavy local models' would let pi-kit preserve responsiveness while still exposing local inference as an optional capability.

### Shape of the profile

The profile should likely separate declarative facts from volatile runtime state. Stable preferences: preferred providers by tier, whether cloud fallback is allowed, whether heavy local models require confirmation, acceptable latency budget for local inference, preferred local models by role, and whether the machine is considered 'setup complete'. Volatile state: current provider auth status, detected Ollama availability, discovered local models, and lightweight hardware observations. This split keeps operator intent durable while allowing startup checks to refresh live conditions.

### Recommended rollout

Phase 1 should stay conservative: add profile capture during bootstrap/new-machine setup, store explicit provider preferences and local-inference guardrails, and use them only to prevent bad automatic decisions. Example: never auto-switch to qwen3:30b if the profile marks it as slow or confirmation-required. Phase 2 can add interactive local-model benchmarking through Ollama to estimate latency and quality on the current hardware. That second phase should remain optional and exploratory rather than on the critical path for first-run setup.

### Profile schema proposal

Proposed schema has three layers. (1) Intent layer: operator-facing roles such as `archmagos`, `magos`, `adept`, `servitor`, `servoskull`. These are stable semantic roles, not concrete models. (2) Resolution layer: per-role ordered candidates and provider preferences, e.g. `archmagos -> [anthropic/claude-opus-4-6, openai/gpt-5.4]`, `magos -> [anthropic/claude-sonnet-4-6, openai/gpt-5.3-codex-spark]`, `servoskull -> [ollama/qwen3:8b]`. (3) Policy layer: fallback rules using `allow | ask | deny` for same-role cross-provider, cross-source, heavy-local, and unknown-local-performance decisions. Runtime capability checks then prune unavailable candidates from the ordered resolution list rather than inventing new behavior.

### Concrete mapping model

A practical v1 shape is: `operatorProfile.roles` plus `operatorProfile.fallback` in `.pi/config.json`, with runtime cooldown/machine state stored separately. Each role holds ordered candidate objects like `{ id, provider, source, weight, maxThinking }`, e.g. `archmagos: [{ id: "claude-opus-4-6", provider: "anthropic", source: "upstream", weight: "heavy", maxThinking: "high" }]`. Provider entries declare whether a provider is enabled, preferred, and requires login. Runtime state records which candidates are currently usable.

### Recommended semantics for fallback

The role mapping should distinguish three transitions: same-role fallback, cross-provider fallback, and cross-source fallback. Same-role fallback means e.g. `magos` from Anthropic Sonnet to OpenAI GPT-5.3-codex-spark. Cross-provider fallback is acceptable if the role remains the same. Cross-source fallback means moving from upstream candidates to local candidates; this is the dangerous transition and should default to `ask` or `deny`, never silent `allow`, because the UX cost can exceed the value of availability. Local roles can independently allow intra-local fallback among models of similar cost.

### Canonical role options for v1

Options for the initial role set: (A) Minimal tier-only roles: `archmagos`, `magos`, `adept`, `servitor`, `servoskull`. Easiest to explain and maps directly to current operator vocabulary. (B) Tier roles plus one execution role: add task aliases like `review` and `background` for cases where review and background summarization need different defaults without exposing too many knobs. (C) Fully task-scoped roles: separate `review`, `compaction`, `extraction`, `cleave.leaf`, `dashboard`, etc. Most expressive but too granular for v1 and likely to confuse first-run setup. Recommendation: choose A for the public schema, but allow internal task aliases to map onto those public roles so future specialization does not break the config shape.

### Graceful degradation model

If the user skips setup, pi-kit should still produce a safe default profile rather than an empty state. Default profile should prefer upstream candidates, allow same-role cross-provider fallback, and deny silent upstream-to-heavy-local fallback. Local usage should be conservative by default: light local tasks may be allowed when explicitly requested or when mapped to background roles, but heavy local models should require confirmation until the operator opts in. This gives good out-of-box behavior without forcing setup completion.

### Dynamic upstream failure handling

Unexpected provider failures during execution need a different path than startup capability checks. Errors such as Anthropic 429/rate limiting or OpenAI session-limit exhaustion are evidence that the originally selected upstream path has become temporarily unavailable. The resolver should treat these as transient capability failures, record them in runtime state with a cooldown window, and then either (1) ask the operator how to proceed if the next candidate changes provider or source or materially changes latency/quality, or (2) automatically retry with the next same-role candidate if the profile allows it. This keeps recovery graceful while avoiding silent degradations.

### Resolver algorithm sketch

Proposed resolution algorithm: (1) accept an internal requested role, e.g. `planning` or `cleave.leaf`; (2) map through `internalAliases` to a canonical public role; (3) load the ordered candidate list for that role; (4) filter out candidates whose provider is disabled, unauthenticated, missing locally, or in a runtime cooldown window; (5) choose the first surviving candidate; (6) if no candidate survives, compute whether the next possible move is same-role, cross-provider, or cross-source and apply policy (`allow`, `ask`, `deny`); (7) when a provider fails mid-run with a transient error such as 429 or session-limit exhaustion, mark that candidate or provider unavailable for a cooldown period and retry resolution from step 4; (8) emit an operator-facing explanation whenever policy blocks or asks. The resolver should never invent a candidate outside the profile/default-profile list.

### Config storage options

There are two plausible storage layouts. Option 1: keep operator profile in `.pi/config.json` alongside existing preferences, with machine-local runtime state in a separate untracked file such as `.pi/runtime-capabilities.json`. This minimizes file sprawl and keeps durable preferences near current config. Option 2: split `operator-profile.json` and `machine-profile.json` explicitly. Cleaner conceptual separation, but introduces another top-level artifact and migration surface. Recommendation: use `.pi/config.json` for durable operator intent and a separate runtime cache for discovered/mutable machine state; machine-local overrides can be nested under `operatorProfile.machineOverrides[<fingerprint>]` later if needed.

### Fallback vocabulary

V1 fallback policy should use a small enum: `allow`, `ask`, `deny`. This is sufficient for same-role, cross-provider, cross-source, heavy-local, and unknown-local-performance decisions. Leave an explicit extension seam in the schema comments/docs for future values such as `allow_once` or `background_only`, but do not expose them in v1 because they complicate both setup UX and resolver behavior.

### Updated canonical v1 role set

The public v1 role set is the full ladder `archmagos`, `magos`, `adept`, `servitor`, and `servoskull`. Internal task aliases like `review`, `planning`, `compaction`, `extraction`, and `cleave.leaf` should resolve through these public roles rather than expanding the operator-facing schema in v1.

### Terminology correction: frontier is a capability tier, not a provider location

Clarification: `frontier` was an overloaded term and should no longer appear in the schema. Provider location (`anthropic`, `openai`, `ollama`) is orthogonal to role/tier (`archmagos`, `magos`, `adept`, `servitor`, `servoskull`). The schema should not overload `frontier` to mean all cloud models. Better mental model: role names describe capability/intent; provider names describe where the candidate comes from.

### Expanded canonical role ladder

Updated operator-facing capability ladder, in descending order: `archmagos -> magos -> adept -> servitor -> servoskull` (with `cherub` as an alternate low-end label if hyphenation or readability becomes an issue). This is a pure role/tier axis and remains separate from provider/source. A small v1 public set can expose all five roles if we want a complete ladder, or collapse the lowest one or two into internal aliases if setup UX feels too granular.

### Public exposure principle

Operator-facing abstraction does not mean concealment. Pi-kit may group concepts for ergonomics, but all supported capability roles should remain visible and configurable. Internal task mappings can still exist, but they resolve through the same public role ladder rather than introducing hidden private tiers.

### Role semantics clarified

The capability ladder is now semantically defined as descending across the board in capability, cost, and available reasoning depth. `archmagos` is top-of-line with maximum thinking and deepest reasoning. `magos` is the workhorse orchestrator: still strong, but a step down in capability/cost from archmagos, including cheaper or older top-tier models when appropriate. `adept` is for common, well-bounded coding and simpler tasking: effectively a step below magos, often using the same family with lower reasoning or older/cheaper variants. `servitor` is rapid-response / simple-task execution: haiku/spark-class behavior, memory housekeeping, embeddings-adjacent utility work, and other shallow tasks. `servoskull` is the absolute minimum tier: servitor-like tasks but with no thinking enabled and the smallest acceptable models only.

### Tier overlap is allowed and desirable

Adjacent tiers may overlap in practical capability, and that is acceptable. For example, a lower-end `archmagos` candidate may be very close in real-world performance to a high-thinking `magos` candidate. The schema should therefore avoid assuming strict disjointness between tiers. Role membership communicates intended operating envelope and preferred routing, while explicit per-candidate metadata (including provider, source, weight, and maxThinking) preserves flexibility.

### Stale assumptions to supersede

Earlier exploration used `frontier.*` and `local.*` namespaces and suggested a reduced public role set. Those assumptions are now superseded. The corrected model uses a fully public capability ladder (`archmagos`, `magos`, `adept`, `servitor`, `servoskull`) with provider/source modeled separately. Fallback policy should talk about cross-source transitions rather than overloaded frontier/local namespaces.

### Candidate object shape v1

Recommended v1 candidate shape: `{ id, provider, source, weight, maxThinking }`, where `provider` is the concrete backend family (`anthropic`, `openai`, `ollama`, etc.), `source` is `upstream` or `local`, `weight` is a coarse latency/cost bucket such as `light|normal|heavy`, and `maxThinking` is `high|medium|low|off`. Additional fields can be added later (e.g. context window hints, interactive safety, latency budgets, allow-once/background-only semantics) without changing the core resolution model.

## Decisions

### Decision: Profile should gate fallbacks, not just advertise capabilities

**Status:** decided
**Rationale:** The operator's real problem is not lack of detection but unsafe automatic behavior. The profile must be consulted before fallback routing decisions so pi-kit can refuse or require confirmation for high-latency local models, even when they are technically available.

### Decision: Schema should map semantic roles to ordered concrete candidates

**Status:** decided
**Rationale:** The operator should configure intent at the role level (`archmagos`, `magos`, `servoskull`) rather than binding every feature directly to a specific model string. Ordered candidate lists preserve current provider-neutral routing while making preferences explicit and inspectable.

### Decision: Cross-source fallback must be explicit when it materially changes UX

**Status:** decided
**Rationale:** Switching from upstream candidates to local candidates changes latency and quality characteristics enough that it should not be treated as an ordinary fallback. The profile should default this transition to ask-or-deny, preventing harmful silent fallbacks like automatic Qwen 30B selection on slower machines.

### Decision: All capability roles are public and operator-visible

**Status:** decided
**Rationale:** pi-kit should not intentionally hide internal capability levels. Abstractions may exist for technical or conceptual clarity, but every supported role should remain visible and configurable to the operator. This means the full ladder archmagos, magos, adept, servitor, and servoskull is public in v1.

### Decision: Default profile must be safe without setup

**Status:** decided
**Rationale:** Skipping setup should not leave routing undefined or permissive. Pi-kit should synthesize a conservative default profile that prefers upstream candidates, permits same-role cross-provider fallback, and blocks silent upstream-to-heavy-local fallback until the operator opts in.

### Decision: Transient upstream availability failures should enter the fallback policy path

**Status:** decided
**Rationale:** Anthropic 429s, OpenAI session-limit errors, and similar mid-run provider failures should be treated as temporary capability loss. The resolver should cool down the failing candidate and either retry within the same role/class or ask the operator before crossing into a materially different model class.

### Decision: Durable operator intent should live in .pi/config.json; volatile machine/runtime state should live separately

**Status:** decided
**Rationale:** This keeps the main profile discoverable and consistent with existing preference storage while avoiding churn from auth status, installed models, and provider cooldowns. Runtime state is inherently mutable and should not be treated like stable user intent.

### Decision: Initial setup should capture qualitative local policies, not benchmark results

**Status:** decided
**Rationale:** First-run and new-machine setup should stay fast and reliable. Capturing policies like allow/avoid/confirm for local inference is enough to prevent harmful fallbacks immediately; benchmarking can remain an optional later enhancement.

### Decision: Use servoskull as the canonical lowest-tier key

**Status:** decided
**Rationale:** The operator prefers `servoskull` as a single-token config/key name to avoid punctuation and character handling issues while preserving the intended semantic identity of the lowest capability role.

### Decision: Provider/source and role/tier must be separate axes

**Status:** decided
**Rationale:** The schema should not use `frontier` as shorthand for 'upstream'. Operator-facing roles express capability intent (`archmagos`, `magos`, `adept`, `servitor`, `servoskull`), while candidate metadata expresses source/provider (`anthropic`, `openai`, `ollama`) and runtime behavior. This avoids conflating Opus-class reasoning with mere cloud location.

### Decision: Capability roles follow the ladder archmagos → magos → adept → servitor → servoskull

**Status:** decided
**Rationale:** This preserves the intended semantic gradient in operator vocabulary and avoids the earlier confusion around `frontier` as a namespace. These names describe capability/intent only; provider/source remains a separate axis.

### Decision: All capability roles are public and operator-visible

**Status:** decided
**Rationale:** pi-kit should not intentionally hide internal capability levels. Abstractions may exist for technical or conceptual clarity, but every supported role should remain visible and configurable to the operator. This means the full ladder archmagos, magos, adept, servitor, and servoskull is public in v1.

### Decision: Use servoskull as the canonical lowest-tier key

**Status:** decided
**Rationale:** The operator prefers `servoskull` as a single-token config/key name to avoid punctuation and character handling issues while preserving the intended semantic identity of the lowest capability role.

### Decision: Capability tiers descend by overall quality and reasoning depth, not by source

**Status:** decided
**Rationale:** Archmagos, magos, adept, servitor, and servoskull are a monotonic ladder across capability, cost, and available thinking. Lower tiers are not merely cheaper routing presets; they represent intentionally reduced reasoning depth and model quality regardless of whether the candidate is upstream or local.

### Decision: Candidate objects must encode explicit thinking ceilings

**Status:** decided
**Rationale:** Thinking depth is part of tier semantics and cannot be derived safely from role alone. Explicit per-candidate ceilings such as `maxThinking: high|medium|low|off` preserve flexibility, allow overlap between adjacent tiers, and let servoskull guarantee thinking-off behavior even when a model could support more.

### Decision: Tier membership expresses intended operating envelope, not a hard capability partition

**Status:** decided
**Rationale:** Real models can overlap across adjacent tiers. The profile should allow a strong magos candidate to approach a weaker archmagos candidate, with the distinction coming from intended use, default reasoning depth, and routing preference rather than an artificial hard boundary.

### Decision: Cross-source fallback must be explicit when it materially changes UX

**Status:** decided
**Rationale:** The important boundary is not role naming but transitions between upstream and local sources, especially when they imply very different latency or quality. The resolver should therefore reason about cross-source fallback and ask before crossing into heavy or uncertain local execution when policy requires it.

### Decision: Use a fixed 5-minute cooldown for transient provider failures in v1

**Status:** decided
**Rationale:** A fixed cooldown keeps the first implementation simple, predictable, and easy to explain. More adaptive backoff strategies can be added later if operational evidence justifies the added complexity.

## Open Questions

*No open questions.*
