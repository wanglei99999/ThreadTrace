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

Future handlers can be injected through:

```js
createThreadTraceRuntime({
  sourceIngestHandlerRegistry
});
```

Runtime and HTTP discovery:

```text
runtime.listSourceIngestHandlers()
GET /api/source-ingest-handlers
```

Discovery returns each handler's adapter requirement, location schema, and capability flags. UI, API clients, and future connector tooling should use this catalog instead of hard-coding required fields for each `sourceType`.

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

## Source Run Guard

Source runs reject duplicate execution while a source is already `running`. The default stale window is 10 minutes; after that, a stuck `running` state is considered recoverable and the next run can proceed. Runtime, HTTP, CLI, batch, and due-worker entrypoints may pass `sourceRunStaleAfterMs` for controlled recovery.

Storage implementations may provide `sourceRepository.acquireSourceRun(request)` to make the `running` transition atomic. File storage serializes the transition with a short-lived lock file; PostgreSQL uses a conditional update on `tracked_sources.run_state`. If a future storage backend does not implement this optional method, the application use case falls back to the portable read-check-save guard.
