---
id: tui-conversation-tabs
title: Conversation area multi-tab — chat, design tree, scratchpad, issues
status: exploring
parent: tui-hud-redesign
open_questions: []
jj_change_id: zroxvpvwoqkmpnxsqluvxxpktmnplror
---

# Conversation area multi-tab — chat, design tree, scratchpad, issues

## Overview

The conversation area becomes a tabbed container. The chat is one view. Other tabs provide parallel work surfaces that don't interrupt the agent:

1. **Chat** (default) — current conversation, scrollable
2. **Design tree** — full interactive tree widget with expand/collapse, search, status filtering
3. **Scratchpad** — quick note capture for ideas/bugs/features. Persisted to .omegon/notes/
4. **Issues** — lightweight git-native issue tracker. Files in repo, not tied to GitHub.

Tab switching via hotkey (Ctrl-1/2/3/4 or similar). The agent continues working regardless of which tab is visible. Notes and issues are git-tracked but git-remote-agnostic.

## Open Questions

*No open questions.*
