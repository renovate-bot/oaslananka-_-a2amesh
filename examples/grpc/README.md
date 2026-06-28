# gRPC Example

This example binds the A2A Mesh gRPC transport to a local port, sends a message with `GrpcClient`, and waits for the task to complete.

## Run

```bash
pnpm --dir examples/grpc run smoke
```

PowerShell:

```powershell
pnpm --dir examples/grpc run smoke
```

## Files

- `src/index.ts` starts a local gRPC server backed by an in-memory A2A agent.
- `tests/smoke.test.ts` verifies the gRPC message round trip.
- `.env.example` documents the local port default.
