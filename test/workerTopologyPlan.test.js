'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { getWorkerTopologyPlan } = require('../src/application/use-cases/getWorkerTopologyPlan');
const { createThreadTraceRuntime } = require('../src/runtime/threadTraceRuntime');

test('worker topology plan recommends split workers for postgres storage', function () {
  const plan = getWorkerTopologyPlan({
    now: '2026-06-19T10:00:00.000Z',
    config: {
      storageMode: 'postgres',
      workers: {
        sourceTaskMode: 'insight-pipeline',
        leaseTtlMs: 300000,
        dueSourceIntervalMs: 300000,
        eventIntervalMs: 60000,
        operationsIntervalMs: 60000
      }
    },
    deploymentChecklist: {
      status: 'ok',
      items: []
    },
    operationalOverview: {
      workers: {
        running: 0,
        failed: 0,
        stale: 0
      }
    }
  });

  assert.equal(plan.generatedAt, '2026-06-19T10:00:00.000Z');
  assert.equal(plan.status, 'ok');
  assert.equal(plan.topology, 'split-workers');
  assert.equal(plan.storageMode, 'postgres');
  assert.equal(plan.sourceTaskMode, 'insight-pipeline');
  assert.equal(plan.sourceKey, undefined);
  assert.deepEqual(plan.workers.map(function (worker) { return worker.workerType; }), ['due-source', 'notification-event']);
  assert.match(plan.workers[0].command, /dueSourceWorkerMain/);
  assert.equal(plan.nextActions.length, 0);
});

test('worker topology plan scopes generated worker commands by source', function () {
  const plan = getWorkerTopologyPlan({
    now: '2026-06-19T10:00:00.000Z',
    sourceId: 'source-a',
    sourceKey: 'forum-a',
    config: {
      storageMode: 'postgres',
      workers: {
        sourceTaskMode: 'ingest',
        leaseTtlMs: 300000,
        dueSourceIntervalMs: 300000,
        eventIntervalMs: 60000,
        operationsIntervalMs: 60000
      }
    },
    deploymentChecklist: {
      status: 'ok',
      items: []
    },
    operationalOverview: {
      workers: {
        running: 0,
        failed: 0,
        stale: 0
      }
    }
  });

  assert.equal(plan.status, 'ok');
  assert.equal(plan.sourceId, 'source-a');
  assert.equal(plan.sourceKey, 'forum-a');
  assert.deepEqual(plan.scope, {
    sourceId: 'source-a',
    sourceKey: 'forum-a'
  });
  assert.equal(plan.workers[0].scope.sourceId, 'source-a');
  assert.equal(plan.workers[0].leaseKey, 'worker:due-source:source-id:source-a');
  assert.equal(plan.workers[1].leaseKey, 'worker:notification-event:source-id:source-a');
  assert.match(plan.workers[0].command, /--source-key forum-a/);
  assert.match(plan.workers[0].command, /--source-id source-a/);
  assert.match(plan.workers[1].command, /--source-key forum-a/);
  assert.match(plan.workers[1].command, /--source-id source-a/);
});

test('worker topology plan emits distinct source-scoped lease keys', function () {
  const baseOptions = {
    topology: 'operations-worker',
    config: {
      storageMode: 'postgres',
      workers: {
        sourceTaskMode: 'ingest',
        leaseTtlMs: 300000,
        operationsIntervalMs: 60000
      }
    },
    deploymentChecklist: {
      status: 'ok',
      items: []
    },
    operationalOverview: {
      workers: {
        running: 0,
        failed: 0,
        stale: 0
      }
    }
  };

  const sourceA = getWorkerTopologyPlan(Object.assign({}, baseOptions, {
    sourceId: 'source-a',
    sourceKey: 'forum-a'
  }));
  const sourceB = getWorkerTopologyPlan(Object.assign({}, baseOptions, {
    sourceId: 'source-b',
    sourceKey: 'forum-a'
  }));
  const sourceKeyOnly = getWorkerTopologyPlan(Object.assign({}, baseOptions, {
    sourceKey: 'forum-a'
  }));

  assert.equal(sourceA.workers[0].leaseKey, 'worker:operations:source-id:source-a');
  assert.equal(sourceB.workers[0].leaseKey, 'worker:operations:source-id:source-b');
  assert.notEqual(sourceA.workers[0].leaseKey, sourceB.workers[0].leaseKey);
  assert.equal(sourceKeyOnly.workers[0].leaseKey, 'worker:operations:source-key:forum-a');
});

test('worker topology plan warns when split workers use file storage', function () {
  const plan = getWorkerTopologyPlan({
    config: {
      storageMode: 'file',
      workers: {
        sourceTaskMode: 'ingest',
        leaseTtlMs: 300000,
        dueSourceIntervalMs: 300000,
        eventIntervalMs: 60000,
        operationsIntervalMs: 60000
      }
    },
    topology: 'split-workers',
    deploymentChecklist: {
      status: 'ok',
      items: []
    },
    operationalOverview: {
      workers: {
        running: 0,
        failed: 0,
        stale: 0
      }
    }
  });

  assert.equal(plan.status, 'warn');
  assert.equal(plan.checks.find(function (check) {
    return check.key === 'workers.storageMode';
  }).status, 'warn');
  assert.equal(plan.nextActions.some(function (action) {
    return action.key === 'workers.storageMode';
  }), true);
});

test('runtime worker topology plan uses current file-storage configuration', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-worker-topology-'));
  const runtime = createThreadTraceRuntime({
    env: {
      THREADTRACE_REVIEW_ACTION_EXECUTOR: 'file-audit'
    },
    storeDir: tempDir
  });
  const plan = await runtime.getWorkerTopologyPlan({
    now: '2026-06-19T10:00:00.000Z',
    storeDir: tempDir
  });

  assert.equal(plan.status, 'ok');
  assert.equal(plan.topology, 'operations-worker');
  assert.equal(plan.storageMode, 'file');
  assert.equal(plan.workers[0].workerType, 'operations');
  assert.match(plan.workers[0].command, /operationsWorkerMain/);
});
