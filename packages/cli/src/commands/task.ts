import { Command } from 'commander';
import { emitResult, withSpinner, type RootOptionsProvider } from '../io.js';
import { createCliMessage } from '../message.js';
import { addNetworkOptions, createA2AClient, type NetworkCommandOptions } from '../network.js';
import { applyCommandDoc, type CliCommandDoc } from './doc-metadata.js';
import { createSendCommand } from './send.js';
import type { A2AClient } from '@a2amesh/runtime';

export const taskCommandDoc = {
  path: ['task'],
  summary: 'Run task lifecycle operations.',
  description:
    'Runs task lifecycle operations including send, stream, status lookup, and cancellation against an A2A endpoint.',
  examples: [
    {
      title: 'Send a task message through the task command group.',
      bash: ['a2amesh task send http://127.0.0.1:3000 "hello"'],
      powershell: ['a2amesh task send http://127.0.0.1:3000 "hello"'],
    },
    {
      title: 'Stream a task response and inspect task status.',
      bash: [
        'a2amesh task stream http://127.0.0.1:3000 "hello"',
        'a2amesh task status http://127.0.0.1:3000 task-123',
      ],
      powershell: [
        'a2amesh task stream http://127.0.0.1:3000 "hello"',
        'a2amesh task status http://127.0.0.1:3000 task-123',
      ],
    },
  ],
} satisfies CliCommandDoc;

type TaskAction = (client: A2AClient, arg: string) => Promise<unknown>;
type TaskActionMeta = {
  name: string;
  description: string;
  spinnerLabel: string;
  action: TaskAction;
};

const createTaskSubcommand = (getOptions: RootOptionsProvider, meta: TaskActionMeta): Command => {
  return addNetworkOptions(
    new Command(meta.name)
      .description(meta.description)
      .argument('<url>')
      .argument(`<${meta.name === 'stream' ? 'message' : 'taskId'}>`),
  ).action(async (url: string, arg: string, commandOptions: NetworkCommandOptions) => {
    const options = getOptions();
    const client = createA2AClient(url, commandOptions);
    if (meta.name === 'stream') {
      const stream = await client.sendMessageStream(createCliMessage(arg));
      for await (const event of stream) {
        emitResult(event, options);
      }
    } else {
      const result = await withSpinner(meta.spinnerLabel, options, () => meta.action(client, arg));
      emitResult(result, options);
    }
  });
};

export function createTaskCommand(getOptions: RootOptionsProvider): Command {
  const taskCommand = applyCommandDoc(new Command('task'), taskCommandDoc);

  taskCommand.addCommand(createSendCommand(getOptions));

  taskCommand.addCommand(
    createTaskSubcommand(getOptions, {
      name: 'stream',
      description: 'Stream events for a sent task message.',
      spinnerLabel: '',
      action: (_client, _arg) => Promise.resolve(null),
    }),
  );

  taskCommand.addCommand(
    createTaskSubcommand(getOptions, {
      name: 'status',
      description: 'Fetch status for an existing task.',
      spinnerLabel: 'Fetching task status',
      action: (client, taskId) => client.getTask(taskId),
    }),
  );

  taskCommand.addCommand(
    createTaskSubcommand(getOptions, {
      name: 'cancel',
      description: 'Cancel an existing task.',
      spinnerLabel: 'Canceling task',
      action: (client, taskId) => client.cancelTask(taskId),
    }),
  );

  return taskCommand;
}
