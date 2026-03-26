# Memory crate interface boundary — MemoryBackend trait + integration with agent loop traits

## Intent

Define the Rust trait boundary for the memory crate so it can be developed independently and slotted into the agent loop. The memory crate implements ToolProvider (agent-callable tools), ContextProvider (injection), and SessionHook (startup/shutdown). Internally it owns a MemoryBackend trait that abstracts the storage engine — allowing sqlite in production and in-memory for tests.

See [design doc](../../../docs/memory-crate-interface.md).
