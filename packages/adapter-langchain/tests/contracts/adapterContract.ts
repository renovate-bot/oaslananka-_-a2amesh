import { request as httpRequest } from 'node:http';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { describe, expect, it } from 'vitest';
import type {
  AnyAgentCard,
  Artifact,
  ExtensibleArtifact,
  Message,
  Task,
  TaskState,
} from '@a2amesh/runtime';
import type { BaseAdapter } from '@a2amesh/internal-adapter-base';

type MaybePromise<T> = T | Promise<T>;

interface AdapterContractInstance<TAdapter extends BaseAdapter, TContext = unknown> {
  adapter: TAdapter;
  context: TContext;
}

interface ProviderErrorCase<TAdapter extends BaseAdapter, TContext> {
  instance: AdapterContractInstance<TAdapter, TContext>;
  expectedError: string | RegExp;
}

interface StreamingContractCase<TAdapter extends BaseAdapter, TContext> {
  createInstance(card: AnyAgentCard): AdapterContractInstance<TAdapter, TContext>;
  expectedText: string;
  assertProviderRequest?: (
    instance: AdapterContractInstance<TAdapter, TContext>,
  ) => MaybePromise<void>;
}

interface AuthPropagationContractCase<TAdapter extends BaseAdapter, TContext> {
  createInstance(card: AnyAgentCard): AdapterContractInstance<TAdapter, TContext>;
  assertAuthPropagation(instance: AdapterContractInstance<TAdapter, TContext>): MaybePromise<void>;
}

export interface AdapterContractSpec<TAdapter extends BaseAdapter, TContext = unknown> {
  adapterName: string;
  provider: string;
  compatibility: 'stable' | 'beta';
  supportsStreaming: boolean;
  expectedText: string;
  createInstance(card: AnyAgentCard): AdapterContractInstance<TAdapter, TContext>;
  createProviderErrorCase(card: AnyAgentCard): ProviderErrorCase<TAdapter, TContext>;
  assertProviderRequest?: (
    instance: AdapterContractInstance<TAdapter, TContext>,
  ) => MaybePromise<void>;
  streamingCase?: StreamingContractCase<TAdapter, TContext>;
  authPropagationCase?: AuthPropagationContractCase<TAdapter, TContext>;
}

export function runAdapterContract<TAdapter extends BaseAdapter, TContext = unknown>(
  spec: AdapterContractSpec<TAdapter, TContext>,
): void {
  describe(`${spec.adapterName} adapter contract`, () => {
    it(`${spec.adapterName}: normalizes legacy agent cards`, () => {
      const instance = spec.createInstance(createLegacyCard(spec.adapterName));

      expect(instance.adapter.getAgentCard()).toEqual(
        expect.objectContaining({
          protocolVersion: '1.0',
          name: `${spec.adapterName} Legacy`,
          defaultInputModes: ['text'],
          defaultOutputModes: ['text'],
          securitySchemes: [
            {
              type: 'apiKey',
              id: 'contract-api-key',
              in: 'header',
              name: 'x-contract-api-key',
            },
          ],
        }),
      );
    });

    it(`${spec.adapterName}: extracts text messages and creates contract artifacts`, async () => {
      const instance = spec.createInstance(createCard(spec.adapterName));
      const task = createTask();

      const artifacts = await instance.adapter.handleTask(task, createTextMessage());

      expectTextArtifact(spec, artifacts, task, spec.expectedText);
      await spec.assertProviderRequest?.(instance);
    });

    it(`${spec.adapterName}: rejects messages without text parts`, async () => {
      const instance = spec.createInstance(createCard(spec.adapterName));

      await expect(
        instance.adapter.handleTask(createTask(), createDataOnlyMessage()),
      ).rejects.toThrow(/adapter requires text input/);
    });

    it(`${spec.adapterName}: maps provider errors to rejected tasks`, async () => {
      const providerErrorCase = spec.createProviderErrorCase(createCard(spec.adapterName));

      await expect(
        providerErrorCase.instance.adapter.handleTask(createTask(), createTextMessage()),
      ).rejects.toThrow(providerErrorCase.expectedError);
    });

    it(`${spec.adapterName}: completes task state and stores artifacts through A2A lifecycle`, async () => {
      const instance = spec.createInstance(createCard(spec.adapterName));
      const server = instance.adapter.start(0);

      try {
        const submitted = await postJsonRpc<Task>(server, {
          jsonrpc: '2.0',
          id: `${spec.provider}-contract-send`,
          method: 'message/send',
          params: {
            contextId: 'contract-context',
            message: createTextMessage(),
          },
        });

        expect(['SUBMITTED', 'WORKING', 'COMPLETED']).toContain(submitted.status.state);

        const completed =
          submitted.status.state === 'COMPLETED'
            ? submitted
            : await waitForTaskState(instance.adapter, submitted.id, 'COMPLETED');
        expect(completed.artifacts).toHaveLength(1);
        expectTextArtifact(spec, completed.artifacts ?? [], completed, spec.expectedText);
      } finally {
        await instance.adapter.stop();
      }
    });

    const streamingCase = spec.streamingCase;
    if (streamingCase) {
      it(`${spec.adapterName}: maps supported streaming responses into streamed artifacts`, async () => {
        const instance = streamingCase.createInstance(createCard(spec.adapterName));
        const task = createTask({ metadata: { stream: true } });

        const artifacts = await instance.adapter.handleTask(task, createTextMessage());

        expectTextArtifact(spec, artifacts, task, streamingCase.expectedText, {
          supportsStreaming: true,
          streamed: true,
        });
        await streamingCase.assertProviderRequest?.(instance);
      });
    }

    const authPropagationCase = spec.authPropagationCase;
    if (authPropagationCase) {
      it(`${spec.adapterName}: propagates configured auth options`, async () => {
        const instance = authPropagationCase.createInstance(createCard(spec.adapterName));

        await instance.adapter.handleTask(createTask(), createTextMessage());

        await authPropagationCase.assertAuthPropagation(instance);
      });
    }
  });
}

