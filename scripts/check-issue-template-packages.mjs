import { readText, fail } from './check-utils.mjs';

const expected = [
  '@a2amesh/runtime',
  '@a2amesh/internal-adapter-anthropic',
  '@a2amesh/internal-adapter-base',
  '@a2amesh/internal-adapter-crewai',
  '@a2amesh/internal-adapter-google-adk',
  '@a2amesh/internal-adapter-langchain',
  '@a2amesh/internal-adapter-llamaindex',
  '@a2amesh/internal-adapter-openai',
  '@a2amesh/internal-adapters',
  '@a2amesh/mcp',
  '@a2amesh/cli',
  '@a2amesh/protocol',
  '@a2amesh/registry',
  '@a2amesh/protocol',
  '@a2amesh/internal-transport-grpc',
  '@a2amesh/internal-transport-ws',
  '@a2amesh/create-a2amesh',
  'Other',
];
const text = readText('.github/ISSUE_TEMPLATE/bug_report.yml');
const failures = [];
for (const option of expected) {
  if (!text.includes(`- '${option}'`)) failures.push(`missing issue-template option ${option}`);
}
if (/@a2amesh[a-z]/.test(text) || /@a2a-mesh/i.test(text))
  failures.push('malformed scoped package option found');
if (failures.length > 0) fail('Issue-template package validation failed.', failures);
