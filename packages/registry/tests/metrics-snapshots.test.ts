import request from 'supertest';
import { describe, expect, it } from 'vitest';
import type { AgentCard } from '@a2amesh/runtime';
import { RegistryServer } from '../src/RegistryServer.js';

function createAgentCard(name: string): AgentCard {
  return {
    protocolVersion: '1.0',
    name,
    description: `${name} description`,
    version: '1.0.0',
    url: 'http://localhost:0',
    capabilities: {
      streaming: true,
      pushNotifications: false,
      stateTransitionHistory: true,
      extendedAgentCard: false,
      mcpCompatible: true,
    },
    skills: [
      {
        id: `${name.toLowerCase().replace(/\s+/g, '-')}-skill`,
        name: 'Research',
        description: 'Searches and summarizes information',
        tags: ['research', 'analysis'],
        examples: [],
        inputModes: ['text'],
        outputModes: ['text'],
      },
    ],
    defaultInputModes: ['text'],
    defaultOutputModes: ['text'],
    securitySchemes: [],
  };
}

describe('registry metrics snapshots', () => {
  it('snapshots stable Prometheus counters and gauges', async () => {
    const server = new RegistryServer({ allowLocalhost: true });

    const registerResponse = await request(server.getExpressApp())
      .post('/agents/register')
      .send({
        agentUrl: 'http://localhost:3001',
        agentCard: createAgentCard('Metrics Snapshot Agent'),
        tenantId: 'tenant-metrics',
        isPublic: true,
      });

    expect(registerResponse.status).toBe(201);
    const agentId = registerResponse.body.id as string;

    await request(server.getExpressApp())
      .get('/agents/search')
      .query({ name: 'metrics' })
      .expect(200);
    await request(server.getExpressApp()).post(`/agents/${agentId}/heartbeat`).expect(200);

    const metricsResponse = await request(server.getExpressApp()).get('/metrics');
    const summaryResponse = await request(server.getExpressApp()).get('/metrics/summary');

    expect(metricsResponse.status).toBe(200);
    expect(metricsResponse.text).toMatchSnapshot('registry prometheus metrics');
    expect(summaryResponse.body).toMatchSnapshot('registry metrics summary');
  });
});
