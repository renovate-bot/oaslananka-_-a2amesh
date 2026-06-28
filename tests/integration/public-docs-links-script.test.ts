import { execFile } from 'node:child_process';
import { createServer, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const scriptPath = fileURLToPath(
  new URL('../../scripts/check-public-docs-links.mjs', import.meta.url),
);
const servers: Server[] = [];

describe('public docs link check', () => {
  afterEach(async () => {
    await Promise.all(servers.splice(0).map(closeServer));
  });

  it('accepts the required published docs pages', async () => {
    const baseUrl = await startDocsServer();

    await expect(execDocsLinksCheck(baseUrl)).resolves.toBeDefined();
  });

  it('reports every required docs page that is not publicly reachable', async () => {
    const baseUrl = await startDocsServer({ '/a2amesh/api/core': 404 });

    await expect(execDocsLinksCheck(baseUrl)).rejects.toMatchObject({
      stderr: expect.stringContaining('/api/core'),
    });
  });
});

function execDocsLinksCheck(baseUrl: string) {
  return execFileAsync('node', [scriptPath], {
    cwd: repoRoot,
    env: {
      ...process.env,
      DOCS_BASE_URL: baseUrl,
    },
  });
}

function closeServer(server: Server) {
  return new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

function startDocsServer(statusByPath: Record<string, number> = {}) {
  return new Promise<string>((resolve, reject) => {
    const server = createServer((request, response) => {
      const pathname = new URL(request.url ?? '/', 'http://docs.local').pathname;
      writeDocsResponse(response, pathname, statusByPath[pathname] ?? 200);
    });

    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address() as AddressInfo;
      servers.push(server);
      resolve(`http://127.0.0.1:${address.port}/a2amesh/`);
    });
  });
}

function writeDocsResponse(response: ServerResponse, pathname: string, status: number) {
  response.statusCode = status;
  response.setHeader('content-type', 'text/html; charset=utf-8');
  response.end(`<html><head><title>A2A Mesh</title></head><body>${pathname}</body></html>`);
}
