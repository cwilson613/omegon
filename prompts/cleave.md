---
description: Recursive task decomposition via cleave extension
---
# Recursive Task Decomposition

Route complex directives through the cleave extension.

## Usage

```
/cleave "directive text"
```

## Tools

- `cleave_assess` — Assess complexity, get execute/cleave decision
- `cleave_run` — Execute a split plan with git worktree isolation

## Workflow

1. Assess directive complexity (automatic or via `cleave_assess`)
2. If complex: generate split plan (2–4 children)
3. Confirm plan with user
4. Dispatch children in dependency-ordered waves
5. Harvest results, detect conflicts, merge branches
6. Report status

See `/skill:cleave` for the full reference.
