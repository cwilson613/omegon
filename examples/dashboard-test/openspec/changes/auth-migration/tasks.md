# Auth Migration — Tasks

## 1. OIDC Client Setup
<!-- specs: auth -->

- [x] Create `src/auth/oidc/client.ts` with Keycloak discovery
- [x] Configure RS256 JWKS endpoint resolution
- [x] Add `src/config/auth.ts` feature flag for dual-auth mode
- [ ] Write integration test for OIDC discovery

## 2. Token Validation Middleware
<!-- specs: auth -->

- [x] Create `src/auth/oidc/validate.ts` middleware
- [x] Implement RS256 signature verification
- [x] Extract user identity from token claims
- [ ] Handle expired token → 401 response
- [ ] Add `X-Auth-Deprecated` header for legacy fallback

## 3. Keycloak Deployment
<!-- specs: auth -->

- [x] Create `k8s/keycloak/values.yaml`
- [x] Export realm config with roles to `realm.json`
- [x] Add Helm chart dependency
