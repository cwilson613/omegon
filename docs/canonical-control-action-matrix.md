---
id: canonical-control-action-matrix
title: Canonical control action matrix
status: exploring
parent: runtime-profile-status-contract
tags: [control-plane, commands, rbac, ipc, web, cli, slash]
open_questions:
  - Which slash actions remain TUI-only by design versus becoming remote-safe?
  - Should IPC grow explicit session.new and graph/state mutation methods, or continue to route many mutations through run_slash_command?
  - Which model-change intents split into edit versus admin (same-provider set vs provider switch) in the first enforcement pass?
dependencies: []
related: []
---

# Canonical control action matrix

## Overview

This document defines the **transport-neutral control surface** for Omegon.

The goal is to describe operator intent once, then bind multiple ingress
surfaces onto that canonical action set:

- slash commands
- CLI subcommands
- IPC methods
- web/daemon trigger kinds

This matrix is the future source of truth for:

- role mapping (`read`, `edit`, `admin`)
- transport capability exposure
- help/docs generation
- RBAC enforcement
- parity audits across slash/CLI/IPC/web surfaces

The matrix is intentionally defined **before** full enforcement so the command
surface can be normalized without encoding security policy into ad hoc strings.

---

## Design rule

Canonical actions own intent. Ingresses are bindings.

Examples:

- `context.view` is the operator intent
  - slash: `/context`, `/context status`
  - future IPC/web binding may be added later
- `runtime.shutdown` is the operator intent
  - IPC: `shutdown`
  - web daemon trigger: `shutdown`
  - local TUI: `Quit`
- `session.new` is the operator intent
  - slash: `/new`
  - web daemon trigger: `new-session`

RBAC, transport support, and docs should attach to `context.view`,
`runtime.shutdown`, `session.new`, etc. — **not** directly to raw slash strings
or individual transport method names.

---

## Starter roles

### `read`
Read-only observation of state.

Allowed shape:
- inspect state
- inspect graph/status
- inspect model/context posture
- inspect available skills/models
- subscribe to events

Not allowed:
- mutate session
- submit work
- change runtime settings
- modify secrets
- shutdown/reset

### `edit`
Normal operator workflow mutation.

Allowed shape:
- submit prompts
- mutate session state
- compact/clear context
- tune model class / thinking level
- set or delete secret values
- run normal work-oriented slash commands

Not allowed:
- change provider
- change auth/login state
- shutdown runtime
- alter transport/runtime ownership posture

### `admin`
Runtime and control-plane authority.

Allowed shape:
- provider switching
- auth/login/logout/unlock
- runtime shutdown
- future transport/control-plane sensitive actions

Includes all `edit` and `read` capabilities.

---

## Current canonical matrix (v0 draft)

The following tables capture the **currently implemented** surfaces and the
proposed canonical actions they map to.

### Context

| Canonical action | Current slash binding | CLI | IPC | Web/daemon | Starter role | Notes |
|---|---|---:|---:|---:|---|---|
| `context.view` | `/context`, `/context status` | — | — | — | read | Bare `/context` now shows the rich status surface |
| `context.compact` | `/context compact`, `/context compress` | — | — | — | edit | Mutates session by compacting older turns |
| `context.clear` | `/context clear` | — | — | — | edit | Resets live conversation context |
| `context.request` | `/context request …` | — | — | — | edit | Pulls a mediated context pack for current work |
| `context.set_class` | `/context <class>` | `--context-class` at startup | — | — | edit | Command-surface intent is workflow tuning |

### Skills

| Canonical action | Current slash binding | CLI | IPC | Web/daemon | Starter role | Notes |
|---|---|---:|---:|---:|---|---|
| `skills.view` | `/skills`, `/skills list` | `omegon skills list` | — | — | read | Bare `/skills` is now a status surface |
| `skills.install` | `/skills install` | `omegon skills install` | — | — | edit | Installs bundled skills into `~/.omegon/skills` |

### Model / thinking / provider

| Canonical action | Current slash binding | CLI | IPC | Web/daemon | Starter role | Notes |
|---|---|---:|---:|---:|---|---|
| `model.view` | `/model` | startup logs only | — | — | read | Bare `/model` now shows model/provider posture |
| `model.list` | `/model list` | — | — | — | read | Lists catalogued models |
| `model.set.same_provider` | `/model <provider:model>` when provider does not change | `--model` | — | — | edit | Workflow tuning; does not change auth/control boundary |
| `provider.switch` | `/model <provider:model>` when provider changes | `--model` | — | — | admin | Same slash syntax, different canonical intent |
| `thinking.set` | `/think <level>` | startup/profile settings | — | — | edit | Workflow tuning |
| `thinking.view` | implied in `/model`, `/context`, `/stats` | — | — | — | read | Not yet a dedicated top-level action |

### Session lifecycle

| Canonical action | Current slash binding | CLI | IPC | Web/daemon | Starter role | Notes |
|---|---|---:|---:|---:|---|---|
| `session.view.list` | `/sessions` | — | — | — | read | Local list of resumable sessions |
| `session.new` | `/new` | — | — | `new-session` | edit | Reuses `TuiCommand::NewSession` |
| `session.reset` | same underlying local effect as `session.new` | — | — | same as above | edit | Keep one canonical action unless semantics diverge later |

