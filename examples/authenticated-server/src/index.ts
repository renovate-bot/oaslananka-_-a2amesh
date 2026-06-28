import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { pathToFileURL } from 'node:url';
import {
  A2AClient,
  A2AServer,
  type AgentCard,
  type Artifact,
  type Message,
  type Task,
} from '@a2amesh/runtime';

const headerName = 'x-a2a-api-key';
const apiKey = process.env['A2A_EXAMPLE_API_KEY'] ?? 'local-dev-key';

class AuthenticatedEchoAgent extends A2AServer {
  constructor() {
    super(createAgentCard('http://127.0.0.1:0'), {
      allowLocalhost: true,
      auth: {
        securitySchemes: [
          {
            id: 'example-api-key',
            type: 'apiKey',
            in: 'header',
            name: headerName,
          },
        ],
        apiKeys: {
          'example-api-key': {
            value: apiKey,
            principalId: 'local-docs-user',
            tenantId: 'docs',
            scopes: ['tasks:write'],
          },
        },
      },
    });
  }

  override async handleTask(_task: Task, message: Message): Promise<Artifact[]> {
    return [
      {
        artifactId: 'authenticated-echo',
        name: 'Authenticated echo',
        parts: [{ type: 'text', text: `authenticated:${readText(message)}` }],
        index: 0,
        lastChunk: true,
      },
    ];
  }
}

export interface AuthenticatedServerResult {
  mode: 'authenticated-server';
  taskId: string;
  state: Task['status']['state'];
  text: string;
}

export async function runExample(): Promise<AuthenticatedServerResult> {
  const agent = new AuthenticatedEchoAgent();
  const server = agent.start(0);

  try {
    const baseUrl = await getServerUrl(server);
    agent.getAgentCard().url = baseUrl;

    const client = new A2AClient(baseUrl, {
      headers: {
        [headerName]: apiKey,
      },
    });
    const task = await client.sendMessage(createUserMessage('local authenticated request'));
    const completed = await waitForTaskState(client, task.id, ['COMPLETED']);

    return {
      mode: 'authenticated-server',
      taskId: completed.id,
      state: completed.status.state,
      text: readTextArtifacts(completed),
    };
  } finally {
    await agent.stop();
  }
}

function createAgentCard(url: string): AgentCard {
  return {
    protocolVersion: '1.0',
    name: 'Authenticated Echo Agent',
    description: 'Local API-key protected echo agent.',
    url,
    version: '1.0.0',
    capabilities: {
      streaming: false,
      pushNotifications: false,
    },
  };
}

function createUserMessage(text: string): Message {
  return {
    role: 'user',
    parts: [{ type: 'text', text }],
    messageId: randomUUID(),
    timestamp: new Date().toISOString(),
  };
}

function readText(message: Message): string {
  return message.parts
    .filter((part) => part.type === 'text')
    .map((part) => (part.type === 'text' ? part.text : ''))
    .join(' ');
}

function readTextArtifacts(task: Task): string {
  return (task.artifacts ?? [])
    .flatMap((artifact) => artifact.parts)
    .filter((part) => part.type === 'text')
    .map((part) => (part.type === 'text' ? part.text : ''))
    .join('\n');
}

async function waitForTaskState(
  client: A2AClient,
  taskId: string,
  states: Task['status']['state'][],
): Promise<Task> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 5000) {
    const task = await client.getTask(taskId);
    if (states.includes(task.status.state)) {
      return task;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  throw new Error(`Timed out waiting for task ${taskId}`);
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
    throw new Error('Unable to resolve local server port');
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
