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

Validation and onboarding preflight reload the module file for each run, so connector authors can edit a module and immediately re-run the check without restarting ThreadTrace.

Connector validation is stricter than a plain `require()` smoke test. It fails when a module:

- cannot be loaded
- registers no forum adapter or source ingest handler
- registers duplicate adapter `sourceKey` or handler `sourceType` values
- registers an adapter missing `sourceKey`, `displayName`, or `parseSavedHtml`
- registers a source ingest handler missing `sourceType`, `description`, `locationSchema.properties`, or `run`

The validation response includes `contractSummary` and per-check failure details so connector authors can fix the package before it is added to runtime configuration.

This repository includes a runnable external connector template:

```powershell
node src/presentation/cli/threadtrace.js validate-connector-module --module-path docs/examples/external-normalized-feed-connector.cjs
node src/presentation/cli/threadtrace.js source-ingest-dry-run --module-path docs/examples/external-normalized-feed-connector.cjs --forum external --source-type external-normalized-feed --input-file docs/examples/external-thread.sample.json
```

The template models a low-friction bridge for future forums or channels: an outside collector normalizes content into ThreadTrace's canonical `ThreadSnapshot` JSON, then a small connector module registers the source type and reuses the standard ingest pipeline.

For a full pre-release view, run the read-only connector rollout plan. It aggregates the connector contract, optional module validation, optional source onboarding preflight, current connector readiness, and deployment checklist:

```powershell
node src/presentation/cli/threadtrace.js connector-rollout-plan --module-path D:\connectors\custom-forum.cjs --source-type external-feed --location-file D:\connectors\location.json
```

```http
POST /api/connectors/rollout-plan
```

See `docs/connector-rollout-plan.md` for the full contract.

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

`/api/connectors/readiness` combines the catalog with stored source diagnostics. It reports loaded connector modules, each module's safe contract summary, each connector's handler registration, adapter coverage, configured source count, status counts, and per-source checks. The matching CLI command is:

```powershell
node src/presentation/cli/threadtrace.js connector-readiness --forum nga
```

When the runtime registers a tracked source, it validates the source type and required location fields against the handler catalog. Unknown source types are rejected by default; operators can explicitly opt into pre-registration with `allowUnknownSourceType` for migration or staged connector rollout.

## Connector Onboarding Flow

Use the same flow for built-in forums and future connectors:

1. Add or inject a `SourceIngestHandler`.
2. For external modules, run `validate-connector-module` before setting `THREADTRACE_CONNECTOR_MODULES`.
3. Use `source-onboarding-preflight --module-path ... --location-file ...` to simulate catalog, readiness, and source validation before changing runtime configuration.
4. Confirm it appears in `GET /api/connectors/catalog`.
5. Check connector readiness with `GET /api/connectors/readiness`.
6. Validate a draft source with `POST /api/sources/validate` or `node src/presentation/cli/threadtrace.js validate-source`.
7. Register the source with `POST /api/sources` only after the validation report is acceptable for the rollout stage.
8. Confirm saved-source readiness with `GET /api/sources/diagnostics`.

The validation report separates `valid` from operational readiness. A staged unknown source can be `valid=true` with `allowUnknownSourceType=true`, while diagnostics still report `status=fail` until a handler exists. This lets operators plan migrations without making a source look runnable too early.

After preflight, use source ingest dry-run to execute the handler with isolated in-memory repositories before registering or scheduling the source:

```powershell
node src/presentation/cli/threadtrace.js source-ingest-dry-run --source-type normalized-thread-json --input-file D:\feeds\threadtrace\thread.json
```

```http
POST /api/sources/ingest/dry-run
```

See `docs/source-ingest-dry-run.md` for the full report shape.

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
