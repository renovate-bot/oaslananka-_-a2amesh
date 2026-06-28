import { ErrorCodes, JsonRpcError } from '../../types/jsonrpc.js';
import type { Task } from '../../types/task.js';
import type { TaskLifecycleError } from '../TaskManager.js';

export function isTerminalTaskState(state: Task['status']['state']): boolean {
  return (
    state === 'COMPLETED' || state === 'FAILED' || state === 'CANCELED' || state === 'REJECTED'
  );
}

export function toLifecycleJsonRpcError(error: TaskLifecycleError): JsonRpcError {
  if (error.code === 'INVALID_TASK_TRANSITION' || error.code === 'TASK_TERMINAL') {
    return new JsonRpcError(ErrorCodes.InvalidTaskTransition, error.message, {
      taskId: error.taskId,
      currentState: error.currentState,
      nextState: error.nextState,
    });
  }

  return new JsonRpcError(ErrorCodes.InternalError, error.message, {
    taskId: error.taskId,
  });
}
