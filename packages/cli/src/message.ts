import { randomUUID } from 'node:crypto';
import type { Message } from '@a2amesh/runtime';

export function createCliMessage(text: string): Message {
  return {
    role: 'user',
    parts: [{ type: 'text', text }],
    messageId: `cli-${randomUUID()}`,
    timestamp: new Date().toISOString(),
  };
}
