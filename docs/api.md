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

### `POST /api/sources`

注册或更新一个可跟踪来源。当前可直接落地的是 `saved-html-directory`，后续 `thread-url` 会接入在线采集器。

请求：

```json
{
  "forum": "nga",
  "sourceType": "saved-html-directory",
  "displayName": "NGA sample archive",
  "inputDir": "D:/Coding/GitCoding/ThreadTrace/example"
}
```

返回：来源记录、是否新建。

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
