import { Command } from 'commander';
import { emitResult, withSpinner, type CliOptions, type RootOptionsProvider } from '../io.js';
import { createCliMessage } from '../message.js';
import { addNetworkOptions, createA2AClient, type NetworkCommandOptions } from '../network.js';
import { applyCommandDoc, type CliCommandDoc } from './doc-metadata.js';

export const sendCommandDoc = {
  path: ['send'],
  summary: 'Send a text message to an A2A endpoint.',
  description: 'Sends a text message to an A2A endpoint and emits the resulting task response.',
  examples: [
    {
      title: 'Send a text message.',
      bash: ['a2amesh send http://127.0.0.1:3000 "hello"'],
      powershell: ['a2amesh send http://127.0.0.1:3000 "hello"'],
    },
    {
      title: 'Send with bearer authentication.',
      bash: ['a2amesh send http://127.0.0.1:3000 "hello" --bearer-token "$A2A_TOKEN"'],
      powershell: ['a2amesh send http://127.0.0.1:3000 "hello" --bearer-token $env:A2A_TOKEN'],
    },
  ],
} satisfies CliCommandDoc;

async function sendMessageToAgent(
  url: string,
  message: string,
  options: CliOptions,
  networkOptions: NetworkCommandOptions,
): Promise<void> {
  const client = createA2AClient(url, networkOptions);
  const result = await withSpinner('Sending task', options, () =>
    client.sendMessage(createCliMessage(message)),
  );
  emitResult(result, options);
}

export function createSendCommand(getOptions: RootOptionsProvider): Command {
  return addNetworkOptions(
    applyCommandDoc(new Command('send'), sendCommandDoc)
      .argument('<url>')
      .argument('<message>')
      .action(async (url: string, message: string, commandOptions: NetworkCommandOptions) => {
        await sendMessageToAgent(url, message, getOptions(), commandOptions);
      }),
  );
}
