# timeout — Delta Spec

## ADDED Requirements

### Requirement: timeout core functionality

Cleave children currently get a flat 2-hour timeout with no idle detection. When a child has no work (e.g. a sibling already completed it), or gets stuck in a loop, it burns through the full timeout before failing. The chronos-native-ts cleave run had children 1 and 2 hang for 29 minutes before RPC pipe break, consuming API tokens and wall clock time on zero-value work.

#### Scenario: Happy path

Given the system is in a default state
When the timeout feature is exercised
Then the expected behavior is observed
