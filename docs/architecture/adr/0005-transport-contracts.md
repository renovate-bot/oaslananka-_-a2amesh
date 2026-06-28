# ADR-0005: Transport Contracts

## Status

Accepted for the 1.0.0 launch baseline.

## Context

HTTP JSON-RPC is the canonical runtime protocol path. A2A Mesh also ships WebSocket and
gRPC transport helpers so applications can use alternate transport envelopes without
changing task semantics.

Transport drift is easy to introduce when each transport has its own request framing,
streaming behavior, card discovery, health behavior, authentication errors, and malformed
request handling. The repository therefore uses shared transport contract tests to make
supported behavior explicit and to require a reason for unsupported capabilities.

## Decision

Keep HTTP JSON-RPC as the source of truth for A2A method semantics. WebSocket and gRPC
transports must adapt to the public runtime API and pass the shared transport contract
for every capability they advertise.

The shared contract requires each transport to declare support for `sendMessage`,
`streamMessage`, `getTask`, `cancelTask`, `resolveCard`, `health`, `authErrors`, and
`malformedRequests`. Unsupported operations must include a reason in the capability map
instead of silently disappearing from the contract.

Transport implementations must not import private runtime internals across package
boundaries. They should use public core APIs, package-level test helpers, and local
transport-specific framing code.

## Consequences

New transports need a contract spec before they are documented as supported. Existing
transports can intentionally differ in envelope details, but task creation, terminal
state observation, cancellation, auth failure behavior, and malformed request reporting
stay comparable.

When a protocol feature is added to the runtime, the transport contract becomes the
coordination point for deciding whether WebSocket and gRPC support it immediately or
declare an explicit unsupported reason.

## Validation Commands

```bash
pnpm run lint:md
pnpm run docs:build
pnpm run test
pnpm run verify:structure
```

Relevant coverage:

- [`transportContract.ts`](../../../tests/transport-contract/transportContract.ts)
- [`WebSocket transport contract`](../../../packages/transport-ws/tests/transport-contract.test.ts)
- [`gRPC transport contract`](../../../packages/transport-grpc/tests/transport-contract.test.ts)
- [`client/server integration`](../../../tests/integration/client-server.test.ts)
