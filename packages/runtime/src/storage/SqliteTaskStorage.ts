import { AsyncLocalStorage } from 'node:async_hooks';
import { createRequire } from 'node:module';
import type { AsyncTaskStorage, AsyncTaskStorageTransaction } from './AsyncTaskStorage.js';
import type { ITaskStorage } from './ITaskStorage.js';
import type { PushNotificationConfig, Task } from '../types/task.js';

interface SqliteStatement<TRow = unknown> {
  run(...params: unknown[]): unknown;
  get(...params: unknown[]): TRow | undefined;
  all(...params: unknown[]): TRow[];
}

interface SqliteDatabase {
  exec(sql: string): void;
  prepare<TRow = unknown>(sql: string): SqliteStatement<TRow>;
  close?(): void;
}

interface SqliteDatabaseConstructor {
  new (path: string): SqliteDatabase;
}

interface TaskRow {
  task_json: string;
}

interface PushNotificationRow {
  config_json: string;
}

function parseTask(row: TaskRow | undefined): Task | undefined {
  return row ? (JSON.parse(row.task_json) as Task) : undefined;
}

function parsePushNotification(
  row: PushNotificationRow | undefined,
): PushNotificationConfig | undefined {
  return row ? (JSON.parse(row.config_json) as PushNotificationConfig) : undefined;
}

