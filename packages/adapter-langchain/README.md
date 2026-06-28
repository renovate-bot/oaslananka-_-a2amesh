# @a2amesh/internal-adapter-langchain

LangChain / LangGraph adapter for the Agent2Agent protocol.

`LangChainAdapter` wraps runnable-style LangChain or LangGraph pipelines and serializes the latest response into A2A artifacts.

## Status

This is an internal workspace package. It is private, not published to npm, not part of the first public alpha install surface, and not a stable public API.

## Workspace usage

This package is consumed inside the A2A Mesh monorepo through workspace dependencies. Do not install it directly from npm.

If provider SDK dependencies are needed for local development, install them through the workspace using the root pnpm workflow.

## Usage

```ts
import { LangChainAdapter, type LangChainRunnable } from '@a2amesh/internal-adapter-langchain';
import type { AnyAgentCard } from '@a2amesh/runtime';

const runnable: LangChainRunnable = {
  invoke: async (input) => {
    /* ... */
  },
};
const adapter = new LangChainAdapter(card, runnable);
```

See [Compatibility](../../docs/compatibility.md) for supported ranges.
