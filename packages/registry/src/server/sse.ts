import type { Response } from 'express';
import type { RegisteredAgent } from '../storage/IAgentStorage.js';
import type { RegistryServerContext } from './types.js';

export interface RegistrySseController {
  configure(res: Response): void;
  closeAllClients(): void;
  serializeData(payload: unknown): string;
  writeData(res: Response, payload: unknown, eventName?: string): void;
  normalizeAgentStreamPayload(
    payload: unknown,
  ): RegisteredAgent | { id: string; deleted: true } | null;
}

export function createRegistrySse(context: RegistryServerContext): RegistrySseController {
  return {
    configure(res: Response): void {
      context.sseClients.add(res);
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      res.on('close', () => {
        context.sseClients.delete(res);
      });
    },
    closeAllClients(): void {
      for (const client of context.sseClients) {
        try {
          client.end();
        } catch {
          /* ignore */
        }
      }
      context.sseClients.clear();
    },
    serializeData: serializeSseData,
    writeData(res: Response, payload: unknown, eventName?: string): void {
      const eventLine = eventName ? `event: ${eventName}\n` : '';
      res.write(`${eventLine}data: ${serializeSseData(payload)}\n\n`);
    },
    normalizeAgentStreamPayload,
  };
}

function serializeSseData(payload: unknown): string {
  return JSON.stringify(payload).replace(/[<>&\u2028\u2029]/g, (character) => {
    const replacements: Record<string, string> = {
      '<': '\\u003c',
      '>': '\\u003e',
      '&': '\\u0026',
      '\u2028': '\\u2028',
      '\u2029': '\\u2029',
    };
    return replacements[character] ?? character;
  });
}

function normalizeAgentStreamPayload(
  payload: unknown,
): RegisteredAgent | { id: string; deleted: true } | null {
  if (
    payload &&
    typeof payload === 'object' &&
    'type' in payload &&
    typeof payload.type === 'string'
  ) {
    if ((payload.type === 'registered' || payload.type === 'heartbeat') && 'agent' in payload) {
      return payload.agent as RegisteredAgent;
    }

    if (payload.type === 'deleted' && 'id' in payload && typeof payload.id === 'string') {
      return { id: payload.id, deleted: true };
    }
  }

  return null;
}
