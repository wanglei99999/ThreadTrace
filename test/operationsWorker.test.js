'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { createOperationsWorker } = require('../src/presentation/worker/operationsWorker');

test('operations worker runs due sources, event dispatch, and overview in order', async function () {
  const calls = [];
  const worker = createOperationsWorker({
    logger: silentLogger(),
    runtime: {
      async runDueSourcesIngestTasks(request) {
        calls.push(['sources', request.limit]);
        return {
          dueCount: 1,
          completedCount: 1,
          failedCount: 0
        };
      },
      async dispatchNotificationEvents(request) {
        calls.push(['events', request.limit]);
        return {
          dispatchedCount: 2,
          failedCount: 0,
          skippedCount: 0
        };
      },
      async getOperationalOverview(request) {
        calls.push(['overview', request.limit]);
        return {
          events: {
            unacknowledged: 0
          }
        };
      }
    }
  });

  const result = await worker.runOnce({
    sources: { limit: 3 },
    events: { limit: 4 },
    overview: { limit: 5 }
  });

  assert.deepEqual(calls, [
    ['sources', 3],
    ['events', 4],
    ['overview', 5]
  ]);
  assert.equal(result.dueSources.completedCount, 1);
  assert.equal(result.events.dispatchedCount, 2);
  assert.equal(result.overview.events.unacknowledged, 0);
});

test('operations worker skips overlapping runs', async function () {
  let releaseRun;
  let callCount = 0;
  const worker = createOperationsWorker({
    logger: silentLogger(),
    runtime: {
      async runDueSourcesIngestTasks() {
        callCount += 1;
        await new Promise(function (resolve) {
          releaseRun = resolve;
        });
        return {
          dueCount: 0,
          completedCount: 0,
          failedCount: 0
        };
      },
      async dispatchNotificationEvents() {
        return {
          dispatchedCount: 0,
          failedCount: 0,
          skippedCount: 0
        };
      },
      async getOperationalOverview() {
        return {
          events: {
            unacknowledged: 0
          }
        };
      }
    }
  });

  const firstRun = worker.runOnce({});
  const secondRun = await worker.runOnce({});
  releaseRun();
  await firstRun;

  assert.equal(secondRun.skipped, true);
  assert.equal(secondRun.reason, 'already-running');
  assert.equal(callCount, 1);
});

function silentLogger() {
  return {
    log() {},
    warn() {},
    error() {}
  };
}
