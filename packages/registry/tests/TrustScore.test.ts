import { describe, expect, it } from 'vitest';

import { computeRegistryTrustScore } from '../src/TrustScore.js';
import type { RegisteredAgent } from '../src/storage/IAgentStorage.js';

function agent(overrides: Partial<RegisteredAgent> = {}): RegisteredAgent {
  return {
    id: 'agent-1',
    url: 'https://agent.example.test',
    status: 'healthy',
    tags: [],
    skills: ['summarize'],
    registeredAt: new Date(0).toISOString(),
    card: {
      protocolVersion: '1.0',
      name: 'Agent',
      description: 'Useful agent',
      url: 'https://agent.example.test',
      version: '1.0.0',
      skills: [
        {
          id: 'summarize',
          name: 'Summarize',
          description: 'Summarizes text',
          inputModes: ['text'],
          outputModes: ['text'],
        },
      ],
    },
    ...overrides,
  };
}

describe('computeRegistryTrustScore', () => {
  it('assigns high trust badges for healthy conformant agents', () => {
    const result = computeRegistryTrustScore(agent(), {
      conformanceProfile: 'official-a2a-v1.0',
      uptimePercent: 99.9,
      p95LatencyMs: 250,
      errorRatePercent: 0.1,
    });

    expect(result.level).toBe('platinum');
    expect(result.score).toBeGreaterThanOrEqual(90);
    expect(result.badges).toContain('conformance:official-a2a-v1.0');
    expect(result.badges).toContain('health:healthy');
  });

  it('keeps unknown agents below gold without conformance signals', () => {
    const result = computeRegistryTrustScore(agent({ status: 'unknown' }));

    expect(result.score).toBeLessThan(75);
    expect(result.badges[0]).toMatch(/^trust:/);
    expect(result.factors.map((item) => item.id)).toContain('conformance');
  });

  it('surfaces weak registry and card signals', () => {
    const result = computeRegistryTrustScore(
      agent({
        status: 'unhealthy',
        card: {
          protocolVersion: '0.9',
          name: 'Agent',
          description: 'Useful agent',
          url: 'https://agent.example.test',
          version: '1.0.0',
          skills: [],
        } as unknown as RegisteredAgent['card'],
      }),
      { uptimePercent: 99.5 },
    );

    expect(result.factors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'health', status: 'fail' }),
        expect.objectContaining({ id: 'protocol', status: 'warn' }),
        expect.objectContaining({ id: 'skills', status: 'warn' }),
        expect.objectContaining({ id: 'operations', status: 'warn' }),
      ]),
    );
  });

  it('reports missing protocol and ops signals separately', () => {
    const base = agent();
    const cardWithoutProtocol = { ...base.card } as Record<string, unknown>;
    delete cardWithoutProtocol['protocolVersion'];
    const result = computeRegistryTrustScore({
      ...base,
      card: {
        ...cardWithoutProtocol,
        skills: [
          {
            id: 'summarize',
            name: 'Summarize',
          },
        ],
      } as unknown as RegisteredAgent['card'],
    });

    expect(result.factors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'protocol', status: 'fail' }),
        expect.objectContaining({ id: 'skills', status: 'warn' }),
        expect.objectContaining({ id: 'operations', status: 'warn' }),
      ]),
    );
  });

  it('does not crash on malformed skill entries', () => {
    const base = agent();
    const result = computeRegistryTrustScore({
      ...base,
      card: {
        ...base.card,
        skills: [undefined as never],
      },
    });

    expect(result.factors).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'skills', status: 'warn' })]),
    );
  });

  it('adds evidence badges for signed and cataloged agents', () => {
    const result = computeRegistryTrustScore(agent(), {
      signatureVerified: true,
      sbomPublished: true,
    });

    expect(result.badges).toContain('signature:verified');
    expect(result.badges).toContain('sbom:published');
  });
});
