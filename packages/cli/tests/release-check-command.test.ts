import { describe, expect, it } from 'vitest';
import { createReleaseCheckCommand } from '../src/commands/release-check.js';
import { expectCommandHelp, jsonOptions } from './command-test-helpers.js';

describe('release-check command', () => {
  it('defines the release-check command', () => {
    const command = createReleaseCheckCommand(jsonOptions);

    expect(command.name()).toBe('release-check');
    expectCommandHelp(command, ['release-check']);
  });
});
