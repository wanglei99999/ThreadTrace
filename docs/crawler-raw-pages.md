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
```

HTTP:

```text
POST /api/crawl-page
GET /api/raw-pages
```

`fetch-thread-page` can also use `--source-id` for a registered `thread-url` source. The stored record includes `sourceKey`, `sourceThreadId`, `sourceUrl`, `contentSha1`, raw `contentText`, `fetchedAt`, and crawler metadata.

## Storage

- File mode stores records under `data/store/raw-pages`.
- PostgreSQL mode stores records in `raw_thread_pages`.
- `(source_key, content_sha1)` is the dedupe key.

## Next Integration Step

The next pipeline step should parse stored raw pages through the existing forum adapter and then call the same snapshot/report repositories used by saved HTML ingestion. That keeps online collection, parsing, analysis, and notifications independently replaceable.
