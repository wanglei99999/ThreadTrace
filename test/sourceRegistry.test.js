'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { createThreadTraceRuntime } = require('../src/runtime/threadTraceRuntime');

test('runtime registers tracked sources and runs ingest from a source', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-source-'));
  const runtime = createThreadTraceRuntime({
    defaultInputDir: path.resolve(__dirname, '..', 'example'),
    storeDir: tempDir
  });

  const registerResult = await runtime.registerSource({
    forum: 'nga',
    displayName: 'NGA sample archive',
    inputDir: path.resolve(__dirname, '..', 'example')
  });
  const sources = await runtime.listSources({});
  const taskResult = await runtime.runSourceIngestTask({
    sourceId: registerResult.source.id
  });

  assert.equal(registerResult.created, true);
  assert.equal(sources.length, 1);
  assert.equal(sources[0].id, registerResult.source.id);
  assert.equal(taskResult.task.status, 'completed');
  assert.equal(taskResult.threadSnapshot.sourceThreadId, '45974302');
});
