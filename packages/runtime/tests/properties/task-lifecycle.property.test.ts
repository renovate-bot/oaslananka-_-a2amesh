import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { TaskLifecycleError, TaskManager } from '../../src/server/TaskManager.js';
import { TASK_TRANSITIONS } from '../../src/server/taskLifecycle.js';
import type { Task, TaskState } from '../../src/types/task.js';

const PROPERTY_CONFIG = {
  seed: 20260525,
  numRuns: 200,
} as const;

const TASK_STATES = [
  'SUBMITTED',
  'QUEUED',
  'WORKING',
  'INPUT_REQUIRED',
  'AUTH_REQUIRED',
  'WAITING_ON_EXTERNAL',
  'COMPLETED',
  'FAILED',
  'CANCELED',
  'REJECTED',
] as const satisfies readonly TaskState[];

const TERMINAL_STATES = [
  'COMPLETED',
  'FAILED',
  'CANCELED',
  'REJECTED',
] as const satisfies readonly TaskState[];

const EXPECTED_TRANSITIONS = {
  SUBMITTED: [
    'SUBMITTED',
    'QUEUED',
    'WORKING',
    'INPUT_REQUIRED',
    'AUTH_REQUIRED',
    'WAITING_ON_EXTERNAL',
    'COMPLETED',
    'FAILED',
    'CANCELED',
    'REJECTED',
  ],
  QUEUED: [
    'QUEUED',
    'WORKING',
    'INPUT_REQUIRED',
    'AUTH_REQUIRED',
    'WAITING_ON_EXTERNAL',
    'COMPLETED',
    'FAILED',
    'CANCELED',
    'REJECTED',
  ],
  WORKING: [
    'WORKING',
    'INPUT_REQUIRED',
    'AUTH_REQUIRED',
    'WAITING_ON_EXTERNAL',
    'COMPLETED',
    'FAILED',
    'CANCELED',
    'REJECTED',
  ],
  INPUT_REQUIRED: [
    'INPUT_REQUIRED',
    'AUTH_REQUIRED',
    'WORKING',
    'WAITING_ON_EXTERNAL',
    'COMPLETED',
    'FAILED',
    'CANCELED',
    'REJECTED',
  ],
  AUTH_REQUIRED: [
    'AUTH_REQUIRED',
    'WORKING',
    'INPUT_REQUIRED',
    'WAITING_ON_EXTERNAL',
    'COMPLETED',
    'FAILED',
    'CANCELED',
    'REJECTED',
  ],
  WAITING_ON_EXTERNAL: [
    'WAITING_ON_EXTERNAL',
    'AUTH_REQUIRED',
    'WORKING',
    'INPUT_REQUIRED',
    'COMPLETED',
    'FAILED',
    'CANCELED',
    'REJECTED',
  ],
  COMPLETED: [],
  FAILED: [],
  CANCELED: [],
  REJECTED: [],
} as const satisfies Record<TaskState, readonly TaskState[]>;

const taskStateArbitrary = fc.constantFrom(...TASK_STATES);
const transitionSequenceArbitrary = fc.array(taskStateArbitrary, {
  minLength: 1,
  maxLength: 16,
});

const TERMINAL_STATE_SET: ReadonlySet<TaskState> = new Set(TERMINAL_STATES);

const EXPECTED_TRANSITION_SETS = TASK_STATES.reduce<Record<TaskState, ReadonlySet<TaskState>>>(
  (transitions, state) => {
    transitions[state] = new Set<TaskState>(EXPECTED_TRANSITIONS[state]);
    return transitions;
  },
  {
    SUBMITTED: new Set<TaskState>(),
    QUEUED: new Set<TaskState>(),
    WORKING: new Set<TaskState>(),
    INPUT_REQUIRED: new Set<TaskState>(),
    AUTH_REQUIRED: new Set<TaskState>(),
    WAITING_ON_EXTERNAL: new Set<TaskState>(),
    COMPLETED: new Set<TaskState>(),
    FAILED: new Set<TaskState>(),
    CANCELED: new Set<TaskState>(),
    REJECTED: new Set<TaskState>(),
  },
);

