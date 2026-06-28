import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EventSource, EventSourceInit } from 'eventsource';

import { A2AClient } from '../src/client/A2AClient.js';

function createTaskPayload(id: string, state: 'SUBMITTED' | 'WORKING' | 'COMPLETED' = 'SUBMITTED') {
  return {
    id,
    status: {
      state,
      timestamp: new Date().toISOString(),
    },
    history: [],
  };
}

type MockEventSourceEvent = { data?: string };
type MockEventSourceListener = (event: MockEventSourceEvent) => void;

class MockEventSource {
  static readonly instances: MockEventSource[] = [];
  readonly listeners = new Map<string, MockEventSourceListener[]>();
  readonly close = vi.fn(() => {
    this.closed = true;
  });
  onerror: (() => void) | null = null;
  closed = false;

  constructor(
    readonly url: string,
    readonly init?: EventSourceInit & { headers?: Record<string, string> },
  ) {
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: MockEventSourceListener): void {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  emit(type: string, data: unknown): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener({ data: JSON.stringify(data) });
    }
  }

  fail(): void {
    this.onerror?.();
  }
}

class FetchOverrideEventSource extends MockEventSource {}

Object.defineProperty(FetchOverrideEventSource, Symbol.for('eventsource.supports-fetch-override'), {
  value: true,
});

