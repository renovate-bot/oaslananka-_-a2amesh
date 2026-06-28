import { vi } from 'vitest';
import type { AgentStreamPayload, RegistryTaskEvent } from '../api/registry';

interface FetchRoute {
  path: string;
  status?: number;
  body?: unknown;
  error?: Error;
}

function routePath(input: RequestInfo | URL): string {
  const raw = input instanceof Request ? input.url : input.toString();
  const url = new URL(raw, 'http://localhost');
  return `${url.pathname}${url.search}`;
}

export function installFetchMock(routes: FetchRoute[]) {
  const calls: string[] = [];

  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, _init?: RequestInit): Promise<Response> => {
      const path = routePath(input);
      calls.push(path);

      const route = routes.find((candidate) => candidate.path === path);
      if (!route) {
        throw new Error(`Unexpected registry UI fetch: ${path}`);
      }

      if (route.error) {
        throw route.error;
      }

      const body = route.body === undefined ? null : JSON.stringify(route.body);
      return new Response(body, {
        status: route.status ?? 200,
        headers: body === null ? undefined : { 'Content-Type': 'application/json' },
      });
    },
  );

  vi.stubGlobal('fetch', fetchMock);

  return { calls, fetchMock };
}

type MessageHandler = ((event: MessageEvent<string>) => void) | null;
type ErrorHandler = ((event: Event) => void) | null;

export class MockRegistryEventSource extends EventTarget {
  static instances: MockRegistryEventSource[] = [];

  private messageHandler: MessageHandler = null;
  private errorHandler: ErrorHandler = null;

  closed = false;

  constructor(readonly url: string) {
    super();
    MockRegistryEventSource.instances.push(this);
  }

  get onmessage(): MessageHandler {
    return this.messageHandler;
  }

  set onmessage(handler: MessageHandler) {
    if (this.messageHandler) {
      this.removeEventListener('message', this.messageHandler as EventListener);
    }
    this.messageHandler = handler;
    if (handler) {
      this.addEventListener('message', handler as EventListener);
    }
  }

  get onerror(): ErrorHandler {
    return this.errorHandler;
  }

  set onerror(handler: ErrorHandler) {
    if (this.errorHandler) {
      this.removeEventListener('error', this.errorHandler);
    }
    this.errorHandler = handler;
    if (handler) {
      this.addEventListener('error', handler);
    }
  }

  static reset() {
    MockRegistryEventSource.instances = [];
  }

  emitJson(payload: AgentStreamPayload | RegistryTaskEvent) {
    this.dispatchEvent(
      new MessageEvent('message', {
        data: JSON.stringify(payload),
      }),
    );
  }

  emitMalformed(data = '{not-json') {
    this.dispatchEvent(
      new MessageEvent('message', {
        data,
      }),
    );
  }

  fail() {
    this.dispatchEvent(new Event('error'));
  }

  close() {
    this.closed = true;
  }
}

export function installEventSourceMock() {
  MockRegistryEventSource.reset();
  vi.stubGlobal('EventSource', MockRegistryEventSource as unknown as typeof EventSource);
  return MockRegistryEventSource;
}
