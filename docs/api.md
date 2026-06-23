# HTTP API

ThreadTrace 提供一个无依赖 Node HTTP API，当前用于本地开发和未来前端工作台接入。

启动：

```powershell
npm run serve
```

默认地址：

```text
http://127.0.0.1:3017
```

## Endpoints

### `GET /health`

返回服务状态。

### `GET /adapters`

返回当前已注册论坛适配器。

### `GET /api/adapters/diagnostics`

诊断论坛适配器注册表是否满足解析契约。它会检查 adapter 是否可通过 registry 解析、`sourceKey` 是否一致、是否实现 `parseSavedHtml`，以及可选样例解析 smoke。

返回：整体 `status`、每个 adapter 的状态和检查项。存在失败检查时 HTTP 状态码为 503，响应体仍包含完整诊断。

### `GET /openapi.json`

返回 OpenAPI 3.0 契约，便于前端、测试工具或后续 SDK 生成器消费。

### `GET /api/contracts/context-review-handoff`

返回新发言语境还原报告中的 `contextReviewHandoff` JSON 契约，包括版本、状态、任务数量、高优先级任务数量、推荐下一步、证据包、开放任务列表和下游接入说明。这个契约面向人工复核、LLM 二次审核、证据持久化和通知队列。

### `POST /api/contracts/context-review-handoff/validate`

校验外部工具或下游 Worker 准备消费的 `contextReviewHandoff` JSON。请求体可以使用 `{ "handoff": { ... } }`、`{ "payload": { ... } }`，也可以直接提交 handoff 对象。有效时返回 200，无效时返回 400，并包含 `checks` 明细。

### `GET /api/contracts/context-review-result`

Returns the `ContextReviewResult` JSON contract used by human reviewers, LLM workers, or downstream review systems after they process a `ContextReviewHandoff`. The contract covers reviewer metadata, per-task decisions, resolved and remaining task ids, cited evidence refs, aggregate confidence, and downstream merge/audit hooks.

### `POST /api/contracts/context-review-result/validate`

Validates a review result before it is merged back into analysis, persisted, or used to close review tasks. The request body can use `{ "result": { ... } }`, `{ "payload": { ... } }`, or the result object directly. Valid payloads return 200; invalid payloads return 400 with detailed `checks`.

### `POST /api/context-review-results/summarize`

Validates a `ContextReviewResult` and returns an operational summary for task closure, context merge, and notification planning. The summary includes decision counts, confidence band, evidence ref count, task ids to close or keep open, merge candidates, blocked tasks, notification severity, and a recommended next action. Invalid payloads return 400 with validation details and no summary.

### `POST /api/context-review-results`

Validates, summarizes, and stores a `ContextReviewResult` in the durable review archive. File storage writes records under `context-review-results` inside the configured store directory. Each record preserves the original result, validation details, derived summary, reviewer metadata, handoff id, and trace metadata.

### `GET /api/context-review-results`

Lists submitted review result records. Optional filters: `handoffId`, `status`, `reviewerId`, `limit`, and `storeDir`. This endpoint is the read side for review audit trails, task closure dashboards, and future merge workers.

### `GET /api/context-review-results/overview`

Aggregates submitted review result records for dashboards and worker planning. Optional filters mirror the list endpoint and add `now` for repeatable reports. The response includes counts by review status and notification severity, resolved and remaining task totals, merge candidate totals, blocked task totals, attention records, recent records, and a recommended next action.

### `GET /api/context-review-results/action-plan`

Builds a read-only closure and merge plan from submitted review results. Optional filters: `handoffId`, `status`, `reviewerId`, `limit`, `now`, and `storeDir`. The response separates tasks that can be closed, tasks that must stay open, merge candidates, blocked tasks, conflicts, risk reasons, and the recommended next action. This endpoint is intentionally non-mutating so future task-closure or context-merge workers can consume it first in dry-run mode.

### `GET /api/context-review-results/action-gate`

Evaluates the action plan as a worker preflight gate. Optional filters match the action-plan endpoint. The response includes readiness gates for available review results, risk, task conflicts, blockers, and execution scope, plus executable flags for task closure and context merge workers. `fail` means downstream workers should not execute; `warn` means manual review or dry-run-only execution is recommended.

### `POST /api/context-review-results/action-tasks/apply`

