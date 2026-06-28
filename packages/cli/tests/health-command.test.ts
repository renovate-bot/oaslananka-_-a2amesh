import { describe, expect, it } from 'vitest';
import { createHealthCommand } from '../src/commands/health.js';
import { expectCommandHelp, jsonOptions } from './command-test-helpers.js';

describe('health command', () => {
  it('defines the health command', () => {
    const command = createHealthCommand(jsonOptions);

    expect(command.name()).toBe('health');
    expectCommandHelp(command, ['health [options] <url>']);
  });
});
