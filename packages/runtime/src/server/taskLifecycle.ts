import { randomUUID } from 'node:crypto';
import type {
  ExtensibleArtifact,
  Message,
  Task,
  TaskCounts,
  TaskState,
  TaskStateInput,
  TerminalTaskState,
} from '../types/task.js';
import { normalizeMessage, normalizeTaskState, taskStateMetadataKey } from '../utils/compat.js';

export type TaskUpdateReason = 'created' | 'message' | 'artifact' | 'state' | 'push-config';

export type TaskLifecycleErrorCode = 'INVALID_TASK_TRANSITION' | 'TASK_TERMINAL' | 'TASK_NOT_FOUND';

export class TaskLifecycleError extends Error {
  constructor(
    readonly code: TaskLifecycleErrorCode,
    message: string,
    readonly taskId?: string,
    readonly currentState?: TaskState,
    readonly nextState?: TaskState,
  ) {
    super(message);
  }
}

export interface TaskUpdatedEvent {
  task: Task;
  reason: TaskUpdateReason;
  previousState?: TaskState;
}

const TERMINAL_TASK_STATES = new Set<TerminalTaskState>([
  'COMPLETED',
  'FAILED',
  'CANCELED',
  'REJECTED',
]);

export const TASK_TRANSITIONS: Record<TaskState, ReadonlySet<TaskState>> = {
  SUBMITTED: new Set([
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
  ]),
  QUEUED: new Set([
    'QUEUED',
    'WORKING',
    'INPUT_REQUIRED',
    'AUTH_REQUIRED',
    'WAITING_ON_EXTERNAL',
    'COMPLETED',
    'FAILED',
    'CANCELED',
    'REJECTED',
  ]),
  WORKING: new Set([
    'WORKING',
    'INPUT_REQUIRED',
    'AUTH_REQUIRED',
    'WAITING_ON_EXTERNAL',
    'COMPLETED',
    'FAILED',
    'CANCELED',
    'REJECTED',
  ]),
  INPUT_REQUIRED: new Set([
    'INPUT_REQUIRED',
    'AUTH_REQUIRED',
    'WORKING',
    'WAITING_ON_EXTERNAL',
    'COMPLETED',
    'FAILED',
    'CANCELED',
    'REJECTED',
  ]),
  AUTH_REQUIRED: new Set([
    'AUTH_REQUIRED',
    'WORKING',
    'INPUT_REQUIRED',
    'WAITING_ON_EXTERNAL',
    'COMPLETED',
    'FAILED',
    'CANCELED',
    'REJECTED',
  ]),
  WAITING_ON_EXTERNAL: new Set([
    'WAITING_ON_EXTERNAL',
    'AUTH_REQUIRED',
    'WORKING',
    'INPUT_REQUIRED',
    'COMPLETED',
    'FAILED',
    'CANCELED',
    'REJECTED',
  ]),
  COMPLETED: new Set(),
  FAILED: new Set(),
  CANCELED: new Set(),
  REJECTED: new Set(),
};

function isTerminalTaskState(state: TaskState): state is TerminalTaskState {
  return TERMINAL_TASK_STATES.has(state as TerminalTaskState);
}

export function createSubmittedTask(
  sessionId?: string,
  contextId?: string,
  principalId?: string,
  tenantId?: string,
): Task {
  const createdAt = new Date().toISOString();
  return {
    kind: 'task',
    id: randomUUID(),
    status: {
      state: 'SUBMITTED',
      timestamp: createdAt,
    },
    history: [],
    artifacts: [],
    extensions: [],
    metadata: {
      createdAt,
    },
    ...(sessionId ? { sessionId } : {}),
    ...(contextId ? { contextId } : {}),
    ...(principalId ? { principalId } : {}),
    ...(tenantId ? { tenantId } : {}),
  };
}

export function appendHistoryMessageToTask(task: Task, message: Message): void {
  assertTaskMutable(task, 'append history');

  task.history.push({
    ...normalizeMessage(message),
    ...((message.contextId ?? task.contextId)
      ? { contextId: message.contextId ?? task.contextId }
      : {}),
  });
}

export function appendArtifactToTask(task: Task, artifact: ExtensibleArtifact): void {
  assertTaskMutable(task, 'append artifact');

  const nextArtifact: ExtensibleArtifact = {
    ...artifact,
    ...((artifact.extensions ?? task.extensions)
      ? { extensions: artifact.extensions ?? task.extensions }
      : {}),
    metadata: {
      ...(artifact.metadata ?? {}),
      ...(task.contextId ? { contextId: task.contextId } : {}),
    },
  };
  task.artifacts = [...(task.artifacts ?? []), nextArtifact];
}

