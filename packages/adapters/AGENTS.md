# Adapters Package Agent Map

Responsibility: optional adapters for supported provider/framework integration surfaces.

Allowed imports: public `@a2amesh/runtime` APIs and optional peer dependencies. Do not import registry server internals, CLI code, apps, or docs-site.

Test commands:

```bash
pnpm --filter @a2amesh/internal-adapters run typecheck
pnpm --filter @a2amesh/internal-adapters run test
```

Feature rule: default tests must use fake providers or mocks; live provider calls stay opt-in and credential-gated.
