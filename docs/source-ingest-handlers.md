# Source Ingest Handlers

ThreadTrace separates tracked-source lifecycle from source-specific ingest behavior.

`runTrackedSourceIngestTask` owns:

- source lookup and enabled-state validation
- duplicate-run protection for active source runs
- run-state transitions
- cursor construction and cursor diffing
- source-changed notification events
- failed-run persistence

`SourceIngestHandler` owns:

- how a concrete `sourceType` is fetched or read
- how source content becomes a canonical `ThreadSnapshot`
- which task type and output summary are recorded

## Contract

```text
SourceIngestHandler
  sourceType: string
  description?: string
  requiresAdapter?: boolean
  locationSchema?: { required: string[], properties: object }
  capabilities?: object
  run(context) -> { task, threadSnapshot, report, ... }
```

Built-in handlers:

- `saved-html-directory`: reads saved forum HTML from local disk.
- `thread-url`: fetches a thread URL, stores raw HTML, parses it, and writes reports.
- `normalized-thread-json`: reads a canonical `ThreadSnapshot` JSON file and writes the same durable snapshot/report records without requiring a forum adapter.

Future handlers can be injected through:

```js
createThreadTraceRuntime({
  sourceIngestHandlerRegistry
});
```

Production-style connector packages can also be loaded by path:

```powershell
$env:THREADTRACE_CONNECTOR_MODULES="D:\connectors\custom-forum.cjs"
node src/presentation/cli/threadtrace.js connector-readiness
```

Connector modules may export `sourceIngestHandlers`, `forumAdapters`, or a `register(context)` function that calls `context.registerSourceIngestHandler(...)` and `context.registerForumAdapter(...)`.

Fetch the machine-readable connector module contract before implementing a custom package:

```powershell
node src/presentation/cli/threadtrace.js connector-module-contract
```

```http
GET /api/contracts/connector-module
```

Validate a connector module file before adding it to `THREADTRACE_CONNECTOR_MODULES`:

```powershell
node src/presentation/cli/threadtrace.js validate-connector-module --module-path D:\connectors\custom-forum.cjs
```

```http
POST /api/connectors/modules/validate
content-type: application/json

{
  "modulePath": "D:/connectors/custom-forum.cjs"
}
```

Runtime and HTTP discovery:

```text
runtime.listSourceIngestHandlers()
GET /api/source-ingest-handlers
GET /api/contracts/connector-module
POST /api/connectors/modules/validate
GET /api/connectors/catalog
GET /api/connectors/readiness
POST /api/sources/validate
```

Discovery returns each handler's adapter requirement, location schema, and capability flags. UI, API clients, and future connector tooling should use this catalog instead of hard-coding required fields for each `sourceType`.

`/api/connectors/catalog` combines source types with registered forum adapters, including `compatibleSourceKeys` for handler types that require an adapter.

`/api/connectors/readiness` combines the catalog with stored source diagnostics. It reports loaded connector modules, each connector's handler registration, adapter coverage, configured source count, status counts, and per-source checks. The matching CLI command is:

```powershell
node src/presentation/cli/threadtrace.js connector-readiness --forum nga
```

When the runtime registers a tracked source, it validates the source type and required location fields against the handler catalog. Unknown source types are rejected by default; operators can explicitly opt into pre-registration with `allowUnknownSourceType` for migration or staged connector rollout.

## Connector Onboarding Flow

Use the same flow for built-in forums and future connectors:

1. Add or inject a `SourceIngestHandler`.
2. For external modules, run `validate-connector-module` before setting `THREADTRACE_CONNECTOR_MODULES`.
3. Confirm it appears in `GET /api/connectors/catalog`.
4. Check connector readiness with `GET /api/connectors/readiness`.
5. Validate a draft source with `POST /api/sources/validate` or `node src/presentation/cli/threadtrace.js validate-source`.
6. Register the source with `POST /api/sources` only after the validation report is acceptable for the rollout stage.
7. Confirm saved-source readiness with `GET /api/sources/diagnostics`.

The validation report separates `valid` from operational readiness. A staged unknown source can be `valid=true` with `allowUnknownSourceType=true`, while diagnostics still report `status=fail` until a handler exists. This lets operators plan migrations without making a source look runnable too early.

## Diagnostics

Tracked source diagnostics verify that each registered source has:

- a usable `location` for its `sourceType`
- a matching `SourceIngestHandler`
- a registered forum adapter when the handler requires one

```text
runtime.diagnoseSources()
GET /api/sources/diagnostics
node src/presentation/cli/threadtrace.js source-diagnostics
```

Forum-HTML handlers should use `requiresAdapter: true` and consume `context.adapter`. API-native, queue-native, or already-normalized sources can use `requiresAdapter: false` and return a canonical `ThreadSnapshot` directly.

This keeps future integrations such as other forums, RSS-like sources, webhook submissions, or database-backed sources out of the tracked-source lifecycle code.

For early integrations, `normalized-thread-json` is the lowest-friction bridge: external collectors can normalize their data into ThreadTrace's canonical snapshot shape first, then let ThreadTrace handle persistence, analysis, scheduling, trace metadata, and operations visibility.

Fetch the canonical payload contract:

```powershell
node src/presentation/cli/threadtrace.js thread-snapshot-contract
```

```http
GET /api/contracts/thread-snapshot-json
```

Validate the JSON file before registering the source:

```powershell
node src/presentation/cli/threadtrace.js validate-thread-json --input-file D:\feeds\threadtrace\thread.json --forum external
```

```http
POST /api/thread-json/validate
content-type: application/json

{
  "forum": "external",
  "inputFile": "D:/feeds/threadtrace/thread.json"
}
```

The validation response includes field-level checks such as `threadJson.posts[0].sourcePostId`, so external collectors can fail fast before scheduling ingestion.

## Source Run Guard

Source runs reject duplicate execution while a source is already `running`. The default stale window is 10 minutes; after that, a stuck `running` state is considered recoverable and the next run can proceed. Runtime, HTTP, CLI, batch, and due-worker entrypoints may pass `sourceRunStaleAfterMs` for controlled recovery.

Storage implementations may provide `sourceRepository.acquireSourceRun(request)` to make the `running` transition atomic. File storage serializes the transition with a short-lived lock file; PostgreSQL uses a conditional update on `tracked_sources.run_state`. If a future storage backend does not implement this optional method, the application use case falls back to the portable read-check-save guard.
