# Harness upstream error recovery and fallback signaling

## Intent

Surface upstream driver/provider failures to the agent and operator, classify obvious transient failures for bounded retry, and route sustained usage/limit/backoff issues into intelligent model or driver fallback.
