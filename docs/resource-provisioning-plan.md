# Resource Provisioning Plan

The resource provisioning plan turns runtime diagnostics and an optional rollout manifest into a concrete checklist of external resources to prepare before production traffic.

It answers: what must be provisioned, what is already locally valid, which environment variables are expected, and which command should verify or initialize each resource.

## CLI

Plan the current runtime:

```powershell
node src/presentation/cli/threadtrace.js resource-provisioning-plan
```

Plan a specific source rollout:

```powershell
node src/presentation/cli/threadtrace.js resource-provisioning-plan --manifest-file docs/examples/rollout-manifest.sample.json
```

## HTTP

```text
POST /api/operations/resource-provisioning-plan
```

The body can be a rollout manifest directly, or an object with a `manifest` property and overrides such as `storeDir`, `limit`, `now`, and `workerStaleAfterMs`.

## Planned Resources

- `storage.file` or `storage.postgres`: primary persistence, schema/bootstrap command, and storage environment variables.
- `source.*`: source-specific input path, JSON file, URL, or connector location object.
- `connectors.modules`: optional or required connector module packaging via `THREADTRACE_CONNECTOR_MODULES`.
- `workers.runtime`: worker commands, topology, leases, intervals, and source task mode.
- `reviewActions.executor`: review action execution mode, diagnostics command, audit rehearsal, and future source-truth mutation adapter.
- `notifications.channel`: file delivery for local use or webhook delivery for external alerting.
- `llm.provider`: mock/local mode for development or remote model credentials for semantic enrichment.
- `http.service`: API host and port entrypoint.

Only required resources affect the top-level status. Optional resources still appear with warnings when they are useful for production hardening.

## PostgreSQL Provisioning

When `THREADTRACE_STORAGE=postgres`, prepare:

```text
THREADTRACE_STORAGE=postgres
THREADTRACE_DATABASE_URL=postgres://...
```

Then apply the schema:

```powershell
psql "$env:THREADTRACE_DATABASE_URL" -f docs/postgresql-schema.sql
```

Run diagnostics after provisioning:

```powershell
node src/presentation/cli/threadtrace.js runtime-diagnostics
node src/presentation/cli/threadtrace.js resource-provisioning-plan --manifest-file docs/examples/rollout-manifest.sample.json
```

When runtime diagnostics can reach PostgreSQL, the provisioning plan also summarizes schema drift from `resources.postgresSchema`, `resources.postgresColumns`, and `resources.postgresIndexes`, including missing notification outbox archive columns and missing source/archive indexes. The remediation command remains the baseline schema apply step above.

## Deployment Notes

For single-node local use, file storage plus the combined operations worker is enough. For multi-host or split-worker deployments, use PostgreSQL so worker leases and source run state are coordinated across processes.

For new forums, provide the connector module path in the rollout manifest while testing, then move it into `THREADTRACE_CONNECTOR_MODULES` for production startup.
