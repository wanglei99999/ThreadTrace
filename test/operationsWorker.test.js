'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { createOperationsWorker } = require('../src/presentation/worker/operationsWorker');

test('operations worker runs due sources, event dispatch, and overview in order', async function () {
  const calls = [];
  const workerRuns = [];
  const worker = createOperationsWorker({
    logger: silentLogger(),
    workerId: 'test-worker',
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
      async runDueSourcesIngestTasks(request) {
        calls.push(['sources', request.limit, request.traceId]);
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
    ['sources', 3, workerRuns[0].id],
    ['events', 4],
    ['overview', 5]
  ]);
  assert.equal(result.dueSources.completedCount, 1);
  assert.equal(result.events.dispatchedCount, 2);
  assert.equal(result.overview.events.unacknowledged, 0);
  assert.equal(workerRuns[0].workerType, 'operations');
  assert.equal(workerRuns[0].workerId, 'test-worker');
  assert.equal(workerRuns.at(-1).status, 'completed');
  assert.equal(workerRuns.at(-1).progress.step, 'overview');
  assert.equal(workerRuns.at(-1).output.events.dispatchedCount, 2);
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
  await waitUntil(function () { return typeof releaseRun === 'function'; });
  const secondRun = await worker.runOnce({});
  releaseRun();
  await firstRun;

  assert.equal(secondRun.skipped, true);
  assert.equal(secondRun.reason, 'already-running');
  assert.equal(callCount, 1);
});

test('operations worker can run due source insight pipeline mode', async function () {
  const calls = [];
  const worker = createOperationsWorker({
    logger: silentLogger(),
    sourceTaskMode: 'insight-pipeline',
    runtime: {
      async runDueSourceInsightPipelineTasks(request) {
        calls.push(['pipelines', request.provider]);
        return {
          task: {
            type: 'source-insight-pipeline-due-sources'
          },
          dueCount: 1,
          completedCount: 1,
          failedCount: 0,
          skippedCount: 0
        };
      },
      async dispatchNotificationEvents() {
        calls.push(['events']);
        return {
          dispatchedCount: 0,
          failedCount: 0,
          skippedCount: 0
        };
      },
      async getOperationalOverview() {
        calls.push(['overview']);
        return {
          events: {
            unacknowledged: 0
          },
          workers: {
            stale: 0
          }
        };
      }
    }
  });

  const result = await worker.runOnce({
    sources: {
      provider: 'mock'
    }
  });

  assert.deepEqual(calls, [
    ['pipelines', 'mock'],
    ['events'],
    ['overview']
  ]);
  assert.equal(result.dueSources.completedCount, 1);
});

test('operations worker preserves explicit source trace id', async function () {
  const calls = [];
  const worker = createOperationsWorker({
    logger: silentLogger(),
    runtime: {
      async runDueSourcesIngestTasks(request) {
        calls.push(['sources', request.traceId]);
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

  await worker.runOnce({
    sources: {
      traceId: 'manual-source-trace'
    }
  });

  assert.deepEqual(calls, [
    ['sources', 'manual-source-trace']
  ]);
});

test('operations worker skips execution when another process holds the lease', async function () {
  let sourceRuns = 0;
  const savedRuns = [];
  const worker = createOperationsWorker({
    logger: silentLogger(),
    workerId: 'worker-b',
    workerLeaseRepository: {
      async acquireWorkerLease() {
        return {
          acquired: false,
          lease: {
            leaseKey: 'worker:operations',
            workerType: 'operations',
            ownerId: 'worker-a',
            expiresAt: '2026-06-18T10:05:00.000Z'
          }
        };
      },
      async renewWorkerLease() {
        throw new Error('should not renew');
      },
      async releaseWorkerLease() {
        throw new Error('should not release');
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
      },
      async dispatchNotificationEvents() {
        return {};
      },
      async getOperationalOverview() {
        return {};
      }
    }
  });

  const result = await worker.runOnce({});

  assert.equal(result.skipped, true);
  assert.equal(result.reason, 'lease-held');
  assert.equal(result.lease.ownerId, 'worker-a');
  assert.equal(sourceRuns, 0);
  assert.equal(savedRuns.at(-1).status, 'skipped');
  assert.equal(savedRuns.at(-1).progress.reason, 'lease-held');
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
