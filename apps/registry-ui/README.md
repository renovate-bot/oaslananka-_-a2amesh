# a2amesh Registry UI

A single-page operator console for the A2A Mesh registry.

## Features

- **Three views:** Fleet table (agent list), Topology graph (visual), Task stream (live event feed)
- **Two access modes:** Authenticated operator (full CRUD + task streaming) and readonly public discovery
- **Live updates** via Server-Sent Events (agent registration changes, task events)
- **Filtering** by status, capability, tenant, and search
- **No external services required** — runs with any A2A Mesh registry instance

## Quick start

```bash
# Install dependencies
pnpm install

# Start the dev server (connects to localhost:3099 by default)
pnpm run dev

# Build for production
pnpm run build

# Run unit tests
pnpm run test

# Run accessibility tests
pnpm run test:a11y

# Run E2E smoke tests
pnpm run test:e2e
```

The dev server proxies `/api` to `http://localhost:3099` so it works out of the box with a local registry started via `pnpm run dev:smoke` from the monorepo root.

## Operator inspector demo flow

Use the fleet table or topology graph to select an agent. The inspector panel shows:

- Agent card metadata, transport, tenant, visibility, capabilities, and skills
- Structured health reason and remediation hints for degraded or unknown agents
- Quick actions to copy the agent card, export operator config, and prepare replay context for the latest task

For demos, seed at least one healthy public agent and one failing private agent so the health reason panel demonstrates both normal and remediation states.

## Connecting to a remote registry

Set the `VITE_REGISTRY_URL` environment variable to point to a registry instance:

```bash
VITE_REGISTRY_URL=https://registry.example.com pnpm run dev
```

When `VITE_REGISTRY_URL` is set, the dev server proxy is bypassed and API calls go directly to the remote URL.

## Access modes

| Mode                       | Condition                              | Features                                                 |
| -------------------------- | -------------------------------------- | -------------------------------------------------------- |
| **Authenticated operator** | Registry requires authentication       | Full agent CRUD, task streaming, live topology updates   |
| **Public discovery**       | Registry permits unauthenticated reads | Agent list (public only), health metrics, no task stream |

When the registry doesn't require auth or the UI detects a 401/403, it automatically falls back to public discovery mode.

## Technology

- React 19, TypeScript 6, Vite 8
- Tailwind CSS 4 (CSS-first configuration via `@import 'tailwindcss'`)
- Server-Sent Events for live data
- Vitest (unit tests), Playwright (E2E + accessibility)
