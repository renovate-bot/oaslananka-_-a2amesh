import type { Request, Response } from 'express';
import fc from 'fast-check';
import { describe, expect, it, vi } from 'vitest';
import { InMemoryIdempotencyStore } from '../../src/server/IdempotencyStore.js';
import { resolveIdempotency } from '../../src/server/http/idempotency.js';
import type { RequestContext } from '../../src/types/auth.js';
import type { JsonRpcRequest } from '../../src/types/jsonrpc.js';

const IDEMPOTENT_METHODS = [
  'message/send',
  'message/stream',
  'tasks/cancel',
  'tasks/pushNotification/set',
] as const;

const PROPERTY_CONFIG = {
  seed: 20260527,
  numRuns: 500,
  verbose: true,
} as const;

type IdempotentMethod = (typeof IDEMPOTENT_METHODS)[number];

interface GeneratedParams {
  [key: string]: unknown;
  taskId: string;
  message: {
    role: 'user' | 'agent';
    parts: { type: 'text'; text: string }[];
  };
  metadata: Record<string, string | number | boolean | null>;
  options: (string | number | boolean | null)[];
}

interface GeneratedRequest {
  id: string | number | null;
  method: IdempotentMethod;
  params: GeneratedParams;
  principalId: string;
  tenantId: string;
  idempotencyKey: string;
}

interface ResolvedIdentity {
  scope: string;
  fingerprint: string;
}

const identifierArbitrary = fc.stringMatching(/^[a-z][a-z0-9-]{0,15}$/);
const scalarArbitrary = fc.oneof(
  fc.string({ maxLength: 32 }),
  fc.integer({ min: -1_000_000, max: 1_000_000 }),
  fc.boolean(),
  fc.constant(null),
);

const distinctIdentifierPairArbitrary = fc
  .tuple(identifierArbitrary, identifierArbitrary)
  .filter(([left, right]) => left !== right);

const paramsArbitrary: fc.Arbitrary<GeneratedParams> = fc.record({
  taskId: identifierArbitrary,
  message: fc.record({
    role: fc.constantFrom('user', 'agent'),
    parts: fc.array(
      fc.record({
        type: fc.constant('text'),
        text: fc.string({ minLength: 1, maxLength: 64 }),
      }),
      { minLength: 1, maxLength: 4 },
    ),
  }),
  metadata: fc.dictionary(identifierArbitrary, scalarArbitrary, { maxKeys: 4 }),
  options: fc.array(scalarArbitrary, { maxLength: 4 }),
});

const requestArbitrary: fc.Arbitrary<GeneratedRequest> = fc.record({
  id: fc.oneof(fc.string({ maxLength: 24 }), fc.integer(), fc.constant(null)),
  method: fc.constantFrom(...IDEMPOTENT_METHODS),
  params: paramsArbitrary,
  principalId: identifierArbitrary,
  tenantId: identifierArbitrary,
  idempotencyKey: identifierArbitrary,
});

const differentMethodArbitrary = requestArbitrary.chain((requestCase) =>
  fc
    .constantFrom(...IDEMPOTENT_METHODS)
    .filter((method) => method !== requestCase.method)
    .map((method) => [requestCase, method] as const),
);

