# Operations Overview

ThreadTrace exposes a compact operational overview for local console use, Web UI status panels, and future monitoring integrations.

## Entry Points

CLI:

```powershell
node src/presentation/cli/threadtrace.js operations-overview
```

HTTP:

```text
GET /api/operations/overview
```

Runtime:

```js
runtime.getOperationalOverview({ limit: 100 })
```

Combined worker:

```powershell
npm run worker:operations-once
npm run worker:operations-loop
```

The operations worker runs due-source ingestion, notification event dispatch, and overview logging in one non-overlapping loop. It is useful for local deployments or a single background service process. Larger deployments can still run the due-source and event workers separately.

## Included Signals

- Sources: total, enabled, disabled, due, running, failed, and due source samples.
- Tasks: recent task totals grouped by status and last failure.
- Events: pending, failed, unacknowledged, delivery-due count, and next delivery time.
- Workers: recent run totals, running/stale counts, latest heartbeat time, and stale run samples.
- Raw pages: recent raw evidence count and latest fetch time.
- Storage mode and generation time.

The first implementation uses repository list operations with a bounded window. PostgreSQL deployments can later optimize the same use case with aggregate queries without changing API or Web contracts.

## Worker Run Records

Background workers write one durable `worker_runs` record per execution:

- `running`: run has started and should keep refreshing `heartbeatAt`.
- `completed`: run finished successfully and stores a small output summary.
- `failed`: run threw an error and stores the failure message/stack.
- `skipped`: a local non-overlap guard skipped a run because the previous one was still active.

The default stale window is five minutes. File storage writes JSON records under `worker-runs`; PostgreSQL storage uses the `worker_runs` table in `docs/postgresql-schema.sql`.
