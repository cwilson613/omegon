# Terminal responsive degradation — graceful layout collapse on resize

## Intent

Handle terminal resizing dynamically. As the terminal shrinks: sidebar disappears first (already at <120 cols), then footer collapses (instruments → engine-only → gone), then conversation fills the screen with input bar. Below a minimum viable size (~40×10?), show a 'terminal too small' message instead of a broken layout. Each breakpoint should be a clean transition, not a jarring jump. The operator should never see rendering artifacts or panics from undersized areas.

See [design doc](../../../docs/terminal-responsive-degradation.md).
