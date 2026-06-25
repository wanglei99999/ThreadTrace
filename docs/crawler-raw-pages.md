# Crawler Raw Pages

ThreadTrace separates online fetching from forum parsing. Crawlers fetch raw HTML, raw page repositories preserve that evidence, and adapters later transform HTML into canonical `ThreadSnapshot` objects.

## Why This Layer Exists

- Forum sessions, cookies, rate limits, proxies, and retries vary by source.
- Parser changes should be replayable from preserved raw HTML.
- Online collection should be auditable before analysis or LLM enrichment.
- Future forums can add crawler implementations without changing domain analysis.

## Runtime Entrypoints

CLI:

```powershell
node src/presentation/cli/threadtrace.js fetch-thread-page --forum nga --url https://bbs.nga.cn/read.php?tid=45974302
node src/presentation/cli/threadtrace.js list-raw-pages --forum nga
node src/presentation/cli/threadtrace.js ingest-raw-page --forum nga --content-sha1 <sha1>
```

HTTP:

```text
POST /api/crawl-page
GET /api/raw-pages
POST /api/raw-pages/tasks/ingest
```

`fetch-thread-page` can also use `--source-id` for a registered `thread-url` source. The stored record includes `sourceKey`, `sourceThreadId`, `sourceUrl`, `contentSha1`, raw `contentText`, `fetchedAt`, and crawler metadata.

## Storage

- File mode stores records under `data/store/raw-pages`.
- PostgreSQL mode stores records in `raw_thread_pages`.
- `(source_key, content_sha1)` is the dedupe key.

## Thread URL Ingestion

Registered `thread-url` sources can now run through the tracked source ingestion flow:

1. `ForumCrawler` fetches the raw page.
2. `RawThreadPageRepository` stores the evidence and content hash.
3. The forum adapter parses raw HTML into a `ThreadSnapshot`.
4. The analyzer creates the report.
5. Snapshot, report, task, cursor, and notification event repositories update through the same ports used by saved HTML ingestion.

This keeps online collection, parsing, analysis, and notifications independently replaceable.

`thread-url` sources may also configure a page window with `startPage` and `pageCount`, either as top-level registration fields or inside `location`. The ingest task fetches each page in order, stores every raw HTML page by SHA-1, parses each page, merges duplicate posts into one `ThreadSnapshot`, and records `rawPageHashes`, `pageNumbers`, and raw page summaries in the task output and cursor replay evidence. Without these fields, ThreadTrace keeps the legacy single-page behavior.

Stored raw pages can also be replayed by `contentSha1`. Replay does not fetch the network again; it reuses preserved evidence to regenerate snapshots and reports after parser or analyzer changes.
