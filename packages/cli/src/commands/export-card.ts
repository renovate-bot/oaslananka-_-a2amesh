import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Command } from 'commander';
import { type AgentCard } from '@a2amesh/runtime';
import { emitResult, withSpinner, type RootOptionsProvider } from '../io.js';
import { addNetworkOptions, createA2AClient, type NetworkCommandOptions } from '../network.js';
import { applyCommandDoc, type CliCommandDoc } from './doc-metadata.js';

export const exportCardCommandDoc = {
  path: ['export-card'],
  summary: 'Export an endpoint Agent Card to JSON.',
  description:
    'Resolves an endpoint Agent Card and writes the normalized card document to a local JSON file.',
  examples: [
    {
      title: 'Export an Agent Card to a file.',
      bash: ['a2amesh export-card http://127.0.0.1:3000 --output ./agent-card.json'],
      powershell: ['a2amesh export-card http://127.0.0.1:3000 --output .\\agent-card.json'],
    },
  ],
} satisfies CliCommandDoc;

interface ExportCardCommandOptions extends NetworkCommandOptions {
  output: string;
}

export function createExportCardCommand(getOptions: RootOptionsProvider): Command {
  return addNetworkOptions(
    applyCommandDoc(new Command('export-card'), exportCardCommandDoc)
      .argument('<url>')
      .option('--output <path>', 'Output path', 'agent-card.json')
      .action(async (url: string, commandOptions: ExportCardCommandOptions) => {
        const options = getOptions();
        const client = createA2AClient(url, commandOptions);
        const card = await withSpinner<AgentCard>('Exporting agent card', options, () =>
          client.resolveCard(),
        );
        writeFileSync(resolve(commandOptions.output), JSON.stringify(card, null, 2));
        emitResult({ output: resolve(commandOptions.output), name: card.name }, options);
      }),
  );
}
