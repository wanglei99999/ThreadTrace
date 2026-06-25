'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { createThreadTraceRuntime } = require('../src/runtime/threadTraceRuntime');

test('runtime ingests a thread-url source through crawler, raw storage, parser, and reports', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-thread-url-'));
  const html = await fs.readFile(path.resolve(__dirname, '..', 'example', '自立自强，科学技术打头阵 NGA玩家社区.html'), 'utf8');
  const runtime = createThreadTraceRuntime({
    defaultInputDir: path.resolve(__dirname, '..', 'example'),
    storeDir: tempDir,
    crawler: {
      async fetchThreadPage(request) {
        assert.equal(request.url, 'https://example.test/read.php?tid=45974302');
        return {
          html,
          finalUrl: request.url,
          contentEncoding: 'utf-8',
          metadata: {
            status: 200
          }
        };
      }
    }
  });

  const registerResult = await runtime.registerSource({
    forum: 'nga',
    sourceType: 'thread-url',
    displayName: 'NGA online sample',
    url: 'https://example.test/read.php?tid=45974302',
    intervalMinutes: 60
  });
  const result = await runtime.runSourceIngestTask({
    sourceId: registerResult.source.id
  });
  const pages = await runtime.listRawThreadPages({
    forum: 'nga'
  });
  const sources = await runtime.listSources({});
  const events = await runtime.listNotificationEvents({});

  assert.equal(result.task.type, 'ingest-thread-url');
  assert.equal(result.task.status, 'completed');
  assert.equal(result.threadSnapshot.sourceThreadId, '45974302');
  assert.equal(result.threadSnapshot.posts.length, 20);
  assert.equal(result.cursor.postCount, 20);
  assert.equal(result.cursorDiff.newPostCount, 20);
  assert.equal(result.rawPage.contentSha1.length, 40);
  assert.equal(pages.length, 1);
  assert.equal(pages[0].sourceUrl, 'https://example.test/read.php?tid=45974302');
  assert.equal(sources[0].runState.status, 'completed');
  assert.equal(sources[0].cursor.sourceThreadId, '45974302');
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'source-changed');
});

test('runtime ingests configured thread-url page windows with replay evidence', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-thread-url-pages-'));
  const html = await readExampleHtml();
  const fetchedPages = [];
  const runtime = createThreadTraceRuntime({
    defaultInputDir: path.resolve(__dirname, '..', 'example'),
    storeDir: tempDir,
    crawler: {
      async fetchThreadPage(request) {
        fetchedPages.push(request.page);
        return {
          html: html + '\n<!-- page ' + request.page + ' -->',
          finalUrl: request.url + '&page=' + request.page,
          contentEncoding: 'utf-8',
          metadata: {
            status: 200
          }
        };
      }
    }
  });

  const registerResult = await runtime.registerSource({
    forum: 'nga',
    sourceType: 'thread-url',
    displayName: 'NGA paged online sample',
    url: 'https://example.test/read.php?tid=45974302',
    startPage: 1,
    pageCount: 2,
    intervalMinutes: 60
  });
  const result = await runtime.runSourceIngestTask({
    sourceId: registerResult.source.id
  });
  const pages = await runtime.listRawThreadPages({
    forum: 'nga'
  });
  const sources = await runtime.listSources({});
  const drilldown = await runtime.getSourceOperationsDrilldown({
    sourceId: registerResult.source.id
  });

  assert.deepEqual(fetchedPages, [1, 2]);
  assert.equal(result.task.output.pagination.pageCount, 2);
  assert.equal(result.rawPages.length, 2);
  assert.equal(result.threadSnapshot.posts.length, 20);
  assert.deepEqual(result.threadSnapshot.metadata.pageNumbers, [1, 2]);
  assert.equal(result.threadSnapshot.metadata.rawPageHashes.length, 2);
  assert.equal(pages.length, 2);
  assert.deepEqual(sources[0].location, {
    url: 'https://example.test/read.php?tid=45974302',
    startPage: 1,
    pageCount: 2
  });
  assert.deepEqual(sources[0].cursor.pageNumbers, [1, 2]);
  assert.equal(sources[0].cursor.rawPageHashes.length, 2);
  assert.equal(drilldown.collectionPlan.replay.rawPageHashes.length, 2);
  assert.deepEqual(drilldown.collectionPlan.replay.pageNumbers, [1, 2]);
  assert.ok(drilldown.collectionPlan.replay.evidenceKinds.includes('raw-pages'));
});

async function readExampleHtml() {
  const exampleDir = path.resolve(__dirname, '..', 'example');
  const files = await fs.readdir(exampleDir);
  const htmlFile = files.find(function (fileName) {
    return /\.html?$/i.test(fileName);
  });
  if (!htmlFile) throw new Error('No example HTML file found.');
  return fs.readFile(path.join(exampleDir, htmlFile), 'utf8');
}