Creates a durable `context-review-action-apply` task audit record for applying review-result closure and merge actions. The endpoint defaults to dry-run and does not mutate task or context records. The task stores the evaluated action gate, planned task closure ids, merge candidates, step statuses, executor readiness, and follow-up actions. `execute: true` is reserved for executor-backed deployments; without configured task-closure and context-merge executors, execution reports `fail` instead of silently changing data. Runtime deployments can provide those executors through `contextReviewActionExecutor.closeTasks` and `contextReviewActionExecutor.mergeContext`; the older `contextReviewActionExecutors.taskClosureExecutor` and `contextReviewActionExecutors.contextMergeExecutor` shape remains supported for compatibility. See `docs/review-action-executor.md`.

### `GET /api/context-review-results/action-audits`

Lists file-audit executor records written by `context-review-action-apply` when `execute=true` and `THREADTRACE_REVIEW_ACTION_EXECUTOR=file-audit` are used. Optional filters: `action` (`tasks.closure` or `context.merge`), `taskId`, `limit`, `now`, and `storeDir`. The response returns generated time, action type, compact executor request payload, and audit file path.

### `GET /api/context-review-results/action-audits/overview`

Summarizes file-audit executor records for dashboards and operational checks. Optional filters mirror the audit list endpoint. The response includes total audit count, unique task count, counts by action and adapter, planned closure and merge-candidate totals, latest generated time, recent records, and the recommended next action.

### `GET /api/context-review-results/action-executions`

Lists review action execution ledger records used to prevent duplicate downstream mutations. Optional filters: `action` (`tasks.closure` or `context.merge`), `status` (`running`, `completed`, or `failed`), `taskId`, `limit`, `runningStaleAfterMs`, `now`, and `storeDir`. File-backed responses include the execution key, request hash, status, result, attempt count, stale-running flag, running age, and ledger file path. The stale-running window defaults to 10 minutes and affects read-side health signals only; it does not automatically mutate ledger records.

### `GET /api/context-review-results/action-executor/diagnostics`

Reports the configured review action executor mode, source, required method readiness, dry-run-only status, mutating-source-truth flag, audit evidence, checks, and next actions. This endpoint is read-only and is intended for deployment preflight before using `execute: true`. A configured executor with missing required methods returns HTTP `503`; no executor returns `warn` with dry-run-only guidance.

### `POST /api/context-review-results/events`

Dry-runs or executes synthesis of attention-worthy review results into notification outbox events. Only `warning` and `critical` review summaries generate events. The endpoint defaults to dry-run; set `execute: true` or `dryRun: false` to persist `context-review-result` events. Optional filters: `handoffId`, `status`, `reviewerId`, `limit`, `now`, and `storeDir`.

### `POST /api/analyze-directory`

分析一个保存页目录。

请求：

```json
{
  "forum": "nga",
  "inputDir": "D:/Coding/GitCoding/ThreadTrace/example"
}
```

返回：基础历史分析报告。

### `GET /api/intelligence/authors`

Builds a read-only author and opinion intelligence dashboard from stored `basic-history` reports. It is source-agnostic: NGA and future connectors only need to persist the same report shape.

Query parameters:

- `sourceKey` / `forum`: optional source filter.
- `sourceThreadId`: optional thread filter.
- `authorId` / `sourceAuthorId`: optional author id filter.
- `author` / `authorName`: optional display-name filter.
- `includeReportRevisions`: optional boolean. Defaults to `false`, so each source thread uses only its newest report revision.
- `limit`: stored report window, defaults to 100.
- `timelineLimit`: opinion timeline window, defaults to 50.
- `reviewQueueLimit`: generated review queue window, defaults to 20.
- `now`: optional fixed generation time.
- `storeDir`: optional file store override.

Returns `revisionMode`, `reportRevisionCount`, `summary`, top `authors`, `focusEntities`, `opinionTimeline`, `evidenceGaps`, high-signal `evidence`, generated `reviewQueue`, compact `threads`, and `recommendedNextAction`. `summary` includes `reviewQueuePriorityCounts` and `reviewQueueTypeCounts`. Author rows include aggregated stance fields such as `dominantStance`, `latestAttitude`, `averageOpinionConfidence`, `opinionThreadCount`, de-duplicated `topFocusEntities`, and an `intelligence.summary` string for review queues. Review queue items include stable `type`, `priority`, `score`, `reason`, `nextAction`, and source `refs`.

