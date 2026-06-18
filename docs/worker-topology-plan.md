# Worker Topology Plan

ThreadTrace can run background work in two deployment shapes:

- `operations-worker`: one combined worker loop runs due source work, notification dispatch, and operational overview updates.
- `split-workers`: separate loops run due source work and notification dispatch.

The topology plan is a read-only deployment planning report. It does not start workers, acquire leases, write task records, or change source schedules.

## CLI

```powershell
node src/presentation/cli/threadtrace.js worker-topology-plan
node src/presentation/cli/threadtrace.js worker-topology-plan --topology split-workers --source-task-mode insight-pipeline
```

The command exits with code `2` when a topology check has `status=fail`.

## HTTP

```http
GET /api/operations/worker-topology-plan?topology=split-workers&sourceTaskMode=insight-pipeline
```

The endpoint returns HTTP `200` for `ok` and `warn` plans, and HTTP `503` for a plan with failing checks.

## Deployment Guidance

For local or single-node deployments, prefer:

```powershell
node src/presentation/worker/operationsWorkerMain.js --loop --source-task-mode ingest
```

For production deployments backed by PostgreSQL, use split workers when source ingest and notification dispatch need independent scaling or failure isolation:

```powershell
node src/presentation/worker/dueSourceWorkerMain.js --loop --source-task-mode insight-pipeline
node src/presentation/worker/notificationEventWorkerMain.js --loop
```

Each worker uses a lease key so multiple processes can be started while only one active owner runs a given loop at a time:

- `worker:operations`
- `worker:due-source`
- `worker:notification-event`

File storage is appropriate for local development and simple single-node operation. Use PostgreSQL before running split workers across hosts, because PostgreSQL coordinates worker runs, worker leases, source run guards, tasks, and notification events in one shared store.

## Result Shape

```json
{
  "status": "ok",
  "topology": "split-workers",
  "storageMode": "postgres",
  "sourceTaskMode": "insight-pipeline",
  "workers": [
    {
      "workerType": "due-source",
      "leaseKey": "worker:due-source",
      "command": "node src/presentation/worker/dueSourceWorkerMain.js --loop --source-task-mode insight-pipeline"
    }
  ],
  "checks": [],
  "nextActions": []
}
```

`nextActions` is generated from non-ok checks and points operators to the next diagnostic command.

