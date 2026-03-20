# RepoModel — git state tracking in Rust core — Tasks

## 1. core/crates/omegon-git/Cargo.toml (new)

- [ ] 1.1 New crate: git2 dep, re-exports RepoModel and git operations

## 2. core/crates/omegon-git/src/lib.rs (new)

- [ ] 2.1 Crate root — re-exports repo, status, commit, submodule, worktree modules

## 3. core/crates/omegon-git/src/repo.rs (new)

- [ ] 3.1 RepoModel struct — discovery, branch, head SHA, submodule map, working set tracking

## 4. core/crates/omegon-git/src/status.rs (new)

- [ ] 4.1 Status queries — dirty files, staged files, submodule state via git2 statuses API

## 5. core/crates/omegon-git/src/commit.rs (new)

- [ ] 5.1 Commit operations — stage paths, create commit with conventional message, submodule two-level dance

## 6. core/crates/omegon-git/src/worktree.rs (new)

- [ ] 6.1 Worktree operations — create, remove, list via git2 + CLI fallback for edge cases

## 7. core/crates/omegon-git/src/merge.rs (new)

- [ ] 7.1 Merge operations — squash-merge, conflict detection, merge-base resolution

## 8. core/Cargo.toml (modified)

- [ ] 8.1 Add omegon-git to workspace members

## 9. core/crates/omegon/Cargo.toml (modified)

- [ ] 9.1 Add omegon-git dependency

## 10. core/crates/omegon/src/cleave/worktree.rs (modified)

- [ ] 10.1 Replace Command::new(git) calls with omegon-git API, add squash-merge

## 11. Cross-cutting constraints

- [ ] 11.1 git2 is the primary library — shell out to git CLI only for operations git2 doesn't cover well
- [ ] 11.2 RepoModel must be Send + Sync for use across async tasks
- [ ] 11.3 Working set tracks files touched by edit/write tools — reset on commit
- [ ] 11.4 Submodule map populated at init, refreshed on submodule operations
- [ ] 11.5 Squash-merge is the default for cleave child branches
