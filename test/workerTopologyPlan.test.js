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
  assert.deepEqual(plan.workers.map(function (worker) { return worker.workerType; }), ['due-source', 'notification-event']);
  assert.match(plan.workers[0].command, /dueSourceWorkerMain/);
  assert.equal(plan.nextActions.length, 0);
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

