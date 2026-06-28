import { describe, expect, it } from 'vitest';
import {
  isTerminalTaskState,
  normalizeMessageRole,
  normalizeTaskState,
} from '../src/utils/compat.js';
import { validateMessageSendParams } from '../src/utils/schema-validator.js';

describe('compat normalizers', () => {
  it('normalizes v0.3 task states to A2A v1.0 SCREAMING_SNAKE_CASE', () => {
    expect(normalizeTaskState('submitted')).toBe('SUBMITTED');
    expect(normalizeTaskState('queued')).toBe('QUEUED');
    expect(normalizeTaskState('working')).toBe('WORKING');
    expect(normalizeTaskState('input-required')).toBe('INPUT_REQUIRED');
    expect(normalizeTaskState('input_required')).toBe('INPUT_REQUIRED');
    expect(normalizeTaskState('waiting_on_external')).toBe('WAITING_ON_EXTERNAL');
    expect(normalizeTaskState('waiting-on-external')).toBe('WAITING_ON_EXTERNAL');
    expect(normalizeTaskState('completed')).toBe('COMPLETED');
    expect(normalizeTaskState('failed')).toBe('FAILED');
    expect(normalizeTaskState('canceled')).toBe('CANCELED');
    expect(normalizeTaskState('rejected')).toBe('REJECTED');
  });

  it('normalizes legacy message roles to A2A v1.0 role constants', () => {
    expect(normalizeMessageRole('user')).toBe('ROLE_USER');
    expect(normalizeMessageRole('agent')).toBe('ROLE_AGENT');
    expect(normalizeMessageRole('ROLE_USER')).toBe('ROLE_USER');
    expect(normalizeMessageRole('ROLE_AGENT')).toBe('ROLE_AGENT');
  });

  it('treats rejected as an A2A v1 terminal state', () => {
    expect(isTerminalTaskState('REJECTED')).toBe(true);
    expect(isTerminalTaskState('rejected')).toBe(true);
    expect(isTerminalTaskState('AUTH_REQUIRED')).toBe(false);
  });

  it('normalizes message roles during schema validation', () => {
    const params = validateMessageSendParams({
      message: {
        role: 'user',
        parts: [{ type: 'text', text: 'hello' }],
        messageId: 'message-1',
        timestamp: new Date().toISOString(),
      },
    });

    expect(params.message.role).toBe('ROLE_USER');
  });

  it('rejects unknown legacy task states and message roles', () => {
    expect(() => normalizeTaskState('done')).toThrow(/Unsupported task state/);
    expect(() => normalizeMessageRole('assistant')).toThrow(/Unsupported message role/);
  });
});
