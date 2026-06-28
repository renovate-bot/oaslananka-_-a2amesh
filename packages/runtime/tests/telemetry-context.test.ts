import { describe, expect, it, vi } from 'vitest';
import { createTelemetryContextMiddleware } from '../src/server/http/middleware.js';
import { extractA2AContext } from '@a2amesh/runtime';

describe('telemetry context propagation', () => {
  it('extractA2AContext returns a context object from headers', () => {
    const ctx = extractA2AContext({
      traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
      tracestate: 'rojo=00f067aa0ba902b7,congo=t61rcWkgMzE',
    });
    expect(ctx).toBeDefined();
    expect(typeof ctx).toBe('object');
  });

  it('extractA2AContext handles empty headers', () => {
    const ctx = extractA2AContext({});
    expect(ctx).toBeDefined();
  });

  it('extractA2AContext handles array-valued headers', () => {
    const ctx = extractA2AContext({
      traceparent: ['00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01'],
    });
    expect(ctx).toBeDefined();
  });

  it('createTelemetryContextMiddleware returns a middleware function', () => {
    const middleware = createTelemetryContextMiddleware();
    expect(typeof middleware).toBe('function');
  });

  it('createTelemetryContextMiddleware extracts context and calls next', () => {
    const middleware = createTelemetryContextMiddleware();
    const next = vi.fn();
    const req = {
      headers: {
        traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
      },
    } as unknown as Parameters<typeof middleware>[0];

    middleware(req, {} as Parameters<typeof middleware>[1], next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('createTelemetryContextMiddleware calls next even without headers', () => {
    const middleware = createTelemetryContextMiddleware();
    const next = vi.fn();
    const req = { headers: {} } as unknown as Parameters<typeof middleware>[0];

    middleware(req, {} as Parameters<typeof middleware>[1], next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
