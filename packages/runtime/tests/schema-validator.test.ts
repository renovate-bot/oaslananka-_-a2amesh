import { describe, expect, it } from 'vitest';
import { ErrorCodes } from '../src/types/jsonrpc.js';
import { validateMessageSendParams } from '../src/utils/schema-validator.js';

function createMessageSendParams(timestamp?: string): Record<string, unknown> {
  return {
    message: {
      role: 'user',
      parts: [{ type: 'text', text: 'hello' }],
      messageId: 'message-1',
      ...(timestamp === undefined ? {} : { timestamp }),
    },
  };
}

describe('schema validator message timestamps', () => {
  it('accepts UTC ISO datetimes', () => {
    const params = validateMessageSendParams(createMessageSendParams('2026-04-06T10:00:00.000Z'));

    expect(params.message.timestamp).toBe('2026-04-06T10:00:00.000Z');
  });

  it('accepts ISO datetimes with timezone offsets', () => {
    const params = validateMessageSendParams(createMessageSendParams('2026-04-06T13:00:00+03:00'));

    expect(params.message.timestamp).toBe('2026-04-06T13:00:00+03:00');
  });

  it('rejects non-date timestamp text', () => {
    expect(() => validateMessageSendParams(createMessageSendParams('not-a-date'))).toThrow(
      expect.objectContaining({ code: ErrorCodes.InvalidParams }),
    );
  });

  it('rejects invalid ISO timestamp dates', () => {
    expect(() =>
      validateMessageSendParams(createMessageSendParams('2026-13-01T00:00:00Z')),
    ).toThrow(expect.objectContaining({ code: ErrorCodes.InvalidParams }));
  });

  it('rejects missing message timestamps', () => {
    expect(() => validateMessageSendParams(createMessageSendParams())).toThrow(
      expect.objectContaining({ code: ErrorCodes.InvalidParams }),
    );
  });
});
