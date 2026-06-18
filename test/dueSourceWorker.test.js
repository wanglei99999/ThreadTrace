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
  const secondRun = await worker.runOnce({});
  releaseRun();
  const firstResult = await firstRun;

  assert.equal(secondRun.skipped, true);
  assert.equal(secondRun.reason, 'already-running');
  assert.equal(firstResult.completedCount, 1);
  assert.equal(callCount, 1);
});

function silentLogger() {
  return {
    log() {},
    warn() {},
    error() {}
  };
}
