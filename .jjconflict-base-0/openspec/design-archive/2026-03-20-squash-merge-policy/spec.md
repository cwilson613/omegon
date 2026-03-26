# Squash-merge policy for feature branches — Design Spec (extracted)

> Auto-extracted from docs/squash-merge-policy.md at decide-time.

## Decisions

### Cleave orchestrator uses git2 merge --squash for child branches instead of merge --no-ff (decided)

Child diary commits (edit, fix test, re-edit) have no value on main. Squash-merge produces one clean commit per child with the child's label and description as the message. The diary stays on the branch until cleanup. git2's merge + index + commit API supports this natively. For interactive feature branches, the harness should offer squash-merge when the operator closes a branch.
