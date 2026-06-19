# 语脉 ThreadTrace

语脉是一个面向论坛长帖的观点追踪与语境还原系统。它不直接给投资建议，而是把作者在历史楼层中的发言、回复关系、隐晦表达、观点变化和证据来源整理出来，帮助用户理解新发言到底接在哪条历史语境上。

当前第一阶段目标是打通 **NGA 保存页 HTML -> 标准帖子结构 -> 历史分析报告** 的本地链路。后续再扩展数据库、定时采集、LLM 语义抽取、向量检索、网页工作台和实时提醒。

## 快速运行

当前版本不依赖第三方包，Node.js 20 可直接运行。

```powershell
npm run parse:sample
npm run analyze:sample
npm run analyze:sample-dir
npm run ingest:sample-dir
npm run task:ingest:sample
npm run index:sample-dir
npm run search:sample
npm run interpret:sample
npm run worker:due-once
npm run test:unit
```

启动本地 HTTP API：

```powershell
npm run serve
```

运行到期来源 Worker：

```powershell
npm run worker:due-once
npm run worker:due-loop
```

Worker 会读取已注册来源的调度配置，默认使用 `data/store`；可通过 `THREADTRACE_STORE_DIR` 和 `THREADTRACE_WORKER_INTERVAL_MS` 调整存储目录与轮询间隔。

默认会读取 `example` 目录中的第一个 `.html` 文件，并把解析结果写入 `data/parsed/nga-thread-45974302.json`。基础分析会同时生成 JSON 报告和 Markdown 报告，Markdown 默认输出到 `data/reports/nga-thread-45974302.basic-report.md`。

## CLI

```powershell
node src/presentation/cli/threadtrace.js list-adapters
node src/presentation/cli/threadtrace.js parse-html --forum nga --input example/自立自强，科学技术打头阵 NGA玩家社区.html
node src/presentation/cli/threadtrace.js parse-html-dir --forum nga --input example
node src/presentation/cli/threadtrace.js analyze-html --forum nga --input example/自立自强，科学技术打头阵 NGA玩家社区.html
node src/presentation/cli/threadtrace.js analyze-html-dir --forum nga --input example
node src/presentation/cli/threadtrace.js ingest-html-dir --forum nga --input example --store-dir data/store
node src/presentation/cli/threadtrace.js register-source --forum nga --input example --name "NGA sample archive" --interval-minutes 60
node src/presentation/cli/threadtrace.js source-ingest-dry-run --forum nga --source-type saved-html-directory --input example
node src/presentation/cli/threadtrace.js rollout-manifest-plan --manifest-file <file>
node src/presentation/cli/threadtrace.js resource-provisioning-plan --manifest-file <file>
node src/presentation/cli/threadtrace.js deployment-gate --manifest-file <file>
node src/presentation/cli/threadtrace.js rollout-manifest-apply --manifest-file <file>
node src/presentation/cli/threadtrace.js source-lifecycle-report
node src/presentation/cli/threadtrace.js source-schedule-report
node src/presentation/cli/threadtrace.js disable-source --source-id <id>
node src/presentation/cli/threadtrace.js disable-source --source-id <id> --execute true --force true
node src/presentation/cli/threadtrace.js enable-source --source-id <id>
node src/presentation/cli/threadtrace.js list-sources
node src/presentation/cli/threadtrace.js list-events
node src/presentation/cli/threadtrace.js dispatch-events
node src/presentation/cli/threadtrace.js dispatch-events --channel webhook --webhook-url http://127.0.0.1:9000/threadtrace-events
node src/presentation/cli/threadtrace.js ack-event --event-id <id>
node src/presentation/cli/threadtrace.js run-sources-task
node src/presentation/cli/threadtrace.js run-due-sources-task
node src/presentation/cli/threadtrace.js interpret-text-dir --forum nga --input example --text 科技后面看量确认
```

## Operations Commands

```powershell
npm run diagnostics:runtime
npm run diagnostics:adapters
npm run diagnostics:sources
npm run diagnostics:notifications
npm run deployment:checklist
npm run operations:worker-topology-plan
npm run operations:runbook
npm run operations:resource-provisioning-plan
npm run deployment:gate
npm run operations:rollout-manifest-apply
```

These commands use the same runtime composition as the HTTP API and Web console. `deployment:checklist` aggregates runtime resources, PostgreSQL schema readiness, adapter contracts, tracked source configuration, workers, notifications, and LLM configuration. `operations:runbook` turns failed or warning checks into actionable next commands.

## HTTP API

