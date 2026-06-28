# Testing

Use the narrowest relevant command first, then run `pnpm run verify` before pushing. Unit tests, integration tests, package dry-runs, docs checks, and security scans are part of the local gate.

Coverage is enforced by `pnpm run test:coverage`. The 1.0.0 launch floor is documented in [ADR-0003](../architecture/adr/0003-coverage-baseline.md) and should only move upward as meaningful server, registry, WebSocket, and adapter branch tests are added.

Linux/macOS:

```bash
pnpm run test:coverage
pnpm run test
pnpm run docs:check
pnpm run security
pnpm run pack:dry-run
pnpm run verify
```

PowerShell:

```powershell
pnpm run test:coverage
pnpm run test
pnpm run docs:check
pnpm run security
pnpm run pack:dry-run
pnpm run verify
```

Performance smoke thresholds are enforced with Grafana k6:

```bash
pnpm run perf:smoke
```

PowerShell:

```powershell
pnpm run perf:smoke
```

The smoke profile starts local A2A server and registry instances, runs only short threshold checks, and does not use external services. Longer manual load checks use the same scripts through:

```bash
pnpm run perf:load
```

PowerShell:

```powershell
pnpm run perf:load
```
