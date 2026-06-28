# @a2amesh/runtime

Core runtime, client APIs, auth, telemetry, storage, and middleware for A2A Mesh.

See [Compatibility](../../docs/compatibility.md) for supported Node.js, protocol, transport, package, and peer ranges.

`TaskManager` keeps the synchronous `ITaskStorage` API. `AsyncTaskManager` uses `AsyncTaskStorage` for promise-based stores and transactional task updates.

`AsyncTaskStorage.transaction(callback)` is optional but recommended for read/modify/write operations. Implementations should serialize the callback, commit on resolve, and roll back on throw or rejection. Keep external network or timer waits outside the transaction callback.

Use `SyncTaskStorageAdapter` to run an existing `ITaskStorage` implementation behind `AsyncTaskManager`.

SQLite storage is optional. Install `better-sqlite3` in the application workspace before constructing `SqliteTaskStorage` or `AsyncSqliteTaskStorage`.
