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
    inputDir: path.resolve(__dirname, '..', 'example'),
    intervalMinutes: 60
  });
  const sources = await runtime.listSources({});
  const dueResult = await runtime.runDueSourcesIngestTasks({});
  const skippedDueResult = await runtime.runDueSourcesIngestTasks({});
  const taskResult = await runtime.runSourceIngestTask({
    sourceId: registerResult.source.id
  });
  const sourcesAfterTask = await runtime.listSources({});
  const updateResult = await runtime.registerSource({
    forum: 'nga',
    displayName: 'Renamed sample archive',
    inputDir: path.resolve(__dirname, '..', 'example')
  });
  const batchResult = await runtime.runEnabledSourcesIngestTasks({});

  assert.equal(registerResult.created, true);
  assert.equal(sources.length, 1);
  assert.equal(sources[0].id, registerResult.source.id);
  assert.equal(dueResult.task.status, 'completed');
  assert.equal(dueResult.task.type, 'ingest-due-sources');
  assert.equal(dueResult.dueCount, 1);
  assert.equal(dueResult.completedCount, 1);
  assert.equal(skippedDueResult.dueCount, 0);
  assert.equal(skippedDueResult.skippedCount, 1);
  assert.equal(taskResult.task.status, 'completed');
  assert.equal(taskResult.threadSnapshot.sourceThreadId, '45974302');
  assert.equal(sourcesAfterTask[0].runState.status, 'completed');
  assert.equal(sourcesAfterTask[0].runState.lastTaskId, taskResult.task.id);
  assert.equal(sourcesAfterTask[0].runState.failureCount, 0);
  assert.equal(updateResult.created, false);
  assert.equal(updateResult.source.displayName, 'Renamed sample archive');
  assert.equal(updateResult.source.runState.lastTaskId, taskResult.task.id);
  assert.equal(batchResult.task.status, 'completed');
  assert.equal(batchResult.task.type, 'ingest-enabled-sources');
  assert.equal(batchResult.sourceCount, 1);
  assert.equal(batchResult.completedCount, 1);
  assert.equal(batchResult.failedCount, 0);
});
