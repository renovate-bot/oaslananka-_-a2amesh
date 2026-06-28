import { describe, it, expect } from 'vitest';
import type { FleetWorker, FleetTask, FleetRun, WorkerCard, FleetStrategy } from '../src/types/domain.js';

const FIXED_TIMESTAMP = '2026-01-01T00:00:00.000Z';

describe('Fleet Domain Types', () => {
  it('should support creating a WorkerCard', () => {
    const card: WorkerCard = {
      protocolVersion: '1.0',
      name: 'TestWorker',
      description: 'A test worker',
      url: 'http://localhost:8080',
      version: '1.0.0',
      fleetRoles: ['tester'],
      maxConcurrentTasks: 5,
    };
    expect(card.name).toBe('TestWorker');
    expect(card.maxConcurrentTasks).toBe(5);
  });

  it('should support creating a FleetWorker', () => {
    const worker: FleetWorker = {
      id: 'worker-1',
      card: {
        protocolVersion: '1.0',
        name: 'Worker1',
        description: 'First worker',
        url: 'http://worker1.local',
        version: '1.0.0',
      },
      status: 'IDLE',
      lastSeenAt: FIXED_TIMESTAMP,
    };
    expect(worker.id).toBe('worker-1');
    expect(worker.status).toBe('IDLE');
  });

  it('should support creating a FleetTask and FleetRun', () => {
    const task: FleetTask = {
      id: 'task-1',
      description: 'Run tests',
      status: {
        state: 'QUEUED',
        timestamp: FIXED_TIMESTAMP,
      },
      createdAt: FIXED_TIMESTAMP,
      updatedAt: FIXED_TIMESTAMP,
    };

    const run: FleetRun = {
      id: 'run-1',
      taskId: task.id,
      workerId: 'worker-1',
      status: 'PENDING',
    };

    expect(task.id).toBe('task-1');
    expect(run.taskId).toBe('task-1');
  });

  it('should support creating a FleetStrategy', () => {
    const strategy: FleetStrategy = {
      type: 'ROUND_ROBIN',
      parameters: {
        timeout: 5000,
      },
    };
    expect(strategy.type).toBe('ROUND_ROBIN');
    expect(strategy.parameters?.['timeout']).toBe(5000);
  });
});
