---
status: exploring
tags: [api, rest, graphql]
parent: null
dependencies: []
related: [auth-migration]
open_questions:
  - Should we support GraphQL alongside REST?
  - What versioning strategy — URL path vs Accept header?
  - Rate limiting at gateway or application layer?
---

# API Redesign

## Overview

The current REST API has grown organically with inconsistent naming, mixed response formats, and no versioning strategy. This redesign aims to establish a consistent, well-documented API surface.

## Research

### Current API Surface
The existing API has 47 endpoints across 8 resource types. Response formats vary between camelCase and snake_case. Error responses use 3 different schemas.

### Industry Patterns
Most modern APIs use URL-path versioning (e.g., `/v2/resources`). Accept-header versioning is more RESTful but harder to test with curl/browsers.

## Decisions

### D1: Response format standardization — decided
All responses will use camelCase with a consistent envelope: `{ data, meta, errors }`.
**Rationale:** camelCase matches JS/TS conventions; envelope pattern simplifies client error handling.

### D2: Versioning strategy — exploring
Leaning toward URL-path versioning for simplicity, but Accept header is more elegant.

## Open Questions

- Should we support GraphQL alongside REST?
- What versioning strategy — URL path vs Accept header?
- Rate limiting at gateway or application layer?

## Implementation Notes

### File Scope
- `src/api/v2/` — new (v2 route handlers)
- `src/api/middleware/` — modified (response envelope)
- `src/api/types.ts` — modified (shared response types)
- `openapi/v2.yaml` — new (OpenAPI spec)

### Constraints
- Must maintain backward compatibility with v1 for 6 months
- API gateway must handle both v1 and v2 simultaneously