CLI can export the same dashboard as a handoff package with `node src/presentation/cli/threadtrace.js author-intelligence --source-key nga --markdown-output data/reports/author-intelligence.md`.

### `GET /api/intelligence/authors/markdown`

Uses the same query parameters as `GET /api/intelligence/authors`, but returns `text/markdown` with the author intelligence review package. This is intended for browser export, operator handoff, or downstream LLM review prompts.

### `POST /api/intelligence/author-review-queue/sync`

Persists the current generated author intelligence `reviewQueue` into durable review queue records. The request body accepts the same source/report filters as `GET /api/intelligence/authors` plus `reviewQueueLimit` and `storeDir`. Existing items keep their review status while `lastSeenAt` and `seenCount` are updated.

### `GET /api/intelligence/author-review-queue`

Lists durable author review queue records. Optional filters: `status` (`open`, `confirmed`, `ignored`), `sourceKey`, `sourceThreadId`, `type`, `priority`, `limit`, and `storeDir`. The response includes `summary.byStatus`, `summary.byPriority`, `summary.byType`, and `summary.openCount`.

### `POST /api/intelligence/author-review-queue/{itemId}/status`

Marks a durable author review queue item as `open`, `confirmed`, or `ignored`. The request body accepts `status`, optional `reviewedBy`, `note`, `now`, and `storeDir`.

### `POST /api/intelligence/author-review-queue/events`

Dry-runs or executes synthesis of open durable author review queue items into notification outbox events. The endpoint defaults to dry-run; set `execute: true` or `dryRun: false` to persist `author-review-queue` events. Event IDs are stable per durable queue item, so repeated synthesis updates pending or failed events instead of duplicating alerts.

Optional filters: `sourceKey` / `forum`, `sourceThreadId`, `status`, `type`, `priority`, `limit`, `staleLimit`, `resolveStale`, `now`, and `storeDir`. By default, stale `author-review-queue` events in the same filter scope are marked `resolved` when the underlying queue item is no longer open. Operator-acknowledged or already delivered events are skipped for audit safety.

### `POST /api/interpret-text`

对一条新发言做语境还原。

请求：

```json
{
  "forum": "nga",
  "inputDir": "D:/Coding/GitCoding/ThreadTrace/example",
  "text": "科技后面看量确认",
  "authorId": "150058",
  "author": "-阿狼-"
}
```

返回：新发言语境还原报告，包括新发言实体候选、观点候选和相关历史证据。

### `POST /api/tasks/ingest-directory`

执行一次“导入目录 -> 分析 -> 持久化”的任务。

请求：

```json
{
  "forum": "nga",
  "inputDir": "D:/Coding/GitCoding/ThreadTrace/example",
  "storeDir": "D:/Coding/GitCoding/ThreadTrace/data/store"
}
```

返回：任务记录和基础历史分析报告。

### `GET /api/tasks`

查询任务记录。

查询参数：

- `status`: 可选，如 `completed`。
- `type`: 可选，如 `ingest-saved-thread-directory`。
- `limit`: 可选，默认 20。

### `GET /api/sources/tasks/insight-pipeline-runs`

List recent source insight pipeline run summaries derived from durable task records.

Query parameters:

- `sourceId`: optional tracked source id filter.
- `status`: optional task status filter, such as `completed` or `failed`.
- `limit`: optional, defaults to 20.
- `scanLimit`: optional internal task scan window when filtering by source.

Returns: stable run summaries with task id, source metadata, cursor diff, semantic status, and timestamps.

### `GET /api/events`

Optional filters include `type`, `sourceId`, `sourceKey` / `forum`, `acknowledged`, `deliveryStatus`, `limit`, and `storeDir`.

查询通知事件。当前本地实现会在来源导入后发现 cursor 变化时写入 `source-changed` 事件，后续可以接邮件、Webhook、企业微信或消息队列。

查询参数：

- `type`: 可选，如 `source-changed`。
- `sourceId`: 可选，按来源过滤。
- `acknowledged`: 可选，`true` 或 `false`。
- `deliveryStatus`: 可选，如 `pending`、`delivered`、`failed`。
- `limit`: 可选，默认 50。

