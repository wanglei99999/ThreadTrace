# 资源接口契约

ThreadTrace 的核心逻辑不直接依赖数据库、向量库、模型服务或具体论坛登录方式。应用层只依赖端口接口，基础设施层负责实现。

## 数据库

建议第一阶段使用 PostgreSQL。

基线表结构见 `docs/postgresql-schema.sql`，文件仓库到 PostgreSQL 的迁移计划见 `docs/persistence-plan.md`。

用途：

- 保存 `ThreadSnapshot`、`Post`、`Author`、`AnalysisReport`。
- 保存任务状态、跟踪来源和增量采集游标。
- 后续可接 `pgvector` 做向量检索。

应用端口：

- `ThreadRepository`
- `AnalysisReportRepository`
- `SourceRepository`

当前本地可运行实现：

- `createFileThreadRepository`
- `createFileAnalysisReportRepository`
- `createFileSourceRepository`

## LLM Provider

用途：

- 实体抽取增强。
- 观点抽取增强。
- 隐晦表达指代消解。
- 新发言语境还原报告。

应用端口：

- `LlmProvider.completeStructured(request)`

约束：

- 输出必须是结构化 JSON。
- 每个结论必须保留证据引用或标记为模型推测。
- 本地测试可使用 mock provider，不强依赖真实模型。

## 检索索引

用途：

- 按关键词、作者、实体、时间召回楼层。
- 按语义相似度召回历史观点。
- 支撑“这句话接在哪条观点链后面”的查询。

应用端口：

- `RetrievalIndex.upsertDocuments(documents)`
- `RetrievalIndex.search(query)`

可选实现：

- PostgreSQL 全文检索。
- PostgreSQL + pgvector。
- Qdrant / Milvus / Elasticsearch。

## 论坛采集器

用途：

- 在线抓取主题页。
- 管理 Cookie / Session / 访问频率。
- 处理分页和重试。

应用端口：

- `ForumCrawler.fetchThreadPage(request)`

注意：

- 采集器只负责拿原始 HTML。
- 论坛适配器只负责把 HTML 转成统一数据模型。
- 二者分离，方便后续支持浏览器导出、本地 HTML、API 拉取等多种来源。
