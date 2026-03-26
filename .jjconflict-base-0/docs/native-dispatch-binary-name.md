---
id: native-dispatch-binary-name
title: Fix native dispatch binary resolution — omegon-agent → omegon rename, drop unnecessary --bridge
status: implemented
parent: rust-cleave-orchestrator
tags: [cleave, subprocess, binary, dispatch, bugfix]
open_questions: []
issue_type: bug
priority: 1
---

# Fix native dispatch binary resolution — omegon-agent → omegon rename, drop unnecessary --bridge

## Overview

The native cleave child dispatcher in omegon-pi looks for a binary named `omegon-agent` but the Rust binary was renamed to `omegon`. Also passes --bridge unnecessarily — the Rust binary has native Anthropic/OpenAI providers. Also lacks a PATH-based fallback for global npm installs. Fix all three in omegon-pi and publish a patch.

## Open Questions

*No open questions.*
