# TUI surface pass — expose new subsystems in dashboard, footer, selectors, and commands — Tasks

## 1. core/crates/omegon/src/tui/dashboard.rs (modified)

- [ ] 1.1 Add harness status section (persona/tone, providers, MCP, secrets, inference, container). Make cleave section conditional (hide when idle). Vertical stack: design tree → openspec → cleave (if active) → harness status.

## 2. core/crates/omegon/src/tui/selector.rs (modified)

- [ ] 2.1 Add SelectorKind::ContextClass with 4 options (Squad/Maniple/Clan/Legion + token counts + descriptions)

## 3. core/crates/omegon/src/tui/mod.rs (modified)

- [ ] 3.1 /context opens context class selector overlay. Toast notifications on HarnessStatusChanged state transitions (persona switch, MCP connect/disconnect, auth expiry, compaction). Dashboard refresh on HarnessStatusChanged.

## 4. core/crates/omegon/src/tui/footer.rs (modified)

- [ ] 4.1 Compaction flash indicator (brief accent color pulse on system card when compaction fires)

## 5. Cross-cutting constraints

- [ ] 5.1 Cleave section hides entirely when no cleave is active — not just empty, invisible
- [ ] 5.2 Harness status section reads from FooterData.harness (same HarnessStatus, no separate data path)
- [ ] 5.3 Context class selector shows nominal token count and one-line description per class
- [ ] 5.4 Toast notifications compare previous HarnessStatus snapshot to detect meaningful transitions — don't toast on every event
