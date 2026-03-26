# Design Tree

Structured design exploration documents for Omegon.

Documents are markdown files with YAML frontmatter tracking status, dependencies, and open questions. The agent creates and manages these via the `design_tree` and `design_tree_update` tools, or via `/design` commands.

## Status Lifecycle

`draft` → `exploring` → `decided` → `implemented` → `archived`

## Bridge to OpenSpec

When a design node reaches `decided` status, `/design implement` scaffolds an OpenSpec change from its content. The full pipeline:

```
design → decide → implement → /cleave → /assess spec → /opsx:archive
```

See `skills/cleave/SKILL.md` for details.
