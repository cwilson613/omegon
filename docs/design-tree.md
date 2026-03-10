---
subsystem: design-tree
design_docs:
  - design/design-tree-lifecycle.md
openspec_baselines: []
last_updated: 2026-03-10
---

# Design Tree

> Structured design exploration — seed ideas, research options, record decisions, track implementation, and bridge to OpenSpec for execution.

## What It Does

The design tree manages the lifecycle of design explorations as structured documents with frontmatter metadata. Each node progresses through statuses: `seed` → `exploring` → `decided` → `implementing` → `implemented` (or `blocked`/`deferred`).

Two agent tools provide full read/write access:
- **`design_tree`** (query): list nodes, get node details, find open questions (frontier), check dependencies
- **`design_tree_update`** (mutate): create nodes, set status, add research/decisions/questions, branch child nodes, focus a node for context injection

The `implement` action bridges a decided node to OpenSpec by scaffolding `openspec/changes/<node-id>/` with proposal, design, and tasks from the node's content. From there, `/cleave` executes the implementation.

Documents live in `docs/design/` (archived explorations) and `docs/` (active explorations). Structured sections: Overview, Research, Decisions, Open Questions, Implementation Notes.

## Key Files

| File | Role |
|------|------|
| `extensions/design-tree/index.ts` | Extension entry — 2 tools, commands, lifecycle event handlers |
| `extensions/design-tree/tree.ts` | Pure domain logic — parse/generate frontmatter+sections, scan, mutations, branching |
| `extensions/design-tree/types.ts` | `NodeStatus`, `DesignNode`, `DocumentSections`, `DesignTree` |
| `extensions/design-tree/dashboard-state.ts` | Dashboard state emission for focused node display |
| `extensions/design-tree/lifecycle-emitter.ts` | Memory lifecycle events on status transitions |

## Design Decisions

- **Frontmatter-driven metadata**: Node status, tags, dependencies, branches, and OpenSpec binding stored in YAML frontmatter. Body sections parsed structurally.
- **Open questions synced between body and frontmatter**: Adding/removing questions in the `## Open Questions` section updates the frontmatter array and vice versa.
- **`implement` bridges to OpenSpec**: A decided node's decisions, file scope, and constraints are used to scaffold an OpenSpec change directory, creating a seamless design → implementation pipeline.
- **Focus context injection**: When a node is focused via `design_tree_update('focus')`, its content is injected into the agent's context on every turn — ensuring design decisions stay visible during implementation.
- **Scan both `docs/` and `docs/design/`**: After the archive migration, the scanner reads from both directories to maintain visibility of all historical nodes.

## Constraints & Known Limitations

- Documents must have valid YAML frontmatter with at least `id` and `status` to be recognized
- No `archived` status exists yet — implemented nodes remain in the tree with `implemented` status
- Focus injection adds to context token usage — unfocus when not actively working on a design

## Related Subsystems

- [OpenSpec](openspec.md) — receives scaffolded changes from `implement` action
- [Cleave](cleave.md) — executes OpenSpec changes generated from design nodes
- [Dashboard](dashboard.md) — displays focused node and tree statistics
- [Project Memory](project-memory.md) — lifecycle events stored as facts on status transitions
