'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { createThreadTraceRuntime } = require('../src/runtime/threadTraceRuntime');

test('runtime replays a stored raw page into snapshot and report repositories', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-raw-replay-'));
  const html = await fs.readFile(path.resolve(__dirname, '..', 'example', '自立自强，科学技术打头阵 NGA玩家社区.html'), 'utf8');
  const runtime = createThreadTraceRuntime({
    storeDir: tempDir,
    crawler: {
      async fetchThreadPage(request) {
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

  const fetchResult = await runtime.fetchThreadPage({
    forum: 'nga',
    sourceThreadId: '45974302',
    url: 'https://example.test/read.php?tid=45974302'
  });
  const replayResult = await runtime.runRawThreadPageIngestTask({
    forum: 'nga',
    contentSha1: fetchResult.rawPage.contentSha1
  });
  const repositories = runtime.createRepositories(tempDir);
  const snapshot = await repositories.threadRepository.findSnapshot({
    sourceKey: 'nga',
    sourceThreadId: '45974302'
  });
  const reports = await repositories.reportRepository.findReports({
    sourceKey: 'nga',
    sourceThreadId: '45974302'
  });

  assert.equal(replayResult.task.type, 'ingest-raw-thread-page');
  assert.equal(replayResult.task.status, 'completed');
  assert.equal(replayResult.threadSnapshot.posts.length, 20);
  assert.equal(snapshot.sourceThreadId, '45974302');
  assert.equal(reports.length, 1);
  assert.equal(reports[0].thread.sourceThreadId, '45974302');
});
