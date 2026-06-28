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

class StreamingAgent extends A2AServer {
  constructor() {
    super(createAgentCard('http://127.0.0.1:0'), { allowLocalhost: true });
  }

  override async handleTask(_task: Task, message: Message): Promise<Artifact[]> {
    await new Promise((resolve) => setTimeout(resolve, 20));
    return [
      {
        artifactId: 'streaming-result',
        name: 'Streaming result',
        parts: [{ type: 'text', text: `streamed:${readText(message)}` }],
        index: 0,
        lastChunk: true,
      },
    ];
  }
}

export interface StreamingExampleResult {
  mode: 'streaming';
  taskId: string;
  states: Task['status']['state'][];
  text: string;
}

export async function runExample(): Promise<StreamingExampleResult> {
  const agent = new StreamingAgent();
  const server = agent.start(Number(process.env['STREAMING_AGENT_PORT'] ?? '0'));

  try {
    const baseUrl = await getServerUrl(server);
    agent.getAgentCard().url = baseUrl;

    const client = new A2AClient(baseUrl);
    const stream = await client.sendMessageStream(createUserMessage('hello stream'));
    const states: Task['status']['state'][] = [];
    let completedTask: Task | undefined;

    for await (const event of stream) {
      if (!isTask(event)) {
        continue;
      }
      states.push(event.status.state);
      if (event.status.state === 'COMPLETED') {
        completedTask = event;
        break;
      }
    }

    if (!completedTask) {
      throw new Error('Streaming example did not receive a completed task');
    }

    return {
      mode: 'streaming',
      taskId: completedTask.id,
      states,
      text: readTextArtifacts(completedTask),
    };
  } finally {
    await agent.stop();
  }
}

function createAgentCard(url: string): AgentCard {
  return {
    protocolVersion: '1.0',
    name: 'Streaming Echo Agent',
    description: 'Local agent that emits task updates over SSE.',
    url,
    version: '1.0.0',
    capabilities: {
      streaming: true,
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

function isTask(value: unknown): value is Task {
  return Boolean(
    value &&
    typeof value === 'object' &&
    'id' in value &&
    'status' in value &&
    typeof (value as { status?: { state?: unknown } }).status?.state === 'string',
  );
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
