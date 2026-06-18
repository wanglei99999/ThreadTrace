# Persistence Plan

ThreadTrace 当前使用文件仓库作为开发期实现，生产化时优先切换到 PostgreSQL。应用层已经通过端口隔离外部资源，因此迁移重点是新增 PostgreSQL 版 infrastructure，而不是改 domain 或 use case。

## Port Mapping

| Application port | Current implementation | PostgreSQL table |
| --- | --- | --- |
| `ThreadRepository` | `createFileThreadRepository` | `thread_snapshots` |
| `AnalysisReportRepository` | `createFileAnalysisReportRepository` | `analysis_reports` |
| `TaskRepository` | `createFileTaskRepository` | `task_records` |
| `SourceRepository` | `createFileSourceRepository` | `tracked_sources` |
| `NotificationEventRepository` | `createFileNotificationEventRepository` | `notification_events` |
| `RetrievalIndex` | `createFileTextRetrievalIndex` | `retrieval_documents` |

## Storage Shape

- Keep canonical domain objects in JSONB first. This preserves adapter flexibility while the NGA parser and future forum adapters continue to evolve.
- Promote frequently queried fields into columns: source key, thread id, task status, delivery status, cursor thread id, post count, and timestamps.
- Store raw crawler output separately in `raw_thread_pages`; parser changes can then re-run from preserved evidence.
- Use `pg_trgm` for local full-text style retrieval before introducing `pgvector` or a separate vector database.

## Migration Steps

1. Add a PostgreSQL connection factory under `src/infrastructure/postgres`.
2. Implement one repository at a time behind existing ports, starting with `SourceRepository` and `TaskRepository`.
3. Extend `src/runtime/threadTraceRuntime.js` to choose file or PostgreSQL storage from configuration.
4. Add repository contract tests that run against both file and PostgreSQL implementations.
5. Backfill from existing `data/store` JSON files into the PostgreSQL tables.
6. Keep file storage available for local/offline development.

## Operational Notes

- `task_records` is the operational audit log; workers should never silently drop failed runs.
- `notification_events` is an outbox. External notification channels should dispatch from this table and update `delivery_status`.
- `tracked_sources.cursor` is the incremental ingestion watermark. Online crawlers should update it only after snapshots and reports are persisted.
- `raw_thread_pages` should be considered evidence storage. Do not delete it during parser refactors unless a separate archive exists.
