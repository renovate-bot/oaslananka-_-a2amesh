# @a2amesh/internal-adapter-anthropic

Anthropic Claude Messages API adapter for the Agent2Agent protocol.

`AnthropicAdapter` targets Claude Messages-compatible runtimes and supports both standard and streamed task execution flows.

## Status

This is an internal workspace package. It is private, not published to npm, not part of the first public alpha install surface, and not a stable public API.

## Workspace usage

This package is consumed inside the A2A Mesh monorepo through workspace dependencies. Do not install it directly from npm.

If provider SDK dependencies are needed for local development, install them through the workspace using the root pnpm workflow.

## Usage

```ts
import Anthropic from '@anthropic-ai/sdk';
import { AnthropicAdapter } from '@a2amesh/internal-adapter-anthropic';
import type { AnyAgentCard } from '@a2amesh/runtime';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const card: AnyAgentCard = {
  /* ... */
};
const adapter = new AnthropicAdapter(card, client, 'claude-opus-4-6');
```

See [Compatibility](../../docs/compatibility.md) for supported ranges.
