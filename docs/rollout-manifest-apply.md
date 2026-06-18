# Rollout Manifest Apply

Rollout manifest apply closes the loop from planning to source registration.

It is safe by default: the CLI and HTTP API run in dry-run mode unless `execute` is explicitly enabled. Dry-run evaluates the deployment gate and reports the source draft without writing to the source repository.

## CLI

Dry-run:

```powershell
node src/presentation/cli/threadtrace.js rollout-manifest-apply --manifest-file docs/examples/rollout-manifest.sample.json
```

Execute registration:

```powershell
node src/presentation/cli/threadtrace.js rollout-manifest-apply --manifest-file docs/examples/rollout-manifest.sample.json --execute true
```

Execution is blocked when the deployment gate fails. Gate warnings are reported and kept in the apply output, but do not block registration because built-in sources can legitimately have connector-module warnings.

## HTTP

```text
POST /api/operations/rollout-manifest/apply
```

Request body:

```json
{
  "manifest": {
    "version": "1.0",
    "name": "nga-sample-rollout",
    "source": {
      "sourceKey": "nga",
      "sourceType": "saved-html-directory",
      "displayName": "NGA sample archive",
      "inputDir": "example"
    },
    "ingest": {
      "dryRun": true
    },
    "workers": {
      "topology": "operations-worker",
      "sourceTaskMode": "ingest"
    }
  },
  "execute": false
}
```

The manifest can also be supplied directly as the request body. Set `execute: true` or `dryRun: false` to register the source.

## Result

The report includes:

- `dryRun`, `executed`, and `applied`.
- `sourceDraft` extracted from the manifest.
- `registration` when execution created or updated a source.
- `deploymentGate` for rollout/resource/checklist/runbook evidence.
- `steps` and `nextActions` for operator follow-up.
