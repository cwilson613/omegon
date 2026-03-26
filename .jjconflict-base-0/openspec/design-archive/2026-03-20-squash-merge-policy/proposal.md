# Squash-merge policy for feature branches

## Intent

The cleave orchestrator and interactive branch-close flow should squash-merge feature branches by default. Cleave child branches get squash-merged into the base (one commit per child, not N diary commits). Interactive feature branches get squash-merge when the operator merges to main. The diary history stays on the branch for debugging (branch is deleted after merge).

See [design doc](../../../docs/squash-merge-policy.md).