### Runtime lifecycle

| Canonical action | Current slash binding | CLI | IPC | Web/daemon | Starter role | Notes |
|---|---|---:|---:|---:|---|---|
| `turn.cancel` | local cancel flows | — | `cancel` | `cancel` | edit | Shared cancellation token path |
| `runtime.shutdown` | local quit path | process signal / local exit | `shutdown` | `shutdown` | admin | Reuses `TuiCommand::Quit` |

### Prompt/work submission

| Canonical action | Current slash binding | CLI | IPC | Web/daemon | Starter role | Notes |
|---|---|---:|---:|---:|---|---|
| `prompt.submit` | normal operator input | `--prompt`, `--prompt-file` | `submit_prompt` | `prompt` | edit | One-shot CLI/headless path is still local operator-driven |
| `slash.execute` | many `/…` commands | — | `run_slash_command` | `slash-command` | depends | Needs subcommand-level classification |

### Auth

| Canonical action | Current slash binding | CLI | IPC | Web/daemon | Starter role | Notes |
|---|---|---:|---:|---:|---|---|
| `auth.status` | `/auth`, `/auth status` | `omegon auth status` | via slash path today | via slash path today | read | Safe observation |
| `auth.login` | `/login`, `/auth login …` | `omegon auth login …` | via slash path today | via slash path today | admin | Changes provider auth state |
| `auth.logout` | `/logout`, `/auth logout …` | `omegon auth logout …` | via slash path today | via slash path today | admin | Changes provider auth state |
| `auth.unlock` | `/auth unlock` | `omegon auth unlock` | via slash path today | via slash path today | admin | Secret/auth backend sensitive |

### Secrets

| Canonical action | Current slash binding | CLI | IPC | Web/daemon | Starter role | Notes |
|---|---|---:|---:|---:|---|---|
| `secrets.view` | `/secrets`, `/secrets list` | — | via slash path today | via slash path today | edit | Operational editing surface, not pure read |
| `secrets.set` | `/secrets set …` | — | via slash path today | via slash path today | edit | Explicitly requested to be edit-capable |
| `secrets.get` | `/secrets get …` | — | via slash path today | via slash path today | edit | Operational secret use |
| `secrets.delete` | `/secrets delete …` | — | via slash path today | via slash path today | edit | Operational secret mutation |

### Skills / plugins / memory / status (additional common surfaces)

| Canonical action | Current slash binding | CLI | IPC | Web/daemon | Starter role | Notes |
|---|---|---:|---:|---:|---|---|
| `status.view` | `/status`, `/stats`, `/auspex status`, `/dash status` | — | `get_state`, `get_graph`, event subscribe | web `/api/state`, `/api/graph` | read | Several current read-only surfaces should eventually normalize here |
| `memory.view` | `/memory` | — | — | — | read | Local summary today |
| `plugin.view` | `/plugin`, `/plugin list` | `omegon plugin list` | — | — | read | Common administration surface |
| `plugin.install` | `/plugin install …` | `omegon plugin install …` | — | — | edit/admin (TBD) | Needs policy decision |
| `plugin.remove` | `/plugin remove …` | `omegon plugin remove …` | — | — | edit/admin (TBD) | Needs policy decision |
| `plugin.update` | `/plugin update …` | `omegon plugin update …` | — | — | edit/admin (TBD) | Needs policy decision |

---

## High-priority ambiguities to resolve

### 1. `run_slash_command` is too broad

IPC and web currently expose generic slash execution paths.
That is useful for parity, but it is not RBAC-ready.

We need a classifier that resolves:

- raw slash command + args
- → canonical action id
- → required role
- → remote-safe or local-only

Without that classifier, any transport-level RBAC for slash execution will be
coarse and error-prone.

### 2. `/model` mixes two intents

`/model <provider:model>` currently handles both:

- same-provider model set → `edit`
- provider switch → `admin`

The canonical matrix distinguishes those intents already. Enforcement will need
intent parsing, not just command-name matching.

### 3. Some top-level slash commands still mix view and action semantics

Examples:
- `/auth`
- `/plugin`
- `/memory`

The canonical matrix should continue moving bare commands toward useful status
views with explicit action subcommands where possible.

---

## Immediate next implementation targets

This document is a **definitions-first artifact**. Before full RBAC enforcement,
we should add code support for:

1. A canonical action classifier
   - input: ingress + command/method/trigger + args
   - output: canonical action id + role + transport policy

2. A small machine-readable registry table in code
   - enough to drive help/docs and future enforcement together

3. Transport-boundary checks
   - IPC dispatch
   - web daemon event ingress
   - web/IPC slash execution wrapper paths

---

## Current command-surface normalization progress

Already normalized toward the matrix:

- `/context` → rich status surface by default; subcommands preserved
- `/skills` → rich status surface by default; install preserved
- `/model` → rich status surface by default; list and direct set preserved

These are the first examples of:

- top-level command = readable status surface
- deeper subcommands / arguments = explicit actions

That pattern should drive the rest of the common control plane.
