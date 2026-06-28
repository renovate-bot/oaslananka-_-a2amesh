# @a2amesh/registry

`@a2amesh/registry` implements the control plane for agent registration, capability discovery, health checks, and signature verification of agent cards.

## Purpose

- **Agent Discovery**: Query registered agents by capabilities, tenant IDs, and namespaces.
- **Trust & Health**: Tracks active agent statuses, performs periodic health polling, and verifies cryptographic signatures on cards.
- **Unified Registry API**: Serves JSON-RPC endpoints for registration and matching.

## Installation

```bash
npm install @a2amesh/registry
```

## Usage Example

```typescript
import { RegistryServer } from '@a2amesh/registry';

const registry = new RegistryServer({
  port: 4000,
  storage: 'memory',
});

await registry.start();
```

## API Reference

See the [OpenAPI specification](/openapi/registry.openapi.json) for the complete registry API reference.

## Release State

- **Channel**: Public Alpha
- **Initial Version**: `0.1.0-alpha.0`
