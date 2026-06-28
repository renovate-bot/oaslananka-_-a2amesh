# @a2amesh/registry

Registry server, discovery API, health polling, matching, and storage helpers.

See [Compatibility](../../docs/compatibility.md) for supported Node.js, protocol, transport, package, and peer ranges.

## OpenAPI

The registry REST contract is available as [registry.openapi.json](../../docs/openapi/registry.openapi.json) for client generation, UI mocks, and API contract checks.

## Export And Import

The registry control plane supports `GET /admin/agents/export` and `POST /admin/agents/import` for moving registered agent records between registries. Exported documents use `https://oaslananka.github.io/a2amesh/schemas/registry-export.schema.json`; imports are idempotent when records match existing agents by `id` or `url`.

## Redis Storage

`RedisStorage` accepts the original JSON key/value client shape:

```ts
new RedisStorage({
  get: (key) => redis.get(key),
  set: (key, value) => redis.set(key, value),
  del: (key) => redis.del(key),
});
```

For production Redis clients, also expose set commands so registry indexes are maintained atomically:

```ts
new RedisStorage({
  get: (key) => redis.get(key),
  set: (key, value) => redis.set(key, value),
  del: (key) => redis.del(key),
  sadd: (key, ...members) => redis.sadd(key, ...members),
  srem: (key, ...members) => redis.srem(key, ...members),
  smembers: (key) => redis.smembers(key),
  multi: () => redis.multi(),
});
```

The lowercase `sadd`, `srem`, and `smembers` methods are the canonical capability interface. Common node-redis aliases `sAdd`, `sRem`, `sMembers`, and raw uppercase command names are also detected. Existing JSON-array clients remain supported for tests and lightweight fakes, so this is a backward-compatible interface expansion.
