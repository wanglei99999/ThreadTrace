'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { createThreadTraceRuntime } = require('../src/runtime/threadTraceRuntime');

test('runtime composes adapters, repositories, tasks, and retrieval index', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-runtime-'));
  const runtime = createThreadTraceRuntime({
    defaultInputDir: path.resolve(__dirname, '..', 'example'),
    storeDir: tempDir
  });

  assert.equal(runtime.defaults.defaultForum, 'nga');
  assert.equal(runtime.listAdapters()[0].sourceKey, 'nga');

  const ingestResult = await runtime.ingestDirectory({});
  const taskResult = await runtime.runIngestDirectoryTask({});
  const tasks = await runtime.listTasks({});
  const indexResult = await runtime.indexDirectory({});
  const searchResults = await runtime.search({
    text: '科技',
    limit: 3
  });

  assert.equal(ingestResult.threadSnapshot.sourceThreadId, '45974302');
  assert.equal(taskResult.task.status, 'completed');
  assert.equal(tasks.length, 1);
  assert.equal(indexResult.indexedDocumentCount, 20);
  assert.ok(searchResults.length >= 1);
  assert.equal(searchResults[0].metadata.sourceThreadId, '45974302');
});
