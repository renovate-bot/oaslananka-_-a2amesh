import { describe, expect, it } from 'vitest';
import { createDoctorCommand } from '../src/commands/doctor.js';
import { expectCommandHelp, jsonOptions } from './command-test-helpers.js';

describe('doctor command', () => {
  it('defines the doctor command', () => {
    const command = createDoctorCommand(jsonOptions);

    expect(command.name()).toBe('doctor');
    expectCommandHelp(command, ['doctor']);
  });
});
