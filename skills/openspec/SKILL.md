---
name: openspec
description: OpenSpec lifecycle for spec-driven development. Use when proposing changes, writing Given/When/Then specs, generating tasks, verifying implementations, or archiving completed changes. Commands /opsx:propose, /opsx:spec, /opsx:ff, /opsx:status, /opsx:verify, /opsx:archive.
---

# OpenSpec — Spec-Driven Development Lifecycle

> **Load this skill** when working with OpenSpec changes, writing specs, generating tasks, or verifying implementations against specifications.

## Overview

OpenSpec is pi-kit's specification layer for spec-and-test-driven development. It ensures that every non-trivial change follows the lifecycle:

```
propose → spec → plan → implement → verify → archive
```

Specs define **what must be true** before code is written. They are the source of truth for correctness.

## Lifecycle Stages

| Stage | Artifacts | Next Action |
|-------|-----------|-------------|
| **proposed** | `proposal.md` | `/opsx:spec <change>` — write specs |
| **specified** | `specs/*.md` | `/opsx:ff <change>` — generate design + tasks |
| **planned** | `design.md`, `tasks.md` | `/cleave` — execute tasks |
| **implementing** | tasks in progress | continue work or `/cleave` |
| **verifying** | all tasks done | `/assess spec <change>` → `/opsx:archive` |
| **archived** | specs merged to baseline | complete |

## Directory Structure

```
openspec/
├── changes/
│   └── <change-name>/
│       ├── proposal.md      # Intent, scope, success criteria
│       ├── design.md        # Architecture decisions, file changes
│       ├── tasks.md         # Numbered task groups for /cleave
│       └── specs/
│           ├── <domain>.md  # Delta specs with Given/When/Then
│           └── <domain>/
│               └── <sub>.md # Nested domain specs
├── baseline/                # Accumulated specs (post-archive)
│   └── <domain>.md
└── archive/                 # Completed changes (timestamped)
    └── YYYY-MM-DD-<name>/
```

## Spec File Format

Spec files use a **delta format** — they describe changes relative to the current baseline:

```markdown
# <domain> — Delta Spec

## ADDED Requirements

### Requirement: <title>

<description of what must be true>

#### Scenario: <scenario title>
Given <precondition>
When <action>
Then <expected outcome>
And <additional expectation>

## MODIFIED Requirements

### Requirement: <title>

<what changed and why>

#### Scenario: <updated scenario>
Given <new precondition>
When <action>
Then <updated expectation>

## REMOVED Requirements

### Requirement: <title>

<why this is being removed>
```

### Writing Good Scenarios

- **Given** establishes the starting state — be specific
- **When** is a single action — not a compound operation
- **Then** is the observable outcome — measurable and testable
- **And** adds additional assertions to Then

**Good:**
```
#### Scenario: Expired token rejected
Given a user has a JWT token that expired 5 minutes ago
When they make a GET request to /api/protected
Then the response status is 401
And the body contains {"error": "token_expired"}
```

**Bad:**
```
#### Scenario: Auth works
Given the system is running
When a user authenticates
Then it works correctly
```

## Commands

| Command | Description |
|---------|-------------|
| `/opsx:propose <name> <title>` | Create a new change with proposal.md |
| `/opsx:spec <change>` | Generate/add specs (triggers agent to write scenarios) |
| `/opsx:ff <change>` | Fast-forward: scaffold design.md + tasks.md from specs |
| `/opsx:status` | Show all active changes with lifecycle stage |
| `/opsx:verify <change>` | Delegates to `/assess spec` for spec verification |
| `/opsx:archive <change>` | Archive change, merge specs to baseline |
| `/opsx:apply <change>` | Continue implementing (delegates to `/cleave`) |

## Tool: `openspec_manage`

Agent-callable tool for programmatic lifecycle operations.

### Actions

| Action | Required Params | Description |
|--------|----------------|-------------|
| `status` | — | List all active changes |
| `get` | `change_name` | Get change details, stage, spec summary |
| `propose` | `name`, `title`, `intent` | Create new change |
| `add_spec` | `change_name`, `domain`, `spec_content` | Add raw spec markdown |
| `generate_spec` | `change_name`, `domain` | Generate spec scaffold from proposal |
| `fast_forward` | `change_name` | Generate design.md + tasks.md |
| `archive` | `change_name` | Archive completed change |

### `generate_spec` Optional Params

- `decisions`: Array of `{title, rationale}` — generates requirements per decision
- `open_questions`: Array of strings — generates MODIFIED Requirements placeholders

## Integration with Cleave

OpenSpec and cleave work together:

1. **`/opsx:ff`** generates `tasks.md` in the format cleave expects (numbered groups with checkboxes)
2. **`/cleave`** detects `openspec/changes/<name>/tasks.md` and uses it as the split plan
3. **`cleave_run`** with `openspec_change_path` updates task checkboxes on completion
4. **`/assess spec`** verifies implementation against spec scenarios

The tasks.md format that cleave parses:
```markdown
## 1. Group Title

- [ ] 1.1 Task description
- [ ] 1.2 Another task
- [x] 1.3 Completed task
```

## Integration with Design Tree

The design-tree `implement` action scaffolds OpenSpec change directories from design nodes:

- Design node **children** → task groups
- Design node **decisions** → additional task groups
- Design node **open questions** → noted in tasks

After `implement`, refine the scaffolded specs before proceeding.

## When to Use OpenSpec

**Always use** for:
- Multi-file changes (complexity ≥ 2.0 in cleave_assess)
- Any change affecting public APIs or data models
- Cross-cutting concerns (auth, logging, error handling)
- Changes that will be reviewed by others

**Skip for:**
- Single-file fixes, typos, config tweaks
- Changes with obvious correctness (renaming, formatting)
- Urgent hotfixes (document retroactively)

## Workflow Example

```
# 1. Propose
/opsx:propose jwt-auth "JWT Authentication"

# 2. Write specs (agent generates Given/When/Then)
/opsx:spec jwt-auth

# 3. Generate implementation plan
/opsx:ff jwt-auth

# 4. Execute in parallel
/cleave implement jwt-auth changes

# 5. Verify against specs
/assess spec jwt-auth

# 6. Archive
/opsx:archive jwt-auth
```
