import { readFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, describe, expect, it } from 'vitest';
import { A2AClient } from '../../packages/runtime/src/client/A2AClient.js';
import { A2AServer } from '../../packages/runtime/src/server/A2AServer.js';
import type { AgentCard } from '../../packages/runtime/src/types/agent-card.js';
import {
  ErrorCodes,
  type JsonRpcId,
  type JsonRpcRequest,
} from '../../packages/runtime/src/types/jsonrpc.js';
import type {
  Artifact,
  Message,
  MessageSendParams,
  PushNotificationConfig,
  Task,
} from '../../packages/runtime/src/types/task.js';
import {
  createUserMessage,
  startTestServer,
  type StartedServer,
  waitForTaskState,
} from '../integration/helpers.js';

const fixtureVersions = ['a2a-1.0', 'a2a-1.2'] as const;

type FixtureVersion = (typeof fixtureVersions)[number];

interface MessageRequestFixture {
  jsonrpc: '2.0';
  id?: JsonRpcId;
  method: 'message/send';
  params: MessageSendParams;
}

interface StreamRequestFixture {
  jsonrpc: '2.0';
  id?: JsonRpcId;
  method: 'message/stream';
  params: MessageSendParams;
  expectedTerminalState: Task['status']['state'];
  expectedArtifactText: string;
}

interface TaskResponseFixture {
  status: Pick<Task['status'], 'state'>;
  artifacts: Artifact[];
}

interface PushConfigFixture {
  pushNotificationConfig: PushNotificationConfig;
  expectedToken: string;
}

interface NegativeCaseFixture {
  name: string;
  request: JsonRpcRequest | JsonRpcRequest[];
  expectedError: {
    code: number;
    message?: string;
  };
}

class FixtureAgent extends A2AServer {
  constructor(
    agentCard: AgentCard,
    private readonly responseFixture: TaskResponseFixture,
  ) {
    super(structuredClone(agentCard));
  }

  async handleTask(_task: Task, message: Message): Promise<Artifact[]> {
    const text = message.parts.find((part) => part.type === 'text');

    return this.responseFixture.artifacts.map((artifact) => ({
      ...artifact,
      parts: artifact.parts.map((part) =>
        part.type === 'text'
          ? {
              ...part,
              text: part.text.replace(
                '{messageText}',
                text?.type === 'text' ? text.text : 'missing text',
              ),
            }
          : part,
      ),
    }));
  }
}

function readFixture<T>(version: FixtureVersion, fileName: string): T {
  const fixtureUrl = new URL(`./fixtures/${version}/${fileName}`, import.meta.url);
  return JSON.parse(readFileSync(fixtureUrl, 'utf8')) as T;
}

async function postRawJsonRpc(
  baseUrl: string,
  body: JsonRpcRequest | JsonRpcRequest[],
): Promise<{
  jsonrpc: '2.0';
  error?: { code: number; message: string };
}> {
  const response = await fetch(`${baseUrl}/rpc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  expect(response.status).toBe(200);
  return (await response.json()) as {
    jsonrpc: '2.0';
    error?: { code: number; message: string };
  };
}

async function createWebhookReceiver(): Promise<{
  url: string;
  receivedTaskIds: string[];
  close: () => Promise<void>;
}> {
  const receivedTaskIds: string[] = [];
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    let body = '';
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const task = JSON.parse(body) as Task;
        receivedTaskIds.push(task.id);
      } catch {
        // Non-JSON payloads are ignored; the conformance assertion covers successful deliveries.
      }
      res.writeHead(200);
      res.end('ok');
    });
  });

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as AddressInfo).port;

  return {
    url: `http://localhost:${port}`,
    receivedTaskIds,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      }),
  };
}

