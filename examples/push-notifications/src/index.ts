import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type Server as HttpServer } from 'node:http';
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

class PushAgent extends A2AServer {
  constructor() {
    super(createAgentCard('http://127.0.0.1:0'), { allowLocalhost: true });
  }

  override async handleTask(_task: Task, message: Message): Promise<Artifact[]> {
    await new Promise((resolve) => setTimeout(resolve, 30));
    return [
      {
        artifactId: 'push-result',
        name: 'Push result',
        parts: [{ type: 'text', text: `push:${readText(message)}` }],
        index: 0,
        lastChunk: true,
      },
    ];
  }
}

export interface PushNotificationExampleResult {
  mode: 'push-notifications';
  taskId: string;
  deliveredStates: Task['status']['state'][];
}

export async function runExample(): Promise<PushNotificationExampleResult> {
  const receiver = await createWebhookReceiver();
  const agent = new PushAgent();
  const server = agent.start(Number(process.env['PUSH_AGENT_PORT'] ?? '0'));

  try {
    const baseUrl = await getServerUrl(server);
    agent.getAgentCard().url = baseUrl;
    const client = new A2AClient(baseUrl);
    const task = await client.sendMessage({
      message: createUserMessage('notify when complete'),
      configuration: {
        pushNotificationConfig: {
          url: receiver.url,
          token: process.env['PUSH_WEBHOOK_TOKEN'] ?? 'local-webhook-token',
        },
      },
    });

    await waitForDeliveredTask(receiver.receivedPayloads, task.id);

    return {
      mode: 'push-notifications',
      taskId: task.id,
      deliveredStates: receiver.receivedPayloads
        .filter((payload) => payload.id === task.id)
        .map((payload) => payload.status.state),
    };
  } finally {
    await Promise.all([agent.stop(), receiver.close()]);
  }
}

function createAgentCard(url: string): AgentCard {
  return {
    protocolVersion: '1.0',
    name: 'Push Notification Agent',
    description: 'Local agent that posts task snapshots to a webhook.',
    url,
    version: '1.0.0',
    capabilities: {
      streaming: false,
      pushNotifications: true,
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

async function createWebhookReceiver(): Promise<{
  url: string;
  receivedPayloads: Task[];
  close: () => Promise<void>;
}> {
  const receivedPayloads: Task[] = [];
  const server = createServer((req, res) => {
    readRequestBody(req)
      .then((body) => {
        try {
          receivedPayloads.push(JSON.parse(body) as Task);
        } catch {
          // Ignore non-JSON callback payloads in this local receiver.
        }
        res.writeHead(200);
        res.end('ok');
      })
      .catch((error: unknown) => {
        res.writeHead(500);
        res.end(error instanceof Error ? error.message : String(error));
      });
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(Number(process.env['PUSH_WEBHOOK_PORT'] ?? '0'), '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });

  return {
    url: await getServerUrl(server),
    receivedPayloads,
    close: () => closeServer(server),
  };
}

async function readRequestBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function waitForDeliveredTask(payloads: Task[], taskId: string): Promise<void> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 5000) {
    if (payloads.some((payload) => payload.id === taskId && payload.status.state === 'COMPLETED')) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  throw new Error(`Timed out waiting for push notification for task ${taskId}`);
}

async function getServerUrl(server: HttpServer): Promise<string> {
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

async function closeServer(server: HttpServer): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
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
