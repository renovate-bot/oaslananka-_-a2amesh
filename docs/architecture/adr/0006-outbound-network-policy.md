# ADR-0006: Outbound Network Policy

## Status

Accepted for the 1.0.0 launch baseline.

## Context

A2A Mesh performs outbound HTTP requests for push notification callbacks, OIDC discovery
and JWKS retrieval, registry health polling, registry task polling, remote agent card
resolution, and selected adapter integrations. These paths can become SSRF risks if they
use raw `fetch` or accept localhost, link-local, private network, or unsupported schemes
by default.

The repository already exposes URL and fetch policy helpers in the core package and
documents the SSRF threat model. Tests cover policy behavior for push notifications,
OIDC discovery, registry registration, scheduled health checks, and URL policy
properties.

## Decision

All outbound HTTP requests that target user-provided or registry-provided URLs must use
the core outbound policy helpers. New runtime, registry, adapter, bridge, or CLI code must
not call raw `fetch` for those URLs unless the URL has already passed the shared policy in
the same control path.

The default policy allows only HTTP-family schemes expected by the runtime and rejects
private, loopback, link-local, and otherwise unsafe hosts. Localhost and unresolved
hostnames are allowed only through explicit development or test configuration. Each
operation should pass an operation label so telemetry and errors identify whether the
request came from push notification delivery, OIDC discovery, registry polling, or
another outbound surface.

Policy exceptions must be narrow, documented near the caller, and covered by tests.

## Consequences

Security posture is centralized in one policy surface instead of being reimplemented per
feature. Local development remains possible by opting into localhost allowances, while
production defaults stay fail-closed against SSRF-prone destinations.

New outbound features carry a test obligation: they need a success path and a blocked
scheme or blocked host assertion before becoming documented supported behavior.

## Validation Commands

```bash
pnpm run lint:md
pnpm run docs:build
pnpm run test:coverage
pnpm run security
```

Relevant coverage:

- [`SSRF policy`](../../security/ssrf.md)
- [`Threat model`](../../security/threat-model.md)
- [`OutboundPolicy.ts`](../../../packages/runtime/src/net/OutboundPolicy.ts)
- [`fetchWithPolicy.ts`](../../../packages/runtime/src/net/fetchWithPolicy.ts)
- [`URL policy property tests`](../../../packages/runtime/tests/properties/url-policy.property.test.ts)
- [`JwtAuthMiddleware.test.ts`](../../../packages/runtime/tests/JwtAuthMiddleware.test.ts)
- [`PushNotificationService.test.ts`](../../../packages/runtime/tests/PushNotificationService.test.ts)
- [`RegistryServer.test.ts`](../../../packages/registry/tests/RegistryServer.test.ts)
