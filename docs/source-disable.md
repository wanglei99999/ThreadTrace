# Source Disable

Source disable is the safe rollback operation for a tracked source. It never deletes source records, snapshots, reports, tasks, raw pages, or notification events. It only sets `enabled=false` on the tracked source.

The operation is safe by default: CLI and HTTP entrypoints run in dry-run mode unless execution is explicitly enabled.

## CLI

Dry-run:

```powershell
node src/presentation/cli/threadtrace.js disable-source --source-id <id>
```

Execute:

```powershell
node src/presentation/cli/threadtrace.js disable-source --source-id <id> --execute true
```

## HTTP

```text
POST /api/sources/{sourceId}/disable
```

Request:

```json
{
  "execute": false
}
```

Set `execute: true` or `dryRun: false` to save the disabled source.

## Audit Trail

The entrypoints create a durable task record with type `disable-tracked-source`.

Query recent disable operations:

```powershell
node src/presentation/cli/threadtrace.js list-tasks --type disable-tracked-source
```

Correlate a disable request:

```powershell
node src/presentation/cli/threadtrace.js trace-context --request-id <request-id>
node src/presentation/cli/threadtrace.js trace-context --idempotency-key <key>
```
