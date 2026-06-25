# Store Migration

ThreadTrace can migrate durable records from a file store into another repository set. This is the bridge for moving local JSON data into PostgreSQL when deployment resources are ready.

## CLI

Dry run:

```powershell
node src/presentation/cli/threadtrace.js migrate-store --from-store-dir data/store
```

File-to-file copy:

```powershell
node src/presentation/cli/threadtrace.js migrate-store --from-store-dir data/store --to-store-dir data/store-copy --dry-run false
```

File-to-PostgreSQL:

```powershell
$env:THREADTRACE_STORAGE='postgres'
node src/presentation/cli/threadtrace.js migrate-store --from-store-dir data/store --dry-run false
```

## Migrated Records

- tracked sources
- thread snapshots
- analysis reports
- task records
- notification events
- raw thread pages
- worker run records
- review action execution ledger records
- notification event action execution ledger records

Worker leases are intentionally not migrated because they are short-lived runtime coordination records. Review action execution records and notification event action execution records are migrated so file-to-PostgreSQL cutovers preserve executor idempotency history and do not re-run completed downstream mutations.

The migration use case depends on repository ports only, so the source is currently file storage and the target can be file or PostgreSQL through runtime composition.
