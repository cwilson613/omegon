# Auth: OIDC Migration

## Requirement: OIDC Token Validation

All API requests must be authenticated via OIDC tokens from Keycloak.

#### Scenario: Valid OIDC access token
Given a request with a valid RS256-signed access token from Keycloak
When the token validation middleware processes the request
Then the request proceeds with the user's identity extracted from claims

#### Scenario: Expired access token
Given a request with an expired OIDC access token
When the token validation middleware processes the request
Then the response is 401 with error `token_expired`

#### Scenario: Legacy JWT during migration period
Given the dual-auth feature flag is enabled
And a request with a valid legacy HS256 JWT
When the token validation middleware processes the request
Then the request proceeds with a `X-Auth-Deprecated: true` response header

## Requirement: Dual-Auth Migration

The system must support both auth methods simultaneously during the 30-day migration window.

#### Scenario: Feature flag enables dual auth
Given the `auth.dualMode` feature flag is `true`
When a request arrives with either a legacy JWT or OIDC token
Then both auth methods are attempted in order: OIDC first, legacy fallback

#### Scenario: Feature flag disables legacy auth
Given the `auth.dualMode` feature flag is `false`
When a request arrives with a legacy JWT
Then the response is 401 with error `legacy_auth_disabled`

#### Scenario: Migration metrics
Given dual-auth mode is active
When a request is authenticated via the legacy path
Then a metric `auth.legacy.used` is incremented
And a warning log is emitted with the client identifier
