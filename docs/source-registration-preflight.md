# Source Registration Preflight

ThreadTrace supports a source registration preflight so UI, CLI, or external automation can validate a source draft before saving it.

For a broader onboarding check, use the source onboarding preflight. It is read-only and combines connector catalog support, connector readiness, source draft validation, the ThreadSnapshot contract summary, and optional normalized JSON file validation.

```http
POST /api/sources/onboarding/preflight
content-type: application/json
```

```json
{
  "forum": "external",
  "sourceType": "normalized-thread-json",
  "displayName": "External normalized feed",
  "modulePath": "D:/connectors/custom-forum.cjs",
  "inputFile": "D:/feeds/threadtrace/thread.json",
  "now": "2026-06-19T10:00:00.000Z"
}
```

CLI equivalent:

```powershell
node src/presentation/cli/threadtrace.js source-onboarding-preflight --forum external --source-type normalized-thread-json --module-path D:/connectors/custom-forum.cjs --input-file D:/feeds/threadtrace/thread.json
```

`modulePath` is optional. When provided, ThreadTrace loads that connector module into temporary registries for the preflight only, so teams can validate a future `sourceType` before adding it to `THREADTRACE_CONNECTOR_MODULES`.

For custom connector fields, pass a generic location object:

```powershell
node src/presentation/cli/threadtrace.js source-onboarding-preflight --forum external --source-type external-feed --module-path D:/connectors/custom-forum.cjs --location-file D:/feeds/threadtrace/location.json
```

`--location-json` is also available for shells where inline JSON quoting is comfortable.

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

Validation and onboarding reports include `nextActions` when a draft cannot be saved or is not runnable. Each action contains `severity`, operator `commands`, structured `evidence`, and compact `evidenceSummary`. For connector-defined location schemas, missing custom fields are surfaced directly, for example:

```json
{
  "key": "source.location",
  "severity": "critical",
  "summary": "Provide the required source location fields before saving or running this source.",
  "evidenceSummary": "missingRequiredFields=tenantId requiredFields=feedUrl,tenantId providedFields=feedUrl sourceType=external-feed sourceKey=external"
}
```

The broader onboarding preflight carries those source validation actions inside the `source.registrationDraft` action `details`, so rollout plans and deployment gates can keep the root cause visible instead of only reporting a generic preflight failure.

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
2. Call `POST /api/sources/onboarding/preflight` with the draft location and optional ThreadSnapshot JSON file.
3. Fix any failed `steps`; use `POST /api/sources/validate` when you only need source draft validation.
4. Call `POST /api/sources` only after the draft is acceptable for the intended rollout stage.
5. Use `GET /api/sources/diagnostics` after saving to verify stored source readiness across the fleet.
