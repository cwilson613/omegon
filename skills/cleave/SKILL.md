---
name: cleave
description: Recursive task decomposition via the cleave extension. Use /cleave command or cleave_assess tool.
---

# Cleave

Task decomposition is provided by the **cleave extension** (`extensions/cleave/`).

## Quick Reference

- **`cleave_assess`** tool — Assess directive complexity. Returns decision (execute/cleave), complexity score, pattern match.
- **`cleave_run`** tool — Execute a decomposition plan. Creates git worktrees, dispatches child pi processes, merges results.
- **`/cleave <directive>`** command — Full interactive workflow: assess → plan → confirm → execute → report.

## Usage

```
/cleave "Implement JWT authentication with refresh tokens"
```

The directive is assessed for complexity. If it exceeds the threshold (default 2.0),
it's decomposed into 2–4 child tasks executed in parallel via git worktrees.

## Complexity Formula

```
complexity = (1 + systems) × (1 + 0.5 × modifiers)
```

## Available Patterns

Full-Stack CRUD, Auth System, API Integration, Data Pipeline, Migration,
Microservice, Testing Infrastructure, DevOps Pipeline, Search System.
