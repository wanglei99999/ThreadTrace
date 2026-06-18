# Source Insight Pipeline

The source insight pipeline is the durable application entry point for running a tracked source through ingestion and optional semantic enrichment.

It is designed for workers, HTTP clients, and operators that want one command instead of manually chaining:

1. tracked source ingest
2. base `basic-history` report persistence
3. optional `semantic-enrichment` report persistence

## Task Model

The parent task type is `source-insight-pipeline`.

Each run still creates child task records through existing use cases:

- source ingest task from the configured source ingest handler
- semantic enrichment task when enrichment runs

The parent task output records:

- `sourceId`
- `sourceKey`
- `sourceThreadId`
- `ingestTaskId`
- `cursorDiff`
- `semantic`

## Semantic Policy

Semantic enrichment is enabled by default with these defaults:

- `enabled: true`
- `skipIfUnchanged: true`
- `baseReportType: basic-history`
- `provider: mock`

When the source cursor is unchanged, the semantic step is skipped by default:

```json
{
  "status": "skipped",
  "reason": "unchanged"
}
```

This keeps repeated worker runs cheap and avoids duplicate LLM reports. Pass `semanticSkipIfUnchanged: false` when a caller needs to force a fresh semantic pass.

## CLI

```powershell
node src/presentation/cli/threadtrace.js register-source --forum nga --input example --name "NGA sample archive"
node src/presentation/cli/threadtrace.js run-source-insight-pipeline --source-id nga-saved-html-directory-d940bb6e68 --provider mock
```

Useful options:

- `--trace-id value`
- `--base-report-type basic-history`
- `--semantic-enrichment-enabled true|false`
- `--semantic-skip-if-unchanged true|false`
- `--store-dir dir`

## HTTP

```text
POST /api/sources/{sourceId}/tasks/insight-pipeline
```

Example body:

```json
{
  "provider": "mock",
  "traceId": "manual-run",
  "baseReportType": "basic-history",
  "semanticEnrichmentEnabled": true,
  "semanticSkipIfUnchanged": true
}
```

## Runtime

```js
await runtime.runSourceInsightPipelineTask({
  sourceId,
  provider: 'mock',
  traceId: 'worker-run',
  semanticEnrichmentEnabled: true,
  semanticSkipIfUnchanged: true
});
```

The runtime keeps all forum parsing and source-type behavior behind registries:

- `forumAdapterRegistry`
- `sourceIngestHandlerRegistry`
- `llmProvider`

This keeps the pipeline stable while allowing new forums, online crawlers, and provider implementations to be added behind ports.
