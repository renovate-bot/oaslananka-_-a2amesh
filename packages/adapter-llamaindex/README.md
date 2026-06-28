# @a2amesh/internal-adapter-llamaindex

LlamaIndex adapter for the Agent2Agent protocol.

`LlamaIndexAdapter` connects LlamaIndex chat-engine and query-engine style execution with A2A tasks, history, and artifact generation.

## Status

This is an internal workspace package. It is private, not published to npm, not part of the first public alpha install surface, and not a stable public API.

## Workspace usage

This package is consumed inside the A2A Mesh monorepo through workspace dependencies. Do not install it directly from npm.

If provider SDK dependencies are needed for local development, install them through the workspace using the root pnpm workflow.

## Usage

```ts
import { LlamaIndexAdapter } from '@a2amesh/internal-adapter-llamaindex';
import type { AnyAgentCard } from '@a2amesh/runtime';

const engine = {
  query: async (input) => {
    /* ... */
  },
};
const adapter = new LlamaIndexAdapter(card, engine);
```

See [Compatibility](../../docs/compatibility.md) for supported ranges.
