# @a2amesh/protocol

Agent2Agent protocol TypeScript types, interfaces, constants, and validators.

Zero runtime dependencies.

## Exports

| Export path | Content                           |
| ----------- | --------------------------------- |
| `.`         | All protocol types and interfaces |

## Usage

```ts
import type { AgentCard, Task, Message } from '@a2amesh/protocol';

const card: AgentCard = {
  protocolVersion: '1.0',
  name: 'My Agent',
  url: 'https://example.com/agent',
  version: '1.0.0',
};
```

See [Compatibility](../../docs/compatibility.md) for supported Node.js and package ranges.
