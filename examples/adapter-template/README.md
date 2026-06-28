# Adapter Template Example

This example creates a small custom adapter by extending `BaseAdapter`. It is useful when a provider SDK is not needed or when a local test double should be exposed through the A2A runtime.

## Run

```bash
pnpm --dir examples/adapter-template run smoke
```

PowerShell:

```powershell
pnpm --dir examples/adapter-template run smoke
```

## Files

- `src/index.ts` defines the custom adapter and invokes it with a local task.
- `tests/smoke.test.ts` verifies the adapter returns a text artifact.
- `.env.example` documents the local response override.
