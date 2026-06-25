# Deployment Gate

The deployment gate is the highest-level read-only release check. It combines:

- rollout manifest planning
- resource provisioning planning
- deployment checklist readiness
- operations runbook actions

Use it before registering a new source in production, adding a connector module, switching storage to PostgreSQL, or changing worker topology.

## CLI

```powershell
node src/presentation/cli/threadtrace.js deployment-gate --manifest-file docs/examples/rollout-manifest.sample.json
node src/presentation/cli/threadtrace.js deployment-gate --manifest-file docs/examples/rollout-manifest.sample.json --llm-readiness-mode evaluation --provider mock
```

The command exits with code `2` when any gate fails. Warnings are printed but keep exit code `0`, which lets deployment automation distinguish hard blockers from follow-up recommendations.

## HTTP

```text
POST /api/deployment/gate
```

The body can be a rollout manifest directly, or an object with a `manifest` property and overrides such as `storeDir`, `limit`, `pipelineLimit`, `now`, `workerStaleAfterMs`, `provider`, and `llmReadinessMode`.

## Gates

- `rollout.manifest`: source onboarding, connector validation, ingest dry-run, and worker topology from the manifest.
- `resources.provisioning`: database, store, workers, LLM, notification channel, connector module paths, and source inputs.
- `deployment.checklist`: runtime, resources, adapters, connectors, sources, workers, notifications, and LLM readiness.
- `operations.runbook`: critical and warning actions derived from diagnostics and recent task history.

The response includes each gate, its evidence, and flattened next actions with commands from the lower-level reports. Resource provisioning failures carry compact lower-level action details, including `evidenceSummary`, so a failed gate can show which resource is missing required source inputs such as `missingRequiredFields=tenantId`. Deployment checklist failures also carry source diagnostics actions when stored sources are broken, for example `source.handler` with `sourceId=... registeredHandler=false`, so top-level gates identify the source that needs repair before rollout.

LLM readiness defaults to configuration-only checks to keep routine gate runs cheap. Use `llmReadinessMode=evaluation` when switching to a real provider; the deployment checklist portion will include both `llm.preflight` and `llm.semanticEvaluation`, and the runbook will point warnings back to the LLM evaluation commands.
