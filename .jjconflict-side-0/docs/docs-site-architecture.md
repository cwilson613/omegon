---
id: docs-site-architecture
title: Documentation site architecture — omegon.styrene.dev scope and structure
status: implemented
parent: rust-versioning
open_questions: []
---

# Documentation site architecture — omegon.styrene.dev scope and structure

## Overview

> Parent: [Rust versioning system — semver, changelog, --version, release workflow](rust-versioning.md)
> Spawned from: "Does omegon.styrene.dev stay as a single-page install landing, or does it become the full docs site (mdBook deployed there)?"

*To be explored.*

## Decisions

### Decision: omegon.styrene.dev becomes the full docs site — install landing + mdserve-rendered docs + API reference

**Status:** decided
**Rationale:** mdserve is the right tooling choice — it's a Rust binary that serves markdown with live reload, Mermaid diagrams, and syntax highlighting. The existing install landing page stays at the root, docs are served under /docs/, and cargo doc API reference under /api/. All deployed as a single container image via the release pipeline. Local preview: `mdserve docs/`.

## Open Questions

*No open questions.*