function createCard(adapterName: string): AnyAgentCard {
  return {
    protocolVersion: '1.0',
    name: `${adapterName} Contract`,
    description: `${adapterName} contract card`,
    url: 'https://example.com/agent',
    version: '1.0.0',
    capabilities: {
      streaming: true,
      pushNotifications: false,
      stateTransitionHistory: true,
      extendedAgentCard: true,
    },
    defaultInputModes: ['text'],
    defaultOutputModes: ['text'],
  };
}

function createLegacyCard(adapterName: string): AnyAgentCard {
  return {
    protocolVersion: '0.3',
    name: `${adapterName} Legacy`,
    description: `${adapterName} legacy contract card`,
    url: 'https://example.com/legacy-agent',
    version: '0.3.0',
    defaultInputMode: 'text',
    defaultOutputMode: 'text',
    authentication: [
      {
        type: 'apiKey',
        id: 'contract-api-key',
        in: 'header',
        name: 'x-contract-api-key',
      },
    ],
    supportsAuthenticatedExtendedCard: true,
  };
}

function createTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'contract-task',
    contextId: 'contract-context',
    status: { state: 'WORKING', timestamp: '2026-01-01T00:00:00.000Z' },
    history: [
      {
        role: 'user',
        parts: [{ type: 'text', text: 'previous user' }],
        messageId: 'contract-history-user',
        timestamp: '2026-01-01T00:00:00.000Z',
      },
      {
        role: 'agent',
        parts: [{ type: 'text', text: 'previous agent' }],
        messageId: 'contract-history-agent',
        timestamp: '2026-01-01T00:00:01.000Z',
      },
    ],
    ...overrides,
  };
}

function createTextMessage(): Message {
  return {
    role: 'user',
    parts: [
      { type: 'text', text: 'contract current' },
      { type: 'data', data: { ignored: true } },
    ],
    messageId: 'contract-current',
    timestamp: '2026-01-01T00:00:02.000Z',
  };
}

function createDataOnlyMessage(): Message {
  return {
    role: 'user',
    parts: [{ type: 'data', data: { unsupported: true } }],
    messageId: 'contract-data-only',
    timestamp: '2026-01-01T00:00:03.000Z',
  };
}

function expectTextArtifact<TAdapter extends BaseAdapter, TContext>(
  spec: AdapterContractSpec<TAdapter, TContext>,
  artifacts: Artifact[] | readonly Artifact[],
  task: Task,
  expectedText: string,
  options: { supportsStreaming?: boolean; streamed?: boolean } = {},
): void {
  expect(artifacts, `${spec.adapterName} should return one artifact`).toHaveLength(1);
  const artifact = artifacts[0];
  expect(artifact, `${spec.adapterName} artifact should be present`).toBeDefined();
  if (!artifact) {
    return;
  }

  expect(artifact.parts[0]).toEqual({ type: 'text', text: expectedText });
  expect(artifact.index).toBe(0);
  expect(artifact.lastChunk).toBe(true);

  const metadata = (artifact as ExtensibleArtifact).metadata ?? {};
  const contract = metadata['contract'] as Record<string, unknown> | undefined;

  expect(metadata).toEqual(
    expect.objectContaining({
      provider: spec.provider,
      taskId: task.id,
      contextId: task.contextId,
    }),
  );
  expect(contract).toEqual(
    expect.objectContaining({
      provider: spec.provider,
      compatibility: spec.compatibility,
      supportsStreaming: options.supportsStreaming ?? spec.supportsStreaming,
      supportsCancellation: false,
      outputType: 'text',
      ...(options.streamed === undefined ? {} : { streamed: options.streamed }),
    }),
  );
}

async function postJsonRpc<TResult>(
  server: Server,
  body: Record<string, unknown>,
): Promise<TResult> {
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Expected an HTTP server with a numeric port');
  }

  const responseBody = await new Promise<string>((resolve, reject) => {
    const req = httpRequest(
      {
        hostname: '127.0.0.1',
        port: (address as AddressInfo).port,
        path: '/',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      },
      (res) => {
        let chunks = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          chunks += chunk;
        });
        res.on('end', () => resolve(chunks));
      },
    );
    req.on('error', reject);
    req.write(JSON.stringify(body));
    req.end();
  });

  const parsed = JSON.parse(responseBody) as { result?: TResult; error?: { message: string } };
  if (parsed.error) {
    throw new Error(parsed.error.message);
  }
  return parsed.result as TResult;
}

async function waitForTaskState<TAdapter extends BaseAdapter>(
  adapter: TAdapter,
  taskId: string,
  expectedState: TaskState,
): Promise<Task> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const task = adapter.getTaskManager().getTask(taskId);
    if (task?.status.state === expectedState) {
      return task;
    }
    if (task && ['COMPLETED', 'FAILED', 'CANCELED'].includes(task.status.state)) {
      throw new Error(`Task ${taskId} reached ${task.status.state}, expected ${expectedState}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  const current = adapter.getTaskManager().getTask(taskId);
  throw new Error(
    `Task ${taskId} did not reach ${expectedState}; current state is ${
      current?.status.state ?? 'missing'
    }`,
  );
}
