import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const repoRoot = process.cwd();
const registryUrl = 'http://127.0.0.1:3099';
const demoPort = 41234;
const demoUrl = `http://127.0.0.1:${demoPort}`;
const pnpmCmd = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

const env = {
  ...process.env,
  PORT: String(demoPort),
  REGISTRY_URL: registryUrl,
  ALLOW_LOCALHOST: 'true',
  ALLOW_PRIVATE_NETWORKS: 'true',
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  return res.json();
}

function runPnpm(args) {
  const file = process.platform === 'win32' ? 'cmd.exe' : pnpmCmd;
  const commandArgs = process.platform === 'win32' ? ['/d', '/s', '/c', pnpmCmd, ...args] : args;
  return spawn(file, commandArgs, {
    cwd: repoRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    env,
  });
}

async function waitForHealth(url, label, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const body = await fetchJson(url);
      process.stdout.write(`  ${label} healthy (${JSON.stringify(body)})\n`);
      return;
    } catch {
      await sleep(500);
    }
  }
  throw new Error(`${label} did not become healthy within ${timeoutMs}ms`);
}

async function main() {
  const registry = runPnpm(['--filter', '@a2amesh/registry', 'run', 'start']);
  registry.stderr.on('data', (chunk) => {
    process.stderr.write(chunk);
  });

  process.stdout.write('Starting registry...\n');
  try {
    await waitForHealth(`${registryUrl}/health`, 'Registry');
  } catch (error) {
    registry.kill();
    process.stderr.write(`Registry failed: ${error.message}\n`);
    process.exit(1);
  }

  const demo = runPnpm(['--filter', 'a2amesh-demo', 'run', 'start']);
  demo.stderr.on('data', (chunk) => {
    process.stderr.write(chunk);
  });

  process.stdout.write('Starting demo agent...\n');
  try {
    await waitForHealth(`${demoUrl}/health`, 'Demo Agent');
  } catch (error) {
    registry.kill();
    demo.kill();
    process.stderr.write(`Demo agent failed: ${error.message}\n`);
    process.exit(1);
  }

  try {
    process.stdout.write('Verifying registry agent list...\n');
    const agents = await fetchJson(`${registryUrl}/agents`);
    process.stdout.write(`  Registered agents: ${agents.length}\n`);
  } catch (error) {
    process.stderr.write(`Registry agent list failed: ${error.message}\n`);
  }

  process.stdout.write('Smoke environment is ready.\n');
  process.stdout.write(`  Registry  \u2192 ${registryUrl}\n`);
  process.stdout.write(`  Demo      \u2192 ${demoUrl}\n`);
  process.stdout.write('\nPress Ctrl+C to stop.\n');

  await new Promise(() => {
    process.on('SIGINT', () => {
      process.stdout.write('\nCleaning up...\n');
      registry.kill();
      demo.kill();
      process.exit(0);
    });
  });
}

main().catch((error) => {
  process.stderr.write(`Smoke script failed: ${error.message}\n`);
  process.exit(1);
});
