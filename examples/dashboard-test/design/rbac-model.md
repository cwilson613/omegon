---
status: implementing
tags: [auth, rbac, permissions]
parent: null
dependencies: [auth-migration]
related: [api-redesign]
open_questions: []
branches:
  - feature/rbac-model
---

# RBAC Permission Model

## Overview

Role-based access control replacing the current binary admin/user model. Integrates with Keycloak roles and provides fine-grained resource-level permissions.

## Research

### Current Permission Model
Binary: users are either `admin` or `user`. No resource-level control. Admin endpoints protected by middleware check only.

### RBAC Approaches
Evaluated ABAC (attribute-based), RBAC (role-based), and ReBAC (relationship-based). RBAC chosen for simplicity — ABAC complexity not justified by current requirements.

## Decisions

### D1: Permission model — decided
Hierarchical RBAC: roles inherit permissions. Three built-in roles: viewer, editor, admin. Custom roles supported.
**Rationale:** Covers 95% of use cases. Custom roles handle the rest without ABAC complexity.

### D2: Storage — decided
Permissions stored in Keycloak realm roles + resource-level overrides in application DB.
**Rationale:** Keycloak handles role assignment/hierarchy natively. App DB handles resource-specific grants.

## Implementation Notes

### File Scope
- `src/auth/rbac/` — new (permission checker, role resolver, middleware)
- `src/db/migrations/003-rbac.sql` — new (permission tables)
- `src/api/middleware/authorize.ts` — new (route-level permission gate)
