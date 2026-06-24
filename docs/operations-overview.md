# Operations Overview

ThreadTrace exposes a compact operational overview for local console use, Web UI status panels, and future monitoring integrations. The Web system view shows the same worker lease source-shard summary as the CLI so operators can spot unhealthy source-scoped workers without opening raw JSON.

## Entry Points

CLI:

```powershell
node src/presentation/cli/threadtrace.js operations-overview
node src/presentation/cli/threadtrace.js operations-overview --source-key nga
node src/presentation/cli/threadtrace.js source-attention-report --source-key nga
```

HTTP:

```text
GET /api/operations/overview
GET /api/operations/overview?sourceKey=nga
GET /api/operations/source-drilldown?sourceId=tracked-source-nga-001
GET /api/operations/source-attention
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

The system view includes a source operations panel that combines `/api/sources/schedule`, `/api/sources/lifecycle`, and `/api/operations/runbook`. It highlights due sources, skipped/backoff reasons, disable guards, lifecycle attention items, source-scoped runbook actions, and review action audit totals. The `Source attention` section merges schedule, lifecycle, and runbook signals by source so operators can handle the highest-priority source first without mentally joining separate tables. Each lifecycle row includes an `Ops` drill-down action backed by `/api/operations/source-drilldown`, so operators can inspect one source's tasks, events, worker runs, worker leases, author queue items, review action ledger state, and next actions without opening raw JSON. Operators can run a source, run its insight pipeline, dry-run/execute enablement changes, reset failed sources, inspect review action audits, synthesize runbook notification events, filter notification events by acknowledgement, delivery status, source key, or event type, bulk-acknowledge the open events in the current filter window, and dry-run/execute handled-event archive retention from the same panel while preserving the dry-run and confirmation boundaries used by the CLI and HTTP APIs.

CLI operators can use `source-attention-report` for the same source-prioritized view in scripts or terminals. It calls the same application report as `/api/operations/source-attention`, prints source-level signals and suggested commands, exits `1` for warning attention, and exits `2` when critical source attention is present.

Runtime:

```js
runtime.getOperationalOverview({ limit: 100 })
runtime.getSourceOperationsDrilldown({ sourceId: 'tracked-source-nga-001' })
runtime.getSourceAttentionReport({ limit: 100 })
runtime.getOperationalReadiness({ limit: 100 })
runtime.getOperationsRunbook({ limit: 100 })
runtime.synthesizeRunbookNotificationEvents({ execute: false })
runtime.synthesizeContextReviewResultNotificationEvents({ execute: false })
runtime.synthesizeAuthorReviewQueueNotificationEvents({ execute: false })
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

The operations worker runs due-source work, optional review action dry-runs, optional runbook event synthesis, optional context review result event synthesis, optional author review queue event synthesis, notification event dispatch, optional handled-event archive retention, and overview logging in one non-overlapping loop. By default the source step is ingest-only and review/runbook/review-result/author-queue/archive synthesis is off. Set `--source-task-mode insight-pipeline` or `THREADTRACE_SOURCE_TASK_MODE=insight-pipeline` to run the full source insight pipeline for due sources. Set `--review-action true` to create an audited `context-review-action-apply` dry-run task during a worker run. Real review-action execution requires a runtime `contextReviewActionExecutor` port with `closeTasks` and `mergeContext`; see `docs/review-action-executor.md`. Set `--runbook-events true` to dry-run synthesis during a worker run, or `--runbook-events-execute true` to persist runbook events before dispatch. Set `--context-review-result-events true` to dry-run context review result alert synthesis during a worker run, or `--context-review-result-events-execute true` to persist `context-review-result` events before dispatch. `--source-key` / `--forum` and `--source-id` scope context review result synthesis and review-action planning to one source when supplied. Set `--author-review-queue-events true` to dry-run author queue alert synthesis during a worker run, or `--author-review-queue-events-execute true` to persist `author-review-queue` events before dispatch. Set `--archive-events true` to dry-run handled-event retention after dispatch, or `--archive-events-execute true` to archive acknowledged `delivered` / `resolved` events before the overview snapshot. Optional author queue filters include `--source-key`, `--source-thread-id`, `--author-review-queue-status`, `--author-review-queue-type`, `--author-review-queue-priority`, and `--author-review-queue-resolve-stale false`. Optional archive filters include `--source-key`, `--source-id`, `--archive-event-type`, `--archive-delivery-statuses`, `--archive-older-than-days`, `--archive-scan-limit`, and `--archive-limit`. Set `THREADTRACE_SOURCE_RUN_STALE_AFTER_MS` or `--source-run-stale-after-ms` to control stuck source-run recovery. Failed sources use exponential retry backoff by default: first retry after 60 seconds, capped at one hour. Tune this with `THREADTRACE_SOURCE_FAILURE_RETRY_BACKOFF_MS`, `THREADTRACE_SOURCE_FAILURE_MAX_RETRY_BACKOFF_MS`, `--source-failure-retry-backoff-ms`, or set the first value to `0` to disable failure backoff. This is useful for local deployments or a single background service process. Larger deployments can still run the due-source and event workers separately.