### `GET /api/events/overview`

Summarizes notification outbox health for dashboards and workers. Optional filters mirror `GET /api/events` and add `maxAttempts`, `now`, and `storeDir`. The response includes status, window size, pending/failed/unacknowledged/due counts, retry-exhausted count, next delivery time, oldest open event, counts by type/severity/delivery status/source, attention samples, and a recommended next action.

### `POST /api/events/dispatch`

投递待处理通知事件。当前默认通道是本地文件投递，会把事件写入 `data/store/deliveries`；后续可替换为 Webhook、邮件、企业微信或消息队列。

请求：

```json
{
  "channel": "file",
  "limit": 50,
  "maxAttempts": 3,
  "includeFailed": true
}
```

返回：投递通道、成功数量、失败数量和跳过数量。成功投递后事件的 `deliveryStatus` 会变为 `delivered`。

通知通道：
- `file`: 默认通道，把事件写入 `data/store/deliveries`。
- `webhook`: 向 `webhookUrl` 发起 `POST application/json`，也可用环境变量 `THREADTRACE_WEBHOOK_URL` 提供地址。

### `POST /api/events/ack`

Bulk-acknowledges notification events. Pass `eventIds` for explicit selection, or omit them to acknowledge the current query window. When `eventIds` is omitted, `acknowledged` defaults to `false`, so the endpoint only closes open events unless the caller deliberately overrides the filter. The query window supports `type`, `sourceId`, `sourceKey` / `forum`, `deliveryStatus`, and `limit`. Set `dryRun: true` to preview candidates without writing, or `execute: true` to force execution when a client default uses dry-run.

Request:
```json
{
  "eventIds": ["source-changed-1"],
  "type": "runbook-action",
  "sourceKey": "nga",
  "deliveryStatus": "delivered",
  "limit": 50,
  "dryRun": true,
  "acknowledgedBy": "web",
  "note": "Handled by operator"
}
```

Returns `status`, `dryRun`, `candidateCount`, `acknowledgedCount`, `skippedCount`, `filters`, and per-event results. Already acknowledged and missing events are skipped without failing the whole batch.

### `POST /api/events/archive`

Dry-runs or executes notification outbox retention. By default the endpoint is a dry-run and only plans events that are already acknowledged, have `deliveryStatus` `delivered` or `resolved`, and are older than the retention window. Set `execute: true` to archive candidates.

Request:
```json
{
  "sourceKey": "nga",
  "deliveryStatuses": ["delivered", "resolved"],
  "requireAcknowledged": true,
  "olderThanDays": 30,
  "archiveLimit": 100,
  "execute": false,
  "archivedBy": "operator",
  "reason": "Handled notification retention"
}
```

Returns a retention plan with `candidateCount`, `archivedCount`, `cutoffAt`, `batchId`, candidate samples, and per-event execution results. File storage moves archived event JSON files under `events/_archive/`; PostgreSQL stores archive metadata on the outbox row. `GET /api/events` hides archived events unless `includeArchived=true`.

### `POST /api/events/{eventId}/ack`

确认一个通知事件。确认后事件仍会保留在本地 outbox 中，但 `acknowledgedAt` 会被写入，后续查询可用 `acknowledged=false` 只看未处理事件。

请求：

```json
{
  "acknowledgedBy": "web",
  "note": "已处理"
}
```

返回：确认后的事件记录。

### `POST /api/sources`

注册或更新一个可跟踪来源。当前可直接落地的是 `saved-html-directory`，后续 `thread-url` 会接入在线采集器。

请求：

```json
{
  "forum": "nga",
  "sourceType": "saved-html-directory",
  "displayName": "NGA sample archive",
  "inputDir": "D:/Coding/GitCoding/ThreadTrace/example",
  "intervalMinutes": 60
}
```

返回：来源记录、是否新建。

来源记录包含 `runState`，用于观察最近一次运行状态：
- `status`: `never-run`、`running`、`completed` 或 `failed`。
- `lastStartedAt` / `lastFinishedAt`: 最近一次开始和结束时间。
- `lastTaskId`: 最近一次成功关联的任务 ID。
- `failureCount`: 连续失败次数。
- `lastCursorDiff`: 最近一次导入相对上次水位线的变化，包括 `changed`、`newPostCount` 和前后最后楼层。

