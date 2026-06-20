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
GET /api/operations/readiness
GET /api/operations/trace-context
GET /api/operations/runbook
POST /api/operations/runbook/events
POST /api/operations/rollout-manifest-plan
POST /api/operations/resource-provisioning-plan
POST /api/deployment/gate
POST /api/operations/rollout-manifest/apply
GET /api/sources/schedule
GET /api/sources/lifecycle
GET /api/runtime/diagnostics
```

Web UI:

The system view includes a source operations panel that combines `/api/sources/schedule`, `/api/sources/lifecycle`, and `/api/operations/runbook`. It highlights due sources, skipped/backoff reasons, disable guards, lifecycle attention items, and source-scoped runbook actions. Operators can run a source, run its insight pipeline, dry-run/execute enablement changes, reset failed sources, synthesize runbook notification events, and filter notification events by acknowledgement, delivery status, or event type from the same panel while preserving the dry-run and confirmation boundaries used by the CLI and HTTP APIs.

Runtime:

```js
runtime.getOperationalOverview({ limit: 100 })
runtime.getOperationalReadiness({ limit: 100 })
runtime.getOperationsRunbook({ limit: 100 })
runtime.synthesizeRunbookNotificationEvents({ execute: false })
runtime.getRolloutManifestPlan({ manifest })
runtime.getResourceProvisioningPlan({ manifest })
runtime.getDeploymentGateReport({ manifest })
runtime.applyRolloutManifest({ manifest, execute: false })
```

Combined worker:

```powershell
npm run worker:operations-once
npm run worker:operations-loop
```

The operations worker runs due-source work, optional runbook event synthesis, notification event dispatch, and overview logging in one non-overlapping loop. By default the source step is ingest-only and runbook synthesis is off. Set `--source-task-mode insight-pipeline` or `THREADTRACE_SOURCE_TASK_MODE=insight-pipeline` to run the full source insight pipeline for due sources. Set `--runbook-events true` to dry-run synthesis during a worker run, or `--runbook-events-execute true` to persist runbook events before dispatch. Set `THREADTRACE_SOURCE_RUN_STALE_AFTER_MS` or `--source-run-stale-after-ms` to control stuck source-run recovery. Failed sources use exponential retry backoff by default: first retry after 60 seconds, capped at one hour. Tune this with `THREADTRACE_SOURCE_FAILURE_RETRY_BACKOFF_MS`, `THREADTRACE_SOURCE_FAILURE_MAX_RETRY_BACKOFF_MS`, `--source-failure-retry-backoff-ms`, or set the first value to `0` to disable failure backoff. This is useful for local deployments or a single background service process. Larger deployments can still run the due-source and event workers separately.

Use the worker topology plan before choosing a deployment shape:

```powershell
node src/presentation/cli/threadtrace.js worker-topology-plan
```

It reports the recommended worker commands, lease keys, intervals, current worker health, and deployment checklist status.

Use a rollout manifest to evaluate source onboarding, optional connector module validation, source ingest dry-run, and worker topology from one repeatable JSON input:

```powershell
node src/presentation/cli/threadtrace.js rollout-manifest-plan --manifest-file <file>
```

See `docs/rollout-manifest-plan.md` for the manifest contract.

Use the resource provisioning plan to turn runtime diagnostics and an optional rollout manifest into a concrete infrastructure checklist:

```powershell
node src/presentation/cli/threadtrace.js resource-provisioning-plan --manifest-file docs/examples/rollout-manifest.sample.json
```

See `docs/resource-provisioning-plan.md` for database, worker, notification, LLM, and connector module preparation notes.

Use the deployment gate as the highest-level preflight before production rollout:

```powershell
node src/presentation/cli/threadtrace.js deployment-gate --manifest-file docs/examples/rollout-manifest.sample.json
```

See `docs/deployment-gate.md` for the gate contract and CI/CD behavior.

Use rollout manifest apply to safely move from planning to source registration. It defaults to dry-run and only writes when `--execute true` is provided:

```powershell
node src/presentation/cli/threadtrace.js rollout-manifest-apply --manifest-file docs/examples/rollout-manifest.sample.json
```

See `docs/rollout-manifest-apply.md` for the apply contract.

## Included Signals

- Sources: total, enabled, disabled, due, running, failed, and due source samples.
- Tasks: recent task totals grouped by status and last failure.
- Events: unacknowledged pending/failed delivery counts, total unacknowledged events, delivery-due count, and next delivery time.
- Workers: recent run totals, running/stale counts, latest heartbeat time, active/expired leases, and stale run samples.
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

## Worker Leases

Workers also use short-lived leases to avoid duplicate background execution across processes:

- `worker:operations`: the combined operations worker.
- `worker:due-source`: the due-source ingestion worker.
- `worker:notification-event`: the notification dispatch worker.

Each run acquires its worker lease before executing, renews it between phases, and releases it at the end. If another process owns an unexpired lease, the run is skipped and recorded as `skipped` with reason `lease-held`.

File storage writes lease JSON under `worker-leases` for local deployments. PostgreSQL storage uses `worker_leases` and acquires leases with a conditional `on conflict` update, which is the preferred path for multi-process or multi-host deployments.

## Readiness

`operations-readiness` turns overview signals into probe-friendly status:

- `ok`: no warning or failure signals in the bounded overview window.
- `warn`: failed tasks, failed sources, failed event delivery, due notification delivery backlog, failed worker runs, or expired leases need attention.
- `fail`: stale worker runs indicate a likely stuck background process.

The HTTP endpoint returns `503` only for `fail`; `warn` still returns `200` so dashboards can alert without forcing a service restart loop.

## Runbook

`operations-runbook` turns readiness, deployment checklist items, source lifecycle signals, duplicate idempotency task records, and recent source insight pipeline failures into operator actions:

- `critical`: blocks production traffic or needs immediate investigation.
- `warning`: deployment can keep serving, but the operator should review the area.

Each action includes an area, title, evidence, a primary CLI command, and optional related commands. Runbook actions prefer the highest-leverage next step: connector issues point to `connector-rollout-plan`, source ingest configuration issues point to `source-ingest-dry-run`, worker issues point to `worker-topology-plan`, notification outbox issues point to `operations-overview`, and duplicate idempotency records point to `trace-context --idempotency-key`. Related commands keep lower-level diagnostics such as `connector-readiness`, `source-diagnostics`, `runtime-diagnostics`, `operations-readiness`, event listing, and event dispatch close at hand.

Source lifecycle actions point operators to `source-lifecycle-report` when a source disable is blocked by an active run or when a failed source is still waiting for retry backoff. If an operator has reviewed a failed source and wants to bypass the remaining backoff window, the runbook also links to `reset-source-failure --retry-now true --execute true`.

Runbook notification synthesis promotes critical and warning runbook actions into the notification outbox as `runbook-action` events. It defaults to dry-run through CLI and HTTP, uses stable IDs based on action keys to avoid duplicate alerts, preserves pending/failed delivery state when an action is refreshed, marks stale actions as `resolved`, reopens system-resolved actions if they return, and skips operator-acknowledged or delivered actions so operator decisions remain durable.
