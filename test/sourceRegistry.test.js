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
  const repeatedTaskResult = await runtime.runSourceIngestTask({
    sourceId: registerResult.source.id
  });
  const sourcesAfterRepeatedTask = await runtime.listSources({});
  const events = await runtime.listNotificationEvents({});
  const ackResult = await runtime.acknowledgeNotificationEvent({
    eventId: events[0].id,
    acknowledgedBy: 'test'
  });
  const openEvents = await runtime.listNotificationEvents({
    acknowledged: false
  });
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
  assert.equal(taskResult.cursor.postCount, 20);
  assert.equal(taskResult.cursor.lastFloor, 19);
  assert.equal(sourcesAfterTask[0].runState.status, 'completed');
  assert.equal(sourcesAfterTask[0].runState.lastTaskId, taskResult.task.id);
  assert.equal(sourcesAfterTask[0].runState.failureCount, 0);
  assert.equal(sourcesAfterTask[0].cursor.postCount, 20);
  assert.equal(sourcesAfterTask[0].cursor.lastFloor, 19);
  assert.equal(repeatedTaskResult.cursorDiff.newPostCount, 0);
  assert.equal(sourcesAfterRepeatedTask[0].runState.lastCursorDiff.newPostCount, 0);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'source-changed');
  assert.equal(events[0].payload.cursor.postCount, 20);
  assert.equal(events[0].payload.cursorDiff.newPostCount, 20);
  assert.equal(ackResult.event.acknowledgedBy, 'test');
  assert.ok(ackResult.event.acknowledgedAt);
  assert.equal(openEvents.length, 0);
  assert.equal(updateResult.created, false);
  assert.equal(updateResult.source.displayName, 'Renamed sample archive');
  assert.equal(updateResult.source.runState.lastTaskId, repeatedTaskResult.task.id);
  assert.equal(batchResult.task.status, 'completed');
  assert.equal(batchResult.task.type, 'ingest-enabled-sources');
  assert.equal(batchResult.sourceCount, 1);
  assert.equal(batchResult.completedCount, 1);
  assert.equal(batchResult.failedCount, 0);
});
