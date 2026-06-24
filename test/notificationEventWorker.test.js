'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { createNotificationEventWorker } = require('../src/presentation/worker/notificationEventWorker');
const { parseArgs } = require('../src/presentation/worker/notificationEventWorkerMain');

test('notification event worker main parses source scope flags', function () {
  const options = parseArgs([
    '--once',
    '--forum', 'forum-a',
    '--source-key', 'forum-a',
    '--source-id', 'source-a'
  ]);

  assert.equal(options.loop, false);
  assert.equal(options.forum, 'forum-a');
  assert.equal(options.sourceKey, 'forum-a');
  assert.equal(options.sourceId, 'source-a');
});

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
  await waitUntil(function () { return typeof releaseRun === 'function'; });
  const secondRun = await worker.runOnce({});
  releaseRun();
  const firstResult = await firstRun;

  assert.equal(secondRun.skipped, true);
  assert.equal(secondRun.reason, 'already-running');
  assert.equal(firstResult.dispatchedCount, 1);
  assert.equal(callCount, 1);
});

test('notification event worker fails before dispatch when lease renewal is lost', async function () {
  let dispatches = 0;
  const savedRuns = [];
  const worker = createNotificationEventWorker({
    logger: silentLogger(),
    workerId: 'worker-a',
    workerLeaseRepository: {
      async acquireWorkerLease() {
        return {
          acquired: true,
          lease: {
            leaseKey: 'worker:notification-event',
            workerType: 'notification-event',
            ownerId: 'worker-a',
            expiresAt: '2026-06-18T10:05:00.000Z'
          }
        };
      },
      async renewWorkerLease() {
        return {
          renewed: false,
          lease: {
            leaseKey: 'worker:notification-event',
            workerType: 'notification-event',
            ownerId: 'worker-b',
            expiresAt: '2026-06-18T10:06:00.000Z'
          }
        };
      },
      async releaseWorkerLease() {
        return { released: false };
      },
      async listWorkerLeases() {
        return [];
      }
    },
    workerRunRepository: {
      async saveWorkerRun(run) {
        savedRuns.push(Object.assign({}, run));
      },
      async findWorkerRun() {},
      async listWorkerRuns() {
        return savedRuns;
      }
    },
    runtime: {
      async dispatchNotificationEvents() {
        dispatches += 1;
        return {};
      }
    }
  });

  await assert.rejects(function () {
    return worker.runOnce({});
  }, function (error) {
    return error.code === 'worker_lease_lost' && error.details.currentOwnerId === 'worker-b';
  });

  assert.equal(dispatches, 0);
  assert.equal(savedRuns.at(-1).status, 'failed');
  assert.equal(savedRuns.at(-1).error.code, 'worker_lease_lost');
  assert.equal(savedRuns.at(-1).error.details.currentOwnerId, 'worker-b');
  assert.match(savedRuns.at(-1).error.message, /Worker lease lost/);
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
