import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createA2AClient,
  createRegistryClient,
  parseNetworkOptions,
  redactNetworkHeaders,
} from '../src/network.js';

describe('shared CLI network options', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('builds A2A client headers from shared auth and request options', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const client = createA2AClient('http://agent.example', {
      header: ['x-client: cli'],
      bearerToken: 'bearer-secret',
      apiKey: ['x-api-key: api-secret'],
      requestId: 'request-1',
      origin: 'https://app.example',
      timeoutMs: '1000',
      retries: '0',
    });

    await expect(client.health()).resolves.toEqual({ status: 'ok' });

    const [, init] = fetchSpy.mock.calls[0] ?? [];
    expect(init?.headers).toMatchObject({
      'x-client': 'cli',
      Authorization: 'Bearer bearer-secret',
      'x-api-key': 'api-secret',
      'x-request-id': 'request-1',
      Origin: 'https://app.example',
    });
  });

  it('builds registry client fetch headers from the same shared options', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));

    const client = createRegistryClient('http://registry.example', {
      header: ['x-client: cli'],
      bearerToken: 'registry-secret',
      requestId: 'request-2',
      origin: 'https://ui.example',
      timeoutMs: '500',
      retries: '0',
    });

    await expect(client.listAgents()).resolves.toEqual([]);

    const [url, init] = fetchSpy.mock.calls[0] ?? [];
    expect(String(url)).toBe('http://registry.example/agents');
    expect(init?.headers).toMatchObject({
      'x-client': 'cli',
      Authorization: 'Bearer registry-secret',
      'x-request-id': 'request-2',
      Origin: 'https://ui.example',
    });
  });

  it('redacts sensitive network headers for JSON-safe diagnostics', () => {
    const { headers } = parseNetworkOptions({
      header: ['x-client: cli'],
      bearerToken: 'bearer-secret',
      apiKey: ['x-api-key: api-secret'],
      requestId: 'request-1',
    });

    const redacted = redactNetworkHeaders(headers);

    expect(redacted).toMatchObject({
      'x-client': 'cli',
      Authorization: '[REDACTED]',
      'x-api-key': '[REDACTED]',
      'x-request-id': 'request-1',
    });
    expect(JSON.stringify(redacted)).not.toContain('bearer-secret');
    expect(JSON.stringify(redacted)).not.toContain('api-secret');
  });

  it('rejects invalid header and API key syntax without echoing secret values', () => {
    expect(() => parseNetworkOptions({ header: ['Authorization bearer-secret'] })).toThrow(
      'Invalid --header syntax. Expected <key:value>.',
    );
    expect(() => parseNetworkOptions({ apiKey: ['x-api-key api-secret'] })).toThrow(
      'Invalid --api-key syntax. Expected <key:value>.',
    );
  });
});
