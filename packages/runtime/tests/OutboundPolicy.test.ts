import { promises as dns } from 'node:dns';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { validateAndFetch, validateUrl } from '../src/net/OutboundPolicy.js';

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('OutboundPolicy', () => {
  it('blocks private IPs by default and allows localhost only when explicit', async () => {
    await expect(validateUrl('http://127.0.0.1:3000/webhook')).rejects.toThrow(
      'SSRF Prevention: Private IP addresses are not allowed',
    );

    const url = await validateUrl('http://127.0.0.1:3000/webhook', { allowLocalhost: true });

    expect(url.toString()).toBe('http://127.0.0.1:3000/webhook');
  });

  it('enforces configured HTTP schemes before DNS resolution', async () => {
    const resolveSpy = vi.spyOn(dns, 'resolve').mockResolvedValue(['93.184.216.34']);

    await expect(validateUrl('http://example.com', { allowedSchemes: ['https'] })).rejects.toThrow(
      'Unsupported URL protocol',
    );

    const url = await validateUrl('https://example.com', { allowedSchemes: ['https'] });

    expect(url.hostname).toBe('example.com');
    expect(resolveSpy).toHaveBeenCalledTimes(1);
  });

  it('caches DNS resolution within the configured TTL', async () => {
    const resolveSpy = vi.spyOn(dns, 'resolve').mockResolvedValue(['93.184.216.34']);

    await validateUrl('https://cached.example/a', { dnsCacheTtlMs: 60_000 });
    await validateUrl('https://cached.example/b', { dnsCacheTtlMs: 60_000 });

    expect(resolveSpy).toHaveBeenCalledTimes(1);
  });

  it('validates URLs before fetching with the shared fetch policy', async () => {
    vi.spyOn(dns, 'resolve').mockResolvedValue(['93.184.216.34']);
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    const response = await validateAndFetch(
      'https://example.com/data',
      {
        headers: {
          Authorization: 'Bearer secret',
        },
      },
      {
        timeoutMs: 250,
        retries: 0,
        telemetryLabels: {
          'a2a.operation': 'test',
        },
      },
    );

    expect(response.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [input, init] = fetchSpy.mock.calls[0] ?? [];
    expect(input?.toString()).toBe('https://example.com/data');
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });
});
