---
subsystem: project-memory
design_docs:
  - design/memory-lifecycle-integration.md
  - design/memory-mind-audit.md
  - design/cheap-gpt-memory-models.md
openspec_baselines:
  - memory.md
  - memory/lifecycle.md
  - memory/models.md
  - project-memory/compaction.md
last_updated: 2026-03-10
---

# Project Memory

> Persistent fact storage, semantic retrieval, episodic session narratives, context injection, and cross-session knowledge accumulation.

## What It Does

Project memory gives agents persistent knowledge across sessions. It operates at multiple levels:

- **Fact store**: SQLite+WAL database (`.pi/memory/facts.db`) with atomic facts organized by section (Architecture, Decisions, Constraints, Known Issues, Patterns, Specs). Facts are stored, superseded, archived, and connected in a knowledge graph.
- **Semantic retrieval**: Facts embedded via Ollama `qwen3-embedding` for `memory_recall(query)` similarity search. Falls back to FTS5 keyword search if embeddings unavailable.
- **Working memory**: 25-slot buffer of pinned facts that survive context compaction and get priority injection.
- **Episodic memory**: Session narratives generated at shutdown via subagent, capturing goals, decisions, sequences, and outcomes.
- **Context injection**: Facts injected into agent context based on relevance scoring and context pressure.
- **JSONL sync**: `facts.jsonl` exported for git tracking; `merge=union` gitattribute enables multi-branch fact merging.
- **Global knowledge base**: Cross-project facts stored in `~/.pi/memory/global.db`.

## Key Files

| File | Role |
|------|------|
| `extensions/project-memory/index.ts` | Extension entry — tools (memory_query/recall/store/etc.), event handlers, compaction hook |
| `extensions/project-memory/factstore.ts` | SQLite storage — CRUD, supersede, archive, knowledge graph edges |
| `extensions/project-memory/embeddings.ts` | Embedding generation via Ollama, similarity search |
| `extensions/project-memory/extraction-v2.ts` | Background fact extraction from conversation via subagent |
| `extensions/project-memory/compaction-policy.ts` | Context pressure detection, auto-compaction triggers |
| `extensions/project-memory/injection-metrics.ts` | Relevance scoring for context injection |
| `extensions/project-memory/lifecycle.ts` | Integration with design-tree and OpenSpec status transitions |
| `extensions/project-memory/migration.ts` | Database schema migrations |
| `extensions/project-memory/triggers.ts` | Event-driven fact extraction triggers |
| `extensions/project-memory/template.ts` | Memory section templates for context injection |
| `extensions/project-memory/types.ts` | `Fact`, `Episode`, `MemorySection` types |

## Design Decisions

- **SQLite+WAL for storage, JSONL for git sync**: Database handles concurrent reads during extraction; JSONL enables cross-branch merging via git union strategy.
- **Semantic search primary, FTS5 fallback**: Embeddings give better retrieval but require Ollama; FTS5 always works.
- **Pointer facts over inline details**: Facts reference files (`"X does Y. See path/to/file.ts"`) instead of inlining implementation details — keeps facts atomic and maintainable.
- **Store conclusions, not investigation steps**: Facts capture final state, not debugging journey.
- **Cheap GPT models for extraction and embeddings**: Memory extraction uses cost-effective models (local or GPT) to avoid burning expensive API calls on background work.
- **Context pressure auto-compaction**: When context window usage exceeds thresholds, memory triggers compaction to free space while preserving pinned working memory facts.

## Behavioral Contracts

See `openspec/baseline/memory.md`, `openspec/baseline/memory/lifecycle.md`, `openspec/baseline/memory/models.md`, and `openspec/baseline/project-memory/compaction.md` for Given/When/Then scenarios.

## Constraints & Known Limitations

- Embedding model (qwen3-embedding) requires Ollama running locally — degrades to keyword search without it
- Working memory capped at 25 facts to control context injection size
- Episode generation runs at session shutdown — abrupt termination skips episode creation
- JSONL merge=union can create duplicates if the same fact is modified on two branches

## Related Subsystems

- [Model Routing](model-routing.md) — controls extraction/compaction model selection
- [Design Tree](design-tree.md) — lifecycle events stored as facts on status transitions
- [OpenSpec](openspec.md) — lifecycle events on archive
- [Dashboard](dashboard.md) — memory statistics displayed in raised mode
