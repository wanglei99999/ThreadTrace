'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { createNotificationEventWorker } = require('../src/presentation/worker/notificationEventWorker');

test('notification event worker skips overlapping runs', async function () {
  let releaseRun;
  let callCount = 0;
  const worker = createNotificationEventWorker({
    logger: silentLogger(),
    runtime: {
      async dispatchNotificationEvents() {
        callCount += 1;
        await new Promise(function (resolve) {
          releaseRun = resolve;
        });
        return {
          dispatchedCount: 1,
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
  assert.equal(firstResult.dispatchedCount, 1);
  assert.equal(callCount, 1);
});

function silentLogger() {
  return {
    log() {},
    warn() {},
    error() {}
  };
}
