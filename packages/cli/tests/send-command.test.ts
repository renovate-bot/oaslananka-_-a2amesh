import { describe, expect, it } from 'vitest';
import { createSendCommand } from '../src/commands/send.js';
import { expectCommandHelp, jsonOptions } from './command-test-helpers.js';

describe('send command', () => {
  it('defines the top-level send command', () => {
    const command = createSendCommand(jsonOptions);

    expect(command.name()).toBe('send');
    expectCommandHelp(command, ['send [options] <url> <message>']);
  });
});
