# Source Ingest Dry Run

Source ingest dry-run executes a source ingest handler with isolated in-memory repositories. It is meant for onboarding a new source type, connector module, or feed before registering the source or scheduling workers.

The report does not write to the configured ThreadTrace store. It can still read local input files. Handlers that fetch remote content are blocked by default and require `allowRemoteFetch=true`.

## CLI

```powershell
node src/presentation/cli/threadtrace.js source-ingest-dry-run `
  --source-key external `
  --source-type normalized-thread-json `
  --input-file D:\feeds\threadtrace\thread.json
```

For connector modules that are not installed in `THREADTRACE_CONNECTOR_MODULES`, pass `--module-path` to load the module into temporary registries for the dry-run:

```powershell
node src/presentation/cli/threadtrace.js source-ingest-dry-run `
  --source-key external `
  --source-type external-feed `
  --module-path D:\connectors\custom-forum.cjs `
  --location-file D:\connectors\location.json
```

## HTTP

```http
POST /api/sources/ingest/dry-run
content-type: application/json

{
  "sourceKey": "external",
  "sourceType": "normalized-thread-json",
  "inputFile": "D:/feeds/threadtrace/thread.json"
}
```

## Result Shape

```json
{
  "dryRun": true,
  "status": "ok",
  "thread": {
    "sourceKey": "external",
    "sourceThreadId": "external-thread-1",
    "postCount": 12
  },
  "repositoryWrites": {
    "threadSnapshots": 1,
    "reports": 1,
    "tasks": 3,
    "rawThreadPages": 0
  }
}
```

`repositoryWrites` counts writes made to isolated in-memory repositories. It is proof that the handler reached the expected persistence points without mutating the configured durable store.

