import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { Command } from 'commander';
import { RegistryExportDocumentSchema } from '@a2amesh/runtime';
import { RegistryServer } from '@a2amesh/registry';
import { emitResult, withSpinner, writeOutput, type RootOptionsProvider } from '../io.js';
import { addNetworkOptions, createRegistryClient, type NetworkCommandOptions } from '../network.js';
import { applyCommandDoc, type CliCommandDoc } from './doc-metadata.js';

export const registryCommandDoc = {
  path: ['registry'],
  summary: 'Start, inspect, export, and import registry state.',
  description:
    'Starts a local registry, lists registered agents, and moves registry state between control planes with versioned JSON export files.',
  examples: [
    {
      title: 'Start and list a local registry.',
      bash: [
        'a2amesh registry start --port 3099',
        'a2amesh registry list --url http://127.0.0.1:3099 --json',
      ],
      powershell: [
        'a2amesh registry start --port 3099',
        'a2amesh registry list --url http://127.0.0.1:3099 --json',
      ],
    },
    {
      title: 'Export and import registry state with control-plane credentials.',
      bash: [
        'a2amesh registry export --url http://127.0.0.1:3099 --output ./registry-export.json --bearer-token "$REGISTRY_TOKEN"',
        'a2amesh registry import --url http://127.0.0.1:3099 --input ./registry-export.json --bearer-token "$REGISTRY_TOKEN"',
      ],
      powershell: [
        'a2amesh registry export --url http://127.0.0.1:3099 --output .\\registry-export.json --bearer-token $env:REGISTRY_TOKEN',
        'a2amesh registry import --url http://127.0.0.1:3099 --input .\\registry-export.json --bearer-token $env:REGISTRY_TOKEN',
      ],
    },
  ],
  additionalMarkdown: [
    '## Export Format',
    '',
    '`registry export` writes a JSON document with:',
    '',
    '- `$schema`: `https://oaslananka.github.io/a2amesh/schemas/registry-export.schema.json`',
    '- `schemaVersion`: currently `1`',
    '- `exportedAt`: ISO timestamp',
    '- `agents`: registered agent records',
    '- `metadata`: source, agent count, tenant ids, and public agent count',
    '',
    'The checked-in JSON Schema is `docs/protocol/schemas/registry-export.schema.json`; the docs site serves the same schema under `/schemas/registry-export.schema.json`.',
    '',
    '## Authentication',
    '',
    'Registries configured with `registrationToken`, `requireAuth`, or JWT auth require control-plane credentials for export and import. Tenant-scoped credentials export records visible to that tenant, including public agents. Imports are idempotent when an incoming record matches an existing agent by `id` or `url`.',
  ].join('\n'),
} satisfies CliCommandDoc;

interface RegistryFileCommandOptions extends NetworkCommandOptions {
  url: string;
  output?: string;
  input?: string;
}

function writeJsonFile(path: string, value: unknown): string {
  const targetPath = resolve(path);
  mkdirSync(dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return targetPath;
}

function readRegistryDocument(path: string): unknown {
  return JSON.parse(readFileSync(resolve(path), 'utf8'));
}

function requireFileOption(value: string | undefined, optionName: '--input' | '--output'): string {
  if (!value) {
    throw new Error(`Missing ${optionName}`);
  }
  return value;
}

function formatSchemaIssues(error: { issues: Array<{ path: PropertyKey[]; message: string }> }) {
  return error.issues
    .map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
    .join('; ');
}

export function createRegistryCommand(getOptions: RootOptionsProvider): Command {
  const registryCommand = applyCommandDoc(new Command('registry'), registryCommandDoc);

  registryCommand
    .command('start')
    .description('Start a local registry server.')
    .option('--port <port>', 'Port to listen on', '3099')
    .action((commandOptions: { port: string }) => {
      const server = new RegistryServer();
      server.start(Number(commandOptions.port));
      writeOutput(`Registry listening on ${commandOptions.port}`);
    });

  registryCommand.addCommand(
    addNetworkOptions(
      new Command('list')
        .description('List agents registered with a registry.')
        .option('--url <url>', 'Registry URL', 'http://localhost:3099'),
    ).action(async (commandOptions: { url: string } & NetworkCommandOptions) => {
      const options = getOptions();
      const client = createRegistryClient(commandOptions.url, commandOptions);
      const agents = await withSpinner('Listing agents', options, () => client.listAgents());
      emitResult(agents, options);
    }),
  );

  registryCommand.addCommand(
    addNetworkOptions(
      new Command('export')
        .description('Export registry agent state to a versioned JSON document.')
        .option('--url <url>', 'Registry URL', 'http://localhost:3099')
        .requiredOption('--output <file>', 'Write the registry export document to a JSON file'),
    ).action(async (commandOptions: RegistryFileCommandOptions) => {
      const options = getOptions();
      const client = createRegistryClient(commandOptions.url, commandOptions);
      const document = await withSpinner('Exporting registry agents', options, () =>
        client.exportAgents(),
      );
      const output = writeJsonFile(requireFileOption(commandOptions.output, '--output'), document);
      emitResult(
        {
          output,
          schemaVersion: document.schemaVersion,
          agentCount: document.agents.length,
        },
        options,
      );
    }),
  );

  registryCommand.addCommand(
    addNetworkOptions(
      new Command('import')
        .description('Import a versioned registry export document.')
        .option('--url <url>', 'Registry URL', 'http://localhost:3099')
        .requiredOption('--input <file>', 'Read a registry export document from a JSON file'),
    ).action(async (commandOptions: RegistryFileCommandOptions) => {
      const parsed = RegistryExportDocumentSchema.safeParse(
        readRegistryDocument(requireFileOption(commandOptions.input, '--input')),
      );
      if (!parsed.success) {
        throw new Error(`Invalid registry import file: ${formatSchemaIssues(parsed.error)}`);
      }

      const options = getOptions();
      const client = createRegistryClient(commandOptions.url, commandOptions);
      const result = await withSpinner('Importing registry agents', options, () =>
        client.importAgents(parsed.data),
      );
      emitResult(result, options);
    }),
  );

  return registryCommand;
}
