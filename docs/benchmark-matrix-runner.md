---
id: benchmark-matrix-runner
title: "Matrix runner — orchestrate permutation runs and collect results"
status: seed
parent: demo-qa-benchmark
tags: []
open_questions:
  - "How should the benchmark matrix expand across provider/model combinations without conflating harness quality with provider quality — fixed canonical provider per harness first, or explicit provider-normalized lanes (e.g. Anthropic/OpenAI/OpenRouter) per harness?"
  - "What CLI/output contract is required to add OpenCode as a supported benchmark harness so it can be compared fairly with omegon, pi, and Claude Code?"
dependencies: []
related: []
---

# Matrix runner — orchestrate permutation runs and collect results

## Overview

A runner that iterates a configuration matrix and launches omegon in headless mode for each permutation. Could be: a /benchmark command within omegon, a standalone CLI tool, or a Justfile/shell script. Each run produces a results JSON. The runner collects all results and produces a comparison report. Key decision: internal vs external orchestration.

## Open Questions

- How should the benchmark matrix expand across provider/model combinations without conflating harness quality with provider quality — fixed canonical provider per harness first, or explicit provider-normalized lanes (e.g. Anthropic/OpenAI/OpenRouter) per harness?
- What CLI/output contract is required to add OpenCode as a supported benchmark harness so it can be compared fairly with omegon, pi, and Claude Code?
