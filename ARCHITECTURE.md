# A2A Mesh Architecture

This file is the repository-level architecture summary. The detailed and canonical map
lives in [docs/development/architecture.md](docs/development/architecture.md).

## Layered Map

A2A Mesh is a TypeScript monorepo whose runtime packages flow in one direction:

```text
types/schemas -> core runtime -> transports -> client/registry -> adapters/bridges -> CLI/apps
```

The layer rule keeps public protocol types and schemas below the HTTP runtime, transport
helpers above the runtime, and user-facing command or app code at the edge. The enforced
package import graph is checked by `scripts/check-workspace-graph.mjs`.

The primary workspace surfaces are:

| Surface                                                                 | Role                                                                                                                                          |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `@a2amesh/runtime`                                                      | Core runtime, protocol types, JSON-RPC server, client, auth, storage, telemetry, URL policy, schemas, testing helpers, and Codex-style tools. |
| `@a2amesh/registry`                                                     | Registry REST/SSE service, discovery, health polling, task projections, and registry storage.                                                 |
| `@a2amesh/internal-adapters`                                            | Provider/framework adapters built on the public core runtime contract.                                                                        |
| `@a2amesh/internal-transport-ws` and `@a2amesh/internal-transport-grpc` | Transport helpers that adapt the core runtime to WebSocket and gRPC contracts.                                                                |
| `@a2amesh/mcp`                                                          | Bridge package that maps public runtime objects into MCP tool surfaces.                                                                       |
| `@a2amesh/protocol`                                                     | Standalone JSON Schema files for editor, CI, and validation pipelines.                                                                        |
| `@a2amesh/cli` and `@a2amesh/create-a2amesh`                            | Command surface and scaffold generator.                                                                                                       |
| `apps/*`, `docs-site`, and `examples/*`                                 | Demo, registry UI, VitePress site, and local runnable examples.                                                                               |

## Dependency Direction

The core package must not import transports, registry, adapters, bridge packages, CLI,
apps, docs-site, or testing internals. Client code may import only public core APIs.
Registry code may import public core APIs and its own storage/server modules. Adapters and
bridges sit above core/client and must not import registry server internals. CLI and apps
are top-level consumers.

The current graph check summary is:

```text
Workspace graph validation passed.
Checked 11 public package import aliases across 47 forbidden dependency edges.
Dependency direction: types/schemas -> core runtime -> transports -> client/registry -> adapters/bridges -> CLI/apps.
```

## Runtime Flows

`A2AServer` owns the HTTP runtime. It registers agent card routes, metrics routes,
JSON-RPC routes, task listing, and SSE stream routes. Requests pass through request
context creation, origin guard, rate limiting, JSON parsing, optional
`JwtAuthMiddleware`, idempotency resolution, schema validation, task ownership checks,
and then task processing through the adapter-provided `handleTask` method.

Task state is centralized in the task lifecycle helpers. The active state graph starts at
`SUBMITTED`, may move through `QUEUED`, `WORKING`, `INPUT_REQUIRED`, or
`WAITING_ON_EXTERNAL`, and ends in `COMPLETED`, `FAILED`, or `CANCELED`. Terminal tasks
cannot receive history, artifacts, push notification changes, or additional state
transitions.

The registry runs as a separate REST/SSE service. It stores registered agent cards,
tenant visibility, health status, and task projections. Health and task polling use the
same outbound URL policy helpers as the runtime so remote callbacks and registry polling
share SSRF controls.

## Verification

Architecture drift is covered by:

- `pnpm run verify:structure`
- `node scripts/check-workspace-graph.mjs`
- `node scripts/check-architecture-docs.mjs`
- [ADR index](docs/architecture/adr/index.md)
- [client/server integration tests](tests/integration/client-server.test.ts)
- [transport contract tests](tests/transport-contract/transportContract.ts)
- [task lifecycle property tests](packages/runtime/tests/properties/task-lifecycle.property.test.ts)
- [telemetry snapshot tests](packages/runtime/tests/telemetry-snapshots.test.ts)
- [release artifact tests](tests/integration/release-artifacts.test.ts)

Release changes flow through ordinary pull requests and Release Please. Publishing remains
owner-triggered through npm Trusted Publishing/OIDC; normal CI must not publish packages,
push images, create tags, or create GitHub Releases.