Use the worker topology plan before choosing a deployment shape:

```powershell
node src/presentation/cli/threadtrace.js worker-topology-plan
```

It reports the recommended worker commands, lease keys, intervals, current worker health, and deployment checklist status. When a source scope is supplied, the lease keys are source-scoped too, allowing different sources to run in parallel while preserving single-active execution for each source.

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
- Notification outbox overview: event counts by type, severity, delivery status, acknowledgement, source, retry exhaustion, attention samples, and recommended next action.
- Workers: recent run totals, running/stale counts, latest heartbeat time, active/expired leases, source-scoped lease counts, lease source breakdowns, and stale run samples.
- Raw pages: recent raw evidence count and latest fetch time.
- Review actions: file-audit executor record count, unique task count, planned closure/merge totals, latest audit time, adapter/action/source counts, execution-ledger totals grouped by completed/running/stale-running/failed, and stale-running execution counts by source. `sourceKey` / `forum` and `sourceId` can scope the review action audit and execution portions of the overview to one source while the broader operations snapshot stays global.
- Author review queue: durable item totals, open/high-priority counts, priority/type/source breakdowns, source hotspots, latest update time, and recent queue samples. Source hotspots let dashboards and runbooks point operators to the source whose author intelligence queue is blocking downstream automation.
- Storage mode and generation time.

The first implementation uses repository list operations with a bounded window. PostgreSQL deployments can later optimize the same use case with aggregate queries without changing API or Web contracts.

## Worker Run Records

Background workers write one durable `worker_runs` record per execution:

- `running`: run has started and should keep refreshing `heartbeatAt`.
- `completed`: run finished successfully and stores a small output summary.
- `failed`: run threw an error and stores the failure message/stack.
- `skipped`: a local non-overlap guard skipped a run because the previous one was still active.

The default stale window is five minutes. File storage writes JSON records under `worker-runs`; PostgreSQL storage uses the `worker_runs` table in `docs/postgresql-schema.sql`.

Worker run records carry a normalized `scope` derived from `sourceId`, `sourceKey`, or legacy `forum` input. `operations-overview` reports `sourceScoped`, `unscoped`, `byWorkerType`, `bySourceId`, `bySourceKey`, `runningBySourceId`, `runningBySourceKey`, `staleBySourceId`, and `staleBySourceKey`, so operators can correlate a stale worker with the source shard it was actually processing. PostgreSQL deployments store `source_id` and `source_key` as indexed columns for source-filtered run history queries.

## Worker Leases

Workers also use short-lived leases to avoid duplicate background execution across processes:

