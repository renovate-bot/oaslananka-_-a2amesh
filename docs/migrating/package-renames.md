# Package Rename Migration

This document covers package renames within the A2A Mesh monorepo.
These renames reflect internal reorganization, not the superseded A2A Warp identity.

> **Note**: Internal/private packages (`@a2amesh/internal-*`) are **not published**
> in the first alpha release (0.1.0-alpha.0). They are workspace-private packages
> subject to change without notice. The renames below describe internal workspace
> organization, not a public install surface.

## Transport Package Renames

| Old name                | New name                           |
| ----------------------- | ---------------------------------- |
| `@a2amesh/runtime-ws`   | `@a2amesh/internal-transport-ws`   |
| `@a2amesh/runtime-grpc` | `@a2amesh/internal-transport-grpc` |

### Import updates (TypeScript)

```diff
- import { WsClient, WsServer } from '@a2amesh/runtime-ws';
+ import { WsClient, WsServer } from '@a2amesh/internal-transport-ws';

- import { GrpcClient, GrpcServer } from '@a2amesh/runtime-grpc';
+ import { GrpcClient, GrpcServer } from '@a2amesh/internal-transport-grpc';
```

## Bridge Package Renames

| Old name                      | New name       |
| ----------------------------- | -------------- |
| `@a2amesh/runtime-mcp-bridge` | `@a2amesh/mcp` |

### Import updates (TypeScript)

```diff
- import { ... } from '@a2amesh/runtime-mcp-bridge';
+ import { ... } from '@a2amesh/mcp';
```

## Deprecated Standalone Packages

The following packages have been absorbed into `@a2amesh/runtime` as subpath
exports. Install the core package and use the subpath instead.

| Deprecated standalone           | Usage instead                   |
| ------------------------------- | ------------------------------- |
| `@a2amesh/runtime/client`       | `@a2amesh/runtime/client`       |
| `@a2amesh/runtime/testing`      | `@a2amesh/runtime/testing`      |
| `@a2amesh/runtime/codex-bridge` | `@a2amesh/runtime/codex-bridge` |

## Adapter Package Split

`@a2amesh/internal-adapters` has been split into individual per-provider packages.
The old package is deprecated — reference only the adapters you need.

| Old name                     | New name                               |
| ---------------------------- | -------------------------------------- |
| `@a2amesh/internal-adapters` | `@a2amesh/internal-adapter-openai`     |
|                              | `@a2amesh/internal-adapter-anthropic`  |
|                              | `@a2amesh/internal-adapter-langchain`  |
|                              | `@a2amesh/internal-adapter-google-adk` |
|                              | `@a2amesh/internal-adapter-llamaindex` |
|                              | `@a2amesh/internal-adapter-crewai`     |

### Import updates

```diff
- import { OpenAIAdapter } from '@a2amesh/internal-adapters';
+ import { OpenAIAdapter } from '@a2amesh/internal-adapter-openai';

- import { AnthropicAdapter } from '@a2amesh/internal-adapters';
+ import { AnthropicAdapter } from '@a2amesh/internal-adapter-anthropic';
```

## Workspace Package Map

The current workspace package topology is:

| Package                                | Purpose                                                           | Public Alpha |
| -------------------------------------- | ----------------------------------------------------------------- | ------------ |
| `@a2amesh/protocol`                    | Protocol types, Agent Card, Task, Message, Artifact, JSON schemas | ✅ Public    |
| `@a2amesh/runtime`                     | Core runtime, client, auth, telemetry, storage, testing           | ✅ Public    |
| `@a2amesh/registry`                    | Registry server and discovery                                     | ✅ Public    |
| `@a2amesh/mcp`                         | MCP bridge                                                        | ✅ Public    |
| `@a2amesh/cli`                         | CLI binary `a2amesh`                                              | ✅ Public    |
| `create-a2amesh`                       | Project scaffolder                                                | ✅ Public    |
| `@a2amesh/internal-adapter-base`       | Abstract base adapter and contract helpers                        | ❌ Private   |
| `@a2amesh/internal-adapter-openai`     | OpenAI adapter                                                    | ❌ Private   |
| `@a2amesh/internal-adapter-anthropic`  | Anthropic Claude adapter                                          | ❌ Private   |
| `@a2amesh/internal-adapter-langchain`  | LangChain adapter                                                 | ❌ Private   |
| `@a2amesh/internal-adapter-google-adk` | Google ADK adapter                                                | ❌ Private   |
| `@a2amesh/internal-adapter-llamaindex` | LlamaIndex adapter                                                | ❌ Private   |
| `@a2amesh/internal-adapter-crewai`     | CrewAI HTTP bridge adapter                                        | ❌ Private   |
| `@a2amesh/internal-transport-ws`       | WebSocket transport                                               | ❌ Private   |
| `@a2amesh/internal-transport-grpc`     | gRPC transport                                                    | ❌ Private   |

Subpath exports under `@a2amesh/runtime`:

- `@a2amesh/runtime/client` — standalone client API
- `@a2amesh/runtime/testing` — test fixtures and matchers
- `@a2amesh/runtime/codex-bridge` — Codex-style tool bridge helpers
- `@a2amesh/runtime/schemas` — Zod schema symbols (runtime parsing)
