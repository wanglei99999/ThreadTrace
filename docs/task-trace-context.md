# Task Trace Context

ThreadTrace stores lightweight trace metadata on task records so operators can connect HTTP requests, CLI runs, worker activity, and persisted task output.

Task records may include:

```json
{
  "input": {
    "_trace": {
      "requestId": "http-request-1",
      "traceId": "semantic-trace-1",
      "idempotencyKey": "client-retry-key-1"
    }
  }
}
```

## Fields

- `requestId`: request correlation id, usually from the HTTP `x-request-id` header.
- `traceId`: business or model trace id supplied by the caller, such as a semantic enrichment trace.
- `idempotencyKey`: client retry key from the HTTP `idempotency-key` header.

## Current Behavior

For explicit command-style tasks with stable inputs, ThreadTrace uses `_trace.idempotencyKey` to replay a matching completed task instead of creating and executing a duplicate task. The replay check compares the task type, idempotency key, and task input with trace metadata removed.

The first replay-enabled use cases are:

- `ingest-saved-thread-directory`
- `ingest-raw-thread-page`
- `semantic-enrichment`

Dynamic batch and scheduler-driven tasks still treat idempotency metadata as observational because their effective inputs depend on source state, due times, and worker leases.

PostgreSQL deployments should apply `docs/postgresql-schema.sql`; it includes expression indexes for `requestId`, `traceId`, and `idempotencyKey` task lookups. Runtime diagnostics report missing baseline columns as `resources.postgresColumns` and missing baseline indexes as `resources.postgresIndexes`.

## Propagation Rules

- HTTP task-triggering endpoints propagate `x-request-id` and `idempotency-key`.
- Source batch and pipeline tasks propagate trace metadata to child source ingest and semantic enrichment tasks.
- Due-source and operations workers use the `workerRun.id` as the default `traceId` for source tasks, unless the caller supplied an explicit trace id.
- CLI source task commands accept `--trace-id` for operator-driven runs.
- New task-producing use cases should call `createTaskRecord(type, input, options)` with the original request options.
- Replay-enabled use cases should call `findReusableCompletedTask(taskRepository, task)` before saving a new queued task.

## Querying Tasks

Task listings can be filtered by trace metadata:

```http
GET /api/tasks?requestId=http-request-1
GET /api/tasks?traceId=semantic-trace-1
GET /api/tasks?idempotencyKey=client-retry-key-1
```

CLI:

```powershell
node src/presentation/cli/threadtrace.js list-tasks --request-id http-request-1
node src/presentation/cli/threadtrace.js list-tasks --trace-id semantic-trace-1
node src/presentation/cli/threadtrace.js list-tasks --idempotency-key client-retry-key-1
```

For an operator-friendly summary of the correlated tasks, use:

```http
GET /api/operations/trace-context?requestId=http-request-1
GET /api/operations/trace-context?traceId=semantic-trace-1
GET /api/operations/trace-context?idempotencyKey=client-retry-key-1
```

CLI:

```powershell
node src/presentation/cli/threadtrace.js trace-context --request-id http-request-1
node src/presentation/cli/threadtrace.js trace-context --trace-id semantic-trace-1
node src/presentation/cli/threadtrace.js trace-context --idempotency-key client-retry-key-1
```

## Web

The Web workbench renders `Trace` controls on task-producing operation results such as rollout apply and source lifecycle updates when the returned task includes `_trace` metadata. The control opens the same `/api/operations/trace-context` summary in the task panel, showing correlated task counts, status/type distribution, idempotency duplicate risk, reusable completed task id, and the individual task records.

When querying by `idempotencyKey`, the response includes `summary.idempotency`. If `duplicateExecutionRisk=true`, more than one task was recorded for the same key and an operator should inspect the caller retry behavior before enabling automatic idempotent replay.
