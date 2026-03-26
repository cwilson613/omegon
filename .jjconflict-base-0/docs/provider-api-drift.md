---
id: provider-api-drift
title: Provider API drift detection — CI cron watches pi-mono for upstream changes that affect Rust clients
status: implemented
parent: core-distribution
tags: [ci, providers, api-drift, upstream, rust, testing]
open_questions: []
---

# Provider API drift detection — CI cron watches pi-mono for upstream changes that affect Rust clients

## Overview

The Rust binary has native HTTP clients for Anthropic and OpenAI that implement the same wire protocols as pi-ai's TypeScript provider implementations. When Anthropic changes their API (new headers, changed SSE event types, auth flow modifications), pi-mono picks up the changes first because it imports the provider SDKs. We need to detect those changes and flag when our Rust implementations are out of sync.

The approach: extract the contract surface from pi-ai's provider files into a machine-readable spec, then validate the Rust implementation against it on a schedule.

## Open Questions

*No open questions.*