- `GET /health`
- `GET /adapters`
- `GET /api/adapters/diagnostics`
- `GET /openapi.json`
- `GET /api/runtime/diagnostics`
- `GET /api/deployment/checklist`
- `POST /api/deployment/gate`
- `GET /api/notifications/diagnostics`
- `POST /api/operations/rollout-manifest/apply`
- `GET /api/operations/overview`
- `GET /api/operations/readiness`
- `GET /api/operations/runbook`
- `GET /api/operations/worker-topology-plan`
- `POST /api/operations/rollout-manifest-plan`
- `POST /api/operations/resource-provisioning-plan`
- `POST /api/analyze-directory`
- `POST /api/interpret-text`
- `POST /api/tasks/ingest-directory`
- `GET /api/tasks`
- `GET /api/events`
- `POST /api/events/dispatch`
- `POST /api/events/{eventId}/ack`
- `POST /api/sources`
- `GET /api/sources`
- `GET /api/sources/diagnostics`
- `GET /api/sources/lifecycle`
- `GET /api/sources/schedule`
- `POST /api/sources/ingest/dry-run`
- `POST /api/sources/{sourceId}/disable`
- `POST /api/sources/{sourceId}/enable`
- `POST /api/sources/tasks/ingest`
- `POST /api/sources/tasks/ingest-due`
- `POST /api/sources/tasks/insight-pipeline-due`
- `GET /api/sources/tasks/insight-pipeline-runs`
- `POST /api/sources/{sourceId}/tasks/ingest`
- `POST /api/sources/{sourceId}/tasks/insight-pipeline`
- `POST /api/index-directory`
- `POST /api/search`

详细说明见 `docs/api.md`。运行配置见 `docs/runtime-configuration.md`。PostgreSQL 基线表结构见 `docs/postgresql-schema.sql`，持久化迁移计划见 `docs/persistence-plan.md`。

## 项目分层

- `src/domain`: 领域模型与核心分析逻辑，不依赖具体论坛、数据库或前端。
- `src/application`: 应用用例，负责编排适配器、分析器和存储。
- `src/infrastructure`: 基础设施实现，比如论坛适配器、后续数据库和采集器。
- `src/runtime`: 运行时组合根，统一装配适配器、仓库、检索索引和应用入口依赖。
- `src/presentation`: 应用入口，比如 CLI、HTTP API、Web UI。
- `docs`: 产品、架构、开发计划文档。
- `example`: 用户提供的真实样例页面。
- `test`: 面向核心解析和分析能力的轻量测试。

## 当前能力

- 解析 NGA 本地保存 HTML。
- 自动识别 GBK / GB18030 / UTF-8 HTML 编码。
- 抽取主题 ID、标题、分页、楼层、作者、uid、发布时间、正文、链接和推荐值。
- 抽取引用与回复关系候选，为后续上下文还原提供结构骨架。
- 规则型抽取观点候选，包括态度、周期、条件信号、证据片段和置信度。
- 预留数据库、LLM、检索索引和论坛采集器端口。
- 提供本地文件仓库实现，可作为 PostgreSQL 前的开发替身。
- 支持导入目录、分析并持久化主题快照和报告。
- 支持任务记录，为后续定时采集、增量分析和提醒队列打基础。
- 支持可跟踪来源注册、运行状态记录、增量水位线、变化事件、事件投递 outbox、文件/Webhook 通知通道、调度到期判断、按来源触发导入和批量导入，为多论坛、多主题和定时采集打基础。
- 支持本地历史证据检索索引，为后续 RAG 和语境召回打基础。
- 支持新发言语境还原 MVP，按实体、观点关键词和作者线索召回历史证据。
- 提供无依赖 HTTP API，供后续前端工作台和定时任务调用。
- 提供无依赖 Web 工作台原型，可直接调用本地 HTTP API。
- 输出统一 `ThreadSnapshot`。
- 支持目录内多个保存页合并，面向长帖多页归档。
- 规则型抽取市场实体与线索候选，包括股票代码、主题关键词和论坛主题链接。
- 生成基础历史分析 JSON。
- 生成可读 Markdown 报告。
- 通过适配器注册表预留多论坛接入点。

## 设计原则

- 原始证据优先：保存原文、楼层、作者、时间和链接，AI 结论必须能回溯。
- 论坛可插拔：NGA 只是第一个适配器，核心分析层只消费统一数据模型。
- 分层可演进：先本地离线跑通，再接数据库、队列、模型和前端。
- 明确区分事实与推测：报告里后续会把直接证据、模型推断和置信度分开。
