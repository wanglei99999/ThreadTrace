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

test('due source worker fails before source work when lease renewal is lost', async function () {
  let sourceRuns = 0;
  const savedRuns = [];
  const worker = createDueSourceWorker({
    logger: silentLogger(),
    workerId: 'worker-a',
    workerLeaseRepository: {
      async acquireWorkerLease() {
        return {
          acquired: true,
          lease: {
            leaseKey: 'worker:due-source',
            workerType: 'due-source',
            ownerId: 'worker-a',
            expiresAt: '2026-06-18T10:05:00.000Z'
          }
        };
      },
      async renewWorkerLease() {
        return {
          renewed: false,
          lease: {
            leaseKey: 'worker:due-source',
            workerType: 'due-source',
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
      async runDueSourcesIngestTasks() {
        sourceRuns += 1;
        return {};
      }
    }
  });

  await assert.rejects(function () {
    return worker.runOnce({});
  }, function (error) {
    return error.code === 'worker_lease_lost' && error.details.currentOwnerId === 'worker-b';
  });

  assert.equal(sourceRuns, 0);
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
