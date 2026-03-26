# Rust settings integration — context class, provider preference, and downgrade overrides

## Intent

Wire the context class taxonomy into the Rust Settings/Profile persistence layer. The TS side has the runtime logic (context-class.ts, route-envelope.ts, routing-state.ts, downgrade-policy.ts). The Rust side needs: ContextClass enum, provider preference persistence in Profile, downgrade override storage, ThinkingLevel parity (add Minimal), replace hardcoded infer_context_window with route matrix, and dashboard display of context class.

See [design doc](../../../docs/rust-context-class-settings.md).
