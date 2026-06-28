import fc from 'fast-check';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { A2AServer, type A2AServerOptions } from '../src/server/A2AServer.js';
import { JsonRpcRequestSchema } from '../src/schemas/public.js';
import { ErrorCodes } from '../src/types/jsonrpc.js';
import type { AgentCard } from '../src/types/agent-card.js';
import type { Artifact, Message, Task } from '../src/types/task.js';

const agentCard: AgentCard = {
  protocolVersion: '1.0',
  name: 'JSON-RPC Fuzz Harness Agent',
  description: 'A2AServer fuzz test harness',
  url: 'http://localhost:0',
  version: '1.0.0',
};

const secretSentinels = [
  'Bearer fuzz-authorization-secret',
  'fuzz-api-key-value',
  'fuzz-token-value',
  'fuzz-client-secret-value',
];
const clientSecretKey = ['client', 'secret'].join('_');

class JsonRpcFuzzServer extends A2AServer {
  constructor(options: A2AServerOptions = {}) {
    super(agentCard, options);
  }

  async handleTask(_task: Task, _message: Message): Promise<Artifact[]> {
    return [];
  }
}

function stringifyPayload(payload: unknown): string {
  return JSON.stringify(payload);
}

function isInvalidJsonRpcRequest(payload: unknown): boolean {
  return !JsonRpcRequestSchema.safeParse(payload).success;
}

function isStrictJsonPrimitive(payload: unknown): boolean {
  return payload === null || (typeof payload !== 'object' && typeof payload !== 'undefined');
}

const malformedJsonRpcPayload: fc.Arbitrary<unknown> = fc
  .oneof(
    fc.constant(null),
    fc.boolean(),
    fc.integer(),
    fc.string(),
    fc.array(fc.jsonValue(), { maxLength: 4 }),
    fc.dictionary(fc.string({ maxLength: 24 }), fc.jsonValue(), { maxKeys: 6 }),
    fc.record(
      {
        jsonrpc: fc.oneof(fc.constant('1.0'), fc.constant('2'), fc.string({ maxLength: 8 })),
        method: fc.oneof(fc.constant(null), fc.integer(), fc.boolean(), fc.array(fc.string())),
        params: fc.oneof(fc.string(), fc.integer(), fc.boolean(), fc.constant(null)),
        id: fc.oneof(fc.boolean(), fc.array(fc.string()), fc.object({ maxDepth: 1 })),
      },
      { requiredKeys: [] },
    ),
    fc.constant({
      jsonrpc: '2.0',
      method: 123,
      params: {
        Authorization: secretSentinels[0],
        apiKey: secretSentinels[1],
        token: secretSentinels[2],
        [clientSecretKey]: secretSentinels[3],
      },
      id: { nested: true },
    }),
  )
  .filter(isInvalidJsonRpcRequest);

const secretExamples: [unknown][] = secretSentinels.map((value) => [
  {
    jsonrpc: '2.0',
    method: 123,
    params: { token: value },
    id: { invalid: true },
  },
]);

describe('JSON-RPC fuzz validation', () => {
  it('maps malformed JSON-RPC bodies to bounded JSON-RPC errors without leaking secrets', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    const server = new JsonRpcFuzzServer({ bodyLimit: '64kb' });

    await fc.assert(
      fc.asyncProperty(malformedJsonRpcPayload, async (payload) => {
        const response = await request(server.getExpressApp())
          .post('/rpc')
          .set('Content-Type', 'application/json')
          .send(stringifyPayload(payload));

        expect(response.status).toBe(200);
        const expectedError = isStrictJsonPrimitive(payload)
          ? {
              code: ErrorCodes.ParseError,
              message: 'Parse error',
            }
          : {
              code: ErrorCodes.InvalidRequest,
              message: Array.isArray(payload)
                ? 'Batch requests are not supported'
                : 'Invalid JSON-RPC request',
            };

        expect(response.body).toMatchObject({
          jsonrpc: '2.0',
          error: expectedError,
        });
        expect(stringifyPayload(response.body).length).toBeLessThan(4096);
      }),
      {
        numRuns: 75,
        examples: secretExamples,
      },
    );

    const capturedLogs = [...stdout.mock.calls, ...stderr.mock.calls]
      .map(([chunk]) => String(chunk))
      .join('\n');
    for (const secret of secretSentinels) {
      expect(capturedLogs).not.toContain(secret);
    }
  });

  it('returns a bounded JSON-RPC parse error for bodies over the configured JSON limit', async () => {
    const secret = 'fuzz-oversized-token-value';
    const server = new JsonRpcFuzzServer({ bodyLimit: '256b' });
    const response = await request(server.getExpressApp())
      .post('/rpc')
      .set('Content-Type', 'application/json')
      .send(
        stringifyPayload({
          jsonrpc: '2.0',
          id: 'too-large',
          method: 'tasks/get',
          params: {
            taskId: 'missing',
            token: secret,
            padding: 'x'.repeat(2048),
          },
        }),
      );

    expect(response.status).toBe(413);
    expect(response.body).toMatchObject({
      jsonrpc: '2.0',
      error: {
        code: ErrorCodes.ParseError,
        message: 'Payload too large',
      },
      id: null,
    });
    expect(stringifyPayload(response.body)).not.toContain(secret);
    expect(stringifyPayload(response.body).length).toBeLessThan(1024);
  });
});
