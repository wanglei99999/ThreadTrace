# Source Lifecycle Report

The source lifecycle report is an operator view for tracked source state. It combines source records, the safe disable guard, and recent enable/disable task audit records.

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
- `blockedDisables`: sources that currently need waiting or an explicit force disable.
- `sources`: per-source lifecycle state, disable guard, failure retry plan, latest lifecycle task, and next action.
- `recentLifecycleTasks`: recent `disable-tracked-source` and `enable-tracked-source` task records.

Use this report before rollout rollback, source maintenance, or worker recovery so operators can distinguish a safe disable from an active run that should finish first.
