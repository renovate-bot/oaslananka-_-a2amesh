# Task retries

A2A Mesh exposes `TaskRetryScheduler` helpers for retry planning, capped backoff, due checks, success, and dead-letter transitions.

This is an in-process contract for durable task engines. Queue adapters can persist `TaskRetryPlan` records in Postgres, Redis, BullMQ, Temporal, or another scheduler while keeping the same state and delay semantics.

## Helpers

| Helper                     | Purpose                                          |
| -------------------------- | ------------------------------------------------ |
| `createTaskRetryPlan`      | Creates a queued retry plan.                     |
| `markTaskAttemptStarted`   | Moves a plan to running and increments attempts. |
| `markTaskAttemptFailed`    | Reschedules the plan or marks it dead-lettered.  |
| `markTaskAttemptSucceeded` | Marks the plan succeeded.                        |
| `isTaskRetryDue`           | Checks whether queued work is ready to run.      |
| `calculateRetryDelayMs`    | Computes capped exponential backoff.             |