describe('idempotency fingerprint properties', () => {
  it('keeps equivalent JSON-RPC payload fingerprints stable across key order and idempotency keys', async () => {
    await fc.assert(
      fc.asyncProperty(
        requestArbitrary,
        distinctIdentifierPairArbitrary,
        async (requestCase, [firstKey, secondKey]) => {
          const first = await resolveIdentity({ ...requestCase, idempotencyKey: firstKey });
          const second = await resolveIdentity({
            ...requestCase,
            idempotencyKey: secondKey,
            params: reorderJsonValue(requestCase.params) as GeneratedParams,
          });

          expect(second).toEqual(first);
        },
      ),
      PROPERTY_CONFIG,
    );
  });

  it('changes fingerprints when principals differ within the same tenant and payload', async () => {
    await fc.assert(
      fc.asyncProperty(
        requestArbitrary,
        distinctIdentifierPairArbitrary,
        async (requestCase, [firstPrincipal, secondPrincipal]) => {
          const first = await resolveIdentity({
            ...requestCase,
            principalId: firstPrincipal,
          });
          const second = await resolveIdentity({
            ...requestCase,
            principalId: secondPrincipal,
          });

          expect(second.scope).not.toBe(first.scope);
          expect(second.fingerprint).not.toBe(first.fingerprint);
        },
      ),
      PROPERTY_CONFIG,
    );
  });

  it('changes fingerprints when tenants differ for the same principal and payload', async () => {
    await fc.assert(
      fc.asyncProperty(
        requestArbitrary,
        distinctIdentifierPairArbitrary,
        async (requestCase, [firstTenant, secondTenant]) => {
          const first = await resolveIdentity({
            ...requestCase,
            tenantId: firstTenant,
          });
          const second = await resolveIdentity({
            ...requestCase,
            tenantId: secondTenant,
          });

          expect(second.scope).not.toBe(first.scope);
          expect(second.fingerprint).not.toBe(first.fingerprint);
        },
      ),
      PROPERTY_CONFIG,
    );
  });

  it('changes fingerprints when idempotent JSON-RPC methods differ', async () => {
    await fc.assert(
      fc.asyncProperty(differentMethodArbitrary, async ([requestCase, method]) => {
        const first = await resolveIdentity(requestCase);
        const second = await resolveIdentity({ ...requestCase, method });

        expect(second.scope).not.toBe(first.scope);
        expect(second.fingerprint).not.toBe(first.fingerprint);
      }),
      PROPERTY_CONFIG,
    );
  });

  it('changes fingerprints when JSON-RPC params differ in a minimized field', async () => {
    await fc.assert(
      fc.asyncProperty(requestArbitrary, async (requestCase) => {
        const first = await resolveIdentity({
          ...requestCase,
          params: {
            ...requestCase.params,
            metadata: {
              ...requestCase.params.metadata,
              generatedDifference: 'left',
            },
          },
        });
        const second = await resolveIdentity({
          ...requestCase,
          params: {
            ...requestCase.params,
            metadata: {
              ...requestCase.params.metadata,
              generatedDifference: 'right',
            },
          },
        });

        expect(second.scope).toBe(first.scope);
        expect(second.fingerprint).not.toBe(first.fingerprint);
      }),
      PROPERTY_CONFIG,
    );
  });
});

async function resolveIdentity(requestCase: GeneratedRequest): Promise<ResolvedIdentity> {
  const response = { json: vi.fn() } as unknown as Response;
  const resolution = await resolveIdempotency(
    makeRequest(requestCase.idempotencyKey),
    makeJsonRpcRequest(requestCase),
    makeRequestContext(requestCase),
    response,
    new InMemoryIdempotencyStore(),
  );

  if (!resolution) {
    throw new Error('Expected idempotency resolution for generated idempotent request');
  }

  expect(response.json).not.toHaveBeenCalled();
  return {
    scope: resolution.scope,
    fingerprint: resolution.fingerprint,
  };
}

function makeRequest(idempotencyKey: string): Request {
  return {
    header: (name: string) =>
      name.toLowerCase() === 'idempotency-key' ? idempotencyKey : undefined,
    ip: '203.0.113.10',
    socket: { remoteAddress: '203.0.113.10' },
  } as unknown as Request;
}

function makeJsonRpcRequest(requestCase: GeneratedRequest): JsonRpcRequest {
  const params = requestCase.params;
  return {
    params,
    method: requestCase.method,
    id: requestCase.id,
    jsonrpc: '2.0',
  };
}

function makeRequestContext(requestCase: GeneratedRequest): RequestContext {
  return {
    requestId: `req-${requestCase.idempotencyKey}`,
    authMethod: 'apiKey',
    principalId: requestCase.principalId,
    tenantId: requestCase.tenantId,
    scopes: [],
    roles: [],
    claims: {},
  };
}

function reorderJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(reorderJsonValue);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .reverse()
        .map(([key, entryValue]) => [key, reorderJsonValue(entryValue)]),
    );
  }

  return value;
}
