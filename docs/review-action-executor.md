# Review Action Executor Port

`context-review-action-apply` is the handoff point between reviewed AI/human decisions and real downstream mutations. It stays dry-run by default. Real execution is available only when the runtime is composed with a `ContextReviewActionExecutor` port.

## Port Contract

```js
const runtime = createThreadTraceRuntime({
  contextReviewActionExecutor: {
    async closeTasks(request) {
      return {
        closedTaskIds: request.closeTaskIds
      };
    },
    async mergeContext(request) {
      return {
        mergedTaskIds: request.mergeCandidates.map(function (candidate) {
          return candidate.taskId;
        })
      };
    }
  }
});
```

`closeTasks(request)` receives:

- `taskId`: the durable `context-review-action-apply` task id.
- `closeTaskIds`: conservative task ids approved by the review action plan.
- `actionGate`: the evaluated gate, including risk, blockers, and compact action plan evidence.
- `now`: optional fixed timestamp.
- `storeDir`: optional store directory for file-backed deployments.

`mergeContext(request)` receives:

- `taskId`: the durable `context-review-action-apply` task id.
- `mergeCandidates`: candidate context updates approved by the review action plan.
- `actionGate`: the same evaluated gate.
- `now`: optional fixed timestamp.
- `storeDir`: optional store directory.

Adapters should return compact audit-friendly objects. The task output stores those objects under `report.executorResults.taskClosure` and `report.executorResults.contextMerge`.

## Execution Rules

- `execute` defaults to `false`; dry-run records the gate, closure ids, merge candidates, and next actions without calling executors.
- `execute: true` requires both `closeTasks` and `mergeContext`.
- A failing action gate prevents executor calls.
- Missing executor methods produce a failed report with `executorReadiness.missing`.
- File-backed runtimes keep an action execution ledger under `THREADTRACE_STORE_DIR/review-action-executions`. Each logical `tasks.closure` or `context.merge` call is claimed before the adapter runs; a completed ledger entry is replayed instead of calling the adapter again.
- If another process has already claimed the same logical action and it is still running, the task fails fast instead of risking a duplicate downstream mutation. Retry after the first execution finishes or after an operator resolves the stale ledger entry.
- Ledger inspection marks running records as stale when their `updatedAt` or `createdAt` timestamp is older than the stale-running window. The default is 10 minutes and can be adjusted with `--running-stale-after-ms` or the `runningStaleAfterMs` API query parameter. This is a read-side operational signal; ThreadTrace does not automatically delete or overwrite stale running ledger entries.
- The action plan is conservative: blocker, keep-open, and conflict signals win over closure or merge.

## Idempotency Boundary

Task-level idempotency protects repeated client calls with the same idempotency key. The execution ledger protects the downstream mutation boundary even when a task crashes after an adapter call but before the task record is marked completed.

Ledger keys are derived from the logical action type and the conservative action-plan payload, not from the transient task id. Adapter results are stored in the ledger and surfaced back under `report.executorResults.*.executionLedger`.

PostgreSQL deployments use the same `ContextReviewActionExecutionRepository` port with a unique `execution_key` and conflict-aware claim operation. The file implementation is suitable for local and single-node deployments; PostgreSQL is the preferred ledger store for multi-process or multi-host execution.

## Legacy Compatibility

Existing deployments can still pass the older shape:

```js
createThreadTraceRuntime({
  contextReviewActionExecutors: {
    taskClosureExecutor,
    contextMergeExecutor
  }
});
```

The runtime use case adapts it to the port shape internally. New integrations should prefer `contextReviewActionExecutor.closeTasks` and `contextReviewActionExecutor.mergeContext`.

## Built-in File Audit Executor

Set this environment variable to exercise the real execution path without mutating a task tracker or context store:

```powershell
$env:THREADTRACE_REVIEW_ACTION_EXECUTOR='file-audit'
```

When `review-action-apply --execute true` or `POST /api/context-review-results/action-tasks/apply` with `execute: true` passes the action gate, ThreadTrace writes two audit files under:

```text
THREADTRACE_STORE_DIR/review-action-audits
```

The file executor returns `changed=false` and stores the planned closure ids, merge candidates, compact gate evidence, and task id. Use it for local demos, staging rehearsals, and downstream adapter contract tests before wiring a real task tracker or context store.

When paired with file storage, executor calls are also tracked in:

```text
THREADTRACE_STORE_DIR/review-action-executions
```

Inspect audit records with:

```powershell
node src/presentation/cli/threadtrace.js review-action-audits
node src/presentation/cli/threadtrace.js review-action-audit-overview
node src/presentation/cli/threadtrace.js review-action-executions
node src/presentation/cli/threadtrace.js review-action-executions --status running --running-stale-after-ms 600000
node src/presentation/cli/threadtrace.js review-action-executor-diagnostics
```

```text
GET /api/context-review-results/action-audits
GET /api/context-review-results/action-audits/overview
GET /api/context-review-results/action-executions
GET /api/context-review-results/action-executor/diagnostics
```

## Adapter Examples

Good adapter boundaries:

- Task tracker adapter: close internal task records, GitHub Issues, Jira tickets, or forum moderation tasks.
- Context store adapter: merge reviewed facts into PostgreSQL, a document store, or a vector/RAG evidence registry.
- Audit adapter: write every mutation request and downstream response id into an operator-readable audit log.

Avoid putting source-specific API details inside `src/application/use-cases`. Source or vendor specifics belong in infrastructure adapters wired through the runtime composition root.
