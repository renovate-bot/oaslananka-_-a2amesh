import { describe, expect, it } from 'vitest';
import { createValidateCommand } from '../src/commands/validate.js';
import { expectCommandHelp, jsonOptions } from './command-test-helpers.js';

describe('validate command', () => {
  it('defines the validate command', () => {
    const command = createValidateCommand(jsonOptions);

    expect(command.name()).toBe('validate');
    expectCommandHelp(command, ['validate [options] <target>']);
  });
});