- `worker:operations`: the combined operations worker.
- `worker:due-source`: the due-source ingestion worker.
- `worker:notification-event`: the notification dispatch worker.
- `worker:<workerType>:source-id:<sourceId>`: a source-sharded worker pinned to one registered source.
- `worker:<workerType>:source-key:<sourceKey>`: a source-sharded worker pinned by source key when no source id is available.

Each run acquires its worker lease before executing, renews it between phases, and releases it at the end. If another process owns an unexpired lease, the run is skipped and recorded as `skipped` with reason `lease-held`. If a running worker cannot renew its lease because ownership changed or the lease disappeared, it fails the current `worker_runs` record with `worker_lease_lost` and stops before the next guarded phase. This prevents an old process from continuing source ingest, review actions, or notification dispatch after another worker has taken over.

`operations-overview` parses these lease keys into `scope`, `scoped`, and `expired` fields in recent lease samples. The worker lease summary also reports `sourceScoped`, `unscoped`, `byWorkerType`, `bySourceId`, `bySourceKey`, `activeBySourceId`, `activeBySourceKey`, `expiredBySourceId`, and `expiredBySourceKey`, so dashboards can distinguish a global worker outage from one unhealthy source shard.

The OpenAPI document exposes these fields through `OperationalOverview`, `WorkerRun`, `WorkerLeaseSummary`, `WorkerLease`, `SourceScope`, `TrackedSource`, `TrackedSourceListResult`, `TrackedSourceRegistrationResult`, `TrackedSourceValidationResult`, `SourceDiagnostics`, `SourceDiagnosticItem`, `SourceDiagnosticAction`, `SourceLifecycleReport`, `SourceLifecycleItem`, `SourceLifecycleMutationTaskResult`, `SourceFailureResetTaskResult`, `SourceIngestTaskResult`, `SourceInsightPipelineTaskResult`, `SourceIngestBatchTaskResult`, `SourceDueIngestBatchTaskResult`, `SourceDueInsightPipelineBatchTaskResult`, `SourceScheduleReport`, `SourceScheduleItem`, `SourceScheduleDecision`, `SourceOnboardingPreflight`, `SourceOnboardingPreflightStep`, `SourceOnboardingPreflightAction`, `SourceRolloutManifestDraft`, `ConnectorRolloutPlan`, `RolloutManifestPlan`, `ResourceProvisioningPlan`, `ResourceProvisioningItem`, `DeploymentGateReport`, `DeploymentGateItem`, `RolloutManifestApplyResult`, `RolloutManifestApplyReport`, `RolloutManifestRollbackPlan`, `TaskRecord`, `AuthorReviewQueueSummary`, `AuthorReviewQueueSourceHotspot`, `AuthorReviewQueueItem`, `OperationsRunbook`, `RunbookAction`, `NotificationEvent`, `NotificationEventListResult`, `NotificationEventDispatchResult`, `NotificationEventAckResult`, `NotificationEventAckSingleResult`, `NotificationEventArchiveResult`, `NotificationEventOverview`, `NotificationEventSourceHotspot`, `NotificationEventAttention`, `ContextReviewActionPlan`, `ContextReviewActionGate`, `ContextReviewActionAuditOverview`, `ContextReviewActionAuditListResult`, `ContextReviewActionExecutionListResult`, and `RunbookNotificationEventSynthesisResult` schemas for generated clients and external monitoring integrations.

File storage writes lease JSON under `worker-leases` for local deployments. PostgreSQL storage uses `worker_leases` and acquires leases with a conditional `on conflict` update, which is the preferred path for multi-process or multi-host deployments.

## Readiness

`operations-readiness` turns overview signals into probe-friendly status:

- `ok`: no warning or failure signals in the bounded overview window.
- `warn`: failed tasks, failed sources, failed event delivery, due notification delivery backlog, failed worker runs, expired leases, or in-flight review action executions need attention.
- `fail`: stale worker runs, failed review action executions, or stale-running review action executions indicate a likely stuck background process or downstream mutation.

