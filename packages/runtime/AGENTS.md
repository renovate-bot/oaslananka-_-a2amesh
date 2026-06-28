# Core Package Agent Map

Responsibility: protocol types, runtime server/client, auth, storage, middleware, telemetry, URL policy, and public core exports.

Allowed imports: standard library, runtime dependencies declared in `packages/runtime/package.json`, and internal core modules. Do not import adapters, registry, CLI, apps, docs-site, bridge packages, or testing helpers from runtime source.

Test commands:

```bash
pnpm --filter @a2amesh/runtime run typecheck
pnpm --filter @a2amesh/runtime run test
```

Feature rule: add behavior tests under `packages/runtime/tests/`, keep telemetry side-effect-free until bootstrapped, and update `public-surface.json` only for intentional exports.
