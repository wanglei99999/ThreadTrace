# Notification Outbox

ThreadTrace uses a notification outbox to decouple forum/source ingestion from user-facing delivery channels. Ingestion creates durable events, and delivery workers dispatch those events later through file, webhook, or future channels such as mail, IM, queues, or database-backed jobs.

## Event Lifecycle

1. Source ingestion detects a cursor change and writes a `source-changed` event.
2. Operations runbook synthesis can turn critical or warning operator actions into stable `runbook-action` events.
3. Source attention synthesis can turn high-priority source health, schedule, lifecycle, and runbook signals into stable `source-attention` events.
4. Review workflows can turn attention-worthy `context-review-result` records and open `author-review-queue` items into stable outbox events.
4. New events start with:
   - `deliveryStatus: "pending"`
   - `deliveryAttempts: 0`
   - `nextDeliveryAt: createdAt`
5. `dispatchPendingNotificationEvents` loads due, unacknowledged `pending` and `failed` events.
6. Successful delivery changes the event to:
   - `deliveryStatus: "delivered"`
   - `lastDeliveredAt`
   - `nextDeliveryAt: undefined`
7. Failed delivery changes the event to:
   - `deliveryStatus: "failed"`
   - `deliveryAttempts + 1`
   - `lastDeliveryAttemptAt`
   - `lastDeliveryError`
   - `nextDeliveryAt`, unless max attempts have been exhausted.
8. Runbook, source attention, and author review queue synthesis can close stale system-owned events when the underlying action, source attention item, or queue item is no longer active:
   - `deliveryStatus: "resolved"`
   - `acknowledgedBy: "runbook-synthesizer"`, `"source-attention-synthesizer"`, or `"author-review-queue-synthesizer"`
   - `nextDeliveryAt: undefined`

Acknowledgement is separate from delivery. A delivered event can still be unacknowledged in the UI, and an acknowledged event remains queryable for audit/history. Dispatch workers do not deliver acknowledged events.

## Retry Policy

The application layer owns retry scheduling so every storage implementation follows the same behavior.

- Default max attempts: `3`
- Default first retry delay: `60000 ms`
- Default max retry delay: `3600000 ms`
- Backoff: `retryBackoffMs * 2 ^ (attemptsAfterFailure - 1)`, capped by `maxRetryBackoffMs`

Repositories may filter by `dueBefore` for efficiency. The use case also checks `nextDeliveryAt`, so a simple repository implementation remains correct.

## Runtime Entrypoints

Manual one-shot dispatch:

```powershell
node src/presentation/cli/threadtrace.js notification-diagnostics --channel file
node src/presentation/cli/threadtrace.js notification-diagnostics --channel webhook --webhook-url http://127.0.0.1:9000/threadtrace-events
node src/presentation/cli/threadtrace.js synthesize-runbook-events
node src/presentation/cli/threadtrace.js synthesize-runbook-events --execute true
node src/presentation/cli/threadtrace.js synthesize-source-attention-events
node src/presentation/cli/threadtrace.js synthesize-source-attention-events --execute true --source-key nga
node src/presentation/cli/threadtrace.js notification-synthesis-policy --json true
node src/presentation/cli/threadtrace.js synthesize-context-review-result-events
node src/presentation/cli/threadtrace.js synthesize-context-review-result-events --execute true --source-key nga
node src/presentation/cli/threadtrace.js synthesize-author-review-queue-events
node src/presentation/cli/threadtrace.js synthesize-author-review-queue-events --execute true --source-key nga
node src/presentation/cli/threadtrace.js dispatch-events --channel file
node src/presentation/cli/threadtrace.js dispatch-events --channel webhook --webhook-url http://127.0.0.1:9000/threadtrace-events
node src/presentation/cli/threadtrace.js dispatch-events --source-key nga --channel file
node src/presentation/cli/threadtrace.js ack-events --delivery-status delivered --dry-run true
node src/presentation/cli/threadtrace.js ack-events --source-key nga --delivery-status delivered --dry-run true
node src/presentation/cli/threadtrace.js ack-events --source-key nga --delivery-status delivered --execute true --by operator
node src/presentation/cli/threadtrace.js archive-events --source-key nga
node src/presentation/cli/threadtrace.js archive-events --source-key nga --execute true --by operator
```

Worker mode:

```powershell
npm run worker:events-once
npm run worker:events-loop
npm run worker:events-loop -- --source-key nga
npm run worker:operations-once -- --runbook-events true
npm run worker:operations-loop -- --runbook-events-execute true
npm run worker:operations-once -- --source-attention-events true
npm run worker:operations-loop -- --source-attention-events-execute true --source-key nga
npm run worker:operations-once -- --context-review-result-events true
npm run worker:operations-loop -- --context-review-result-events-execute true --source-key nga
npm run worker:operations-once -- --author-review-queue-events true
npm run worker:operations-loop -- --author-review-queue-events-execute true --source-key nga
npm run worker:operations-once -- --archive-events true --source-key nga
npm run worker:operations-loop -- --archive-events-execute true --source-key nga
```

HTTP:

