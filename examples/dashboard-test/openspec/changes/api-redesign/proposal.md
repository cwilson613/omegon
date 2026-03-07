# API Redesign

## Problem
47 endpoints with inconsistent naming, mixed response formats (camelCase/snake_case), and 3 different error schemas. No versioning. No OpenAPI spec.

## Solution
Establish v2 API surface with consistent envelope responses, URL-path versioning, and auto-generated OpenAPI documentation.

## Design Reference
`design/api-redesign.md` — D1 decided, D2 exploring.

## Scope
- `src/api/v2/` — new (v2 route handlers)
- `src/api/middleware/` — modified (response envelope)
- `src/api/types.ts` — modified (shared response types)
- `openapi/v2.yaml` — new (OpenAPI spec)
