# Operations Overview

ThreadTrace exposes a compact operational overview for local console use, Web UI status panels, and future monitoring integrations.

## Entry Points

CLI:

```powershell
node src/presentation/cli/threadtrace.js operations-overview
```

HTTP:

```text
GET /api/operations/overview
```

Runtime:

```js
runtime.getOperationalOverview({ limit: 100 })
```

## Included Signals

- Sources: total, enabled, disabled, due, running, failed, and due source samples.
- Tasks: recent task totals grouped by status and last failure.
- Events: pending, failed, unacknowledged, delivery-due count, and next delivery time.
- Raw pages: recent raw evidence count and latest fetch time.
- Storage mode and generation time.

The first implementation uses repository list operations with a bounded window. PostgreSQL deployments can later optimize the same use case with aggregate queries without changing API or Web contracts.
