import type { AgentCard, TaskStatus, ExtensibleArtifact } from '@a2amesh/protocol';

/**
 * WorkerCard extends the core AgentCard to represent a worker node
 * in the Fleet orchestration system.
 */
export interface WorkerCard extends AgentCard {
  /** Fleet-specific roles this worker can fulfill */
  fleetRoles?: string[];
  /** Maximum number of concurrent tasks this worker can handle */
  maxConcurrentTasks?: number;
}

/**
 * FleetWorker represents an active worker node in the Fleet.
 */
export type FleetWorkerStatus = 'IDLE' | 'BUSY' | 'OFFLINE';

export type FleetRunStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELED';

export type FleetStrategyType = 'MANUAL' | 'ROUND_ROBIN' | 'CAPABILITY_MATCH';

export interface FleetWorker {
  id: string;
  card: WorkerCard;
  status: FleetWorkerStatus;
  lastSeenAt: string;
  labels?: Record<string, string>;
}

/**
 * Strategy definitions for task assignment and execution.
 */
export interface FleetStrategy {
  type: FleetStrategyType;
  fallbackStrategy?: FleetStrategy;
  parameters?: Record<string, unknown>;
}

/**
 * FleetTask extends the concept of a task for distributed execution.
 */
export interface FleetTask {
  id: string;
  description?: string;
  requiredCapabilities?: string[];
  strategy?: FleetStrategy;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  targetWorkerId?: string;
}

/**
 * FleetRun represents an execution of a FleetTask on a FleetWorker.
 */
export interface FleetRun {
  id: string;
  taskId: string;
  workerId: string;
  status: FleetRunStatus;
  startedAt?: string;
  completedAt?: string;
  artifacts?: ExtensibleArtifact[];
  metrics?: Record<string, unknown>;
}
