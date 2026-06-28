#!/usr/bin/env node
import { access, readFile } from 'node:fs/promises';

const requiredFiles = [
  'deploy/helm/a2amesh/Chart.yaml',
  'deploy/helm/a2amesh/values.yaml',
  'ops/grafana/a2amesh-dashboard.json',
  'ops/prometheus/a2amesh-alerts.yml',
  'ops/otel/collector.yaml',
  'docs/operations/deployment.md',
  'docs-site/operations/deployment.md',
];

const errors = [];
const existingFiles = new Set();

for (const file of requiredFiles) {
  try {
    await access(file);
    existingFiles.add(file);
  } catch {
    errors.push(`missing required file: ${file}`);
  }
}

const dashboardPath = 'ops/grafana/a2amesh-dashboard.json';
if (existingFiles.has(dashboardPath)) {
  try {
    JSON.parse(await readFile(dashboardPath, 'utf8'));
  } catch (error) {
    errors.push(
      `invalid dashboard json: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log('Ops pack check passed.');
