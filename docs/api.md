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

### `GET /openapi.json`

返回 OpenAPI 3.0 契约，便于前端、测试工具或后续 SDK 生成器消费。

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

查询通知事件。当前本地实现会在来源导入后发现 cursor 变化时写入 `source-changed` 事件，后续可以接邮件、Webhook、企业微信或消息队列。

查询参数：

- `type`: 可选，如 `source-changed`。
- `sourceId`: 可选，按来源过滤。
- `acknowledged`: 可选，`true` 或 `false`。
- `deliveryStatus`: 可选，如 `pending`、`delivered`、`failed`。
- `limit`: 可选，默认 50。

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

### `POST /api/sources/{sourceId}/tasks/ingest`

按已注册来源触发一次导入任务。当前支持 `saved-html-directory` 来源，后续会扩展到在线主题 URL、批量来源和定时计划。

请求：

```json
{}
```

返回：任务记录和基础历史分析报告。

### `POST /api/sources/tasks/ingest`

批量运行所有启用来源的导入任务，可按 `forum` 过滤。这个接口是未来 Scheduler / Worker 的最小执行入口。

请求：

```json
{
  "forum": "nga",
  "limit": 50
}
```

返回：父任务记录、批量执行汇总、成功/失败数量和每个来源的任务结果。父任务类型为 `ingest-enabled-sources`，每个来源仍会生成自己的导入任务记录。

### `POST /api/sources/tasks/ingest-due`

只运行已启用且调度到期的来源。调度规则来自来源的 `schedule.intervalMinutes` 或 `schedule.nextRunAt`，运行中的来源会被跳过，未设置调度的来源不会自动运行。

请求：

```json
{
  "forum": "nga",
  "limit": 50,
  "now": "2026-06-18T10:00:00.000Z"
}
```

返回：父任务记录、到期数量、跳过数量、成功/失败数量和每个来源的调度原因。父任务类型为 `ingest-due-sources`。

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
