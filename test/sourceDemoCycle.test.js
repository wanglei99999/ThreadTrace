'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { createMockLlmProvider } = require('../src/infrastructure/llm/mockLlmProvider');
const { createThreadTraceRuntime } = require('../src/runtime/threadTraceRuntime');

test('runtime runs a source demo cycle through pipeline, event evidence, and drilldown', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-source-demo-cycle-'));
  const runtime = createDemoRuntime(tempDir);
  const registerResult = await registerSampleSource(runtime);

  const result = await runtime.runSourceDemoCycle({
    sourceId: registerResult.source.id,
    traceId: 'demo-cycle-test',
    now: '2026-06-25T10:00:00.000Z'
  });
  const events = await runtime.listNotificationEvents({
    sourceId: registerResult.source.id,
    type: 'source-changed'
  });

  assert.equal(result.status, 'ok');
  assert.equal(result.task.status, 'completed');
  assert.equal(result.task.type, 'source-demo-cycle');
  assert.equal(result.pipeline.completedCount, 1);
  assert.equal(result.pipeline.results[0].semantic.status, 'completed');
  assert.equal(result.summary.sourceChangedEventCount, 1);
  assert.equal(result.sourceChangedEvents[0].type, 'source-changed');
  assert.equal(result.closure.status, 'review');
  assert.equal(result.closure.readyForDailyUse, false);
  assert.equal(result.closure.summary.completed, 5);
  assert.deepEqual(result.closure.summary.missingStepKeys, ['operator-acknowledgement']);
  assert.equal(result.drilldown.sourceFound, true);
  assert.equal(result.drilldown.recent.events[0].id, result.sourceChangedEvents[0].id);
  assert.equal(result.task.output.pipelineTaskId, result.pipeline.task.id);
  assert.equal(result.task.output.closure.status, 'review');
  assert.equal(events.length, 1);
  assert.equal(events[0].acknowledgedAt, undefined);
});

test('runtime source demo cycle can execute acknowledgement for generated events', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-source-demo-cycle-ack-'));
  const runtime = createDemoRuntime(tempDir);
  const registerResult = await registerSampleSource(runtime);

  const result = await runtime.runSourceDemoCycle({
    sourceId: registerResult.source.id,
    traceId: 'demo-cycle-ack-test',
    acknowledgeEvents: true,
    executeAcknowledgement: true,
    acknowledgedBy: 'test',
    now: '2026-06-25T10:00:00.000Z'
  });
  const events = await runtime.listNotificationEvents({
    sourceId: registerResult.source.id,
    type: 'source-changed',
    acknowledged: true
  });

  assert.equal(result.status, 'ok');
  assert.equal(result.acknowledgement.status, 'ok');
  assert.equal(result.acknowledgement.acknowledgedCount, 1);
  assert.equal(result.summary.openEventCount, 0);
  assert.equal(result.sourceChangedEvents[0].acknowledgedBy, 'test');
  assert.equal(result.closure.status, 'ok');
  assert.equal(result.closure.readyForDailyUse, true);
  assert.equal(result.closure.summary.completed, result.closure.summary.total);
  assert.deepEqual(result.closure.summary.missingStepKeys, []);
  assert.equal(events.length, 1);
  assert.equal(events[0].acknowledgedBy, 'test');
});

function createDemoRuntime(storeDir) {
  return createThreadTraceRuntime({
    defaultInputDir: path.resolve(__dirname, '..', 'example'),
    storeDir,
    llmProvider: createMockLlmProvider()
  });
}

function registerSampleSource(runtime) {
  return runtime.registerSource({
    forum: 'nga',
    displayName: 'NGA sample archive',
    inputDir: path.resolve(__dirname, '..', 'example'),
    intervalMinutes: 60
  });
}
