# WebSocket Example

This example starts the A2A Mesh WebSocket JSON-RPC transport on a local port and sends a request through `WsClient`.

## Run

```bash
pnpm --dir examples/websocket run smoke
```

PowerShell:

```powershell
pnpm --dir examples/websocket run smoke
```

## Files

- `src/index.ts` starts a local WebSocket transport and sends a JSON-RPC request.
- `tests/smoke.test.ts` verifies the round trip.
- `.env.example` documents the optional local port.
