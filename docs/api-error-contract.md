# API Error Contract

ThreadTrace HTTP APIs return a stable error envelope for request validation failures, application-level conflicts, and missing resources.

```json
{
  "error": {
    "message": "Human-readable failure summary.",
    "code": "stable_machine_readable_code",
    "details": {
      "sourceId": "source-1"
    }
  }
}
```

## Client Rules

- Treat `error.code` as the primary machine-readable value.
- Treat `error.message` as display or log text only; do not parse it for control flow.
- Treat `error.details` as optional and code-specific.
- Retry `409` source run conflicts only after the current run finishes or the configured stale-run window has elapsed.
- Do not retry `400` validation errors without changing the request.
- `404 source_not_found` means the caller should refresh source state before retrying.

## Common Codes

| Code | HTTP | Meaning |
| --- | --- | --- |
| `invalid_json_body` | 400 | Request body is not valid JSON. |
| `request_body_too_large` | 413 | Request body exceeds the configured limit. |
| `interpret_text_missing_text` | 400 | `/api/interpret-text` requires `text`. |
| `semantic_enrichment_missing_source_thread_id` | 400 | Semantic enrichment requires `sourceThreadId`. |
| `crawl_page_missing_target` | 400 | `/api/crawl-page` requires `url` or `sourceId`. |
| `raw_page_ingest_missing_content_sha1` | 400 | Raw page replay requires `contentSha1`. |
| `search_missing_text` | 400 | `/api/search` requires `text`. |
| `route_not_found` | 404 | No HTTP route matched the request. |
| `source_type_unregistered` | 400 | Source registration used a source type with no registered ingest handler. |
| `source_location_invalid` | 400 | Source registration location is missing required fields for its handler. |
| `source_type_not_ingestible` | 400 | A stored source type has no ingest handler at run time. |
| `source_not_found` | 404 | The requested tracked source does not exist. |
| `source_disabled` | 409 | The tracked source exists but is disabled. |
| `source_run_already_running` | 409 | A non-stale run is already active for the source. |
| `source_run_transition_locked` | 409 | Another process is currently changing source run state. |

## Integration Notes

The OpenAPI spec at `GET /openapi.json` exposes the reusable `ErrorResponse` schema and common error response references. New API routes should use the same envelope and add a code to this catalog when the code is part of the public contract.
