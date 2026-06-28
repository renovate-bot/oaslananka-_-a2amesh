import { describe, expect, it } from 'vitest';
import {
  calculateRetryDelayMs,
  createTaskRetryPlan,
  isTaskRetryDue,
  markTaskAttemptFailed,
  markTaskAttemptStarted,
  markTaskAttemptSucceeded,
  type TaskRetryPlan,
} from '../src/server/TaskRetryScheduler.js';

describe('TaskRetryScheduler', () => {
  it('calculates capped delays', () => {
    expect(calculateRetryDelayMs(1, { initialDelayMs: 100, multiplier: 2, maxDelayMs: 1000 })).toBe(
      100,
    );
    expect(calculateRetryDelayMs(4, { initialDelayMs: 100, multiplier: 2, maxDelayMs: 500 })).toBe(
      500,
    );
  });

  it('creates queued plans', () => {
    expect(createTaskRetryPlan('task-1', new Date('2026-01-01T00:00:00.000Z'))).toEqual({
      attempts: 0,
      nextRunAt: '2026-01-01T00:00:00.000Z',
      state: 'queued',
      taskId: 'task-1',
    });
  });

  it('marks attempts as started while preserving metadata', () => {
    const planWithMetadata: TaskRetryPlan & { operatorHint: string } = {
      ...createTaskRetryPlan('task-2', new Date('2026-01-01T00:00:00.000Z')),
      operatorHint: 'node-a',
    };

    const started = markTaskAttemptStarted(planWithMetadata);

    expect(started).toMatchObject({
      attempts: 1,
      operatorHint: 'node-a',
      state: 'running',
      taskId: 'task-2',
    });
  });

  it('marks attempts as succeeded while preserving metadata and clearing errors', () => {
    const plan = {
      ...createTaskRetryPlan('task-3', new Date('2026-01-01T00:00:00.000Z')),
      attempts: 2,
      lastError: 'temporary failure',
      resumeToken: 'cursor-1',
      state: 'running' as const,
    };

    const succeeded = markTaskAttemptSucceeded(plan);

    expect(succeeded).toMatchObject({
      attempts: 2,
      nextRunAt: '2026-01-01T00:00:00.000Z',
      resumeToken: 'cursor-1',
      state: 'succeeded',
      taskId: 'task-3',
    });
    expect('lastError' in succeeded).toBe(false);
  });

  it('reschedules failed attempts and records the last error', () => {
    const started = markTaskAttemptStarted(
      createTaskRetryPlan('task-4', new Date('2026-01-01T00:00:00.000Z')),
    );

    const failed = markTaskAttemptFailed(
      started,
      new Error('provider timeout'),
      new Date('2026-01-01T00:00:10.000Z'),
      { initialDelayMs: 500, maxAttempts: 3 },
    );

    expect(failed).toMatchObject({
      attempts: 1,
      lastError: 'provider timeout',
      nextRunAt: '2026-01-01T00:00:10.500Z',
      state: 'queued',
      taskId: 'task-4',
    });
  });

  it('dead-letters attempts that exhaust the retry budget', () => {
    const exhausted: TaskRetryPlan = {
      attempts: 3,
      nextRunAt: '2026-01-01T00:00:00.000Z',
      state: 'running',
      taskId: 'task-5',
    };

    expect(
      markTaskAttemptFailed(exhausted, 'boom', new Date('2026-01-01T00:00:00.000Z'), {
        maxAttempts: 3,
      }),
    ).toMatchObject({
      attempts: 3,
      lastError: 'boom',
      state: 'dead-lettered',
      taskId: 'task-5',
    });
  });

  it('checks due queued plans only', () => {
    expect(
      isTaskRetryDue(
        createTaskRetryPlan('task-6', new Date('2026-01-01T00:00:00.000Z')),
        new Date('2026-01-01T00:00:00.001Z'),
      ),
    ).toBe(true);
    expect(
      isTaskRetryDue(
        {
          ...createTaskRetryPlan('task-7', new Date('2026-01-01T00:00:01.000Z')),
          state: 'running',
        },
        new Date('2026-01-01T00:00:02.000Z'),
      ),
    ).toBe(false);
  });
});
