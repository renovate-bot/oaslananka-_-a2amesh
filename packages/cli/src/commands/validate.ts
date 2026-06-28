import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Command } from 'commander';
import { normalizeAgentCard } from '@a2amesh/runtime';
import { emitResult, writeError, type RootOptionsProvider } from '../io.js';
import { addNetworkOptions, createA2AClient, type NetworkCommandOptions } from '../network.js';
import { applyCommandDoc, type CliCommandDoc } from './doc-metadata.js';

export const validateCommandDoc = {
  path: ['validate'],
  summary: 'Validate an Agent Card file or endpoint.',
  description:
    'Validates an Agent Card from a local JSON file or by resolving an HTTP endpoint Agent Card.',
  examples: [
    {
      title: 'Validate a local Agent Card file.',
      bash: ['a2amesh validate ./agent-card.json'],
      powershell: ['a2amesh validate .\\agent-card.json'],
    },
    {
      title: 'Validate an endpoint Agent Card with a timeout.',
      bash: ['a2amesh validate http://127.0.0.1:3000 --timeout-ms 1000'],
      powershell: ['a2amesh validate http://127.0.0.1:3000 --timeout-ms 1000'],
    },
  ],
} satisfies CliCommandDoc;

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function createValidateCommand(getOptions: RootOptionsProvider): Command {
  return addNetworkOptions(
    applyCommandDoc(new Command('validate'), validateCommandDoc).argument('<target>'),
  ).action(async (target: string, commandOptions: NetworkCommandOptions) => {
    const options = getOptions();

    try {
      if (isHttpUrl(target)) {
        const client = createA2AClient(target, commandOptions);
        emitResult(normalizeAgentCard(await client.resolveCard()), options);
        return;
      }

      const card = JSON.parse(readFileSync(resolve(target), 'utf8')) as Parameters<
        typeof normalizeAgentCard
      >[0];
      emitResult(normalizeAgentCard(card), options);
    } catch (error) {
      writeError(`Validation failed: ${String(error)}`);
      process.exitCode = 1;
    }
  });
}
