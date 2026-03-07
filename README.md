# pi-kit

A batteries-included extension package for the [pi coding agent](https://github.com/nicolecomputer/pi-coding-agent). Adds persistent project memory, spec-driven development, local LLM inference, image generation, web search, task decomposition, and quality-of-life tools — all loadable with a single install.

```bash
pi install https://github.com/cwilson613/pi-kit
```

> **Note:** `pi install` and `pi update` track the `main` branch. There is no tag-pinned install yet — see [#5](https://github.com/cwilson613/pi-kit/issues/5). The version-check extension notifies you when a new release is available.

## Architecture

![pi-kit Architecture](docs/img/architecture.png)

pi-kit extends the pi agent with **23 extensions**, **7 skills**, and **2 prompt templates** — loaded automatically on session start.

### Development Methodology

pi-kit enforces **spec-first development** for non-trivial changes:

![Spec-Driven Pipeline](docs/img/spec-pipeline.png)

When a change involves an API, Given/When/Then scenarios are translated into an **OpenAPI 3.1 contract** (`api.yaml`) before implementation begins. The contract is the source of truth for API shape — code implements the contract, not the reverse.

## Extensions

### 📋 OpenSpec

Spec-driven development lifecycle — proposal → specs → design → tasks workflow with delta-spec merge on archive.

- **Tool**: `openspec_manage`
- **Commands**: `/opsx:propose`, `/opsx:spec`, `/opsx:ff`, `/opsx:status`, `/opsx:verify`, `/opsx:archive`, `/opsx:sync`
- **API contracts**: When a change involves a network API, derives an OpenAPI 3.1 spec from Given/When/Then scenarios
- **Lifecycle stages**: proposed → specified → planned → implementing → verifying → archived
- Integrates with [OpenSpec CLI](https://github.com/Fission-AI/OpenSpec) profiles

### 🪓 Cleave

Recursive task decomposition, code assessment, and OpenSpec lifecycle integration.

- **Tools**: `cleave_assess` (complexity evaluation), `cleave_run` (parallel dispatch in git worktrees)
- **Commands**: `/cleave <directive>`, `/assess cleave`, `/assess diff`, `/assess spec`, `/assess complexity`
- **OpenSpec integration**: When `openspec/` exists, uses `tasks.md` as the split plan, enriches child tasks with design.md decisions and spec acceptance criteria, writes back task completion, and guides through verify → archive
- **API contract validation**: `/assess spec` reads `api.yaml` and verifies endpoint paths, request/response schemas, status codes, and security schemes against the implementation
- **Session awareness**: Surfaces active OpenSpec changes with task progress on session start

### 🌲 Design Tree

Structured design exploration with persistent markdown documents.

- **Tools**: `design_tree` (query), `design_tree_update` (create/mutate nodes)
- **Commands**: `/design list`, `/design new`, `/design update`, `/design branch`, `/design decide`, `/design implement`
- **Document structure**: Frontmatter (status, tags, dependencies, open questions) + sections (Overview, Research, Decisions, Open Questions, Implementation Notes)
- **OpenSpec bridge**: `/design implement` scaffolds `openspec/changes/<node-id>/` from a decided node, then `/cleave` executes it
- **Full pipeline**: design → decide → implement → /cleave → verify

### 🧠 Project Memory

Persistent, cross-session knowledge stored in SQLite. The agent accumulates architectural decisions, constraints, patterns, and known issues — and retrieves them semantically each session.

- **11 tools**: `memory_store`, `memory_recall`, `memory_query`, `memory_supersede`, `memory_archive`, `memory_connect`, `memory_compact`, `memory_episodes`, `memory_focus`, `memory_release`, `memory_search_archive`
- **Background extraction**: Auto-discovers facts from tool output without interrupting work
- **Episodic memory**: Generates session narratives at shutdown for "what happened last time" context
- **Git sync**: Exports to JSONL for version-controlled knowledge sharing across machines

![Memory Lifecycle](docs/img/memory-lifecycle.png)

### 🤖 Local Inference

Delegate sub-tasks to locally running LLMs via Ollama — zero API cost.

- Auto-discovers available models on session start
- Tools: `ask_local_model`, `list_local_models`
- Commands: `/local-models`, `/local-status`

### 🔌 Offline Driver

Switch the driving model from cloud to a local Ollama model when connectivity drops or for fully offline operation.

- Tool: `switch_to_offline_driver`
- Auto-selects best available model (Nemotron, Devstral, Qwen3)

### 🎨 Render

Generate images and diagrams directly in the terminal.

- **FLUX.1 image generation** via MLX on Apple Silicon — `generate_image_local`
- **D2 diagrams** rendered inline — `render_diagram`
- **Excalidraw** JSON-to-PNG rendering — `render_excalidraw`

### 🔍 Web Search

Multi-provider web search with deduplication.

- Providers: Brave, Tavily, Serper (Google)
- Modes: `quick` (single provider), `deep` (more results), `compare` (fan out to all)
- Tool: `web_search`

### 💰 Model Budget

Switch model tiers to match task complexity and conserve API spend.

- Tool: `set_model_tier` — opus / sonnet / haiku
- Tool: `set_thinking_level` — off / minimal / low / medium / high
- Downgrade for routine edits, upgrade for architecture decisions

### 🔐 Secrets

Resolve secrets from environment variables, shell commands, or system keychains — without storing values.

- Declarative `@secret` annotations in extension headers
- Supports `env:`, `cmd:`, `keychain:` sources

### 🌐 MCP Bridge

Connect external MCP (Model Context Protocol) servers as pi tools.

- Bridges MCP tool schemas into pi's native tool registry
- Stdio transport for local MCP servers

### 🔧 Utilities

| Extension | Description |
|-----------|-------------|
| `chronos` | Authoritative date/time from system clock — eliminates AI date math errors |
| `01-auth` | Auth status, diagnosis, and refresh across git, GitHub, GitLab, AWS, k8s, OCI (`/auth`, `/whoami`) |
| `view` | Inline file viewer — images, PDFs, docs, syntax-highlighted code |
| `distill` | Context distillation for session handoff (`/distill`) |
| `session-log` | Append-only structured session tracking |
| `auto-compact` | Context pressure monitoring with automatic compaction |
| `defaults` | Auto-configures AGENTS.md and theme on first install (content-hash guard prevents overwrites) |
| `shared-state` | Cross-extension state sharing |
| `status-bar` | Severity-colored context gauge with memory usage and turn counter |
| `terminal-title` | Dynamic tab titles for multi-session workflows |
| `spinner-verbs` | Warhammer 40K-themed loading messages |
| `style` | Verdant design system reference (`/style`) |

## Skills

Skills provide specialized instructions the agent loads on-demand when a task matches.

| Skill | Description |
|-------|-------------|
| `openspec` | OpenSpec lifecycle — writing specs, deriving API contracts, generating tasks, verifying implementations |
| `cleave` | Task decomposition, code assessment, OpenSpec lifecycle integration |
| `git` | Conventional commits, semantic versioning, branch naming, changelogs |
| `oci` | Container and artifact best practices |
| `python` | Project setup, pytest, ruff, mypy, packaging, venv management |
| `rust` | Cargo, clippy, rustfmt, Zellij WASM plugin development |
| `style` | Verdant color system, typography, spacing — shared across all visual output |

## Prompt Templates

Pre-built prompts for common workflows:

- **new-repo** — Scaffold a new repository
- **oci-login** — OCI registry authentication

## Requirements

- [pi coding agent](https://github.com/nicolecomputer/pi-coding-agent) (v1.0+)
- **Optional**: [Ollama](https://ollama.ai) — for local inference, offline mode, and semantic memory search
- **Optional**: [d2](https://d2lang.com) — for diagram rendering
- **Optional**: [mflux](https://github.com/filipstrand/mflux) — for FLUX.1 image generation on Apple Silicon
- **Optional**: API keys for web search (Brave, Tavily, or Serper)

## License

ISC
