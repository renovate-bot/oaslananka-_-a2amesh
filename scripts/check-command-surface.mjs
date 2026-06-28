import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { readJson, readText, fail } from './check-utils.mjs';

const indexSource = readText('packages/cli/src/index.ts');
const commandSource = readdirSync('packages/cli/src/commands')
  .filter((file) => file.endsWith('.ts'))
  .map((file) => readText(join('packages/cli/src/commands', file)))
  .join('\n');
const source = `${indexSource}\n${commandSource}`;
const generatedVersion = readText('packages/cli/src/generated/version.ts');
const generatedScaffoldTemplate = readText('packages/cli/src/generated/scaffold-template.ts');
const cliPackage = readJson('packages/cli/package.json');
const runtimeVersions = readJson('tools/runtime-versions.json');
const protocolPackage = readJson('packages/protocol/package.json');
const runtimePackage = readJson('packages/runtime/package.json');
const rootPackage = readJson('package.json');
const demoPackage = readJson('apps/demo/package.json');
const required = [
  'discover',
  'init',
  'task',
  'send',
  'registry',
  'health',
  'validate',
  'monitor',
  'benchmark',
  'conformance',
  'doctor',
  'export-card',
];
const semverLiteral = String.raw`\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?`;
const quotedSemverLiteral = String.raw`["']${semverLiteral}["']`;
const failures = [];
if (!indexSource.includes(".name('a2amesh')")) failures.push('CLI program name must be a2amesh');
for (const command of required) {
  if (!source.includes(`.command('${command}')`) && !source.includes(`new Command('${command}')`)) {
    failures.push(`missing CLI command ${command}`);
  }
}
if (!indexSource.includes('.version(CLI_VERSION)'))
  failures.push('CLI version must use CLI_VERSION');
if (!source.includes('version: CLI_VERSION')) failures.push('doctor version must use CLI_VERSION');
if (
  new RegExp(String.raw`\.version\(${quotedSemverLiteral}\)`).test(indexSource) ||
  new RegExp(String.raw`version:\s*${quotedSemverLiteral}`).test(indexSource)
) {
  failures.push('CLI version must not be hard-coded in packages/cli/src/index.ts');
}
if (!generatedVersion.includes(`generatedCliVersion = '${cliPackage.version}'`)) {
  failures.push('generated CLI version must match packages/cli/package.json');
}
const requiredScaffoldTemplateSnippets = [
  `'@a2amesh/protocol': '^${protocolPackage.version}'`,
  `'@a2amesh/runtime': '^${runtimePackage.version}'`,
  `'@types/node': '${rootPackage.devDependencies?.['@types/node']}'`,
  `tsx: '${demoPackage.devDependencies?.tsx}'`,
  `typescript: '${rootPackage.devDependencies?.typescript}'`,
  `node: '${runtimeVersions.node}'`,
  runtimeVersions.nodeDockerAlpineDigest,
  `pnpm: '${runtimeVersions.pnpm}'`,
];
for (const snippet of requiredScaffoldTemplateSnippets) {
  if (!generatedScaffoldTemplate.includes(snippet)) {
    failures.push('generated scaffold template config must match workspace manifests');
    break;
  }
}
if (failures.length > 0) fail('CLI command surface validation failed.', failures);
