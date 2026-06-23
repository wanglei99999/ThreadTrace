# Connector Rollout Plan

Connector rollout planning is a read-only preflight for bringing a new forum, feed, or source type into ThreadTrace.

It aggregates the checks an operator would otherwise run one by one:

- connector module contract
- optional connector module validation
- optional source onboarding preflight
- optional source ingest dry-run
- current connector readiness
- current deployment checklist

The report does not register sources, mutate runtime connector registries, write business data, or change deployment configuration. External connector module simulation uses temporary registries through the existing onboarding preflight path.

Module validation in the plan checks both loading and contract shape. A module must register at least one adapter or handler, keep adapter `sourceKey` and handler `sourceType` values unique, and expose the required metadata used by UI and operations tooling (`displayName` for adapters, `description` and `locationSchema.properties` for handlers). The returned `contractSummary` is safe to show in release notes or operator handoffs.

## CLI

```powershell
node src/presentation/cli/threadtrace.js connector-rollout-plan `
  --forum external `
  --source-type external-feed `
  --module-path D:\connectors\custom-forum.cjs `
  --location-file D:\connectors\external-feed-location.json `
  --dry-run-ingest true
```

Runnable repository example:

```powershell
node src/presentation/cli/threadtrace.js connector-rollout-plan `
  --forum external `
  --source-type external-normalized-feed `
  --module-path docs/examples/external-normalized-feed-connector.cjs `
  --input-file docs/examples/external-thread.sample.json `
  --dry-run-ingest true
```

The command exits with code `2` when any rollout step has `status=fail`, which makes it suitable for release gates and scripted operator checklists.

If no `--module-path` is supplied, module validation is marked as `warn` and the plan still reports the contract, runtime readiness, and deployment checklist. If no source draft fields are supplied, source onboarding preflight is marked as `warn`. If `dryRunIngest` is not requested, source ingest dry-run is marked as `warn`.

## HTTP

```http
POST /api/connectors/rollout-plan
content-type: application/json

{
  "sourceKey": "external",
  "sourceType": "external-feed",
  "modulePath": "D:/connectors/custom-forum.cjs",
  "dryRunIngest": true,
  "location": {
    "feedUrl": "https://example.test/feed"
  }
}
```

The endpoint returns HTTP `200` for `ok` and `warn` plans, and HTTP `503` for a plan with a failing step.

## Result Shape

```json
{
  "status": "ok",
  "sourceKey": "external",
  "sourceType": "external-feed",
  "modulePath": "D:/connectors/custom-forum.cjs",
  "steps": [
    {
      "key": "connectorModule.validation",
      "status": "ok",
      "summary": "Connector module file validates."
    }
  ],
  "nextActions": []
}
```

`nextActions` is generated from non-ok steps and includes the CLI command an operator can run to inspect that area in more detail.