async function waitForWebhookReceipt(
  receiver: Awaited<ReturnType<typeof createWebhookReceiver>>,
  taskId: string,
  timeoutMs = 5000,
): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (receiver.receivedTaskIds.includes(taskId)) {
      return;
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Timed out waiting for webhook delivery for task ${taskId}`);
}

describe.each(fixtureVersions)('Agent2Agent conformance fixtures %s', (version) => {
  const handles: StartedServer[] = [];
  const webhookReceivers: Awaited<ReturnType<typeof createWebhookReceiver>>[] = [];

  afterAll(async () => {
    await Promise.all([
      ...handles.map((handle) => handle.close()),
      ...webhookReceivers.map((receiver) => receiver.close()),
    ]);
  });

  async function startFixtureAgent(): Promise<{
    agentCard: AgentCard;
    client: A2AClient;
    handle: StartedServer;
    taskResponse: TaskResponseFixture;
  }> {
    const agentCard = readFixture<AgentCard>(version, 'agent-card.json');
    const taskResponse = readFixture<TaskResponseFixture>(version, 'task-response.json');
    const handle = await startTestServer(new FixtureAgent(agentCard, taskResponse));
    handles.push(handle);

    return {
      agentCard,
      client: new A2AClient(handle.url),
      handle,
      taskResponse,
    };
  }

  it('serves the versioned agent card fixture through discovery', async () => {
    const { agentCard, client } = await startFixtureAgent();

    const resolved = await client.resolveCard();

    expect(resolved.protocolVersion).toBe(agentCard.protocolVersion);
    expect(resolved.name).toBe(agentCard.name);
    expect(resolved.capabilities?.streaming).toBe(true);
    expect(resolved.capabilities?.pushNotifications).toBe(true);
  });

  it('runs the message request fixture through A2AServer and A2AClient', async () => {
    const { client, taskResponse } = await startFixtureAgent();
    const request = readFixture<MessageRequestFixture>(version, 'message-request.json');

    const createdTask = await client.sendMessage(request.params);
    const completedTask = await waitForTaskState(client, createdTask.id, [
      taskResponse.status.state,
    ]);

    expect(completedTask.status.state).toBe(taskResponse.status.state);
    expect(completedTask.artifacts?.map((artifact) => artifact.artifactId)).toEqual(
      taskResponse.artifacts.map((artifact) => artifact.artifactId),
    );
    expect(completedTask.history[0]?.messageId).toBe(request.params.message.messageId);
  });

  it('runs the streaming fixture as canonical JSON-RPC SSE events', async () => {
    const { client } = await startFixtureAgent();
    const request = readFixture<StreamRequestFixture>(version, 'stream-events.json');
    const observedTasks: Task[] = [];

    for await (const event of await client.sendMessageStream(request.params)) {
      const task = event as Task;
      observedTasks.push(task);
      if (task.status.state === request.expectedTerminalState) {
        break;
      }
    }

    expect(observedTasks.length).toBeGreaterThan(0);
    const terminalTask = observedTasks.at(-1);
    expect(terminalTask?.status.state).toBe(request.expectedTerminalState);
    expect(JSON.stringify(terminalTask?.artifacts ?? [])).toContain(request.expectedArtifactText);
  });

  it('runs the push configuration fixture through set/get and webhook delivery', async () => {
    const { client } = await startFixtureAgent();
    const fixture = readFixture<PushConfigFixture>(version, 'push-config.json');
    const receiver = await createWebhookReceiver();
    webhookReceivers.push(receiver);

    const task = await client.sendMessage({
      message: createUserMessage(`push ${version}`),
      configuration: {
        pushNotificationConfig: {
          ...fixture.pushNotificationConfig,
          url: receiver.url,
        },
      },
    });
    const retrieved = await client.getPushNotification(task.id);
    const completedTask = await waitForTaskState(client, task.id, ['COMPLETED']);

    await waitForWebhookReceipt(receiver, task.id);

    expect(retrieved?.url).toBe(receiver.url);
    expect(retrieved?.token).toBe(fixture.expectedToken);
    expect(completedTask.status.state).toBe('COMPLETED');
    expect(receiver.receivedTaskIds).toContain(task.id);
  });

  it('runs negative JSON-RPC cases as fixture-backed protocol errors', async () => {
    const { handle } = await startFixtureAgent();
    const cases = readFixture<NegativeCaseFixture[]>(version, 'negative-cases.json');

    for (const negativeCase of cases) {
      const body = await postRawJsonRpc(handle.url, negativeCase.request);

      expect(body.error?.code, negativeCase.name).toBe(negativeCase.expectedError.code);
      if (negativeCase.expectedError.message) {
        expect(body.error?.message, negativeCase.name).toBe(negativeCase.expectedError.message);
      }
    }
    expect(
      cases.some((testCase) => testCase.expectedError.code === ErrorCodes.InvalidRequest),
    ).toBe(true);
  });
});