来源记录还包含 `cursor`，用于后续增量采集和去重：
- `sourceThreadId` / `title`: 最近一次归档的主题。
- `postCount`: 最近一次看到的楼层数量。
- `lastFloor` / `lastPostId` / `lastPublishedAt`: 最近一次看到的末尾楼层。
- `fingerprint`: 基于主题、帖子数和末尾楼层内容生成的变化指纹。

### `GET /api/sources`

查询已注册来源。

查询参数：

- `forum`: 可选，如 `nga`。
- `enabled`: 可选，`true` 或 `false`。
- `limit`: 可选，默认 50。

### `GET /api/sources/diagnostics`

诊断已注册来源是否具备可导入的配置。它会检查来源是否启用、`location` 是否满足来源类型、`sourceType` 是否有 ingest handler，以及需要论坛解析时对应 `forum/sourceKey` 是否有 adapter。

查询参数：

- `forum` / `sourceKey`: 可选，按来源论坛过滤。
- `enabled`: 可选，`true` 或 `false`。
- `limit`: 可选，默认 100。

返回：整体 `status`、每个来源的 `status` 和检查项。存在失败检查时 HTTP 状态码为 503，响应体仍包含完整诊断。

### `GET /api/sources/lifecycle`

Reports tracked source lifecycle state, safe disable guard results, failure retry state, and recent lifecycle task audit records.

Query parameters:

- `forum` / `sourceKey`: optional source key filter.
- `enabled`: optional `true` or `false`.
- `limit`: optional source window, defaults to 100.
- `taskLimit`: optional lifecycle task audit scan window.
- `sourceRunStaleAfterMs`: optional running-source stale window, defaults to 10 minutes.
- `sourceFailureRetryBackoffMs`: optional first retry delay after a failed source run.
- `sourceFailureMaxRetryBackoffMs`: optional maximum retry delay for exponential source failure backoff.
- `now`: optional fixed time for repeatable checks.

Returns `summary`, `blockedDisables`, per-source `disableGuard`, `failureRetry`, `latestLifecycleTask`, and `recentLifecycleTasks`.

### `GET /api/sources/schedule`

Previews due-source scheduling decisions without running workers or writing task records.

Query parameters:

- `forum` / `sourceKey`: optional source key filter.
- `enabled`: optional `true` or `false`.
- `limit`: optional source window, defaults to 100.
- `sourceRunStaleAfterMs`: optional stale running-source recovery window.
- `sourceFailureRetryBackoffMs`: optional first retry delay after a failed source run.
- `sourceFailureMaxRetryBackoffMs`: optional maximum retry delay for exponential source failure backoff.
- `now`: optional fixed time for repeatable checks.

Returns `summary.byReason`, `dueSources`, `skippedSources`, and per-source schedule decisions.

### `GET /api/deployment/checklist`

查询部署前验收清单。它聚合 runtime diagnostics、source diagnostics 和 operations readiness，用于部署脚本或控制台判断当前实例是否具备上线条件。

查询参数：

- `forum` / `sourceKey`: 可选，按来源论坛过滤来源诊断。
- `enabled`: 可选，`true` 或 `false`。
- `limit`: 可选，默认 100。
- `now`: 可选，用于测试或固定探测时间。

返回：整体 `status`、分区 `items` 和底层诊断证据。存在失败检查时 HTTP 状态码为 503，响应体仍包含完整清单。

### `GET /api/operations/runbook`

查询可执行运维 Runbook。它把 deployment checklist、来源生命周期信号和最近来源洞察流水线运行转换成行动项，包括严重级别、区域、建议命令和证据。

查询参数：

- `forum` / `sourceKey`: 可选，按来源论坛过滤。
- `sourceId`: 可选，按来源过滤最近流水线。
- `limit`: 可选，默认 100。
- `pipelineLimit`: 可选，默认 20。
- `taskLimit`: 可选，来源生命周期任务审计窗口。
- `sourceRunStaleAfterMs`: 可选，运行中来源恢复窗口。
- `sourceFailureRetryBackoffMs`: 可选，失败来源首次重试退避窗口。
- `sourceFailureMaxRetryBackoffMs`: 可选，失败来源最大重试退避窗口。
- `now`: 可选，用于测试或固定探测时间。

