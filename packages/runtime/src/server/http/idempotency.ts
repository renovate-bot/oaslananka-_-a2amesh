import type { Request, Response } from 'express';
import {
  ErrorCodes,
  JsonRpcError,
  type JsonRpcId,
  type JsonRpcRequest,
} from '../../types/jsonrpc.js';
import type { RequestContext } from '../../types/auth.js';
import {
  buildIdempotencyFingerprint,
  type IdempotencyStoredResult,
  type IdempotencyStore,
} from '../IdempotencyStore.js';
import { attachRequestContext } from '../../auth/index.js';

export interface IdempotencyResolution {
  scope: string;
  key: string;
  fingerprint: string;
  replay?: IdempotencyStoredResult;
}

export interface IdempotencyScopeInput {
  method: string;
  tenantId?: string;
  principalId?: string;
  authMethod: string;
}

export function isIdempotentMethod(method: string): boolean {
  return (
    method === 'message/send' ||
    method === 'message/stream' ||
    method === 'tasks/cancel' ||
    method === 'tasks/pushNotification/set'
  );
}

export function buildIdempotencyScope(input: IdempotencyScopeInput): string {
  return [
    'rpc',
    input.method,
    input.tenantId ?? 'global',
    input.principalId ?? 'anonymous',
    input.authMethod,
  ].join(':');
}

export async function resolveIdempotency(
  req: Request,
  rpcReq: JsonRpcRequest,
  requestContext: RequestContext,
  res: Response,
  store: IdempotencyStore,
  deferReplay = false,
): Promise<IdempotencyResolution | null | undefined> {
  if (!isIdempotentMethod(rpcReq.method)) {
    return undefined;
  }

  const key = req.header('idempotency-key');
  if (!key) {
    return undefined;
  }

  const principalScope =
    requestContext.principalId ??
    requestContext.subject ??
    req.ip ??
    req.socket?.remoteAddress ??
    'anonymous';
  const scope = buildIdempotencyScope({
    method: rpcReq.method,
    ...(requestContext.tenantId ? { tenantId: requestContext.tenantId } : {}),
    principalId: principalScope,
    authMethod: requestContext.authMethod,
  });
  const fingerprint = buildIdempotencyFingerprint({
    scope,
    method: rpcReq.method,
    params: rpcReq.params ?? null,
  });

  attachRequestContext(req, {
    ...requestContext,
    idempotency: {
      key,
      scope,
      fingerprint,
      replayed: false,
    },
  });

  const existing = await store.get(scope, key);
  if (!existing) {
    return { scope, key, fingerprint };
  }

  if (existing.fingerprint !== fingerprint) {
    throw new JsonRpcError(ErrorCodes.IdempotencyConflict, 'Idempotency key reuse conflict', {
      key,
      scope,
    });
  }

  if (deferReplay) {
    return { scope, key, fingerprint, replay: existing.result };
  }

  if (existing.result.kind === 'error') {
    res.json({
      jsonrpc: '2.0',
      error: existing.result.error,
      id: rpcReq.id ?? null,
    });
    return null;
  }

  res.json({
    jsonrpc: '2.0',
    result: decorateIdempotentResult(existing.result.value, { scope, key, fingerprint }, true),
    id: rpcReq.id ?? null,
  });
  return null;
}

export function decorateIdempotentResult(
  result: unknown,
  idempotency: IdempotencyResolution,
  replayed: boolean,
): unknown {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    return result;
  }

  const record = {
    key: idempotency.key,
    scope: idempotency.scope,
    fingerprint: idempotency.fingerprint,
    replayed,
  };
  const currentMetadata =
    'metadata' in result && result.metadata && typeof result.metadata === 'object'
      ? (result.metadata as Record<string, unknown>)
      : {};

  return {
    ...result,
    metadata: {
      ...currentMetadata,
      idempotency: record,
    },
  };
}

export function extractJsonRpcId(body: unknown): JsonRpcId {
  if (!body || typeof body !== 'object' || !('id' in body)) {
    return null;
  }

  const id = (body as { id?: unknown }).id;
  return typeof id === 'string' || typeof id === 'number' || id === null ? id : null;
}
