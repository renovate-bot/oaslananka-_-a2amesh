import { Command } from 'commander';
import { emitResult, withSpinner, type RootOptionsProvider } from '../io.js';
import { addNetworkOptions, createA2AClient, type NetworkCommandOptions } from '../network.js';
import { applyCommandDoc, type CliCommandDoc } from './doc-metadata.js';

export const healthCommandDoc = {
  path: ['health'],
  summary: 'Check an A2A endpoint health route.',
  description: 'Checks an A2A endpoint health route and emits the health response.',
  examples: [
    {
      title: 'Check endpoint health with a short timeout.',
      bash: ['a2amesh health http://127.0.0.1:3000 --timeout-ms 1000 --json'],
      powershell: ['a2amesh health http://127.0.0.1:3000 --timeout-ms 1000 --json'],
    },
  ],
} satisfies CliCommandDoc;

export function createHealthCommand(getOptions: RootOptionsProvider): Command {
  return addNetworkOptions(
    applyCommandDoc(new Command('health'), healthCommandDoc).argument('<url>'),
  ).action(async (url: string, commandOptions: NetworkCommandOptions) => {
    const options = getOptions();
    const client = createA2AClient(url, commandOptions);
    const health = await withSpinner('Checking health', options, () => client.health());
    emitResult(health, options);
  });
}
