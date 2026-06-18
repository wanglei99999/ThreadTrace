# Deployment Checklist

ThreadTrace exposes a deployment checklist as a runnable readiness contract. It aggregates existing diagnostics instead of inventing a separate deployment state:

- runtime configuration and secret redaction
- forum adapter registry contracts
- source connector catalog, modules, and adapter coverage
- storage resource checks
- notification channel configuration
- tracked source ingest configuration
- worker readiness and lease health
- notification outbox delivery health
- LLM provider configuration

## Entrypoints

```powershell
node src/presentation/cli/threadtrace.js deployment-checklist --store-dir data/store
```

```text
GET /api/deployment/checklist
```

The checklist returns `ok`, `warn`, or `fail`. HTTP returns `503` when the checklist is `fail`, while still returning the full response body for operators and deployment scripts.

## Checklist Items

| Key | Area | Evidence |
| --- | --- | --- |
| `runtime.configuration` | runtime | Redacted runtime diagnostics are available. |
| `resources.storage` | resources | File store paths, PostgreSQL ping checks, and required PostgreSQL tables. |
| `adapters.contract` | adapters | Forum adapters resolve from the registry and implement parser contracts. |
| `connectors.readiness` | connectors | Source connector catalog, module load errors, adapter coverage, and configured source counts. |
| `sources.ingestConfiguration` | sources | Source locations, ingest handlers, and adapters. |
| `workers.readiness` | workers | Stale/failed worker runs and expired leases. |
| `notifications.channel` | notifications | File delivery directory or webhook URL configuration. |
| `notifications.outbox` | notifications | Recent notification delivery failures. |
| `llm.configuration` | llm | Provider-specific LLM configuration checks. |

## Resource Preparation

Before production traffic, prepare the resources below and use the checklist as the common validation point:

- PostgreSQL: set `THREADTRACE_STORAGE=postgres`, provide `THREADTRACE_DATABASE_URL` or host-based variables, and apply `docs/postgresql-schema.sql`.
- Workers: run either the combined operations worker or separate due-source and notification workers.
- LLM: keep `mock` for local smoke tests, then configure provider, model, and API key for real enrichment.
- Notifications: start with file outbox delivery and run `notification-diagnostics`; then add a webhook or future channel when an external receiver is ready.
- Sources: run `connector-readiness` before registration, then `source-diagnostics` after registering each new forum/source integration.
