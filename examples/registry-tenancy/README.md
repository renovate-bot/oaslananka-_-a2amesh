# Registry Tenancy Example

This example starts a local registry with a bearer registration token. Two tenant-scoped clients register separate agents and list only the agents visible to their tenant context.

## Run

```bash
pnpm --dir examples/registry-tenancy run smoke
```

PowerShell:

```powershell
pnpm --dir examples/registry-tenancy run smoke
```

## Files

- `src/index.ts` starts the local registry and registers tenant-scoped agents.
- `tests/smoke.test.ts` verifies tenant isolation with local registry clients.
- `.env.example` documents the local token and optional port.
