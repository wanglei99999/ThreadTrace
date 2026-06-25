# Source Schedule Report

The source schedule report previews due-source decisions without running ingest workers or writing task records. It is useful before enabling new connectors, changing worker intervals, or investigating why a source did or did not run.

## CLI

```powershell
node src/presentation/cli/threadtrace.js source-schedule-report
node src/presentation/cli/threadtrace.js source-schedule-report --forum nga --now 2026-06-19T10:00:00.000Z
node src/presentation/cli/threadtrace.js source-schedule-report --source-failure-retry-backoff-ms 60000
```

## HTTP

```text
GET /api/sources/schedule
```

Query parameters:

- `forum` / `sourceKey`: filter sources by source key.
- `enabled`: filter `true` or `false`.
- `limit`: source window size.
- `sourceRunStaleAfterMs`: running-source stale window used for stale run recovery preview.
- `sourceFailureRetryBackoffMs`: first retry delay after a failed source run.
- `sourceFailureMaxRetryBackoffMs`: maximum retry delay for exponential failure backoff.
- `now`: fixed time for repeatable checks.

The response includes `summary.byReason`, `dueSources`, `skippedSources`, and per-source decisions with `reason`, `nextRunAt`, `retryAt`, `failureCount`, and `backoffMs`.

Each source also includes `collectionPlan`, a stable operator-facing summary of the ingest loop: collection status, source strategy (`local-archive`, `online-thread`, `external-normalized-feed`, or custom), schedule decision, cursor watermark, last cursor diff, last run error/task, replay evidence, and recommended commands. This lets dashboards explain whether a source is due, retry-waiting, unscheduled, or ready to replay without recomputing state from raw source records.
