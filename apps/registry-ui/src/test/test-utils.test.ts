import { afterEach, describe, expect, it, vi } from 'vitest';
import { researcherAgent } from './fixtures';
import { installEventSourceMock, installFetchMock, MockRegistryEventSource } from './test-utils';

describe('registry UI test utilities', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    MockRegistryEventSource.reset();
  });

  it('supports EventSource listener APIs and direct handler properties', () => {
    installEventSourceMock();

    const source = new MockRegistryEventSource('/api/agents/stream');
    const listener = vi.fn((event: Event) => (event as MessageEvent<string>).data);
    const directMessageHandler = vi.fn((event: MessageEvent<string>) => event.data);
    const directErrorHandler = vi.fn();

    source.addEventListener('message', listener);
    source.onmessage = directMessageHandler;
    source.onerror = directErrorHandler;

    source.emitJson(researcherAgent);
    source.fail();

    expect(listener).toHaveReturnedWith(JSON.stringify(researcherAgent));
    expect(directMessageHandler).toHaveReturnedWith(JSON.stringify(researcherAgent));
    expect(directErrorHandler).toHaveBeenCalledTimes(1);

    source.removeEventListener('message', listener);
    source.onmessage = null;
    source.emitMalformed();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(directMessageHandler).toHaveBeenCalledTimes(1);
  });

  it('can reject fetch routes to simulate offline registry failures', async () => {
    installFetchMock([
      { path: '/api/tasks/recent?limit=30', error: new TypeError('network offline') },
    ]);

    await expect(fetch('/api/tasks/recent?limit=30')).rejects.toThrow('network offline');
  });
});
