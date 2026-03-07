# Auth Migration — Design

## Architecture Decisions

### AD1: OIDC Provider
**Decision:** Keycloak via Helm on existing K8s cluster
**Rationale:** Self-hosted, OIDC-compliant, mature admin console

### AD2: Token Strategy
**Decision:** authorization_code + PKCE, RS256 access tokens (15min), refresh tokens (7d sliding)
**Rationale:** PKCE eliminates client secret exposure; short-lived tokens limit blast radius

### AD3: Migration Approach
**Decision:** 30-day dual-auth period with feature flag
**Rationale:** Zero-downtime, gradual rollover

## File Scope

| Path | Action | Description |
|---|---|---|
| `src/auth/oidc/client.ts` | new | OIDC client configuration and discovery |
| `src/auth/oidc/validate.ts` | new | Token validation middleware |
| `src/auth/oidc/claims.ts` | new | Claim extraction and mapping |
| `src/auth/legacy/middleware.ts` | modified | Add deprecation headers, fallback logic |
| `src/config/auth.ts` | modified | Dual-auth feature flag |
| `k8s/keycloak/values.yaml` | new | Helm chart values |
| `k8s/keycloak/realm.json` | new | Realm export with roles |
