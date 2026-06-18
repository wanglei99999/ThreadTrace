# Runtime Configuration

ThreadTrace centralizes process configuration in `src/runtime/threadTraceConfig.js`.

The goal is to keep deployment choices out of business use cases. CLI, HTTP, workers, and the runtime composition root should all consume the same normalized config object.

Process entry points load a local `.env` file from the current working directory before creating the runtime config. Existing process environment values win by default, so production deployment variables are not overwritten by a checked-out local file.

## Core Values

| Variable | Default | Purpose |
| --- | --- | --- |
| `THREADTRACE_DEFAULT_FORUM` | `nga` | Default forum/source key for local commands. |
| `THREADTRACE_EXAMPLE_DIR` | `example` | Default saved HTML input directory. |
| `THREADTRACE_STORE_DIR` | `data/store` | File-store root for durable local records. |
| `THREADTRACE_STORAGE` | `file` | Storage backend. Supported: `file`, `postgres`. |
| `THREADTRACE_HTTP_HOST` | `127.0.0.1` | HTTP server bind host. |
| `THREADTRACE_HTTP_PORT` | `3017` | HTTP server port. `PORT` is also accepted. |

## Workers

| Variable | Default | Purpose |
| --- | --- | --- |
| `THREADTRACE_SOURCE_TASK_MODE` | `ingest` | Due-source worker mode. Supported: `ingest`, `insight-pipeline`. |
| `THREADTRACE_WORKER_INTERVAL_MS` | `300000` | Due-source worker loop interval. |
| `THREADTRACE_OPERATIONS_WORKER_INTERVAL_MS` | `60000` | Combined operations worker loop interval. |
| `THREADTRACE_EVENT_WORKER_INTERVAL_MS` | `60000` | Notification event worker loop interval. |
| `THREADTRACE_WORKER_LEASE_TTL_MS` | `300000` | Cross-process worker lease TTL. |

Use `THREADTRACE_SOURCE_TASK_MODE=insight-pipeline` when background workers should run tracked source ingest plus semantic enrichment for due sources.

## LLM

| Variable | Default | Purpose |
| --- | --- | --- |
| `THREADTRACE_LLM_PROVIDER` | `mock` | Provider key. Supported: `mock`, `openai-compatible`, `openai`. |
| `THREADTRACE_LLM_BASE_URL` |  | OpenAI-compatible base URL. |
| `THREADTRACE_LLM_API_KEY` |  | Provider API key. `OPENAI_API_KEY` is also accepted by the provider. |
| `THREADTRACE_LLM_MODEL` |  | Provider model name. |
| `THREADTRACE_LLM_TIMEOUT_MS` |  | Provider timeout. |

## Notifications

| Variable | Default | Purpose |
| --- | --- | --- |
| `THREADTRACE_WEBHOOK_URL` |  | Default webhook URL for notification dispatch. |

## PostgreSQL

PostgreSQL config is still implemented in `src/infrastructure/postgres/postgresConfig.js`; the runtime config selects `THREADTRACE_STORAGE=postgres`, while the PostgreSQL adapter reads:

- `THREADTRACE_DATABASE_URL` or `DATABASE_URL`
- `THREADTRACE_POSTGRES_HOST`
- `THREADTRACE_POSTGRES_PORT`
- `THREADTRACE_POSTGRES_DATABASE`
- `THREADTRACE_POSTGRES_USER`
- `THREADTRACE_POSTGRES_PASSWORD`
- `THREADTRACE_POSTGRES_POOL_MAX`
- `THREADTRACE_POSTGRES_SSL`

## Entry Points

These entry points now consume the normalized runtime config:

- `src/runtime/threadTraceRuntime.js`
- `src/presentation/cli/threadtrace.js`
- `src/presentation/http/server.js`
- `src/presentation/worker/dueSourceWorkerMain.js`
- `src/presentation/worker/operationsWorkerMain.js`
- `src/presentation/worker/notificationEventWorkerMain.js`

Application use cases continue to receive explicit ports and options; they do not read environment variables directly.

## Diagnostics

Runtime diagnostics expose a redacted configuration summary, configuration checks, and local resource checks:

```powershell
node src/presentation/cli/threadtrace.js runtime-diagnostics
```

```text
GET /api/runtime/diagnostics
```

Diagnostics intentionally expose booleans such as `apiKeyConfigured`; they do not return secret values.

In file storage mode, diagnostics verify:

- default input directory readability
- store directory writability

In PostgreSQL mode, diagnostics create or use the configured PostgreSQL client, run a lightweight `select 1 as ok` ping, and verify the required ThreadTrace tables exist in `public`. Missing client configuration, missing `pg`, connection errors, or missing schema tables are reported as `fail` resource checks so readiness probes can block traffic before workers start writing production data.
