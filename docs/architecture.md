# 架构设计

## 总体思路

ThreadTrace 采用分层架构。核心原则是：论坛采集和页面解析属于基础设施，观点建模和证据分析属于领域层，CLI、Web、定时任务只是不同入口。

```text
presentation
  CLI / HTTP API / Web UI / Scheduler
application
  use cases: parse saved thread, analyze history, interpret new post
domain
  models: Forum, Author, Thread, Post, Evidence, Opinion
  services: historical analyzer, evidence linker, opinion tracker
infrastructure
  forum adapters: NGA, future forums
  storage: file, PostgreSQL, object storage
  retrieval: full-text, vector, rerank
  llm providers: OpenAI-compatible, local model, mock
```

## 应用端口

外部资源通过应用层端口接入，避免业务用例直接依赖具体实现。

- `ThreadRepository`: 保存和读取主题快照。
- `AnalysisReportRepository`: 保存和读取分析报告。
- `LlmProvider`: 结构化语义抽取和新发言解读。
- `RetrievalIndex`: 全文、向量或混合检索。
- `ForumCrawler`: 在线获取论坛原始页面。

具体契约见 `docs/resource-interfaces.md`。

## 运行时组合根

`src/runtime/threadTraceRuntime.js` 是当前应用的组合根，负责把论坛适配器、文件仓库、检索索引和应用用例装配成统一运行时。CLI、HTTP API、未来 Worker 或 Scheduler 都应优先依赖 runtime，而不是各自创建仓库、索引或外部服务实例。
`src/runtime/threadTraceConfig.js` 负责把环境变量和入口参数规范化成统一运行配置，避免 CLI、HTTP、Worker 各自散落默认值和资源开关。

这样做的目的：
- 换 PostgreSQL、对象存储、向量库或任务队列时，只需要替换 runtime 的装配逻辑。
- 多论坛接入时，入口层只传入 `forum` / source key，领域层继续消费统一模型。
- 测试可以对 runtime 做端到端组合验证，同时保持 use case 和 domain 的单元测试轻量。

## 可扩展论坛适配器

每个论坛只需要实现统一适配器接口：

```text
ForumAdapter
  sourceKey
  parseSavedHtml(html, context) -> ThreadSnapshot
  fetchThread?(url, options) -> RawThreadPage[]
```

NGA 适配器只负责理解 NGA 的 DOM、分页、楼层、uid、引用和正文结构。应用层和领域层不直接依赖 NGA。

## 领域数据模型

当前先落地最小结构，后续可以持久化到 PostgreSQL。

- `ForumSource`: 论坛来源。
- `Author`: 作者身份。
- `ThreadSnapshot`: 单次解析得到的主题帖快照。
- `Post`: 楼层发言。
- `PostRelation`: 引用、回复、上下文关系。
- `Evidence`: 支撑某个结论的原文证据。
- `Opinion`: 从楼层中抽取出的观点。
- `OpinionChain`: 围绕实体或主题的观点时间线。
- `AnalysisReport`: 历史分析或新发言解读报告。

## 入口设计

当前已提供多种入口：

- `parse-html`: 解析本地 HTML，输出标准 JSON。
- `analyze-html`: 解析并生成基础历史分析。
- HTTP API：供网页工作台调用。
- Web UI：来源管理、历史分析、语境还原和证据检索。
- Worker：执行到期来源调度，可一次性运行或常驻轮询。

后续入口：

- Job Queue：批量解析、LLM 抽取、索引刷新。
- Web UI 深化：作者看板、主题时间线、证据报告。

## 高可用与可维护策略

- 原始 HTML 和解析结果分开保存，解析规则变更后可以重跑。
- 分析报告引用楼层证据，不把模型输出当作事实。
- 所有外部能力都通过接口接入，包括论坛、数据库、LLM、向量库和通知渠道。
- 采集任务与分析任务分离，避免论坛访问波动影响历史报告查看。
- 适配器层做容错和降级，核心领域层只处理标准结构。
