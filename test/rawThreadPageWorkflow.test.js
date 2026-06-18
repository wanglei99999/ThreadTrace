'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { createThreadTraceRuntime } = require('../src/runtime/threadTraceRuntime');
const { createHttpForumCrawler } = require('../src/infrastructure/crawlers/httpForumCrawler');
const { createPostgresRawThreadPageRepository } = require('../src/infrastructure/postgres/postgresRawThreadPageRepository');

test('runtime fetches and stores raw thread pages through a crawler port', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-raw-pages-'));
  const runtime = createThreadTraceRuntime({
    storeDir: tempDir,
    crawler: {
      async fetchThreadPage(request) {
        assert.equal(request.url, 'https://example.test/thread/1');
        return {
          html: '<html><title>sample</title><body>hello thread</body></html>',
          finalUrl: request.url,
          contentEncoding: 'utf-8',
          metadata: {
            status: 200,
            contentType: 'text/html; charset=utf-8'
          }
        };
      }
    }
  });

  const first = await runtime.fetchThreadPage({
    forum: 'example',
    sourceThreadId: 'thread-1',
    url: 'https://example.test/thread/1'
  });
  const second = await runtime.fetchThreadPage({
    forum: 'example',
    sourceThreadId: 'thread-1',
    url: 'https://example.test/thread/1'
  });
  const pages = await runtime.listRawThreadPages({
    forum: 'example'
  });

  assert.equal(first.duplicate, false);
  assert.equal(second.duplicate, true);
  assert.equal(first.rawPage.contentSha1, second.rawPage.contentSha1);
  assert.equal(pages.length, 1);
  assert.equal(pages[0].sourceThreadId, 'thread-1');
  assert.equal(pages[0].metadata.status, 200);
});

test('http forum crawler turns fetch responses into raw html results', async function () {
  const crawler = createHttpForumCrawler({
    fetch: async function (url, options) {
      assert.equal(url, 'https://example.test/thread/1');
      assert.equal(options.headers['user-agent'], 'ThreadTrace/0.1');
      return {
        ok: true,
        status: 200,
        url: 'https://example.test/thread/1?page=1',
        headers: {
          get(name) {
            if (name === 'content-type') return 'text/html';
            if (name === 'content-encoding') return 'gzip';
            return undefined;
          }
        },
        async text() {
          return '<html>ok</html>';
        }
      };
    }
  });

  const result = await crawler.fetchThreadPage({
    url: 'https://example.test/thread/1'
  });

  assert.equal(result.html, '<html>ok</html>');
  assert.equal(result.finalUrl, 'https://example.test/thread/1?page=1');
  assert.equal(result.contentEncoding, 'gzip');
  assert.equal(result.metadata.contentType, 'text/html');
});

test('postgres raw page repository maps list results', async function () {
  const queries = [];
  const repository = createPostgresRawThreadPageRepository({
    client: {
      async query(sql, params) {
        queries.push({ sql, params });
        return {
          rows: [
            {
              id: 1,
              source_key: 'nga',
              source_thread_id: '45974302',
              source_url: 'https://bbs.nga.cn/read.php?tid=45974302',
              page_number: 1,
              content_encoding: 'utf-8',
              content_sha1: 'abc123',
              content_text: '<html></html>',
              fetched_at: new Date('2026-06-18T10:00:00.000Z'),
              metadata: { status: 200 }
            }
          ]
        };
      }
    }
  });

  const pages = await repository.listRawThreadPages({
    sourceKey: 'nga',
    sourceThreadId: '45974302',
    limit: 5
  });

  assert.match(queries[0].sql, /from raw_thread_pages/);
  assert.deepEqual(queries[0].params, ['nga', '45974302', 5]);
  assert.equal(pages[0].sourceUrl, 'https://bbs.nga.cn/read.php?tid=45974302');
  assert.equal(pages[0].fetchedAt, '2026-06-18T10:00:00.000Z');
});
