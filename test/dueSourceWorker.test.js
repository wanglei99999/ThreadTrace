'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { createDueSourceWorker } = require('../src/presentation/worker/dueSourceWorker');

test('due source worker skips overlapping runs', async function () {
  let releaseRun;
  let callCount = 0;
  const worker = createDueSourceWorker({
    logger: silentLogger(),
    runtime: {
      async runDueSourcesIngestTasks() {
        callCount += 1;
        await new Promise(function (resolve) {
          releaseRun = resolve;
        });
        return {
          dueCount: 1,
          completedCount: 1,
          failedCount: 0,
          skippedCount: 0
        };
      }
    }
  });

  const firstRun = worker.runOnce({});
  await waitUntil(function () { return typeof releaseRun === 'function'; });
  const secondRun = await worker.runOnce({});
  releaseRun();
  const firstResult = await firstRun;

  assert.equal(secondRun.skipped, true);
  assert.equal(secondRun.reason, 'already-running');
  assert.equal(firstResult.completedCount, 1);
  assert.equal(callCount, 1);
});

test('due source worker can run due source insight pipeline mode', async function () {
  const calls = [];
  const workerRuns = [];
  const worker = createDueSourceWorker({
    logger: silentLogger(),
    sourceTaskMode: 'insight-pipeline',
    workerRunRepository: {
      async saveWorkerRun(run) {
        workerRuns.push(Object.assign({}, run));
      },
      async findWorkerRun() {},
      async listWorkerRuns() {
        return workerRuns;
      }
    },
    runtime: {
      async runDueSourceInsightPipelineTasks(request) {
        calls.push(request);
        return {
          dueCount: 1,
          completedCount: 1,
          failedCount: 0,
          skippedCount: 0
        };
      }
    }
  });

  const result = await worker.runOnce({
    provider: 'mock'
  });

  assert.equal(result.completedCount, 1);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].provider, 'mock');
  assert.equal(calls[0].traceId, workerRuns[0].id);
});

function silentLogger() {
  return {
    log() {},
    warn() {},
    error() {}
  };
}

async function waitUntil(predicate) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (predicate()) return;
    await new Promise(function (resolve) {
      setImmediate(resolve);
    });
  }
  throw new Error('Timed out waiting for worker run to start.');
}
