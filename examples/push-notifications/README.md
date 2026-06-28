# Push Notifications Example

This example starts a local A2A server and a local webhook receiver. The client sends a task with a push notification callback, then the smoke test waits for the completed task snapshot to arrive at the webhook.

## Run

```bash
pnpm --dir examples/push-notifications run smoke
```

PowerShell:

```powershell
pnpm --dir examples/push-notifications run smoke
```

## Files

- `src/index.ts` starts both local HTTP servers and sends the callback-enabled message.
- `tests/smoke.test.ts` verifies the webhook receives a completed task snapshot.
- `.env.example` documents local port and token defaults.
