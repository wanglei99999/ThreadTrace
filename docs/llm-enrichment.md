# LLM Enrichment

ThreadTrace keeps LLM work behind the `LlmProvider` port:

```js
completeStructured({ task, input, schema, traceId })
```

The application layer sends a compact, evidence-grounded report slice to the provider and expects structured JSON back. Domain parsing and rule-based analysis do not depend on any model SDK.

## Current Entry Points

CLI:

```powershell
node src/presentation/cli/threadtrace.js enrich-html-dir --forum nga --input example --provider mock
node src/presentation/cli/threadtrace.js run-semantic-enrichment-task --source-key nga --source-thread-id 45974302 --provider mock
node src/presentation/cli/threadtrace.js list-reports --source-key nga --source-thread-id 45974302 --report-type semantic-enrichment
```

HTTP:

```text
POST /api/enrich-directory
POST /api/reports/tasks/semantic-enrichment
GET /api/reports?sourceKey=nga&sourceThreadId=45974302&reportType=semantic-enrichment
```

Runtime:

```js
runtime.enrichDirectory({ forum: 'nga', inputDir: 'example', provider: 'mock' })
runtime.runSemanticEnrichmentTask({ sourceKey: 'nga', sourceThreadId: '45974302', provider: 'mock' })
runtime.listAnalysisReports({ sourceKey: 'nga', sourceThreadId: '45974302', reportType: 'semantic-enrichment' })
```

`enrichDirectory` is useful for immediate previews. `runSemanticEnrichmentTask` reads a stored `basic-history` report, writes a `semantic-enrichment` report, and records a durable `semantic-enrichment` task.

## Output Shape

The enriched report keeps the existing basic report and adds `semanticInsights`:

- `summary`
- `entityInsights`
- `opinionInsights`
- `evidenceQuestions`
- `limitations`
- `usage`

Every entity or opinion insight should include `evidenceRefs` with floor/post references or be covered by `limitations`.

## Provider Strategy

- `createMockLlmProvider` is deterministic and suitable for local tests.
- `createOpenAiCompatibleLlmProvider` calls an OpenAI-compatible `/v1/chat/completions` endpoint and expects JSON content.
- `createLlmProvider` selects `mock`, `openai-compatible`, or `openai` from explicit options or `THREADTRACE_LLM_PROVIDER`.
- Provider-specific credentials, model names, retry logic, and rate limits belong in infrastructure, not domain or application use cases.

Environment variables for real providers:

- `THREADTRACE_LLM_PROVIDER=openai-compatible`
- `THREADTRACE_LLM_BASE_URL`
- `THREADTRACE_LLM_API_KEY` or `OPENAI_API_KEY`
- `THREADTRACE_LLM_MODEL`
- `THREADTRACE_LLM_TIMEOUT_MS`
