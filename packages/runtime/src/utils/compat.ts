import type {
  LegacyMessageRole,
  Message,
  MessageRole,
  TaskState,
  TaskStateInput,
} from '../types/task.js';

const STATE_MAP: Record<TaskStateInput, TaskState> = {
  SUBMITTED: 'SUBMITTED',
  QUEUED: 'QUEUED',
  WORKING: 'WORKING',
  INPUT_REQUIRED: 'INPUT_REQUIRED',
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  WAITING_ON_EXTERNAL: 'WAITING_ON_EXTERNAL',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELED: 'CANCELED',
  REJECTED: 'REJECTED',
  TASK_STATE_SUBMITTED: 'SUBMITTED',
  TASK_STATE_QUEUED: 'QUEUED',
  TASK_STATE_WORKING: 'WORKING',
  TASK_STATE_INPUT_REQUIRED: 'INPUT_REQUIRED',
  TASK_STATE_AUTH_REQUIRED: 'AUTH_REQUIRED',
  TASK_STATE_WAITING_ON_EXTERNAL: 'WAITING_ON_EXTERNAL',
  TASK_STATE_COMPLETED: 'COMPLETED',
  TASK_STATE_FAILED: 'FAILED',
  TASK_STATE_CANCELED: 'CANCELED',
  TASK_STATE_REJECTED: 'REJECTED',
  submitted: 'SUBMITTED',
  queued: 'QUEUED',
  working: 'WORKING',
  'input-required': 'INPUT_REQUIRED',
  input_required: 'INPUT_REQUIRED',
  'auth-required': 'AUTH_REQUIRED',
  auth_required: 'AUTH_REQUIRED',
  waiting_on_external: 'WAITING_ON_EXTERNAL',
  'waiting-on-external': 'WAITING_ON_EXTERNAL',
  completed: 'COMPLETED',
  failed: 'FAILED',
  canceled: 'CANCELED',
  rejected: 'REJECTED',
};

const ROLE_MAP: Record<MessageRole | LegacyMessageRole, MessageRole> = {
  ROLE_USER: 'ROLE_USER',
  ROLE_AGENT: 'ROLE_AGENT',
  user: 'ROLE_USER',
  agent: 'ROLE_AGENT',
};

export function normalizeTaskState(raw: string): TaskState {
  const normalized = STATE_MAP[raw as TaskStateInput];
  if (!normalized) {
    throw new Error(`Unsupported task state: ${raw}`);
  }
  return normalized;
}

export function normalizeMessageRole(raw: string): MessageRole {
  const normalized = ROLE_MAP[raw as MessageRole | LegacyMessageRole];
  if (!normalized) {
    throw new Error(`Unsupported message role: ${raw}`);
  }
  return normalized;
}

export function normalizeMessage(message: Message): Message {
  return {
    ...message,
    role: normalizeMessageRole(message.role),
  };
}

export function isAgentMessage(message: Pick<Message, 'role'>): boolean {
  return normalizeMessageRole(message.role) === 'ROLE_AGENT';
}

export function isTerminalTaskState(
  state: string,
): state is 'COMPLETED' | 'FAILED' | 'CANCELED' | 'REJECTED' {
  const normalized = normalizeTaskState(state);
  return (
    normalized === 'COMPLETED' ||
    normalized === 'FAILED' ||
    normalized === 'CANCELED' ||
    normalized === 'REJECTED'
  );
}

export function taskStateMetadataKey(state: TaskState): string {
  switch (state) {
    case 'INPUT_REQUIRED':
      return 'inputRequiredAt';
    case 'AUTH_REQUIRED':
      return 'authRequiredAt';
    case 'WAITING_ON_EXTERNAL':
      return 'waitingOnExternalAt';
    default:
      return `${state.toLowerCase()}At`;
  }
}
