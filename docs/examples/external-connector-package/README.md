# External Connector Package Template

This directory is a package-style connector template for future forums, channels, queues, or collectors that already produce ThreadTrace's canonical `ThreadSnapshot` JSON.

## Files

- `index.cjs`: connector module entrypoint. It uses `register(context)`, the `src/connectors/connectorSdk` helpers, and registers one canonical JSON `SourceIngestHandler`.
- `package.json`: package metadata, local validation scripts, and the `threadtraceConnector` manifest used by module validation.
- `sample-location.json`: source `location` payload for onboarding preflight or rollout manifests.
- `../external-thread.sample.json`: canonical sample thread payload used by the dry-run command.

## Validate

From the repository root:

```powershell
node src/presentation/cli/threadtrace.js validate-connector-module --module-path docs/examples/external-connector-package/index.cjs
```

Inspect the package source type and generated onboarding recipe:

```powershell
node src/presentation/cli/threadtrace.js connector-catalog --module-path docs/examples/external-connector-package/index.cjs --source-type package-normalized-feed
node src/presentation/cli/threadtrace.js connector-catalog --module-path docs/examples/external-connector-package/index.cjs --source-type package-normalized-feed --json true
```

The JSON output includes `onboardingRecipe.requiredLocationFields`, `recommendedFlow`, and a conservative `rolloutManifestTemplate` that can seed rollout planning after real source values are filled in.

`validate-connector-module` also checks that `package.json.threadtraceConnector.sourceTypes[]` matches the handler registrations. This lets operators and future package catalogs trust the package manifest without reading connector source code first.

From this package directory:

```powershell
npm run validate
```

## Dry-Run Ingest

```powershell
node src/presentation/cli/threadtrace.js source-ingest-dry-run --module-path docs/examples/external-connector-package/index.cjs --forum external-package --source-type package-normalized-feed --input-file docs/examples/external-thread.sample.json
```

## Onboarding Preflight

```powershell
node src/presentation/cli/threadtrace.js source-onboarding-preflight --module-path docs/examples/external-connector-package/index.cjs --forum external-package --source-type package-normalized-feed --location-file docs/examples/external-connector-package/sample-location.json
```

## Rollout Manifest

Use the package rollout manifest to run connector validation, onboarding preflight, dry-run ingest, and worker topology planning from one file:

```powershell
node src/presentation/cli/threadtrace.js rollout-manifest-plan --manifest-file docs/examples/external-package-rollout-manifest.sample.json
node src/presentation/cli/threadtrace.js rollout-manifest-apply --manifest-file docs/examples/external-package-rollout-manifest.sample.json
```

## Runtime Configuration

For production-like startup, point `THREADTRACE_CONNECTOR_MODULES` to the package entrypoint:

```powershell
$env:THREADTRACE_CONNECTOR_MODULES="D:\connectors\external-connector-package\index.cjs"
node src/presentation/cli/threadtrace.js connector-readiness
```

When the package is copied outside this repository, set `THREADTRACE_ROOT` if the package still imports ThreadTrace application helpers from a local checkout:

```powershell
$env:THREADTRACE_ROOT="D:\Coding\GitCoding\ThreadTrace"
```

Longer term, external packages should depend on a published ThreadTrace SDK package instead of importing source files directly. Until then, `src/connectors/connectorSdk` is the local authoring surface for connector definitions, including `defineNormalizedThreadJsonHandler` for collectors that already emit canonical snapshots. This template keeps the package boundary explicit while staying executable in the repository test suite.
