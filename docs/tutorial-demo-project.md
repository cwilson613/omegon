---
id: tutorial-demo-project
title: Tutorial demo project — self-seeded repo with live cleave demonstration
status: exploring
parent: tutorial-system
tags: [tutorial, demo, cleave, onboarding, 0.15.0]
open_questions:
  - "What project should the tutorial repo contain? A toy Rust/Python project works but needs to be interesting enough that the cleave branches do visible, meaningful work the operator can inspect."
  - "How do we handle API cost during the tutorial? A 5-branch cleave on gloriana burns tokens. Should tutorial cleave use retribution/local tier? Should there be a cost warning?"
  - "Should the tutorial overlay steps be reworked to match the new demo flow? Current steps: Welcome → Engine → Inference → Tools → Slash Commands → Focus → Ready. New steps would need to cover the cleave lifecycle."
jj_change_id: xwnrqnuystrovmssnxktvlkuqoxwymxu
issue_type: feature
priority: 2
---

# Tutorial demo project — self-seeded repo with live cleave demonstration

## Overview

Rework the tutorial's cloned project to be a self-seeded demonstration environment. The current 'type a message for tool use' step is weak. Instead: the tutorial repo should be pre-seeded with design nodes, OpenSpec changes, and a prepared cleave plan so the operator watches a real 5-branch cleave run (2×3 topology) execute live. Design nodes update in the sidebar as implementation progresses. The operator experiences the full lifecycle — design → spec → decompose → implement → verify — as a guided walkthrough, not an abstract explanation.

## Open Questions

- What project should the tutorial repo contain? A toy Rust/Python project works but needs to be interesting enough that the cleave branches do visible, meaningful work the operator can inspect.
- How do we handle API cost during the tutorial? A 5-branch cleave on gloriana burns tokens. Should tutorial cleave use retribution/local tier? Should there be a cost warning?
- Should the tutorial overlay steps be reworked to match the new demo flow? Current steps: Welcome → Engine → Inference → Tools → Slash Commands → Focus → Ready. New steps would need to cover the cleave lifecycle.
