export type TaskRetryState = 'queued' | 'running' | 'succeeded' | 'dead-lettered';

export interface TaskRetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  multiplier?: number;
  jitterRatio?: number;
}

export interface TaskRetryPlan {
  taskId: string;
  state: TaskRetryState;
  attempts: number;
  nextRunAt: string;
  lastError?: string;
}

const DEFAULT_OPTIONS: Required<TaskRetryOptions> = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30_000,
  multiplier: 2,
  jitterRatio: 0,
};

function normalizeOptions(options: TaskRetryOptions = {}): Required<TaskRetryOptions> {
  return {
    maxAttempts: Math.max(1, options.maxAttempts ?? DEFAULT_OPTIONS.maxAttempts),
    initialDelayMs: Math.max(0, options.initialDelayMs ?? DEFAULT_OPTIONS.initialDelayMs),
    maxDelayMs: Math.max(0, options.maxDelayMs ?? DEFAULT_OPTIONS.maxDelayMs),
    multiplier: Math.max(1, options.multiplier ?? DEFAULT_OPTIONS.multiplier),
    jitterRatio: Math.max(0, Math.min(1, options.jitterRatio ?? DEFAULT_OPTIONS.jitterRatio)),
  };
}

export function calculateRetryDelayMs(attempt: number, options: TaskRetryOptions = {}): number {
  const normalized = normalizeOptions(options);
  const base = normalized.initialDelayMs * normalized.multiplier ** Math.max(0, attempt - 1);
  const capped = Math.min(base, normalized.maxDelayMs);
  if (normalized.jitterRatio === 0) return Math.round(capped);
  const jitter = capped * normalized.jitterRatio;
  return Math.round(capped - jitter / 2 + Math.random() * jitter);
}

export function createTaskRetryPlan(taskId: string, now: Date = new Date()): TaskRetryPlan {
  return {
    taskId,
    state: 'queued',
    attempts: 0,
    nextRunAt: now.toISOString(),
  };
}

export function markTaskAttemptStarted(plan: TaskRetryPlan): TaskRetryPlan {
  return {
    ...plan,
    state: 'running',
    attempts: plan.attempts + 1,
  };
}

export function markTaskAttemptSucceeded<TPlan extends TaskRetryPlan>(
  plan: TPlan,
): Omit<TPlan, 'lastError' | 'state'> & { state: 'succeeded' } {
  const { lastError: ignoredLastError, state: ignoredState, ...rest } = plan;
  void ignoredLastError;
  void ignoredState;
  return {
    ...rest,
    state: 'succeeded',
  } as Omit<TPlan, 'lastError' | 'state'> & { state: 'succeeded' };
}

export function markTaskAttemptFailed(
  plan: TaskRetryPlan,
  error: unknown,
  now: Date = new Date(),
  options: TaskRetryOptions = {},
): TaskRetryPlan {
  const normalized = normalizeOptions(options);
  const lastError = error instanceof Error ? error.message : String(error);
  if (plan.attempts >= normalized.maxAttempts) {
    return {
      ...plan,
      state: 'dead-lettered',
      lastError,
    };
  }

  const delay = calculateRetryDelayMs(plan.attempts, normalized);
  return {
    ...plan,
    state: 'queued',
    nextRunAt: new Date(now.getTime() + delay).toISOString(),
    lastError,
  };
}

export function isTaskRetryDue(plan: TaskRetryPlan, now: Date = new Date()): boolean {
  return plan.state === 'queued' && Date.parse(plan.nextRunAt) <= now.getTime();
}
