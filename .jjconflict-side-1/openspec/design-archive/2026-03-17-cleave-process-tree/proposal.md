# Cleave Process Tree — bidirectional parent↔child coordination

## Intent

Replace cleave's current fire-and-forget task-file protocol with bidirectional parent↔child communication. Children are trusted subprocesses spawned by Omegon — no discovery, no auth, no HTTP overhead. The goal is enabling mid-task negotiation (child asks parent for input), sibling awareness (children know what others have done), structured progress (richer than stdout line scraping), and coordinated resource access (shared file locks, interface contracts).

See [design doc](../../../docs/cleave-process-tree.md).
