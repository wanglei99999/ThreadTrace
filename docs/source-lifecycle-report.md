# Source Lifecycle Report

The source lifecycle report is an operator view for tracked source state. It combines source records, the safe disable guard, failure retry state, and recent enable/disable/failure-reset task audit records.

## CLI

```powershell
node src/presentation/cli/threadtrace.js source-lifecycle-report
node src/presentation/cli/threadtrace.js source-lifecycle-report --forum nga --source-run-stale-after-ms 600000
node src/presentation/cli/threadtrace.js source-lifecycle-report --source-failure-retry-backoff-ms 60000
```

The command exits with code `2` when a source has a non-stale running state that blocks a normal disable operation.

## HTTP

```text
GET /api/sources/lifecycle
```

Query parameters:

- `forum` / `sourceKey`: filter sources by source key.
- `enabled`: filter `true` or `false`.
- `limit`: source window size.
- `taskLimit`: lifecycle task audit scan window.
- `sourceRunStaleAfterMs`: running-source stale window for disable guard evaluation.
- `sourceFailureRetryBackoffMs`: first retry delay after a failed source run.
- `sourceFailureMaxRetryBackoffMs`: maximum retry delay for exponential failure backoff.
- `now`: fixed time for repeatable checks.

## Report Shape

The report returns:

- `summary`: source counts, running counts, stale running counts, failure-retry-waiting counts, and disable-blocked counts.
- `blockedDisables`: sources that currently need waiting or an explicit force disable, including recommended CLI commands.
- `sources`: per-source lifecycle state, disable guard, failure retry plan, latest lifecycle task, next action, and recommended CLI commands.
- `recentLifecycleTasks`: recent `disable-tracked-source`, `enable-tracked-source`, and `reset-tracked-source-failure` task records.

Use this report before rollout rollback, source maintenance, or worker recovery so operators can distinguish a safe disable from an active run that should finish first.

The Web source operations view renders the same recommended commands as copyable command rows, keeping browser actions separate from shell execution.

When a failed source is waiting for retry backoff and an operator has reviewed the failure, use `reset-source-failure --retry-now true --execute true` or `POST /api/sources/{sourceId}/failure/reset` to clear the failure state and make the source schedulable again.