function initializeSqliteTaskStorage(db: SqliteDatabase): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      context_id TEXT,
      task_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS push_notifications (
      task_id TEXT PRIMARY KEY,
      config_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_tasks_context_id ON tasks(context_id);
  `);
}

function insertTaskIntoSqlite(db: SqliteDatabase, task: Task): Task {
  db.prepare('INSERT INTO tasks (id, context_id, task_json) VALUES (?, ?, ?)').run(
    task.id,
    task.contextId ?? null,
    JSON.stringify(task),
  );
  return structuredClone(task);
}

function getTaskFromSqlite(db: SqliteDatabase, taskId: string): Task | undefined {
  return parseTask(db.prepare<TaskRow>('SELECT task_json FROM tasks WHERE id = ?').get(taskId));
}

function saveTaskToSqlite(db: SqliteDatabase, task: Task): void {
  db.prepare('UPDATE tasks SET context_id = ?, task_json = ? WHERE id = ?').run(
    task.contextId ?? null,
    JSON.stringify(task),
    task.id,
  );
}

function getAllTasksFromSqlite(db: SqliteDatabase): Task[] {
  return db
    .prepare<TaskRow>('SELECT task_json FROM tasks ORDER BY id')
    .all()
    .map((row) => JSON.parse(row.task_json) as Task);
}

function getTasksByContextIdFromSqlite(db: SqliteDatabase, contextId: string): Task[] {
  return db
    .prepare<TaskRow>('SELECT task_json FROM tasks WHERE context_id = ? ORDER BY id')
    .all(contextId)
    .map((row) => JSON.parse(row.task_json) as Task);
}

function setPushNotificationInSqlite(
  db: SqliteDatabase,
  taskId: string,
  config: PushNotificationConfig,
): PushNotificationConfig | undefined {
  if (!getTaskFromSqlite(db, taskId)) {
    return undefined;
  }

  db.prepare(
    'INSERT INTO push_notifications (task_id, config_json) VALUES (?, ?) ON CONFLICT(task_id) DO UPDATE SET config_json = excluded.config_json',
  ).run(taskId, JSON.stringify(config));

  return structuredClone(config);
}

function getPushNotificationFromSqlite(
  db: SqliteDatabase,
  taskId: string,
): PushNotificationConfig | undefined {
  return parsePushNotification(
    db
      .prepare<PushNotificationRow>('SELECT config_json FROM push_notifications WHERE task_id = ?')
      .get(taskId),
  );
}

function removePushNotificationFromSqlite(db: SqliteDatabase, taskId: string): boolean {
  const result = db.prepare('DELETE FROM push_notifications WHERE task_id = ?').run(taskId);
  return getSqliteChanges(result) > 0;
}
function deleteTaskFromSqlite(db: SqliteDatabase, taskId: string): boolean {
  db.prepare('DELETE FROM push_notifications WHERE task_id = ?').run(taskId);
  const result = db.prepare('DELETE FROM tasks WHERE id = ?').run(taskId);
  return getSqliteChanges(result) > 0;
}

function clearSqliteTaskStorage(db: SqliteDatabase): void {
  db.prepare('DELETE FROM push_notifications').run();
  db.prepare('DELETE FROM tasks').run();
}

function countSqliteTasks(db: SqliteDatabase): number {
  const row = db.prepare<{ count: number }>('SELECT COUNT(*) AS count FROM tasks').get();
  return row?.count ?? 0;
}

export class SqliteTaskStorage implements ITaskStorage {
  private readonly db: SqliteDatabase;

  constructor(path: string, databaseConstructor?: SqliteDatabaseConstructor) {
    const Database = databaseConstructor ?? loadSqliteDatabase();
    this.db = new Database(path);
    initializeSqliteTaskStorage(this.db);
  }

  insertTask(task: Task): Task {
    return insertTaskIntoSqlite(this.db, task);
  }

  getTask(taskId: string): Task | undefined {
    return getTaskFromSqlite(this.db, taskId);
  }

  saveTask(task: Task): void {
    saveTaskToSqlite(this.db, task);
  }

  getAllTasks(): Task[] {
    return getAllTasksFromSqlite(this.db);
  }

  getTasksByContextId(contextId: string): Task[] {
    return getTasksByContextIdFromSqlite(this.db, contextId);
  }

  setPushNotification(
    taskId: string,
    config: PushNotificationConfig,
  ): PushNotificationConfig | undefined {
    return setPushNotificationInSqlite(this.db, taskId, config);
  }

  getPushNotification(taskId: string): PushNotificationConfig | undefined {
    return getPushNotificationFromSqlite(this.db, taskId);
  }

  removePushNotification(taskId: string): boolean {
    return removePushNotificationFromSqlite(this.db, taskId);
  }

  deleteTask(taskId: string): boolean {
    return deleteTaskFromSqlite(this.db, taskId);
  }

  clear(): void {
    clearSqliteTaskStorage(this.db);
  }

  count(): number {
    return countSqliteTasks(this.db);
  }

  close(): void {
    this.db.close?.();
  }
}

export class AsyncSqliteTaskStorage implements AsyncTaskStorage {
  private readonly db: SqliteDatabase;
  private operationQueue: Promise<void> = Promise.resolve();
  private readonly transactionScope = new AsyncLocalStorage<boolean>();

  constructor(path: string, databaseConstructor?: SqliteDatabaseConstructor) {
    const Database = databaseConstructor ?? loadSqliteDatabase();
    this.db = new Database(path);
    initializeSqliteTaskStorage(this.db);
  }

  insertTask(task: Task): Promise<Task> {
    return this.runOperation(() => insertTaskIntoSqlite(this.db, task));
  }

  getTask(taskId: string): Promise<Task | undefined> {
    return this.runOperation(() => getTaskFromSqlite(this.db, taskId));
  }

  saveTask(task: Task): Promise<void> {
    return this.runOperation(() => saveTaskToSqlite(this.db, task));
  }

  getAllTasks(): Promise<Task[]> {
    return this.runOperation(() => getAllTasksFromSqlite(this.db));
  }

  getTasksByContextId(contextId: string): Promise<Task[]> {
    return this.runOperation(() => getTasksByContextIdFromSqlite(this.db, contextId));
  }

  setPushNotification(
    taskId: string,
    config: PushNotificationConfig,
  ): Promise<PushNotificationConfig | undefined> {
    return this.runOperation(() => setPushNotificationInSqlite(this.db, taskId, config));
  }

  removePushNotification(taskId: string): Promise<boolean> {
    return this.runOperation(() => removePushNotificationFromSqlite(this.db, taskId));
  }

  getPushNotification(taskId: string): Promise<PushNotificationConfig | undefined> {
    return this.runOperation(() => getPushNotificationFromSqlite(this.db, taskId));
  }

  deleteTask(taskId: string): Promise<boolean> {
    return this.runOperation(() => deleteTaskFromSqlite(this.db, taskId));
  }

  clear(): Promise<void> {
    return this.runOperation(() => clearSqliteTaskStorage(this.db));
  }

  count(): Promise<number> {
    return this.runOperation(() => countSqliteTasks(this.db));
  }

  transaction<T>(callback: AsyncTaskStorageTransaction<T>): Promise<T> {
    return this.runOperation(async () => {
      this.db.exec('BEGIN IMMEDIATE');
      try {
        const result = await this.transactionScope.run(true, () => callback(this));
        this.db.exec('COMMIT');
        return result;
      } catch (error) {
        this.db.exec('ROLLBACK');
        throw error;
      }
    });
  }

  close(): Promise<void> {
    return this.runOperation(() => this.db.close?.());
  }

  private runOperation<T>(operation: () => T | Promise<T>): Promise<T> {
    if (this.transactionScope.getStore()) {
      return Promise.resolve(operation());
    }

    const run = this.operationQueue.then(operation);
    this.operationQueue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }
}

function loadSqliteDatabase(): SqliteDatabaseConstructor {
  const require = createRequire(import.meta.url);
  const imported = require('better-sqlite3') as
    | SqliteDatabaseConstructor
    | { default: SqliteDatabaseConstructor };
  return 'default' in imported ? imported.default : imported;
}

function getSqliteChanges(result: unknown): number {
  if (result && typeof result === 'object' && 'changes' in result) {
    const changes = (result as { changes: unknown }).changes;
    return typeof changes === 'number' ? changes : 0;
  }
  return 0;
}
