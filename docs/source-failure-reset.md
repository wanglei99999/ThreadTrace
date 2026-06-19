# Source Failure Reset

Source failure reset is an operator maintenance action for a tracked source stuck in `runState.status=failed`. It clears the failure backoff state after an operator has reviewed the failure and wants the source to become schedulable again.

The action is safe by default: CLI and HTTP entrypoints run in dry-run mode unless execution is explicitly enabled. It does not delete source records, reports, tasks, raw pages, notification events, or cursor data.

## CLI

Dry-run:

```powershell
node src/presentation/cli/threadtrace.js reset-source-failure --source-id <id>
```

Execute and make the source due immediately:

```powershell
node src/presentation/cli/threadtrace.js reset-source-failure --source-id <id> --retry-now true --execute true --reset-by operator
```

Execute with a specific next run time:

```powershell
node src/presentation/cli/threadtrace.js reset-source-failure --source-id <id> --next-run-at 2026-06-19T10:05:00.000Z --execute true
```

## HTTP

```text
POST /api/sources/{sourceId}/failure/reset
```

Request:

```json
{
  "execute": false,
  "retryNow": true,
  "nextRunAt": "2026-06-19T10:05:00.000Z",
  "resetBy": "operator"
}
```

Set `execute: true` or `dryRun: false` to persist the updated source. `retryNow: true` sets `schedule.nextRunAt` to `now`; `nextRunAt` can be used instead for a controlled retry window.

## State Change

When the source is failed, execution updates the source to:

- `runState.status = completed`
- `runState.failureCount = 0`
- `runState.lastError = undefined`
- `runState.failureResetAt = now`
- `runState.failureResetBy = resetBy || operator`
- `schedule.nextRunAt = now` when `retryNow` is true, or to the provided `nextRunAt`

If the source is not failed, the action is idempotent and returns `changed=false` with `reason=source-not-failed`.

## Audit Trail

The entrypoints create durable task records with type `reset-tracked-source-failure`.

```powershell
node src/presentation/cli/threadtrace.js list-tasks --type reset-tracked-source-failure
node src/presentation/cli/threadtrace.js trace-context --idempotency-key <key>
```

`source-lifecycle-report` includes reset tasks in recent lifecycle audit records, and `operations-runbook` recommends this action when a failed source is waiting for retry backoff but an operator has approved an immediate retry.
