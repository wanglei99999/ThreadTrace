# Source Registration Preflight

ThreadTrace supports a source registration preflight so UI, CLI, or external automation can validate a source draft before saving it.

## HTTP Entry

```http
POST /api/sources/validate
content-type: application/json
```

```json
{
  "forum": "nga",
  "sourceType": "saved-html-directory",
  "displayName": "NGA sample archive",
  "inputDir": "D:/Coding/GitCoding/ThreadTrace/example",
  "now": "2026-06-19T10:00:00.000Z"
}
```

The response is a report, not a persisted source:

```json
{
  "generatedAt": "2026-06-19T10:00:00.000Z",
  "valid": true,
  "status": "ok",
  "source": {
    "id": "nga-saved-html-directory-...",
    "sourceKey": "nga",
    "sourceType": "saved-html-directory"
  },
  "checks": [
    {
      "key": "source.handler",
      "status": "ok",
      "summary": "Tracked source type has an ingest handler."
    }
  ]
}
```

For connector bridges that already produce canonical ThreadTrace snapshots, use `normalized-thread-json`:

```json
{
  "forum": "external",
  "sourceType": "normalized-thread-json",
  "displayName": "External normalized feed",
  "location": {
    "inputFile": "D:/feeds/threadtrace/thread.json"
  }
}
```

## Result Semantics

- `valid` means the draft can be accepted by source registration rules.
- `status` is ingest readiness: `ok`, `warn`, or `fail`.
- `checks` explains handler, location, enabled state, and adapter readiness.
- `error` is present when registration rules reject the draft.

`allowUnknownSourceType=true` can make `valid=true` for staged migrations, while `status` may still be `fail` because no ingest handler is registered yet. This lets operators save future source definitions deliberately without pretending they are runnable.

## Onboarding Flow

1. Add or select a source ingest handler from `GET /api/connectors/catalog`.
2. Call `POST /api/sources/validate` with the draft location and schedule.
3. Fix any `error.code` or failed `checks`.
4. Call `POST /api/sources` only after the draft is acceptable for the intended rollout stage.
5. Use `GET /api/sources/diagnostics` after saving to verify stored source readiness across the fleet.
