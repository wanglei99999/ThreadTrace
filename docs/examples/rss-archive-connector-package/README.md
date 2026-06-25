# RSS/API Archive Connector Package Template

This package models a low-risk path for sources that ThreadTrace should not fetch directly yet:

1. An external collector reads RSS feeds, APIs, exports, or web archives.
2. The collector normalizes items into ThreadTrace's canonical `ThreadSnapshot` JSON.
3. This connector package registers a source type that ingests the normalized snapshot through the standard pipeline.

The package uses `defineNormalizedThreadJsonHandler`, so it gets the same task, report, idempotency, diagnostics, and rollout behavior as the built-in `normalized-thread-json` source type.

## Validate

```powershell
node src/presentation/cli/threadtrace.js validate-connector-module --module-path docs/examples/rss-archive-connector-package/index.cjs
```

Validation checks both the module registrations and `package.json.threadtraceConnector`.

## Dry-Run

```powershell
node src/presentation/cli/threadtrace.js source-ingest-dry-run --module-path docs/examples/rss-archive-connector-package/index.cjs --forum rss-archive --source-type rss-archive-normalized-feed --location-file docs/examples/rss-archive-connector-package/sample-location.json
```

## Rollout

```powershell
node src/presentation/cli/threadtrace.js rollout-manifest-plan --manifest-file docs/examples/rss-archive-rollout-manifest.sample.json
node src/presentation/cli/threadtrace.js connector-rollout-plan --module-path docs/examples/rss-archive-connector-package/index.cjs --forum rss-archive --source-type rss-archive-normalized-feed --location-file docs/examples/rss-archive-connector-package/sample-location.json --dry-run-ingest true
```