export function applyTaskStateToTask(
  task: Task,
  state: TaskStateInput,
  historyMessage?: Message,
  metadata?: Record<string, unknown>,
): TaskState {
  const previousState = task.status.state;
  const nextState = normalizeTaskState(state);
  assertTransition(task, nextState);

  const timestamp = new Date().toISOString();
  task.status = {
    state: nextState,
    timestamp,
    ...(typeof metadata?.['message'] === 'string' ? { message: metadata['message'] } : {}),
  };
  if (historyMessage) {
    task.history.push({
      ...normalizeMessage(historyMessage),
      ...((historyMessage.contextId ?? task.contextId)
        ? { contextId: historyMessage.contextId ?? task.contextId }
        : {}),
    });
  }
  const nextMetadata = { ...(task.metadata ?? {}), ...(metadata ?? {}) };
  if (nextState === 'WORKING' && typeof nextMetadata['startedAt'] !== 'string') {
    nextMetadata['startedAt'] = timestamp;
  } else if (!isTerminalTaskState(nextState)) {
    const metadataKey = taskStateMetadataKey(nextState);
    if (typeof nextMetadata[metadataKey] !== 'string') {
      nextMetadata[metadataKey] = timestamp;
    }
  }
  if (isTerminalTaskState(nextState)) {
    nextMetadata['endedAt'] = timestamp;
    nextMetadata[taskStateMetadataKey(nextState)] = timestamp;
    const startedAtValue =
      typeof nextMetadata['startedAt'] === 'string'
        ? Date.parse(nextMetadata['startedAt'])
        : typeof nextMetadata['createdAt'] === 'string'
          ? Date.parse(nextMetadata['createdAt'])
          : Number.NaN;
    const endedAtValue = Date.parse(timestamp);
    if (Number.isFinite(startedAtValue) && Number.isFinite(endedAtValue)) {
      nextMetadata['durationMs'] = Math.max(endedAtValue - startedAtValue, 0);
    }
  }
  task.metadata = nextMetadata;
  return previousState;
}

export function calculateTaskCounts(tasks: Task[]): TaskCounts {
  return tasks.reduce<TaskCounts>(
    (counts, task) => {
      counts.total += 1;
      switch (task.status.state) {
        case 'SUBMITTED':
          counts.submitted += 1;
          counts.active += 1;
          break;
        case 'QUEUED':
          counts.queued += 1;
          counts.active += 1;
          break;
        case 'WORKING':
          counts.working += 1;
          counts.active += 1;
          break;
        case 'AUTH_REQUIRED':
          counts.authRequired += 1;
          counts.active += 1;
          break;
        case 'WAITING_ON_EXTERNAL':
          counts.waitingOnExternal += 1;
          counts.active += 1;
          break;
        case 'INPUT_REQUIRED':
          counts.inputRequired += 1;
          counts.active += 1;
          break;
        case 'COMPLETED':
          counts.completed += 1;
          break;
        case 'FAILED':
          counts.failed += 1;
          break;
        case 'CANCELED':
          counts.canceled += 1;
          break;
        case 'REJECTED':
          counts.rejected += 1;
          break;
      }
      return counts;
    },
    {
      total: 0,
      active: 0,
      completed: 0,
      failed: 0,
      canceled: 0,
      rejected: 0,
      submitted: 0,
      queued: 0,
      inputRequired: 0,
      authRequired: 0,
      waitingOnExternal: 0,
      working: 0,
    },
  );
}

export function assertTaskMutable(task: Task, action: string): void {
  if (isTerminalTaskState(task.status.state)) {
    throw new TaskLifecycleError(
      'TASK_TERMINAL',
      `Cannot ${action} for terminal task ${task.id} in state ${task.status.state}`,
      task.id,
      task.status.state,
    );
  }
}

function assertTransition(task: Task, nextState: TaskState): void {
  const currentState = task.status.state;
  if (isTerminalTaskState(currentState)) {
    throw new TaskLifecycleError(
      'TASK_TERMINAL',
      `Task ${task.id} is already terminal in state ${currentState}`,
      task.id,
      currentState,
      nextState,
    );
  }

  if (TASK_TRANSITIONS[currentState].has(nextState)) {
    return;
  }

  throw new TaskLifecycleError(
    'INVALID_TASK_TRANSITION',
    `Invalid task transition from ${currentState} to ${nextState} for task ${task.id}`,
    task.id,
    currentState,
    nextState,
  );
}