```text
POST /api/operations/runbook/events
POST /api/operations/source-attention/events
GET /api/events/synthesis-policy
POST /api/context-review-results/events
POST /api/intelligence/author-review-queue/events
GET /api/events/overview
POST /api/events/dispatch {"sourceKey":"nga"}
POST /api/events/ack
POST /api/events/archive
```

`synthesize-runbook-events`, `synthesize-source-attention-events`, `synthesize-context-review-result-events`, `synthesize-author-review-queue-events`, `POST /api/operations/runbook/events`, `POST /api/operations/source-attention/events`, `POST /api/context-review-results/events`, and `POST /api/intelligence/author-review-queue/events` default to dry-run. Set `--execute true` or request body `{"execute": true}` to persist events into the outbox. Stable event IDs are derived from the runbook action key, source attention key plus source scope, source-scoped context review result record id, or durable author queue item id, so repeated synthesis updates pending/failed events without duplicating alerts or crossing sources. Source attention synthesis supports `sourceId`, `sourceKey` / `forum`, `attentionLimit`, and `priorityScoreThreshold`; it alerts on critical/warning attention and on lower-severity items whose priority score crosses the threshold. Context review result synthesis supports `sourceId` and `sourceKey` / `forum` filters and generated events carry that scope when the record, result payload, or trace contains it. Stale runbook, source attention, and author queue events are marked `resolved` when the underlying action, source attention item, or queue item disappears, and system-resolved events reopen as `pending` if the same signal returns. Operator-acknowledged or already delivered events are left untouched for audit safety.

The application layer keeps these shared notification synthesis rules in `notificationSynthesisPolicy`: `warn` is normalized to `warning`, critical/warning severity is alert-worthy, source attention can also alert by `priorityScoreThreshold`, acknowledged or delivered existing events are immutable for synthesis, refreshed pending/failed events preserve delivery attempts and retry state, source-scoped stale resolution only touches matching source events, and created/updated/resolved/reopened/skipped counters use one status policy. Individual synthesis use cases still own their domain-specific inputs, stable event ids, stale-resolution acknowledgement text, and recommended next actions.

Use `notification-synthesis-policy`, `GET /api/events/synthesis-policy`, or the Web console notification outbox panel to inspect the active defaults and per-event-type synthesis rules. The report is read-only and exists so operators, generated clients, and Web panels can understand why an item will or will not become an outbox event before running execute mode.

Use `dispatch-events`, `POST /api/events/dispatch`, `worker:events-*`, or the operations worker dispatch step with `sourceId` / `sourceKey` / `forum` when running source-scoped delivery. The dispatch use case applies that scope to both pending and failed retry queries, so a worker assigned to one source does not deliver another source's outbox events. PostgreSQL deployments should apply `docs/postgresql-schema.sql` after upgrading; the baseline includes partial dispatch indexes for active, unacknowledged due events, plus source-id and source-key variants for split worker fleets.

`GET /api/events/overview` returns `byOpenSourceKey` and `sourceHotspots` in addition to all-window `bySourceKey`. The Web console uses those fields to show which source owns open, due, failed, or retry-exhausted alerts, and event rows with source scope include an `Ops` action that opens the source operations drill-down.

Use `ack-events` or `POST /api/events/ack` to close handled events in bulk. Without explicit `eventIds`, bulk acknowledgement defaults to `acknowledged=false` and the requested filter window, including optional `sourceKey` / `forum`, which keeps historical acknowledged events immutable while giving operators a fast way to clear delivered or resolved alerts. The CLI and API support `dryRun=true` for acknowledgement previews; `npm run operations:ack-events` uses dry-run by default and requires `-- --execute true` to persist.

Use `archive-events`, `POST /api/events/archive`, or the operations-worker `--archive-events true` / `--archive-events-execute true` flags to keep the active outbox small after operators have handled alerts. The archive command defaults to dry-run and only targets acknowledged `delivered` or `resolved` events older than the retention window. File storage moves records into `events/_archive/YYYY-MM/`; PostgreSQL stores `archived_at`, `archived_by`, `archive_reason`, and `archive_batch_id`. Active reads hide archived events unless the caller sets `includeArchived=true`.

Useful environment variables:

- `THREADTRACE_STORE_DIR`: storage root, default `data/store`
- `THREADTRACE_EVENT_WORKER_INTERVAL_MS`: event worker polling interval, default `60000`
- `THREADTRACE_WEBHOOK_URL`: default webhook target when using the webhook channel

## Extension Notes

- PostgreSQL should store notification events as an outbox table with indexes on `delivery_status`, `next_delivery_at`, `created_at`, `source_key`, and `archived_at`. Production split-worker deployments should also keep the partial dispatch indexes from `docs/postgresql-schema.sql`: `idx_notification_events_dispatch_due`, `idx_notification_events_dispatch_source`, and `idx_notification_events_dispatch_source_key`.
- A queue-backed implementation can keep the same event schema and use the outbox as the durable source of truth.
- New channels should implement the `NotificationChannel` port and return a small `deliveryResult` object that is safe to persist.
- Runbook action, source attention, context review result, and author review queue events use the same outbox contract as source-change events, so future alert channels do not need special-case delivery logic.