返回：整体 `status`、`actionCount` 和行动项。存在 critical 行动时 HTTP 状态码为 503，响应体仍包含完整 Runbook。

### `POST /api/operations/runbook/events`

Dry-runs or executes synthesis of critical and warning runbook actions into notification outbox events.

Request:

```json
{
  "execute": false,
  "forum": "nga",
  "limit": 100,
  "includeRunbook": false
}
```

The endpoint defaults to dry-run. Set `execute: true` or `dryRun: false` to persist `runbook-action` events. Event IDs are stable per runbook action key, so repeated synthesis updates pending or failed events without duplicating alerts. The response includes created, updated, resolved, reopened, and skipped counts. Operator-acknowledged and delivered events are skipped.

### `GET /api/notifications/diagnostics`

诊断通知投递通道配置。`file` 通道会检查本地 deliveries 目录可写；`webhook` 通道会检查 URL 是否存在且使用 `http` 或 `https`，不会主动投递外部请求。

查询参数：

- `channel`: 可选，`file` 或 `webhook`。
- `webhookUrl`: 可选，临时覆盖运行时配置中的 webhook 地址。
- `storeDir`: 可选，文件通道的本地存储根目录。

返回：通道、检查项和状态。存在失败检查时 HTTP 状态码为 503，响应体仍包含完整诊断。

### `POST /api/sources/ingest/dry-run`

Executes a source ingest handler with isolated in-memory repositories. It validates the source draft, runs the handler, returns thread/task/report summaries, and does not write to the configured durable store.

Request:

```json
{
  "sourceKey": "external",
  "sourceType": "normalized-thread-json",
  "inputFile": "D:/feeds/threadtrace/thread.json",
  "allowRemoteFetch": false
}
```

Remote-fetching handlers are blocked unless `allowRemoteFetch` is `true`. A failing dry-run returns HTTP `503` with the diagnostic report body.

### `POST /api/sources/{sourceId}/disable`

Safely disables a tracked source without deleting historical data. The endpoint defaults to dry-run and returns a durable task audit record plus the disable result.

Request:

```json
{
  "execute": false,
  "force": false,
  "sourceRunStaleAfterMs": 600000
}
```

Set `execute: true` or `dryRun: false` to persist `enabled=false`.
When the source has a non-stale `runState.status=running`, disable returns HTTP `409` with `source_disable_running`. Use `force: true` only for an operator-approved intervention, or lower `sourceRunStaleAfterMs` when recovering a stale run.

### `POST /api/sources/{sourceId}/enable`

Safely re-enables a tracked source after rollback or maintenance. The endpoint defaults to dry-run and returns a durable task audit record plus the enable result.

Request:

```json
{
  "execute": false
}
```

Set `execute: true` or `dryRun: false` to persist `enabled=true`.

### `POST /api/sources/{sourceId}/failure/reset`

Clears a failed source run state after operator review. The endpoint defaults to dry-run and returns a durable task audit record plus the reset result.

Request:

```json
{
  "execute": false,
  "retryNow": true,
  "nextRunAt": "2026-06-19T10:05:00.000Z",
  "resetBy": "operator"
}
```

Set `execute: true` or `dryRun: false` to persist the reset. `retryNow: true` sets `schedule.nextRunAt` to `now`; `nextRunAt` can be used for a controlled retry window. The task type is `reset-tracked-source-failure`. If the source is not failed, the action returns `changed=false` and does not write.

### `POST /api/sources/{sourceId}/tasks/ingest`

按已注册来源触发一次导入任务。当前支持 `saved-html-directory` 来源，后续会扩展到在线主题 URL、批量来源和定时计划。

请求：

```json
{
  "sourceRunStaleAfterMs": 600000
}
```

返回：任务记录和基础历史分析报告。

如果来源当前处于未过期的 `running` 状态，请求会失败以避免重复导入。同一规则也适用于来源洞察流水线；默认恢复窗口为 10 分钟。

### `POST /api/sources/tasks/ingest`

批量运行所有启用来源的导入任务，可按 `forum` 过滤。这个接口是未来 Scheduler / Worker 的最小执行入口。

请求：

```json
{
  "forum": "nga",
  "limit": 50,
  "sourceRunStaleAfterMs": 600000
}
```

