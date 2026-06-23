# External Connector Package Template

This directory is a package-style connector template for future forums, channels, queues, or collectors that already produce ThreadTrace's canonical `ThreadSnapshot` JSON.

## Files

- `index.cjs`: connector module entrypoint. It uses `register(context)` and registers one `SourceIngestHandler`.
- `package.json`: package metadata and local validation scripts.
- `sample-location.json`: source `location` payload for onboarding preflight or rollout manifests.
- `../external-thread.sample.json`: canonical sample thread payload used by the dry-run command.

## Validate

From the repository root:

```powershell
node src/presentation/cli/threadtrace.js validate-connector-module --module-path docs/examples/external-connector-package/index.cjs
```

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

Longer term, external packages should depend on a published ThreadTrace SDK instead of importing source files directly. Until then, this template keeps the package boundary explicit while staying executable in the repository test suite.