The HTTP endpoint returns `503` only for `fail`; `warn` still returns `200` so dashboards can alert without forcing a service restart loop.

## Runbook

`operations-runbook` turns readiness, deployment checklist items, source diagnostics repair actions, source lifecycle signals, duplicate idempotency task records, and recent source insight pipeline failures into operator actions:

- `critical`: blocks production traffic or needs immediate investigation.
- `warning`: deployment can keep serving, but the operator should review the area.

Each action includes an area, title, evidence, a primary CLI command, and optional related commands. Runbook actions prefer the highest-leverage next step: connector issues point to `connector-rollout-plan`, source ingest configuration issues point to `source-ingest-dry-run`, source diagnostics repairs preserve the source-scoped `connector-catalog`, `adapter-diagnostics`, `source-onboarding-preflight`, `register-source`, or `enable-source` command emitted by diagnostics, worker issues point to `worker-topology-plan`, notification outbox issues point to `operations-overview`, review-result closure issues point to `review-action-gate`, review action execution ledger issues point to `review-action-executions`, and duplicate idempotency records point to `trace-context --idempotency-key`. Stale running ledger records are surfaced separately so operators can inspect blocked downstream mutations with `review-action-executions --status running`; when ledger evidence points to one source, runbook commands and action evidence include `sourceId` / `sourceKey` so operators do not accidentally inspect or replay another source's mutation window, and notification synthesis can keep ledger alerts source-isolated. Related commands keep lower-level diagnostics such as `connector-readiness`, `source-diagnostics`, `runtime-diagnostics`, `operations-readiness`, review-action dry-runs, event listing, and event dispatch close at hand.

`source-diagnostics` emits source-scoped `nextActions` with `evidenceSummary`, including missing handler, adapter, disabled-source, and handler-required location field evidence. The runbook expands those into `sourceDiagnostics.*.<sourceId>` actions with the same source id, command list, structured evidence, and compact evidence summary, while keeping the generic checklist failure for the overall readiness signal. When deployment checklist or runbook generation is filtered by `forum` / `sourceKey`, the source readiness checklist action also carries that source scope so notification events stay isolated by source. Deployment checklist summaries preserve the first action details so higher-level gates can show the broken stored source instead of only reporting a generic source readiness failure.

Source lifecycle actions reuse the `recommendedCommands` emitted by `source-lifecycle-report` when a source disable is blocked by an active run or when a failed source is still waiting for retry backoff, then append lower-level diagnostic fallbacks. If an operator has reviewed a failed source and wants to bypass the remaining backoff window, the runbook also links to `reset-source-failure --retry-now true --execute true`.

Author review queue actions point operators to `list-author-review-queue --status open`, the manual `synthesize-author-review-queue-events` command, and the operations worker author-queue event flag so queue pressure can become durable outbox notifications without duplicating delivery logic. When all open author queue pressure belongs to one source, these commands include `--source-key <source>` and the action evidence carries `openBySourceKey`, `highPriorityOpenBySourceKey`, and `sourceHotspots` so source-sharded operators do not accidentally inspect or alert on unrelated queues.

Runbook notification synthesis promotes critical and warning runbook actions into the notification outbox as `runbook-action` events. It defaults to dry-run through CLI and HTTP, uses stable IDs based on action keys plus `sourceId` / `sourceKey` scope to avoid duplicate alerts without merging different sources, preserves pending/failed delivery state when an action is refreshed, scopes stale resolution to the requested `sourceId` or `sourceKey` when provided, marks stale actions as `resolved`, reopens system-resolved actions if they return, and skips operator-acknowledged or delivered actions so operator decisions remain durable.

Author review queue notification synthesis promotes open durable author intelligence review items into the notification outbox as `author-review-queue` events. It defaults to dry-run through CLI, HTTP, Web UI, and operations-worker flags, uses stable IDs based on queue item ids, scopes stale resolution to the requested source/thread/type/priority filters, and skips operator-acknowledged or delivered events so manual decisions remain durable.
