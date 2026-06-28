import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { BaseAdapter } from '@a2amesh/internal-adapters';
import type { AnyAgentCard, Artifact, Message, Task } from '@a2amesh/runtime';

class LocalAdapter extends BaseAdapter {
  constructor() {
    super(createAgentCard());
  }

  override async handleTask(_task: Task, message: Message): Promise<Artifact[]> {
    const response = process.env['ADAPTER_TEMPLATE_RESPONSE'] ?? 'adapter template response';
    return [
      {
        artifactId: 'adapter-template-result',
        name: 'Adapter template result',
        parts: [{ type: 'text', text: `${response}:${readText(message)}` }],
        index: 0,
        lastChunk: true,
      },
    ];
  }
}

export interface AdapterTemplateExampleResult {
  mode: 'adapter-template';
  agentName: string;
  text: string;
}

export async function runExample(): Promise<AdapterTemplateExampleResult> {
  const adapter = new LocalAdapter();
  const task: Task = {
    id: 'adapter-template-task',
    status: { state: 'WORKING', timestamp: new Date().toISOString() },
    history: [],
  };
  const artifacts = await adapter.handleTask(task, createUserMessage('hello adapter'));
  const firstArtifact = artifacts[0];
  if (!firstArtifact) {
    throw new Error('Adapter template example did not return an artifact');
  }

  return {
    mode: 'adapter-template',
    agentName: adapter.getAgentCard().name,
    text: firstArtifact.parts
      .filter((part) => part.type === 'text')
      .map((part) => (part.type === 'text' ? part.text : ''))
      .join('\n'),
  };
}

function createAgentCard(): AnyAgentCard {
  return {
    protocolVersion: '1.0',
    name: 'Local Adapter Template',
    description: 'Local custom adapter example.',
    url: 'http://127.0.0.1:0',
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
