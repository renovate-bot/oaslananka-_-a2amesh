import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  buildIdempotencyFingerprint,
  InMemoryIdempotencyStore,
  RedisIdempotencyStore,
  type RedisIdempotencyClient,
} from '../src/server/IdempotencyStore.js';

type MutableStringPrototype = typeof String.prototype & {
  toWellFormed?: () => string;
};

async function withoutNativeToWellFormed(callback: () => Promise<void>): Promise<void> {
  const stringPrototype = String.prototype as MutableStringPrototype;
  const originalToWellFormed = Object.getOwnPropertyDescriptor(stringPrototype, 'toWellFormed');

  Object.defineProperty(stringPrototype, 'toWellFormed', {
    configurable: true,
    value: undefined,
  });

  try {
    await callback();
  } finally {
    if (originalToWellFormed) {
      Object.defineProperty(stringPrototype, 'toWellFormed', originalToWellFormed);
    } else {
      delete stringPrototype.toWellFormed;
    }
  }
}

describe('IdempotencyStore', () => {
  it('builds stable fingerprints independent of object key order', () => {
    expect(buildIdempotencyFingerprint({ b: 2, a: { d: 4, c: [3, 2] } })).toBe(
      buildIdempotencyFingerprint({ a: { c: [3, 2], d: 4 }, b: 2 }),
    );
  });

  it('preserves array order in request fingerprints', () => {
    expect(buildIdempotencyFingerprint({ params: ['first', 'second'] })).not.toBe(
      buildIdempotencyFingerprint({ params: ['second', 'first'] }),
    );
  });

  it('domain-separates request fingerprints from raw SHA-256 digests', () => {
    const payload = { method: 'message/send', params: { apiKey: 'sk-test-secret', value: 1 } };
    const rawDigest = createHash('sha256')
      .update('{"method":"message/send","params":{"apiKey":"sk-test-secret","value":1}}')
      .digest('hex');

    const fingerprint = buildIdempotencyFingerprint(payload);

    expect(fingerprint).toMatch(/^[a-f0-9]{64}$/u);
    expect(fingerprint).not.toBe(rawDigest);
    expect(fingerprint).not.toContain('sk-test-secret');
    expect(fingerprint).not.toContain('apiKey');
  });

  it('stores process-local records with TTL and clone isolation', async () => {
    vi.useFakeTimers();
    const store = new InMemoryIdempotencyStore();

    const record = await store.set(
      'tenant-a:user-a:route',
      'key-1',
      'fingerprint',
      { kind: 'success', value: { ok: true } },
      1000,
    );
    (record.result as { kind: 'success'; value: { ok: boolean } }).value.ok = false;

    expect(await store.get('tenant-a:user-a:route', 'key-1')).toEqual(
      expect.objectContaining({
        scope: 'tenant-a:user-a:route',
        key: 'key-1',
        fingerprint: 'fingerprint',
        result: { kind: 'success', value: { ok: true } },
      }),
    );

    vi.advanceTimersByTime(1001);
    await expect(store.get('tenant-a:user-a:route', 'key-1')).resolves.toBeNull();
    vi.useRealTimers();
  });

  it('keeps process-local records distinct when scope and key contain delimiters', async () => {
    const store = new InMemoryIdempotencyStore();

    await store.set(
      'tenant-a:user-a',
      'route',
      'fingerprint-a',
      { kind: 'success', value: { request: 'a' } },
      1000,
    );
    await store.set(
      'tenant-a',
      'user-a:route',
      'fingerprint-b',
      { kind: 'success', value: { request: 'b' } },
      1000,
    );

    await expect(store.get('tenant-a:user-a', 'route')).resolves.toEqual(
      expect.objectContaining({
        scope: 'tenant-a:user-a',
        key: 'route',
        fingerprint: 'fingerprint-a',
      }),
    );
    await expect(store.get('tenant-a', 'user-a:route')).resolves.toEqual(
      expect.objectContaining({
        scope: 'tenant-a',
        key: 'user-a:route',
        fingerprint: 'fingerprint-b',
      }),
    );
  });

  it('handles malformed UTF-16 in process-local storage keys', async () => {
    const store = new InMemoryIdempotencyStore();

    await store.set(
      'tenant-\uD800',
      'route-\uD800',
      'fingerprint',
      { kind: 'success', value: { ok: true } },
      1000,
    );

    await expect(store.get('tenant-\uD800', 'route-\uD800')).resolves.toEqual(
      expect.objectContaining({
        scope: 'tenant-\uD800',
        key: 'route-\uD800',
        fingerprint: 'fingerprint',
      }),
    );
  });

  it('stores Redis records with TTL and ignores expired payloads', async () => {
    const values = new Map<string, string>();
    const expirations = new Map<string, number>();
    const client: RedisIdempotencyClient = {
      get: vi.fn(async (key) => values.get(key) ?? null),
      set: vi.fn(async (key, value) => {
        values.set(key, value);
      }),
      pexpire: vi.fn(async (key, ttlMs) => {
        expirations.set(key, ttlMs);
        return 1;
      }),
    };
    const store = new RedisIdempotencyStore(client, 'prefix');

    await expect(store.get('scope', 'missing')).resolves.toBeNull();

    const record = await store.set(
      'scope',
      'key',
      'fingerprint',
      { kind: 'error', error: { code: -32000, message: 'nope' } },
      500,
    );

    expect(record.result).toEqual({ kind: 'error', error: { code: -32000, message: 'nope' } });
    expect(expirations.get('prefix:scope:key')).toBe(500);
    await expect(store.get('scope', 'key')).resolves.toEqual(record);

    values.set(
      'prefix:scope:key',
      JSON.stringify({
        ...record,
        expiresAt: Date.now() - 1,
      }),
    );
    await expect(store.get('scope', 'key')).resolves.toBeNull();
  });

  it('handles malformed UTF-16 in Redis storage keys', async () => {
    const values = new Map<string, string>();
    const client: RedisIdempotencyClient = {
      get: vi.fn(async (key) => values.get(key) ?? null),
      set: vi.fn(async (key, value) => {
        values.set(key, value);
      }),
      pexpire: vi.fn(async () => 1),
    };
    const store = new RedisIdempotencyStore(client, 'prefix');

    await store.set(
      'tenant-\uD800',
      'route-\uD800',
      'fingerprint',
      { kind: 'success', value: { ok: true } },
      1000,
    );

    expect(values.has('prefix:tenant-%EF%BF%BD:route-%EF%BF%BD')).toBe(true);
    await expect(store.get('tenant-\uD800', 'route-\uD800')).resolves.toEqual(
      expect.objectContaining({
        scope: 'tenant-\uD800',
        key: 'route-\uD800',
        fingerprint: 'fingerprint',
      }),
    );
  });

  it('falls back to local UTF-16 normalization when toWellFormed is unavailable', async () => {
    const values = new Map<string, string>();
    const client: RedisIdempotencyClient = {
      get: vi.fn(async (key) => values.get(key) ?? null),
      set: vi.fn(async (key, value) => {
        values.set(key, value);
      }),
      pexpire: vi.fn(async () => 1),
    };
    const store = new RedisIdempotencyStore(client, 'prefix');

    await withoutNativeToWellFormed(async () => {
      await store.set(
        'ok-\uD83D\uDE00-\uD800-\uDC00-z',
        'route-\uD800',
        'fingerprint',
        { kind: 'success', value: { ok: true } },
        1000,
      );
    });

    expect(values.has('prefix:ok-%F0%9F%98%80-%EF%BF%BD-%EF%BF%BD-z:route-%EF%BF%BD')).toBe(true);
  });

  it('keeps Redis records distinct when scope and key contain delimiters', async () => {
    const values = new Map<string, string>();
    const expirations = new Map<string, number>();
    const client: RedisIdempotencyClient = {
      get: vi.fn(async (key) => values.get(key) ?? null),
      set: vi.fn(async (key, value) => {
        values.set(key, value);
      }),
      pexpire: vi.fn(async (key, ttlMs) => {
        expirations.set(key, ttlMs);
        return 1;
      }),
    };
    const store = new RedisIdempotencyStore(client, 'prefix');

    await store.set(
      'tenant-a:user-a',
      'route',
      'fingerprint-a',
      { kind: 'success', value: { request: 'a' } },
      1000,
    );
    await store.set(
      'tenant-a',
      'user-a:route',
      'fingerprint-b',
      { kind: 'success', value: { request: 'b' } },
      1000,
    );

    expect(values).toHaveLength(2);
    expect(values.has('prefix:tenant-a%3Auser-a:route')).toBe(true);
    expect(values.has('prefix:tenant-a:user-a%3Aroute')).toBe(true);
    await expect(store.get('tenant-a:user-a', 'route')).resolves.toEqual(
      expect.objectContaining({
        scope: 'tenant-a:user-a',
        key: 'route',
        fingerprint: 'fingerprint-a',
      }),
    );
    await expect(store.get('tenant-a', 'user-a:route')).resolves.toEqual(
      expect.objectContaining({
        scope: 'tenant-a',
        key: 'user-a:route',
        fingerprint: 'fingerprint-b',
      }),
    );
  });
});
