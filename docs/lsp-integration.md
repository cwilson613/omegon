---
id: lsp-integration
title: LSP integration — language server protocol for code-aware navigation and diagnostics
status: exploring
tags: [architecture, lsp, code-intelligence, tools, navigation]
open_questions: []
issue_type: feature
priority: 1
---

# LSP integration — language server protocol for code-aware navigation and diagnostics

## Overview

Use Language Server Protocol for structural code understanding — go-to-definition, find-references, diagnostics, symbols. Today the agent relies on grep/ripgrep for navigation. LSP gives it the same code intelligence a human IDE has: jump to definition, find all callers of a function, see type errors before running the compiler. OpenCode ships with native LSP; we have none.

## Research

### Implementation approach — LSP client in Rust

OpenCode's approach: configure LSP servers per language in opencode.json (e.g. gopls for Go, rust-analyzer for Rust). The agent gets code intelligence via LSP responses.

For Omegon, the LSP integration would provide three new tools:
- `goto_definition(file, line, col)` → returns the definition location
- `find_references(file, line, col)` → returns all reference locations
- `diagnostics(file)` → returns compiler errors/warnings without running the build

The Rust crate `tower-lsp` provides LSP server infra but we need a client. The `lsp-types` crate gives us the protocol types. We'd spawn the appropriate LSP server (rust-analyzer, tsserver, gopls, pyright) as a subprocess and communicate via JSON-RPC over stdio.

Auto-detection: same pattern as project conventions detection in prompt.rs — if Cargo.toml exists, spawn rust-analyzer. If tsconfig.json, spawn tsserver. If go.mod, spawn gopls.

This is medium effort, high value. Every edit the agent makes could be validated structurally (not just syntactically) before committing.

### OpenCode competitive re-assessment (March 2026)

**Full feature comparison — OpenCode vs Omegon (March 2026)**

## Open Questions

*No open questions.*

## OpenCode has, Omegon has equivalent or better

| Feature | OpenCode | Omegon | Assessment |
|---|---|---|---|
| MCP servers (stdio + remote) | ✅ stdio + remote + OAuth | ✅ 4 modes: local, OCI container, Docker Gateway, Styrene mesh | **Omegon ahead** (OCI sandboxing, mesh transport) |
| TUI + Web dashboard | ✅ TUI + desktop app + web | ✅ ratatui TUI + embedded axum web dashboard | Parity (OpenCode has desktop app) |
| Multi-provider | ✅ 75+ via Models.dev | ✅ via pi-ai bridge (15+) + local Ollama | OpenCode has more providers |
| Custom commands | ✅ markdown prompt files | ✅ prompt templates + slash commands | Parity |
| Session management | ✅ multi-session, resume, share | ✅ session save/load/resume | OpenCode has sharing + multi-session |
| Auto-compact | ✅ built-in | ✅ continuous decay + LLM fallback | **Omegon ahead** (two-tier decay) |
| Headless/CI mode | ✅ `--prompt` flag | ✅ `--prompt` flag + cleave children | **Omegon ahead** (parallel children) |
| Plugin/extension system | ✅ MCP servers + ecosystem | ✅ armory plugins (persona/tone/skill/extension) + MCP + script/OCI tools | **Omegon ahead** (unified plugin.toml, 5 runner types) |
| Serve mode (HTTP backend) | ✅ `opencode serve` + `opencode web` | ✅ embedded axum + WebSocket (`/dash open`) | Parity |
| File watcher | ✅ experimental | ❌ Not implemented | **Gap** |
| Git copilot auth | ✅ native | ✅ via pi-ai OAuth | Parity |

## OpenCode has, Omegon doesn't

| Feature | OpenCode | Omegon Status | Priority |
|---|---|---|---|
| **LSP integration** | Built-in: Go, TS, Python, Rust, C/C++, Java, PHP, YAML. Auto-detection. goto-definition, references, hover, call hierarchy. Custom LSP config. | `lsp-integration` node (exploring, P2) | **P1 — critical gap** |
| **Granular permissions** | per-tool allow/deny/prompt, path-based patterns, wildcard matching, `external_directory` policy, per-agent permissions | `granular-permissions` node (exploring, P2) | **P1 — critical gap** |
| **Multi-session** | Multiple parallel agents on same project | `multi-instance-coordination` (decided) | P2 |
| **Background agents** | Community plugin (`opencode-background-agents`) | Not designed | P3 |
| **Desktop app** | Electron/Tauri desktop wrapper | Not planned — TUI + web is the target | N/A |
| **Session sharing** | Share via URL | Not designed | P3 |
| **File watcher** | Watch project for external changes | Not designed | P2 |
| **Task tool** (sub-agents) | Primary agents invoke sub-agents via Task tool | Cleave children are parallel, not sub-agent invocable | P2 |
| **PTY sessions** | Full PTY for background processes | Bash tool only, no persistent PTY | P3 |
| **Patch tool** | Apply unified diffs | edit tool (exact match), no patch | P3 |

## Omegon has, OpenCode doesn't

| Feature | Omegon | OpenCode |
|---|---|---|
| **Design tree** | 203-node exploration DAG with status machine, decisions, research | Nothing comparable |
| **OpenSpec lifecycle** | Spec-driven dev: propose→spec→plan→implement→verify→archive | Nothing comparable |
| **Cleave decomposition** | Parallel child agents with git worktrees, merge policies, adversarial review | No built-in parallel decomposition |
| **Persona system** | Domain-expert identities with mind stores, tone axis, Lex Imperialis | Basic agent config (model + prompt) |
| **Memory system** | 2,500+ facts, episodes, edges, semantic search, decay, schema v6 | No persistent memory system |
| **Encrypted secrets** | SQLite + AES-256-GCM + Argon2id, 3 backends | No secret store (env vars only) |
| **HarnessStatus** | Unified status surface (TUI footer + bootstrap + web) | No comparable status contract |
| **Context class routing** | Squad/Maniple/Clan/Legion with three-axis model | Basic model selection |
| **jj VCS binding** | Change IDs on facts, episodes, design nodes | Git only |
| **OCI container tools** | Sandboxed tool execution in podman/docker | No container tool runner |
| **Speculative execution** | speculate_start/check/commit/rollback | No built-in speculation |

## Gap closure priority (revised)

**P1 — Must close (competitive table stakes):**
1. **LSP integration** — OpenCode auto-detects and configures LSP for 8+ languages. Without this, Omegon's code navigation relies entirely on grep/read. The `understand` tool vision from the rust-agent-loop design is the Omegon-native answer but LSP is the pragmatic step.
2. **Granular permissions** — OpenCode has per-tool, per-path allow/deny/prompt with wildcard patterns. Omegon has guards (path-based blocking) but no operator-facing permission config.

**P2 — Should close (differentiation erosion):**
3. **File watcher** — detect external changes (IDE edits, git operations) during session
4. **Multi-session** — parallel agents on same project (Omegon has multi-instance-coordination designed but not built)

**P3 — Nice to have:**
5. Session sharing, PTY sessions, patch tool, desktop app
