/**
 * @file tracer.ts
 * OpenTelemetry helpers for the A2A runtime.
 * Note: @opentelemetry/api is imported at module level but is optional at runtime.
 */

import {
  SpanStatusCode,
  baggageEntryMetadataFromString,
  context,
  propagation,
  trace,
  type Context,
  type SpanOptions,
  type Tracer,
} from '@opentelemetry/api';

const VERSION = '1.0.0';

function getTracer(): Tracer {
  return trace.getTracer('@a2amesh/runtime', VERSION);
}

export const a2aMeshTracer: Pick<Tracer, 'startSpan'> = {
  startSpan(name: string, options?: SpanOptions, activeContext?: Context) {
    return getTracer().startSpan(name, options, activeContext);
  },
};

export function withA2ABaggage(
  taskId?: string,
  contextId?: string,
  activeContext?: Context,
): Context {
  const current = activeContext ?? context.active();
  let currentBaggage = propagation.getBaggage(current) ?? propagation.createBaggage({});

  if (taskId) {
    currentBaggage = currentBaggage.setEntry('a2a.task_id', {
      value: taskId,
      metadata: baggageEntryMetadataFromString('a2a'),
    });
  }

  if (contextId) {
    currentBaggage = currentBaggage.setEntry('a2a.context_id', {
      value: contextId,
      metadata: baggageEntryMetadataFromString('a2a'),
    });
  }

  return propagation.setBaggage(current, currentBaggage);
}

export function extractA2AContext(carrier: Record<string, string | string[] | undefined>): Context {
  return propagation.extract(context.active(), carrier, {
    get(c, key) {
      const value = (c as Record<string, string | string[] | undefined>)[key];
      return Array.isArray(value) ? value[0] : value;
    },
    keys(c) {
      return Object.keys(c as Record<string, string | string[] | undefined>);
    },
  });
}

export { SpanStatusCode };
