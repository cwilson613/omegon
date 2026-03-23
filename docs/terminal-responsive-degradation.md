---
id: terminal-responsive-degradation
title: Terminal responsive degradation — graceful layout collapse on resize
status: exploring
parent: rust-agent-loop
tags: [tui, layout, responsive, ux, 0.15.0]
open_questions:
  - "What are the exact breakpoints? Current: sidebar at >=120, footer always 9 rows. Need: footer collapse point, conversation-only point, minimum viable size."
jj_change_id: xwnrqnuystrovmssnxktvlkuqoxwymxu
issue_type: feature
priority: 2
---

# Terminal responsive degradation — graceful layout collapse on resize

## Overview

Handle terminal resizing dynamically. As the terminal shrinks: sidebar disappears first (already at <120 cols), then footer collapses (instruments → engine-only → gone), then conversation fills the screen with input bar. Below a minimum viable size (~40×10?), show a 'terminal too small' message instead of a broken layout. Each breakpoint should be a clean transition, not a jarring jump. The operator should never see rendering artifacts or panics from undersized areas.

## Open Questions

- What are the exact breakpoints? Current: sidebar at >=120, footer always 9 rows. Need: footer collapse point, conversation-only point, minimum viable size.
