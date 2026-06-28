# MCP Bridge Package Agent Map

Responsibility: mapping supported A2A agent calls and MCP tool shapes.

Allowed imports: public core/client APIs and MCP SDK types. Do not import provider adapters, registry server internals, CLI code, apps, or docs-site.

Test commands:

```bash
pnpm --filter @a2amesh/mcp run typecheck
pnpm --filter @a2amesh/mcp run test
```

Feature rule: add parity tests for every new mapping and ensure secrets are not forwarded to downstream tools or logs.
