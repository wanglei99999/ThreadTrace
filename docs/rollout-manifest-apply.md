# Rollout Manifest Apply

Rollout manifest apply closes the loop from planning to source registration.

It is safe by default: the CLI and HTTP API run in dry-run mode unless `execute` is explicitly enabled. Dry-run evaluates the deployment gate and reports the source draft without writing to the source repository.

## CLI

Dry-run:

```powershell
node src/presentation/cli/threadtrace.js rollout-manifest-apply --manifest-file docs/examples/rollout-manifest.sample.json
node src/presentation/cli/threadtrace.js rollout-manifest-apply --manifest-file docs/examples/external-rollout-manifest.sample.json
node src/presentation/cli/threadtrace.js rollout-manifest-apply --manifest-file docs/examples/external-package-rollout-manifest.sample.json
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

## Web

The Web system view can run rollout checks, launch an apply dry-run from the readiness card, and submit the apply form. When `execute=true` is selected, the Web UI runs the deployment gate first, blocks failing gates, and asks for confirmation on warning gates before calling the apply endpoint. After execution registers a source, the apply report includes `Ops`, `Rollback check`, and `Rollback disable` controls. `Rollback check` calls the source disable endpoint in dry-run mode, while `Rollback disable` uses the same confirmation and task-audit path as other source lifecycle actions.

## Result

The report includes:

- `dryRun`, `executed`, and `applied`.
- `sourceDraft` extracted from the manifest.
- `registration` when execution created or updated a source.
- `rollbackPlan` with disable-source commands for the registered source, or a dry-run template before execution.
- `deploymentGate` for rollout/resource/checklist/runbook evidence.
- `steps` and `nextActions` for operator follow-up. When the deployment gate blocks apply, gate lower-level `details` and compact `evidenceSummary` values are carried into apply actions so the blocked rollout can show missing resource inputs or broken stored source diagnostics directly.

## Audit Trail

CLI and HTTP apply entrypoints create a durable task record with type `rollout-manifest-apply`. The task output stores the apply report, source summary, registration summary, and deployment gate status.

Query recent rollout apply records:

```powershell
node src/presentation/cli/threadtrace.js list-tasks --type rollout-manifest-apply
```

Correlate a rollout apply request:

```powershell
node src/presentation/cli/threadtrace.js trace-context --request-id <request-id>
node src/presentation/cli/threadtrace.js trace-context --idempotency-key <key>
```

Use `idempotency-key` on the HTTP request or `--idempotency-key` on the CLI to safely replay the same dry-run/apply call without creating duplicate audit records.
