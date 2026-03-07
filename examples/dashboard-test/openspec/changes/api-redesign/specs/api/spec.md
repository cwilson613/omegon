# API: v2 Response Format

## Requirement: Consistent Response Envelope

All v2 endpoints return responses in a standardized envelope format.

#### Scenario: Successful response
Given a v2 endpoint returns data successfully
When the response is serialized
Then the body matches `{ data: <payload>, meta: { requestId, timestamp } }`
And all keys are camelCase

#### Scenario: Error response
Given a v2 endpoint encounters a validation error
When the error response is serialized
Then the body matches `{ data: null, errors: [{ code, message, field? }], meta: { requestId } }`

#### Scenario: List response with pagination
Given a v2 list endpoint returns paginated results
When the response is serialized
Then `meta` includes `{ page, perPage, total, totalPages }`

## Requirement: URL-Path Versioning

#### Scenario: v2 prefix routing
Given a request to `/v2/users`
When the API gateway routes the request
Then it reaches the v2 user handler

#### Scenario: v1 backward compatibility
Given a request to `/v1/users` during the compatibility period
When the API gateway routes the request
Then it reaches the legacy v1 handler
And the response includes `Deprecation: true` header
