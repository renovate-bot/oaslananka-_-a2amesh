import { mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import prettier from 'prettier';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const checkOnly = process.argv.includes('--check');
const schemaDirectories = [
  'docs/protocol/schemas',
  'docs-site/public/schemas',
  'packages/protocol/schemas',
];
const coreRequire = createRequire(resolve(repoRoot, 'packages/runtime/package.json'));
const { z } = coreRequire('zod');
const prettierOptions = (await prettier.resolveConfig(resolve(repoRoot, 'package.json'))) ?? {};
const publicSchemasModule = await import(
  pathToFileURL(resolve(repoRoot, 'packages/runtime/dist/schemas/public.js')).href
);

const definitions = publicSchemasModule.publicJsonSchemaDefinitions;
if (!Array.isArray(definitions) || definitions.length === 0) {
  throw new Error('packages/runtime/src/schemas/public.ts must export publicJsonSchemaDefinitions');
}

const expectedByName = new Map();
for (const definition of definitions) {
  expectedByName.set(definition.fileName, await serializeDefinition(definition));
}
const failures = [];

for (const directory of schemaDirectories) {
  const absoluteDirectory = resolve(repoRoot, directory);
  if (!checkOnly) {
    mkdirSync(absoluteDirectory, { recursive: true });
  }
  const existing = new Set(readSchemaFileNames(absoluteDirectory));

  for (const [fileName, content] of expectedByName) {
    const absolutePath = resolve(absoluteDirectory, fileName);
    if (checkOnly) {
      if (!existing.has(fileName)) {
        failures.push(`${directory}/${fileName}: missing generated schema`);
        continue;
      }
      const current = readFileSync(absolutePath, 'utf8');
      if (current !== content) {
        failures.push(`${directory}/${fileName}: schema drift detected`);
      }
    } else {
      writeFileSync(absolutePath, content);
    }
  }

  for (const fileName of existing) {
    if (expectedByName.has(fileName)) {
      continue;
    }
    const extraPath = resolve(absoluteDirectory, fileName);
    if (checkOnly) {
      failures.push(`${directory}/${fileName}: stale generated schema`);
    } else {
      unlinkSync(extraPath);
    }
  }
}

if (failures.length > 0) {
  console.error('Generated JSON Schema files are out of date.');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  console.error('Run `pnpm run schemas:generate` and commit the updated schema files.');
  process.exit(1);
}

async function serializeDefinition(definition) {
  const schema = z.toJSONSchema(definition.schema, {
    target: 'draft-2020-12',
    unrepresentable: 'throw',
    cycles: 'throw',
    reused: 'inline',
  });
  const enriched = {
    ...schema,
    $id: definition.id,
    title: definition.title,
    description: definition.description,
    'x-a2a-source': definition.source,
  };
  return prettier.format(JSON.stringify(sortJson(enriched)), {
    ...prettierOptions,
    filepath: definition.fileName,
    parser: 'json',
  });
}

function readSchemaFileNames(directory) {
  try {
    return readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.schema.json'))
      .map((entry) => basename(entry.name))
      .sort();
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

function sortJson(value) {
  if (Array.isArray(value)) {
    return value.map(sortJson);
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entryValue]) => [key, sortJson(entryValue)]),
  );
}