function serializedTransitions(): Record<TaskState, TaskState[]> {
  return Object.fromEntries(
    TASK_STATES.map((state) => [state, [...TASK_TRANSITIONS[state]]]),
  ) as Record<TaskState, TaskState[]>;
}

function isTerminalState(state: TaskState): boolean {
  return TERMINAL_STATE_SET.has(state);
}

function isValidTransition(currentState: TaskState, nextState: TaskState): boolean {
  return EXPECTED_TRANSITION_SETS[currentState].has(nextState);
}

function lifecycleErrorFor(operation: () => unknown): TaskLifecycleError {
  try {
    operation();
  } catch (error) {
    expect(error).toBeInstanceOf(TaskLifecycleError);
    return error as TaskLifecycleError;
  }

  throw new Error('Expected task lifecycle operation to throw');
}

function expectIsoTimestampAtOrAfter(later: unknown, earlier: unknown): void {
  expect(typeof later).toBe('string');
  expect(typeof earlier).toBe('string');
  expect(Date.parse(later as string)).toBeGreaterThanOrEqual(Date.parse(earlier as string));
}

function assertTimestampMetadataIsMonotonic(task: Task): void {
  const createdAt = task.metadata?.['createdAt'];
  expectIsoTimestampAtOrAfter(task.status.timestamp, createdAt);

  const startedAt = task.metadata?.['startedAt'];
  if (typeof startedAt === 'string') {
    expectIsoTimestampAtOrAfter(startedAt, createdAt);
    expectIsoTimestampAtOrAfter(task.status.timestamp, startedAt);
  }

  if (isTerminalState(task.status.state)) {
    const endedAt = task.metadata?.['endedAt'];
    expectIsoTimestampAtOrAfter(endedAt, createdAt);
    if (typeof startedAt === 'string') {
      expectIsoTimestampAtOrAfter(endedAt, startedAt);
    }

    const terminalTimestampKey = `${task.status.state.toLowerCase()}At`;
    expect(task.metadata?.[terminalTimestampKey]).toBe(endedAt);
    expect(task.metadata?.['durationMs']).toEqual(expect.any(Number));
    expect(task.metadata?.['durationMs']).toBeGreaterThanOrEqual(0);
  }
}

describe('task lifecycle properties', () => {
  it('keeps the checked transition graph aligned with TASK_TRANSITIONS', () => {
    expect(serializedTransitions()).toEqual(EXPECTED_TRANSITIONS);
  });

  it('enforces lifecycle invariants across generated transition sequences', () => {
    fc.assert(
      fc.property(transitionSequenceArbitrary, (sequence) => {
        const manager = new TaskManager();
        const task = manager.createTask();
        assertTimestampMetadataIsMonotonic(task);

        for (const nextState of sequence) {
          const before = manager.getTask(task.id);
          if (!before) {
            throw new Error(`Expected task ${task.id} to exist`);
          }
          const currentState = before.status.state;

          if (isTerminalState(currentState)) {
            const error = lifecycleErrorFor(() => manager.updateTaskState(task.id, nextState));
            expect(error.code).toBe('TASK_TERMINAL');
            expect(error.taskId).toBe(task.id);
            expect(error.currentState).toBe(currentState);
            expect(error.nextState).toBe(nextState);
            expect(manager.getTask(task.id)?.status.state).toBe(currentState);
            continue;
          }

          if (isValidTransition(currentState, nextState)) {
            const updatedTask = manager.updateTaskState(task.id, nextState);
            if (!updatedTask) {
              throw new Error(`Expected transition to update task ${task.id}`);
            }
            expect(updatedTask.status.state).toBe(nextState);
            assertTimestampMetadataIsMonotonic(updatedTask);
            continue;
          }

          const error = lifecycleErrorFor(() => manager.updateTaskState(task.id, nextState));
          expect(error.code).toBe('INVALID_TASK_TRANSITION');
          expect(error.taskId).toBe(task.id);
          expect(error.currentState).toBe(currentState);
          expect(error.nextState).toBe(nextState);
          expect(manager.getTask(task.id)?.status.state).toBe(currentState);
        }
      }),
      PROPERTY_CONFIG,
    );
  });
});
