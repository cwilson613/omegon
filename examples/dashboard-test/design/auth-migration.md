---
status: decided
tags: [auth, oidc, security]
parent: null
dependencies: []
related: [api-redesign, rbac-model]
open_questions: []
---

# Authentication Migration

## Overview

Migrate from custom JWT authentication to standards-based OIDC with Keycloak as the identity provider. Enables SSO, MFA, and federated identity.

## Research

### Current Auth System
Custom JWT with HS256 signing, no refresh tokens, 24h expiry. Session state in Redis. No MFA support.

### OIDC Provider Comparison
Evaluated Keycloak, Auth0, and Okta. Keycloak chosen for self-hosted control, cost, and Kubernetes-native deployment.

## Decisions

### D1: OIDC provider — decided
Keycloak deployed via Helm chart on the existing K8s cluster.
**Rationale:** Self-hosted, open-source, full OIDC compliance, mature admin console.

### D2: Token strategy — decided
Use authorization_code + PKCE flow. Access tokens (RS256, 15min) + refresh tokens (7d sliding window). Token introspection endpoint for backend services.
**Rationale:** PKCE eliminates client secret exposure. Short-lived access tokens limit blast radius.

### D3: Migration approach — decided
Dual-auth period: both old JWT and new OIDC accepted for 30 days. Feature flag controls which auth is primary.
**Rationale:** Zero-downtime migration, allows gradual client rollover.

## Open Questions

(none — all decided)

## Implementation Notes

### File Scope
- `src/auth/oidc/` — new (OIDC client, token validation, middleware)
- `src/auth/legacy/` — modified (add deprecation headers)
- `k8s/keycloak/` — new (Helm values, realm export)
- `src/config/auth.ts` — modified (feature flags)

### Constraints
- Must support both auth methods simultaneously during migration
- Keycloak must be deployed before application changes go live
