---
status: seed
tags: [performance, caching, redis]
parent: null
dependencies: [api-redesign]
related: []
open_questions:
  - Cache invalidation strategy — event-driven vs TTL-based?
  - Should we cache at the API gateway or application layer?
---

# Cache Layer

## Overview

Add a caching layer to reduce database load and improve API response times. The v2 API endpoints are expected to handle 10x current traffic.

## Open Questions

- Cache invalidation strategy — event-driven vs TTL-based?
- Should we cache at the API gateway or application layer?
