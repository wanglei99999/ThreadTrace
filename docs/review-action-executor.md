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
- The action plan is conservative: blocker, keep-open, and conflict signals win over closure or merge.

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

## Adapter Examples

Good adapter boundaries:

- Task tracker adapter: close internal task records, GitHub Issues, Jira tickets, or forum moderation tasks.
- Context store adapter: merge reviewed facts into PostgreSQL, a document store, or a vector/RAG evidence registry.
- Audit adapter: write every mutation request and downstream response id into an operator-readable audit log.

Avoid putting source-specific API details inside `src/application/use-cases`. Source or vendor specifics belong in infrastructure adapters wired through the runtime composition root.
