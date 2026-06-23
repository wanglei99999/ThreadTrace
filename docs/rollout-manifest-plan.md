# Rollout Manifest Plan

The rollout manifest is a repeatable deployment input for onboarding a source, validating an optional connector module, dry-running ingest, and choosing worker topology.

It is intended for multi-forum growth: each future source can provide the same manifest shape while connector-specific details stay inside source handlers and connector modules.

## Manifest Shape

```json
{
  "version": "1.0",
  "name": "nga-sample-rollout",
  "source": {
    "sourceKey": "nga",
    "sourceType": "saved-html-directory",
    "displayName": "NGA sample archive",
    "inputDir": "example"
  },
  "connector": {
    "modulePath": "D:/connectors/custom-forum.cjs"
  },
  "ingest": {
    "dryRun": true,
    "allowRemoteFetch": false
  },
  "workers": {
    "topology": "operations-worker",
    "sourceTaskMode": "ingest"
  },
  "deployment": {
    "storeDir": "data/store",
    "limit": 100,
    "workerStaleAfterMs": 300000
  }
}
```

`source` is required and must include `sourceKey` or `forum`, plus `sourceType`. The source body accepts the same draft fields used by source onboarding: `inputDir`, `inputFile`, `url`, `location`, schedule fields, tags, and display name.

`connector.modulePath` is optional. When present, the runtime validates the module in an isolated registry and uses it for onboarding and dry-run simulation.

`ingest.dryRun` controls whether the connector rollout plan runs source ingest against isolated in-memory repositories. Remote-fetching handlers still require `allowRemoteFetch: true`.

`workers` is optional. When omitted, the runtime evaluates the default worker topology from current configuration.

## CLI

```powershell
node src/presentation/cli/threadtrace.js rollout-manifest-plan --manifest-file docs/examples/rollout-manifest.sample.json
node src/presentation/cli/threadtrace.js rollout-manifest-plan --manifest-file docs/examples/external-rollout-manifest.sample.json
```

The command prints the manifest status, source identity, composed connector rollout status, worker topology status, and next actions.

## HTTP

```text
POST /api/operations/rollout-manifest-plan
```

The request body can be the manifest itself, or an object with a `manifest` property plus top-level overrides such as `now`, `storeDir`, `limit`, and `workerStaleAfterMs`.

The response includes:

- `steps`: `manifest.structure`, `connector.rollout`, and `workers.topology`.
- `nextActions`: primary commands and related lower-level commands.
- `connectorRolloutPlan`: the composed connector rollout report.
- `workerTopologyPlan`: the composed worker deployment plan.

HTTP returns `503` only when the manifest plan has a failing step. Warnings return `200`.
