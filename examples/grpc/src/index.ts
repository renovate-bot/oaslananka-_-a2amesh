import { pathToFileURL } from 'node:url';
import {
  A2AServer,
  type AgentCard,
  type Artifact,
  type Message,
  type Task,
} from '@a2amesh/runtime';
import { GrpcClient, GrpcServer } from '@a2amesh/internal-transport-grpc';

class GrpcEchoAgent extends A2AServer {
  constructor() {
    super(createAgentCard('grpc://127.0.0.1:0'), { allowUnresolvedHostnames: true });
  }

  override async handleTask(_task: Task, message: Message): Promise<Artifact[]> {
    return [
      {
        artifactId: 'grpc-result',
        name: 'gRPC result',
        parts: [{ type: 'text', text: `grpc:${readText(message)}` }],
        index: 0,
        lastChunk: true,
      },
    ];
  }
}

export interface GrpcExampleResult {
  mode: 'grpc';
  taskId: string;
  state: Task['status']['state'];
  text: string;
}

export async function runExample(): Promise<GrpcExampleResult> {
  const adapter = new GrpcEchoAgent();
  const server = new GrpcServer(adapter, adapter.getAgentCard());
  const requestedPort = Number(process.env['GRPC_EXAMPLE_PORT'] ?? '0');
  const port = await server.bind(requestedPort);
  const address = `127.0.0.1:${port}`;
  adapter.getAgentCard().url = `grpc://${address}`;
  const client = new GrpcClient(address);

  try {
    const submitted = await client.sendMessage('hello grpc');
    if (!submitted) {
      throw new Error('gRPC example did not create a task');
    }
    const completed = await waitForTaskState(client, submitted.id, 'COMPLETED');

    return {
      mode: 'grpc',
      taskId: completed.id,
      state: completed.status.state,
      text: readTextArtifacts(completed),
    };
  } finally {
    client.close();
    await server.close();
  }
}

function createAgentCard(url: string): AgentCard {
  return {
    protocolVersion: '1.0',
    name: 'gRPC Echo Agent',
    description: 'Local gRPC echo agent.',
    url,
    version: '1.0.0',
    capabilities: {
      streaming: true,
      pushNotifications: false,
    },
    supportedInterfaces: [
      {
        protocolBinding: 'gRPC',
        protocolVersion: '1.0',
        url,
      },
    ],
  };
}

async function waitForTaskState(
  client: GrpcClient,
  taskId: string,
  state: Task['status']['state'],
): Promise<Task> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 5000) {
    const task = await client.getTask(taskId);
    if (task?.status.state === state) {
      return task;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  throw new Error(`Timed out waiting for gRPC task ${taskId}`);
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
