# Docs Agent Map

Responsibility: canonical markdown documentation under `docs/`.

Allowed imports: none. Markdown examples must use documented public package names and CLI commands.

Test commands:

```bash
pnpm run lint:md
pnpm run docs:check
```

Feature rule: do not claim support for a package, adapter, transport, deployment surface, or security control without matching tests or CI checks.
