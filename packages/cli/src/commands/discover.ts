import { Command } from 'commander';
import { type AgentCard, type AgentSkill } from '@a2amesh/runtime';
import { emitResult, withSpinner, type RootOptionsProvider } from '../io.js';
import { addNetworkOptions, createA2AClient, type NetworkCommandOptions } from '../network.js';
import { applyCommandDoc, type CliCommandDoc } from './doc-metadata.js';

export const discoverCommandDoc = {
  path: ['discover'],
  summary: 'Resolve and print an endpoint Agent Card.',
  description:
    'Discovers an A2A endpoint Agent Card and prints human-readable details or machine-readable JSON.',
  examples: [
    {
      title: 'Discover an Agent Card.',
      bash: ['a2amesh discover http://127.0.0.1:3000'],
      powershell: ['a2amesh discover http://127.0.0.1:3000'],
    },
    {
      title: 'Discover with tenant and request headers.',
      bash: [
        'a2amesh discover http://127.0.0.1:3000 --header "x-tenant:demo" --request-id "req-1"',
      ],
      powershell: [
        'a2amesh discover http://127.0.0.1:3000 --header "x-tenant:demo" --request-id "req-1"',
      ],
    },
  ],
} satisfies CliCommandDoc;

export async function discoverAgent(
  url: string,
  options: { json?: boolean } = {},
  networkOptions: NetworkCommandOptions = {},
): Promise<AgentCard> {
  const client = createA2AClient(url, networkOptions);
  const card = await client.resolveCard();

  if (!options.json) {
    process.stdout.write(`\nDiscovered Agent Card for: ${card.name} v${card.version}\n`);
    process.stdout.write(`URL: ${card.url}\n`);
    process.stdout.write(`Description: ${card.description}\n`);
    process.stdout.write('Skills:\n');
    if (card.skills) {
      card.skills.forEach((skill: AgentSkill) => {
        process.stdout.write(`  - ${skill.name} [${(skill.tags || []).join(', ')}]\n`);
      });
    } else {
      process.stdout.write('  (None)\n');
    }
  }

  return card;
}

export function createDiscoverCommand(getOptions: RootOptionsProvider): Command {
  return addNetworkOptions(
    applyCommandDoc(new Command('discover'), discoverCommandDoc).argument('<url>'),
  ).action(async (url: string, commandOptions: NetworkCommandOptions) => {
    const options = getOptions();
    const card = await withSpinner(`Discovering ${url}`, options, () =>
      discoverAgent(url, options, commandOptions),
    );
    if (options.json) {
      emitResult(card, options);
    }
  });
}
