import { pathToFileURL } from 'node:url';
import { ErrorCodes, JsonRpcError } from '@a2amesh/runtime';
import { WsClient, WsServer } from '@a2amesh/internal-transport-ws';

export interface WebSocketExampleResult {
  mode: 'websocket';
  reply: string;
  port: number;
}

export async function runExample(): Promise<WebSocketExampleResult> {
  const server = new WsServer({
    port: Number(process.env['WEBSOCKET_EXAMPLE_PORT'] ?? '0'),
    async handleRequest(request) {
      if (request.method === 'deployment.describe') {
        return {
          reply: 'websocket transport is reachable',
        };
      }
      throw new JsonRpcError(ErrorCodes.MethodNotFound, 'Unknown local example method');
    },
  });
  const port = await server.start();
  const client = new WsClient(`ws://127.0.0.1:${port}/a2amesh-ws`);

  try {
    const result = await client.request<{ reply: string }>('deployment.describe', {
      mode: 'websocket',
    });

    return {
      mode: 'websocket',
      reply: result.reply,
      port,
    };
  } finally {
    await client.close();
    await server.close();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  runExample()
    .then((result) => {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    });
}
