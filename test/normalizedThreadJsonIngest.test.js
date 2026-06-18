'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { validateNormalizedThreadJsonFile } = require('../src/application/use-cases/validateNormalizedThreadJsonFile');
const { createThreadTraceRuntime } = require('../src/runtime/threadTraceRuntime');

test('runtime ingests normalized thread snapshot JSON sources without a forum adapter', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-normalized-json-'));
  const inputFile = path.join(tempDir, 'thread.json');
  await fs.writeFile(inputFile, JSON.stringify({
    forum: {
      sourceKey: 'external',
      displayName: 'External System'
    },
    sourceKey: 'external',
    sourceThreadId: 'external-thread-1',
    title: 'External normalized thread',
    posts: [
      {
        sourceKey: 'external',
        sourcePostId: 'post-1',
        floor: 0,
        author: {
          sourceKey: 'external',
          sourceAuthorId: 'author-1',
          displayName: 'External Author'
        },
        publishedAt: '2026-06-19T10:00:00.000Z',
        contentText: 'A normalized source can feed ThreadTrace without HTML parsing.',
        links: [],
        relations: []
      }
    ]
  }, null, 2) + '\n', 'utf8');

  const runtime = createThreadTraceRuntime({
    storeDir: path.join(tempDir, 'store')
  });
  const registered = await runtime.registerSource({
    sourceKey: 'external',
    sourceType: 'normalized-thread-json',
    displayName: 'External normalized feed',
    location: {
      inputFile
    }
  });
  const result = await runtime.runSourceIngestTask({
    sourceId: registered.source.id,
    traceId: 'normalized-trace-1',
    idempotencyKey: 'normalized-idem-1'
  });
  const reports = await runtime.listAnalysisReports({
    sourceKey: 'external',
    sourceThreadId: 'external-thread-1'
  });

  assert.equal(result.task.type, 'ingest-normalized-thread-json');
  assert.equal(result.task.status, 'completed');
  assert.equal(result.task.input._trace.traceId, 'normalized-trace-1');
  assert.equal(result.threadSnapshot.sourceThreadId, 'external-thread-1');
  assert.equal(result.cursor.sourceThreadId, 'external-thread-1');
  assert.equal(result.cursor.postCount, 1);
  assert.equal(result.report.reportType, 'basic-history');
  assert.equal(reports[0].thread.sourceThreadId, 'external-thread-1');
});

test('normalized thread snapshot JSON validation reports file readiness', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-normalized-json-validation-'));
  const inputFile = path.join(tempDir, 'thread.json');
  await fs.writeFile(inputFile, '\uFEFF' + JSON.stringify({
    sourceKey: 'external',
    sourceThreadId: 'external-thread-2',
    title: 'Validated external thread',
    posts: []
  }, null, 2) + '\n', 'utf8');

  const valid = await validateNormalizedThreadJsonFile({
    inputFile,
    now: '2026-06-19T10:00:00.000Z'
  });
  const invalid = await validateNormalizedThreadJsonFile({
    inputFile: path.join(tempDir, 'missing.json'),
    now: '2026-06-19T10:00:00.000Z'
  });

  assert.equal(valid.valid, true);
  assert.equal(valid.status, 'ok');
  assert.equal(valid.thread.sourceThreadId, 'external-thread-2');
  assert.equal(valid.thread.postCount, 0);
  assert.equal(invalid.valid, false);
  assert.equal(invalid.status, 'fail');
  assert.equal(invalid.error.code, 'thread_json_invalid');
});
