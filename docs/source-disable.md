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

Disable is guarded when the source is already running. A non-stale `runState.status=running` source returns `source_disable_running` with HTTP `409` and is not saved. The default stale window is 10 minutes.

Force disable for an operator-approved intervention:

```powershell
node src/presentation/cli/threadtrace.js disable-source --source-id <id> --execute true --force true
```

Tune stale recovery:

```powershell
node src/presentation/cli/threadtrace.js disable-source --source-id <id> --source-run-stale-after-ms 600000
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
  "execute": false,
  "force": false,
  "sourceRunStaleAfterMs": 600000
}
```

Set `execute: true` or `dryRun: false` to save the disabled source.

## Web UI

The system view's Source operations panel exposes source lifecycle controls beside each lifecycle row:

- `Enable check` / `Disable check`: create a dry-run task audit record without changing the source.
- `Enable` / `Disable`: ask for browser confirmation, then execute the lifecycle change.

Disable execution still uses the same active-run guard as CLI and HTTP. A non-stale running source returns `source_disable_running`; the Web UI does not force-disable sources.

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
node src/presentation/cli/threadtrace.js trace-context --task-id <task-id>
```
