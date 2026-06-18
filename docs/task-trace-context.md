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

The metadata is observational. It does not yet deduplicate task execution. That is intentional: persisted `_trace.idempotencyKey` gives us a compatible migration path toward real idempotent command handling without changing the PostgreSQL task schema.

## Propagation Rules

- HTTP task-triggering endpoints propagate `x-request-id` and `idempotency-key`.
- Source batch and pipeline tasks propagate trace metadata to child source ingest and semantic enrichment tasks.
- CLI source task commands accept `--trace-id` for operator-driven runs.
- New task-producing use cases should call `createTaskRecord(type, input, options)` with the original request options.
