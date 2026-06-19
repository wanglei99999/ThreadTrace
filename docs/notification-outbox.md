# Notification Outbox

ThreadTrace uses a notification outbox to decouple forum/source ingestion from user-facing delivery channels. Ingestion creates durable events, and delivery workers dispatch those events later through file, webhook, or future channels such as mail, IM, queues, or database-backed jobs.

## Event Lifecycle

1. Source ingestion detects a cursor change and writes a `source-changed` event.
2. Operations runbook synthesis can turn critical or warning operator actions into stable `runbook-action` events.
3. New events start with:
   - `deliveryStatus: "pending"`
   - `deliveryAttempts: 0`
   - `nextDeliveryAt: createdAt`
4. `dispatchPendingNotificationEvents` loads due, unacknowledged `pending` and `failed` events.
5. Successful delivery changes the event to:
   - `deliveryStatus: "delivered"`
   - `lastDeliveredAt`
   - `nextDeliveryAt: undefined`
6. Failed delivery changes the event to:
   - `deliveryStatus: "failed"`
   - `deliveryAttempts + 1`
   - `lastDeliveryAttemptAt`
   - `lastDeliveryError`
   - `nextDeliveryAt`, unless max attempts have been exhausted.

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
node src/presentation/cli/threadtrace.js dispatch-events --channel file
node src/presentation/cli/threadtrace.js dispatch-events --channel webhook --webhook-url http://127.0.0.1:9000/threadtrace-events
```

Worker mode:

```powershell
npm run worker:events-once
npm run worker:events-loop
npm run worker:operations-once -- --runbook-events true
npm run worker:operations-loop -- --runbook-events-execute true
```

HTTP:

```text
POST /api/operations/runbook/events
POST /api/events/dispatch
```

`synthesize-runbook-events` and `POST /api/operations/runbook/events` default to dry-run. Set `--execute true` or request body `{"execute": true}` to persist `runbook-action` events into the outbox. Stable event IDs are derived from the runbook action key, so repeated synthesis updates pending/failed events without duplicating alerts. Acknowledged or already delivered runbook events are left untouched for audit safety.

Useful environment variables:

- `THREADTRACE_STORE_DIR`: storage root, default `data/store`
- `THREADTRACE_EVENT_WORKER_INTERVAL_MS`: event worker polling interval, default `60000`
- `THREADTRACE_WEBHOOK_URL`: default webhook target when using the webhook channel

## Extension Notes

- PostgreSQL should store notification events as an outbox table with indexes on `delivery_status`, `next_delivery_at`, and `created_at`.
- A queue-backed implementation can keep the same event schema and use the outbox as the durable source of truth.
- New channels should implement the `NotificationChannel` port and return a small `deliveryResult` object that is safe to persist.
- Runbook action events use the same outbox contract as source-change events, so future alert channels do not need special-case runbook delivery logic.
