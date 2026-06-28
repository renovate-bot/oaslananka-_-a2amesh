# Observability

A2A Mesh treats trace span names, metric names, and metric labels as a stable operational surface. Changes to the names or required attributes below must update the telemetry snapshot tests intentionally.

OpenTelemetry trace and metric instruments use the instrumentation scope `@a2amesh/runtime` with version `1.0.0`. Prometheus text endpoints remain available for local runtime and registry scraping.

## Traces

| Span name         | Surface                                                                              | Required attributes                                                                                                                                                                             |
| ----------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `a2a.handleRpc`   | Server JSON-RPC request handling.                                                    | `rpc.method`, `a2a.agent_name`                                                                                                                                                                  |
| `a2a.processTask` | Server task execution around adapter `handleTask`.                                   | `a2a.task_id`, `a2a.context_id`                                                                                                                                                                 |
| `http.request`    | Shared outbound fetch policy, including registry URL validation and polling callers. | `http.method`, `http.url`, `http.attempt`, `http.max_retries`, `http.status_code` when a response is received, plus caller-provided labels such as `a2a.registry.operation` and `a2a.transport` |

`A2AClient` RPC and streaming calls inject the active W3C trace context into outbound headers. They do not create a separate stable client span name.

## Runtime Metrics

Runtime metrics are emitted through `/metrics` as Prometheus text. The same task, SSE, auth, and duration instruments are also recorded through the OpenTelemetry metrics API when a meter provider is installed.

All runtime metric points use these labels:

| Label             | Meaning                                 |
| ----------------- | --------------------------------------- |
| `service_name`    | Agent card name used by the runtime.    |
| `service_version` | Agent card version used by the runtime. |

Stable runtime metric names:

| Metric                               | Type                  | Meaning                                                  |
| ------------------------------------ | --------------------- | -------------------------------------------------------- |
| `a2a_runtime_task_created_total`     | Counter               | Tasks created by the runtime.                            |
| `a2a_runtime_task_started_total`     | Counter               | Tasks that entered `WORKING`.                            |
| `a2a_runtime_task_completed_total`   | Counter               | Tasks that reached `COMPLETED`.                          |
| `a2a_runtime_task_failed_total`      | Counter               | Tasks that reached `FAILED`.                             |
| `a2a_runtime_task_canceled_total`    | Counter               | Tasks that reached `CANCELED`.                           |
| `a2a_runtime_auth_rejected_total`    | Counter               | Authenticated endpoint requests rejected by auth checks. |
| `a2a_runtime_sse_connections_total`  | Counter               | SSE connections opened by stream routes.                 |
| `a2a_runtime_sse_reconnect_total`    | Counter               | SSE reconnects detected by stream routes.                |
| `a2a_runtime_sse_connections_active` | Gauge / UpDownCounter | Current active SSE connections.                          |
| `a2a_runtime_tasks_active`           | Prometheus gauge      | Current active tasks from task state counts.             |
| `a2a_runtime_task_duration_ms`       | Histogram             | Terminal task duration in milliseconds.                  |

The OpenTelemetry runtime snapshot currently covers the task, auth, SSE, active SSE, and duration instruments. `a2a_runtime_tasks_active` is derived at Prometheus render time from the task manager counts.

## Registry Metrics

Registry metrics are emitted through `/metrics` as Prometheus text and through `/metrics/summary` as JSON. Registry metrics do not currently have labels.

Stable registry metric names:

| Metric                             | Type    | Meaning                                            |
| ---------------------------------- | ------- | -------------------------------------------------- |
| `a2a_registry_registrations_total` | Counter | Agent registrations accepted by the registry.      |
| `a2a_registry_searches_total`      | Counter | Registry search requests accepted by the registry. |
| `a2a_registry_heartbeats_total`    | Counter | Agent heartbeat updates accepted by the registry.  |
| `a2a_registry_agents`              | Gauge   | Known agent count.                                 |
| `a2a_registry_healthy_agents`      | Gauge   | Agents currently marked healthy.                   |
| `a2a_registry_active_tenants`      | Gauge   | Unique tenants with registered agents.             |
| `a2a_registry_public_agents`       | Gauge   | Agents visible as public.                          |

## Snapshot Tests

Telemetry snapshots live next to the package tests:

```bash
pnpm --filter @a2amesh/runtime run test -- telemetry
pnpm --filter @a2amesh/registry run test -- metrics
```

When a name, label, or required attribute changes intentionally, update the related Vitest snapshot in the same change and document the reason in the pull request.
