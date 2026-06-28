# Authenticated Server Example

This example starts a local A2A HTTP server that requires an API key header for JSON-RPC task calls. It uses an in-memory echo agent and does not call external services.

## Run

```bash
pnpm --dir examples/authenticated-server run smoke
```

PowerShell:

```powershell
pnpm --dir examples/authenticated-server run smoke
```

## Files

- `src/index.ts` starts the local server, sends an authenticated message, and returns the completed task summary.
- `tests/smoke.test.ts` proves the example completes with only local resources.
- `.env.example` documents the local API key used by the example.
