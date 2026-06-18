# Source Disable and Enable

Source disable is the safe rollback operation for a tracked source. Source enable is the matching recovery operation. Neither operation deletes source records, snapshots, reports, tasks, raw pages, or notification events; they only change the tracked source `enabled` flag.

The operation is safe by default: CLI and HTTP entrypoints run in dry-run mode unless execution is explicitly enabled.

## CLI

Disable dry-run:

```powershell
node src/presentation/cli/threadtrace.js disable-source --source-id <id>
```

Disable execute:

```powershell
node src/presentation/cli/threadtrace.js disable-source --source-id <id> --execute true
```

Enable dry-run:

```powershell
node src/presentation/cli/threadtrace.js enable-source --source-id <id>
```

Enable execute:

```powershell
node src/presentation/cli/threadtrace.js enable-source --source-id <id> --execute true
```

## HTTP

```text
POST /api/sources/{sourceId}/disable
POST /api/sources/{sourceId}/enable
```

Request:

```json
{
  "execute": false
}
```

Set `execute: true` or `dryRun: false` to save the disabled source.

## Audit Trail

The entrypoints create durable task records with type `disable-tracked-source` or `enable-tracked-source`.

Query recent lifecycle operations:

```powershell
node src/presentation/cli/threadtrace.js list-tasks --type disable-tracked-source
node src/presentation/cli/threadtrace.js list-tasks --type enable-tracked-source
```

Correlate a disable request:

```powershell
node src/presentation/cli/threadtrace.js trace-context --request-id <request-id>
node src/presentation/cli/threadtrace.js trace-context --idempotency-key <key>
```
