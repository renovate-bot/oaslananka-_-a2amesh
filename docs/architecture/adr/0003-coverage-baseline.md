# ADR-0003: Coverage Baseline

## Status

Accepted for the 1.0.0 launch baseline.

## Context

The launch verification gate runs Vitest coverage against package, CLI, registry, WebSocket, and testing sources. The preferred long-term target is 90% statements, 85% branches, 90% functions, and 90% lines.

During the 1.0.0 rebuild, meaningful tests were added for SQLite task storage without native test dependencies, JSON-RPC error normalization, docs URL configuration, client task-stream subscriptions, and SSE heartbeat/close behavior. The remaining gap to 90/85 is concentrated in branch-heavy HTTP server paths for `A2AServer`, `RegistryServer`, and transport/provider error handling. Raising those numbers further in this cut would require either low-value branch padding or excluding supported runtime files from the measured set.

## Decision

Set the fail-closed coverage baseline to the current verified launch floor:

```text
statements >= 87
branches   >= 77
functions  >= 90
lines      >= 88
```

Keep all supported package sources in the coverage include list. Do not add coverage ignores to runtime code solely to pass the gate.

## Consequences

`pnpm run test:coverage` fails on real regressions below the 1.0.0 baseline while keeping the measured surface broad. Future changes should ratchet these thresholds upward as server, registry, WebSocket, and adapter branch tests are added.
