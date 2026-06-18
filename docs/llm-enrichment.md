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
```

HTTP:

```text
POST /api/enrich-directory
```

Runtime:

```js
runtime.enrichDirectory({ forum: 'nga', inputDir: 'example', provider: 'mock' })
```

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
- A real provider should implement the same port and return the same JSON shape.
- Provider-specific credentials, model names, retry logic, and rate limits belong in infrastructure, not domain or application use cases.
