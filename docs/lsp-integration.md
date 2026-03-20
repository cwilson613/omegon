---
id: lsp-integration
title: LSP integration — language server protocol for code-aware navigation and diagnostics
status: exploring
tags: [architecture, lsp, code-intelligence, tools, navigation]
open_questions: []
issue_type: feature
priority: 2
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

## Open Questions

*No open questions.*
