# @a2amesh/mcp

`@a2amesh/mcp` provides mapping helpers and a bridge layer to integrate Model Context Protocol (MCP) clients and servers with the A2A Mesh protocol.

## Purpose

- **A2A ↔ MCP Bridge**: Translates MCP tool calls and resources into A2A messages and task invocations.
- **Auditable Safety**: Implements audit logging hooks and telemetry propagation across MCP tool execution.
- **Dry-run & Policy Hook Skeletons**: Prepares endpoints for dry-running commands and enforcing validation rules.

## Installation

```bash
npm install @a2amesh/mcp
```

## Usage Example

```typescript
import { createMcpBridge } from '@a2amesh/mcp';

const bridge = createMcpBridge({
  a2aClientOptions: {
    endpoint: 'https://api.example.com/a2a',
  },
});
```

## Release State

- **Channel**: Public Alpha
- **Initial Version**: `0.1.0-alpha.0`
