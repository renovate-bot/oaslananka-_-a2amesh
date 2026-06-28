import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { pathToFileURL } from 'node:url';
import { AgentRegistryClient, type AgentCard } from '@a2amesh/runtime';
import { RegistryServer } from '@a2amesh/registry';

const token = process.env['REGISTRY_TENANCY_TOKEN'] ?? 'local-registry-token';

export interface RegistryTenancyExampleResult {
  mode: 'registry-tenancy';
  alphaVisible: string[];
  betaVisible: string[];
}

export async function runExample(): Promise<RegistryTenancyExampleResult> {
  const registry = new RegistryServer({
    allowLocalhost: true,
    registrationToken: token,
    healthPollingIntervalMs: 60_000,
    taskPollingIntervalMs: 60_000,
  });
  const server = registry.start(Number(process.env['REGISTRY_TENANCY_PORT'] ?? '0'));

  try {
    const registryUrl = await getServerUrl(server);
    const alphaClient = createTenantClient(registryUrl, 'alpha');
    const betaClient = createTenantClient(registryUrl, 'beta');

    await alphaClient.register(
      'http://127.0.0.1:4010',
      createAgentCard('Alpha Agent', 'http://127.0.0.1:4010'),
    );
    await betaClient.register(
      'http://127.0.0.1:4020',
      createAgentCard('Beta Agent', 'http://127.0.0.1:4020'),
    );

    return {
      mode: 'registry-tenancy',
      alphaVisible: (await alphaClient.listAgents()).map((agent) => agent.card.name),
      betaVisible: (await betaClient.listAgents()).map((agent) => agent.card.name),
    };
  } finally {
    await registry.stop();
  }
}

function createTenantClient(baseUrl: string, tenantId: string): AgentRegistryClient {
  return new AgentRegistryClient(baseUrl, async (input, init = {}) => {
    const headers = new Headers(init.headers ?? {});
    headers.set('authorization', `Bearer ${token}`);
    headers.set('x-tenant-id', tenantId);
    return fetch(input, { ...init, headers });
  });
}

function createAgentCard(name: string, url: string): AgentCard {
  return {
    protocolVersion: '1.0',
    name,
    description: `${name} for local registry tenancy checks.`,
    url,
    version: '1.0.0',
    capabilities: {
      streaming: false,
      pushNotifications: false,
    },
    skills: [
      {
        id: `${name.toLowerCase().replace(/\s+/gu, '-')}-skill`,
        name: `${name} skill`,
        description: 'Local registry smoke skill.',
        tags: ['registry', 'tenant'],
      },
    ],
  };
}

async function getServerUrl(server: Server): Promise<string> {
  if (!server.listening) {
    await new Promise<void>((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });
  }
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Unable to resolve local registry port');
  }
  return `http://127.0.0.1:${(address as AddressInfo).port}`;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  runExample()
    .then((result) => {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    });
}
