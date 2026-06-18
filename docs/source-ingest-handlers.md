# Source Ingest Handlers

ThreadTrace separates tracked-source lifecycle from source-specific ingest behavior.

`runTrackedSourceIngestTask` owns:

- source lookup and enabled-state validation
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

## Diagnostics

Tracked source diagnostics verify that each registered source has:

- a usable `location` for its `sourceType`
- a matching `SourceIngestHandler`
- a registered forum adapter when the handler requires one

```text
runtime.diagnoseSources()
GET /api/sources/diagnostics
```

Forum-HTML handlers should use `requiresAdapter: true` and consume `context.adapter`. API-native, queue-native, or already-normalized sources can use `requiresAdapter: false` and return a canonical `ThreadSnapshot` directly.

This keeps future integrations such as other forums, RSS-like sources, webhook submissions, or database-backed sources out of the tracked-source lifecycle code.