describe('A2AClient streaming and retry branches', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    MockEventSource.instances.length = 0;
  });

  it('resolves the canonical agent card without falling back to the legacy path', async () => {
    const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          protocolVersion: '1.0',
          name: 'Canonical',
          description: 'Primary card',
          url: 'http://localhost:3000',
          version: '1.0.0',
        }),
        { status: 200 },
      ),
    );

    const client = new A2AClient('http://localhost:3000', {
      fetchImplementation: fetchSpy,
    });

    const card = await client.resolveCard();
    expect(card.name).toBe('Canonical');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('does not retry non-retryable HTTP failures', async () => {
    const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 404 }));
    const client = new A2AClient('http://localhost:3000', {
      fetchImplementation: fetchSpy,
      retry: {
        maxAttempts: 3,
        backoffMs: 1,
        retryOn: [503],
      },
    });

    await expect(client.health()).rejects.toThrow('Health check failed with status 404');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('keeps wrapped message params intact when calling sendMessage', async () => {
    const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          id: '1',
          result: createTaskPayload('task-wrapped'),
        }),
        { status: 200 },
      ),
    );

    const client = new A2AClient('http://localhost:3000', {
      fetchImplementation: fetchSpy,
    });

    await client.sendMessage({
      message: {
        role: 'user',
        parts: [{ type: 'text', text: 'wrapped params' }],
        messageId: 'wrapped-message',
        timestamp: new Date().toISOString(),
      },
      contextId: 'ctx-wrapped',
      configuration: {
        blocking: true,
      },
    });

    const [, init] = fetchSpy.mock.calls[0] ?? [];
    const body = JSON.parse(String(init?.body)) as {
      params: { contextId?: string; message: { messageId: string } };
    };
    expect(body.params.contextId).toBe('ctx-wrapped');
    expect(body.params.message.messageId).toBe('wrapped-message');
  });

  it('streams task updates until a terminal state is received', async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const task of [
          createTaskPayload('task-stream', 'WORKING'),
          createTaskPayload('task-stream', 'COMPLETED'),
        ]) {
          controller.enqueue(
            encoder.encode(
              `event: message\ndata: ${JSON.stringify({
                jsonrpc: '2.0',
                id: 'stream-id',
                result: task,
              })}\r\n\r\n`,
            ),
          );
        }
        controller.close();
      },
    });
    const fetchSpy = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } }),
      );

    const client = new A2AClient('http://localhost:3000', {
      fetchImplementation: fetchSpy,
      headers: { authorization: 'Bearer token' },
    });

    const updates = await client.sendMessageStream({
      role: 'user',
      parts: [{ type: 'text', text: 'stream please' }],
      messageId: 'message-stream',
      timestamp: new Date().toISOString(),
    });

    const states: string[] = [];
    for await (const update of updates) {
      const task = update as { status?: { state?: string } };
      if (task.status?.state) {
        states.push(task.status.state);
      }
    }

    expect(states).toEqual(['WORKING', 'COMPLETED']);
    const [, init] = fetchSpy.mock.calls[0] ?? [];
    expect(init?.headers).toMatchObject({
      Accept: 'text/event-stream',
      authorization: 'Bearer token',
    });
  });

  it('keeps the final JSON-RPC SSE event when the stream closes without a delimiter', async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            `event: message\ndata: ${JSON.stringify({
              jsonrpc: '2.0',
              id: 'stream-id',
              result: createTaskPayload('task-final', 'COMPLETED'),
            })}`,
          ),
        );
        controller.close();
      },
    });
    const fetchSpy = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } }),
      );

    const client = new A2AClient('http://localhost:3000', {
      fetchImplementation: fetchSpy,
    });

    const updates = await client.sendMessageStream({
      role: 'user',
      parts: [{ type: 'text', text: 'final frame' }],
      messageId: 'message-stream-final',
      timestamp: new Date().toISOString(),
    });

    const next = await updates.next();
    expect((next.value as { id?: string }).id).toBe('task-final');
    expect(next.done).toBe(false);
    await expect(updates.next()).resolves.toMatchObject({ done: true });
  });

  it('throws typed errors received from the JSON-RPC SSE stream', async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            `event: message\ndata: ${JSON.stringify({
              jsonrpc: '2.0',
              id: 'stream-error',
              error: { code: -32011, message: 'Streaming unsupported' },
            })}\n\n`,
          ),
        );
        controller.close();
      },
    });
    const fetchSpy = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } }),
      );

    const client = new A2AClient('http://localhost:3000', {
      fetchImplementation: fetchSpy,
    });

    const updates = await client.sendMessageStream({
      role: 'user',
      parts: [{ type: 'text', text: 'fail the stream' }],
      messageId: 'message-stream-error',
      timestamp: new Date().toISOString(),
    });

    await expect(updates.next()).rejects.toThrow('Streaming unsupported (-32011)');
  });

  it('throws a descriptive error for malformed JSON-RPC SSE payloads', async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('event: message\ndata: {"jsonrpc":"2.0",\n\n'));
        controller.close();
      },
    });
    const fetchSpy = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } }),
      );

    const client = new A2AClient('http://localhost:3000', {
      fetchImplementation: fetchSpy,
    });

    const updates = await client.sendMessageStream({
      role: 'user',
      parts: [{ type: 'text', text: 'malformed stream' }],
      messageId: 'message-stream-malformed',
      timestamp: new Date().toISOString(),
    });

    await expect(updates.next()).rejects.toThrow('RPC stream returned malformed JSON');
  });

  it('subscribes to task EventSource updates and closes after a terminal state', async () => {
    const client = new A2AClient('http://localhost:3000', {
      eventSourceImplementation: MockEventSource as unknown as typeof EventSource,
      headers: { authorization: 'Bearer token' },
      streamPath: '/tasks/stream',
    });

    const updates = client.subscribeTask('task-1');
    const first = updates.next();

    const source = MockEventSource.instances[0];
    expect(source?.url).toBe('http://localhost:3000/tasks/stream?taskId=task-1');
    expect(source?.init?.headers).toEqual({
      'A2A-Version': '1.0',
      authorization: 'Bearer token',
    });

    source?.emit('task_updated', createTaskPayload('task-1', 'WORKING'));
    await expect(first).resolves.toMatchObject({
      value: expect.objectContaining({ id: 'task-1' }),
      done: false,
    });

    const terminal = updates.next();
    source?.emit('task_updated', createTaskPayload('task-1', 'COMPLETED'));
    await expect(terminal).resolves.toMatchObject({
      value: expect.objectContaining({
        status: expect.objectContaining({ state: 'COMPLETED' }),
      }),
      done: false,
    });
    await expect(updates.next()).resolves.toMatchObject({ done: true });
    expect(source?.close).toHaveBeenCalled();
  });

  it('uses EventSource fetch override support when attaching task stream headers', async () => {
    const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 200 }));
    const client = new A2AClient('http://localhost:3000', {
      eventSourceImplementation: FetchOverrideEventSource as unknown as typeof EventSource,
      fetchImplementation: fetchSpy,
      headers: { authorization: 'Bearer token' },
      streamPath: '/tasks/stream',
    });

    const updates = client.subscribeTask('task-fetch-headers');
    const next = updates.next();

    const source = MockEventSource.instances[0];
    const fetchOverride = source?.init?.fetch;
    expect(fetchOverride).toEqual(expect.any(Function));

    type EventSourceFetch = NonNullable<EventSourceInit['fetch']>;
    await fetchOverride?.(new URL('http://localhost:3000/tasks/stream?taskId=task-fetch-headers'), {
      headers: { Accept: 'text/event-stream' },
    } as Parameters<EventSourceFetch>[1]);

    const [, init] = fetchSpy.mock.calls[0] ?? [];
    const headers = new Headers(init?.headers);
    expect(headers.get('accept')).toBe('text/event-stream');
    expect(headers.get('authorization')).toBe('Bearer token');

    source?.fail();
    await expect(next).resolves.toMatchObject({ done: true });
  });

  it('ends task EventSource iteration when the stream errors', async () => {
    const client = new A2AClient('http://localhost:3000', {
      eventSourceImplementation: MockEventSource as unknown as typeof EventSource,
    });

    const updates = client.subscribeTask('task-error');
    const next = updates.next();
    MockEventSource.instances[0]?.fail();

    await expect(next).resolves.toMatchObject({ done: true });
    expect(MockEventSource.instances[0]?.close).toHaveBeenCalled();
  });
});
