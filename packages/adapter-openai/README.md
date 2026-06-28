# @a2amesh/internal-adapter-openai

OpenAI Chat API adapter for the Agent2Agent protocol.

`OpenAIAdapter` converts A2A task history into OpenAI chat-completion requests and returns the generated reply as an A2A artifact.

## Status

This is an internal workspace package. It is private, not published to npm, not part of the first public alpha install surface, and not a stable public API.

## Workspace usage

This package is consumed inside the A2A Mesh monorepo through workspace dependencies. Do not install it directly from npm.

If provider SDK dependencies are needed for local development, install them through the workspace using the root pnpm workflow.

## Usage

```ts
import OpenAI from 'openai';
import { OpenAIAdapter } from '@a2amesh/internal-adapter-openai';
import type { AnyAgentCard } from '@a2amesh/runtime';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const card: AnyAgentCard = {
  /* ... */
};
const adapter = new OpenAIAdapter(card, client, 'gpt-4o');
```

See [Compatibility](../../docs/compatibility.md) for supported ranges.
