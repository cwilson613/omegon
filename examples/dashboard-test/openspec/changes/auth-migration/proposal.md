# Auth Migration

## Problem
The application uses a custom JWT system with no MFA, no SSO, and hardcoded HS256 signing. Security audits have flagged the lack of token refresh and the 24-hour expiry window.

## Solution
Migrate to OIDC with Keycloak. Implement authorization_code + PKCE flow, RS256 token validation, and a dual-auth migration period.

## Design Reference
`design/auth-migration.md` — all decisions D1–D3 finalized.

## Scope
- `src/auth/oidc/` — new (OIDC client, token validation)
- `src/auth/legacy/` — modified (deprecation headers)
- `k8s/keycloak/` — new (Helm chart, realm config)
- `src/config/auth.ts` — modified (feature flags)
