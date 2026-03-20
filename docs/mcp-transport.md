---
id: mcp-transport
title: MCP transport for plugin tools — Model Context Protocol as first-class tool source
status: exploring
tags: [architecture, plugins, mcp, tools, interoperability, standards]
open_questions: []
issue_type: feature
priority: 1
---

# MCP transport for plugin tools — Model Context Protocol as first-class tool source

## Overview

Support MCP (Model Context Protocol) servers as a tool source alongside the existing HTTP, script, and OCI runners. MCP is the emerging industry standard — every MCP server in the ecosystem becomes an Omegon plugin with zero adaptation. This is the single highest-impact gap vs OpenCode.

## Research

### Rust MCP ecosystem — official SDK and crate options

**Official SDK**: `modelcontextprotocol/rust-sdk` → crate `rmcp`
- Official MCP org repo. Active development.
- Transports: stdio (`transport-io`), child-process spawn (`transport-child-process`), streamable HTTP client/server
- Full protocol: tools, resources, prompts, logging, sampling
- Client and server roles — we need client (connect to external MCP servers)
- Uses tokio async, reqwest for HTTP

**Community SDK**: `mcp-protocol-sdk` (crates.io v0.5.0)
- Claims 100% schema compliance with MCP 2025-06-18
- stdio, HTTP, WebSocket transports
- Feature-gated: `stdio`, `http`, `websocket`, `validation`

**Recommendation**: Use the official `rmcp` crate. Maintained by MCP org, matches protocol exactly, has client-side child-process transport (spawn MCP server as subprocess, talk via stdio — the standard pattern).

**Integration point**: Add `runner = "mcp"` to plugin.toml alongside script/http/oci/wasm. MCP servers declared as:
```toml
[mcp_servers.filesystem]
command = "npx"
args = ["-y", "@modelcontextprotocol/server-filesystem", "/path"]

[mcp_servers.brave-search]
command = "npx"
args = ["-y", "@modelcontextprotocol/server-brave-search"]
env = { BRAVE_API_KEY = "{BRAVE_API_KEY}" }
```
Tools from MCP servers register alongside native tools in the tool registry. The agent sees a flat tool list regardless of source.

## Open Questions

*No open questions.*
