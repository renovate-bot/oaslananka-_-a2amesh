import { createHmac } from 'node:crypto';
import type { JsonRpcError } from '../types/jsonrpc.js';

const IDEMPOTENCY_FINGERPRINT_ALGORITHM = 'sha256';
const IDEMPOTENCY_FINGERPRINT_DOMAIN = 'a2amesh:idempotency:fingerprint:v1';
const HIGH_SURROGATE_END = 0xdbff;
const HIGH_SURROGATE_START = 0xd800;
const LOW_SURROGATE_END = 0xdfff;
const LOW_SURROGATE_START = 0xdc00;
const REPLACEMENT_CHARACTER = '\uFFFD';

type StringWithToWellFormed = string & { toWellFormed?: () => string };

export interface IdempotencySuccessResult {
  kind: 'success';
  value: unknown;
}

export interface IdempotencyFailureResult {
  kind: 'error';
  error: Pick<JsonRpcError, 'code' | 'message' | 'data'>;
}

export type IdempotencyStoredResult = IdempotencySuccessResult | IdempotencyFailureResult;

export interface IdempotencyRecord {
  scope: string;
  key: string;
  fingerprint: string;
  storedAt: string;
  expiresAt: number;
  result: IdempotencyStoredResult;
}

export interface IdempotencyStore {
  get(scope: string, key: string): Promise<IdempotencyRecord | null>;
  set(
    scope: string,
    key: string,
    fingerprint: string,
    result: IdempotencyStoredResult,
    ttlMs: number,
  ): Promise<IdempotencyRecord>;
}

export interface RedisIdempotencyClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<unknown>;
  pexpire(key: string, ttlMs: number): Promise<number>;
}

export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly records = new Map<string, IdempotencyRecord>();

  async get(scope: string, key: string): Promise<IdempotencyRecord | null> {
    this.pruneExpired();
    return structuredClone(this.records.get(this.buildKey(scope, key)) ?? null);
  }

  async set(
    scope: string,
    key: string,
    fingerprint: string,
    result: IdempotencyStoredResult,
    ttlMs: number,
  ): Promise<IdempotencyRecord> {
    this.pruneExpired();
    const record: IdempotencyRecord = {
      scope,
      key,
      fingerprint,
      storedAt: new Date().toISOString(),
      expiresAt: Date.now() + ttlMs,
      result: structuredClone(result),
    };
    this.records.set(this.buildKey(scope, key), record);
    return structuredClone(record);
  }

  private buildKey(scope: string, key: string): string {
    return buildScopedStorageKey(scope, key);
  }

  private pruneExpired(): void {
    const now = Date.now();
    for (const [key, record] of this.records.entries()) {
      if (record.expiresAt <= now) {
        this.records.delete(key);
      }
    }
  }
}

export class RedisIdempotencyStore implements IdempotencyStore {
  constructor(
    private readonly client: RedisIdempotencyClient,
    private readonly prefix = 'a2a:idempotency',
  ) {}

  async get(scope: string, key: string): Promise<IdempotencyRecord | null> {
    const record = await this.client.get(this.buildKey(scope, key));
    if (!record) {
      return null;
    }

    const parsed = JSON.parse(record) as IdempotencyRecord;
    if (parsed.expiresAt <= Date.now()) {
      return null;
    }

    return parsed;
  }

  async set(
    scope: string,
    key: string,
    fingerprint: string,
    result: IdempotencyStoredResult,
    ttlMs: number,
  ): Promise<IdempotencyRecord> {
    const record: IdempotencyRecord = {
      scope,
      key,
      fingerprint,
      storedAt: new Date().toISOString(),
      expiresAt: Date.now() + ttlMs,
      result,
    };
    const redisKey = this.buildKey(scope, key);
    await this.client.set(redisKey, JSON.stringify(record));
    await this.client.pexpire(redisKey, ttlMs);
    return record;
  }

  private buildKey(scope: string, key: string): string {
    return `${this.prefix}:${buildScopedStorageKey(scope, key)}`;
  }
}

export function buildIdempotencyFingerprint(value: unknown): string {
  return createHmac(IDEMPOTENCY_FINGERPRINT_ALGORITHM, IDEMPOTENCY_FINGERPRINT_DOMAIN)
    .update(stableStringify(value))
    .digest('hex');
}

function buildScopedStorageKey(scope: string, key: string): string {
  return `${encodeStorageKeyPart(scope)}:${encodeStorageKeyPart(key)}`;
}

function encodeStorageKeyPart(value: string): string {
  return encodeURIComponent(toWellFormedString(value));
}

function toWellFormedString(value: string): string {
  const toWellFormed = (value as StringWithToWellFormed).toWellFormed;
  if (typeof toWellFormed === 'function') {
    return toWellFormed.call(value);
  }

  let result = '';
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (isHighSurrogate(codeUnit)) {
      const nextCodeUnit = value.charCodeAt(index + 1);
      if (isLowSurrogate(nextCodeUnit)) {
        result += value.charAt(index) + value.charAt(index + 1);
        index += 1;
      } else {
        result += REPLACEMENT_CHARACTER;
      }
      continue;
    }

    result += isLowSurrogate(codeUnit) ? REPLACEMENT_CHARACTER : value.charAt(index);
  }
  return result;
}

function isHighSurrogate(codeUnit: number): boolean {
  return codeUnit >= HIGH_SURROGATE_START && codeUnit <= HIGH_SURROGATE_END;
}

function isLowSurrogate(codeUnit: number): boolean {
  return codeUnit >= LOW_SURROGATE_START && codeUnit <= LOW_SURROGATE_END;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
      left.localeCompare(right),
    );
    return `{${entries
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
}
