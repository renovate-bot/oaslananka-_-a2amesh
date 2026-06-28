# CLI Agent Map

Responsibility: the `a2amesh` binary, command routing, terminal output, and scaffolding command integration.

Allowed imports: public package APIs. Do not import app internals or docs-site code.

Test commands:

```bash
pnpm --filter @a2amesh/cli run typecheck
pnpm --filter @a2amesh/cli run test
```

Feature rule: add command tests first, update `docs/cli/`, and keep terminal output free of tokens and full auth headers.
