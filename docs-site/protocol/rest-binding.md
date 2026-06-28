# A2A HTTP+JSON REST binding

A2A Mesh exposes the JSON-RPC runtime through the existing `POST /`, `POST /rpc`, and
`POST /a2a/jsonrpc` routes. It also exposes a REST-style HTTP+JSON binding for clients
that prefer resource-oriented endpoints.

## Implemented routes

| Operation                  | Method and path                                             | Runtime mapping                  |
| -------------------------- | ----------------------------------------------------------- | -------------------------------- |
| Send a message             | `POST /message:send`                                        | `message/send`                   |
| Stream a message           | `POST /message:stream`                                      | `message/stream`                 |
| Get a task                 | `GET /tasks/{taskId}`                                       | `tasks/get`                      |
| Cancel a task              | `POST /tasks/{taskId}:cancel`                               | `tasks/cancel`                   |
| Subscribe to a task stream | `GET /tasks/{taskId}:subscribe`                             | `tasks/resubscribe`              |
| Set a task push config     | `POST /tasks/{taskId}/pushNotificationConfigs`              | `tasks/pushNotification/set`     |
| List task push configs     | `GET /tasks/{taskId}/pushNotificationConfigs`               | Task manager push config lookup  |
| Get a task push config     | `GET /tasks/{taskId}/pushNotificationConfigs/{configId}`    | `tasks/pushNotification/get`     |
| Delete a task push config  | `DELETE /tasks/{taskId}/pushNotificationConfigs/{configId}` | Task manager push config removal |

The same handlers are also registered under an optional first path segment, for example
`POST /{tenant}/message:send` and `GET /{tenant}/tasks/{taskId}`. The segment is kept
for deployments that route tenants at the edge; authorization still comes from the
configured request context and middleware.

## Request and response shape

REST routes reuse the same runtime handlers as JSON-RPC. Successful unary routes return
the operation result directly instead of a JSON-RPC envelope. Streaming routes write the
same server-sent event stream as the JSON-RPC streaming method.

Push configuration creation accepts any of these body shapes:

```json
{ "config": { "url": "https://example.com/hook" } }
```

```json
{ "pushNotificationConfig": { "url": "https://example.com/hook" } }
```

```json
{ "taskPushNotificationConfig": { "url": "https://example.com/hook" } }
```

The current task manager stores one push configuration per task. Listing therefore
returns either `{ "configs": [] }` or `{ "configs": [config] }`. The `{configId}` path
segment is accepted for REST compatibility but is not yet used to address multiple
configs.

## Error mapping

REST handlers translate runtime errors to HTTP status codes:

| Runtime error                         | HTTP status |
| ------------------------------------- | ----------- |
| Invalid request or invalid params     | `400`       |
| Task not found                        | `404`       |
| Unauthorized or forbidden task access | `403`       |
| Unsupported operation                 | `501`       |
| Unexpected runtime error              | `500`       |

## Verification

The route-level contract is covered by `packages/runtime/tests/A2AServer.test.ts`, which
exercises `message:send`, task get/cancel, push config set/list/get/delete, and the
underlying storage removal path through real HTTP requests.
