import { randomUUID } from 'node:crypto';
import { context, propagation } from '@opentelemetry/api';
import type { ErrorRequestHandler, Request, RequestHandler } from 'express';
import { attachRequestContext, createAnonymousRequestContext } from '../../auth/index.js';
import { ErrorCodes, type JsonRpcResponse } from '../../types/jsonrpc.js';
import { makeErrorInfo } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

export interface RequestWithRequestId extends Request {
  requestId?: string;
}

export interface OriginPolicy {
  origin: string | undefined;
  allowedOrigins?: string[] | undefined;
  requireOrigin?: boolean | undefined;
}

export function createRequestContextMiddleware(): RequestHandler {
  return (req: RequestWithRequestId, _res, next) => {
    req.requestId = req.header('x-request-id') ?? randomUUID();
    attachRequestContext(req, createAnonymousRequestContext(req));
    next();
  };
}

export function createTelemetryContextMiddleware(): RequestHandler {
  return (req, _res, next) => {
    const extracted = propagation.extract(context.active(), req.headers, {
      get(carrier, key) {
        const value = (carrier as Record<string, string | string[] | undefined>)[key];
        return Array.isArray(value) ? value[0] : value;
      },
      keys(carrier) {
        return Object.keys(carrier as Record<string, string | string[] | undefined>);
      },
    });
    context.with(extracted, () => next());
  };
}

export function createOriginGuardMiddleware(policy: Omit<OriginPolicy, 'origin'>): RequestHandler {
  return (req, res, next) => {
    if (
      !isOriginAllowed({
        origin: req.header('origin'),
        allowedOrigins: policy.allowedOrigins,
        requireOrigin: policy.requireOrigin,
      })
    ) {
      res.status(403).send('Forbidden origin');
      return;
    }
    next();
  };
}

export function isOriginAllowed(policy: OriginPolicy): boolean {
  if (!policy.origin) {
    return !policy.requireOrigin;
  }

  const origin = policy.origin;
  const allowedOrigins = policy.allowedOrigins ?? [];
  if (allowedOrigins.length === 0) {
    logger.warn('allowedOrigins is not configured; cross-origin request rejected');
    return false;
  }

  let originHostname: string | undefined;
  return allowedOrigins.some((pattern) => {
    if (pattern === policy.origin) {
      return true;
    }
    if (!pattern.startsWith('*.')) {
      return false;
    }
    try {
      originHostname ??= new URL(origin).hostname;
      const wildcardDomain = pattern.slice(2);
      return originHostname === wildcardDomain || originHostname.endsWith(`.${wildcardDomain}`);
    } catch {
      return false;
    }
  });
}

export function jsonParseErrorHandler(): ErrorRequestHandler {
  return (err, _req, res, next) => {
    if (isPayloadTooLargeError(err)) {
      res.status(413).json({
        jsonrpc: '2.0',
        error: {
          code: ErrorCodes.ParseError,
          message: 'Payload too large',
          data: makeErrorInfo('PARSE_ERROR'),
        },
        id: null,
      } satisfies JsonRpcResponse);
      return;
    }

    if (err instanceof SyntaxError && 'body' in err) {
      res.status(200).json({
        jsonrpc: '2.0',
        error: {
          code: ErrorCodes.ParseError,
          message: 'Parse error',
          data: makeErrorInfo('PARSE_ERROR'),
        },
        id: null,
      } satisfies JsonRpcResponse);
      return;
    }

    next(err);
  };
}

function isPayloadTooLargeError(err: unknown): boolean {
  if (!err || typeof err !== 'object') {
    return false;
  }
  const payload = err as { status?: unknown; type?: unknown };
  return payload.status === 413 || payload.type === 'entity.too.large';
}
