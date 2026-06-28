import { describe, expect, it } from 'vitest';
import { createDiscoverCommand } from '../src/commands/discover.js';
import { expectCommandHelp, jsonOptions } from './command-test-helpers.js';

describe('discover command', () => {
  it('defines the discover command', () => {
    const command = createDiscoverCommand(jsonOptions);

    expect(command.name()).toBe('discover');
    expectCommandHelp(command, ['discover [options] <url>']);
  });
});
