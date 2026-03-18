# Cleave child timeout and idle detection — Tasks

## 1. extensions/cleave/dispatcher.ts (modified)

- [ ] 1.1 Add idle timer in spawnChildRpc() — reset on each RPC event, kill child when fired. Reduce default wall-clock timeout constant.

## 2. extensions/cleave/index.ts (modified)

- [ ] 2.1 Change hardcoded 120*60*1000 to a configurable default (e.g. 15 min wall clock). Expose idle_timeout_ms as optional cleave_run param.

## 3. Cross-cutting constraints

- [ ] 3.1 Idle timeout only applies to RPC mode — pipe mode children keep wall-clock-only timeout
- [ ] 3.2 Idle timer must reset on ANY RPC event, not just tool events (assistant_message counts as activity)
- [ ] 3.3 Default idle timeout should be generous enough that normal thinking pauses (60-90s for complex reasoning) don't trigger false kills
- [ ] 3.4 Wall-clock default should still allow legitimately large tasks (15 min) but not 2 hours
