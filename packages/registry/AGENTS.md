# Registry Package Agent Map

Responsibility: registry server, discovery API, health polling, capability matching, and storage backends.

Allowed imports: public core APIs from `@a2amesh/runtime` and declared dependencies. Do not import adapter internals, CLI code, apps, or docs-site.

Test commands:

```bash
pnpm --filter @a2amesh/registry run typecheck
pnpm --filter @a2amesh/registry run test
```

Feature rule: tenant/principal boundaries require tests when auth context participates in registry behavior.
