# Streaming Example

This example starts a local A2A server with SSE task streaming enabled. The smoke test sends a streaming message and waits until the stream reports a completed task.

## Run

```bash
pnpm --dir examples/streaming run smoke
```

PowerShell:

```powershell
pnpm --dir examples/streaming run smoke
```

## Files

- `src/index.ts` starts the streaming agent and consumes the client stream.
- `tests/smoke.test.ts` verifies a completed task arrives over the stream.
- `.env.example` documents the optional local port override.