返回：父任务记录、批量执行汇总、成功/失败数量和每个来源的任务结果。父任务类型为 `ingest-enabled-sources`，每个来源仍会生成自己的导入任务记录。

### `POST /api/sources/tasks/ingest-due`

只运行已启用且调度到期的来源。调度规则来自来源的 `schedule.intervalMinutes` 或 `schedule.nextRunAt`；未过期的运行中来源会被跳过，超过恢复窗口的 `running` 状态会重新按调度规则评估，未设置调度的来源不会自动运行。

请求：

```json
{
  "forum": "nga",
  "limit": 50,
  "now": "2026-06-18T10:00:00.000Z",
  "sourceRunStaleAfterMs": 600000,
  "sourceFailureRetryBackoffMs": 60000,
  "sourceFailureMaxRetryBackoffMs": 3600000
}
```

返回：父任务记录、到期数量、跳过数量、成功/失败数量和每个来源的调度原因。父任务类型为 `ingest-due-sources`。

批量入口会对每个来源应用同一套重复运行保护；单个来源重复运行会记录为该来源失败，不会中断整个父任务。失败来源默认采用指数退避重试，跳过项会返回 `retryAt`、`backoffMs` 和原始调度原因；将 `sourceFailureRetryBackoffMs` 设为 `0` 可关闭额外失败退避。

### `GET /api/operations/worker-topology-plan`

Returns a read-only worker deployment topology plan for choosing between the combined operations worker and split due-source / notification-event workers.

Query parameters:

```text
topology=operations-worker|split-workers
sourceTaskMode=ingest|insight-pipeline
limit=100
now=2026-06-18T10:00:00.000Z
```

The response includes recommended worker commands, lease keys, polling intervals, current worker health, deployment checklist status, and next diagnostic commands. A failing plan returns HTTP `503`.

### `POST /api/operations/rollout-manifest-plan`

Evaluates one repeatable rollout manifest across source onboarding, connector validation, optional ingest dry-run, deployment checklist, and worker topology.

Request:

```json
{
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
}
```

The response includes `steps`, `nextActions`, the composed `connectorRolloutPlan`, and the composed `workerTopologyPlan`. A failing plan returns HTTP `503`; warnings return `200`.

### `POST /api/operations/resource-provisioning-plan`

Builds a read-only provisioning checklist from runtime diagnostics, deployment checklist signals, and an optional rollout manifest.

Request:

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
  }
}
```

The response includes `resources`, required/optional status, expected environment variables, verification commands, and `nextActions` for missing required resources. PostgreSQL resources may include `schemaDrift` with missing extensions, tables, columns, indexes, inspection errors, and the baseline schema apply command. A failing required resource returns HTTP `503`; warnings on optional resources return `200`.

### `POST /api/deployment/gate`

Evaluates the highest-level deployment gate by composing rollout manifest planning, resource provisioning, deployment checklist, and operations runbook.

Request:

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
  }
}
```

The response includes `gates`, `nextActions`, and the composed lower-level reports. A failing gate returns HTTP `503`; warnings return `200`.

### `POST /api/operations/rollout-manifest/apply`

Dry-runs or executes source registration from a rollout manifest after evaluating the deployment gate.

Request:

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

The endpoint defaults to dry-run. Set `execute: true` or `dryRun: false` to register the source. The response includes a durable `task` audit record and the apply `report`; the report contains `rollbackPlan.commands` with `disable-source` guidance for the registered source or a dry-run rollback template before execution. A failing deployment gate or registration error returns HTTP `503`; gate warnings return `200` with follow-up actions.

### `POST /api/index-directory`

将保存页目录解析为楼层文档并写入本地检索索引。

请求：

```json
{
  "forum": "nga",
  "inputDir": "D:/Coding/GitCoding/ThreadTrace/example",
  "storeDir": "D:/Coding/GitCoding/ThreadTrace/data/store"
}
```

返回：索引文档数量和主题信息。

### `POST /api/search`

搜索已索引的历史证据。

请求：

```json
{
  "text": "科技",
  "limit": 10
}
```

返回：命中的楼层证据、分数、摘要和元数据。

## 工程约束

- API 默认允许 CORS，方便本地前端工作台调试。
- 请求体默认限制为 1MB，避免误传大文件压垮入口。
- 上传大批 HTML 文件不走 JSON API，后续会设计文件上传或采集任务入口。
