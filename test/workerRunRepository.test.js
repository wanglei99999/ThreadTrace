'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { createFileWorkerRunRepository } = require('../src/infrastructure/storage/fileWorkerRunRepository');

test('file worker run repository persists and filters worker runs', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-worker-runs-'));
  const repository = createFileWorkerRunRepository({
    baseDir: tempDir
  });

  await repository.saveWorkerRun({
    id: 'run-1',
    workerType: 'operations',
    workerId: 'worker-a',
    status: 'completed',
    input: {},
    progress: {},
    output: { ok: true },
    startedAt: '2026-06-18T10:00:00.000Z',
    updatedAt: '2026-06-18T10:01:00.000Z',
    heartbeatAt: '2026-06-18T10:01:00.000Z',
    finishedAt: '2026-06-18T10:01:00.000Z'
  });
  await repository.saveWorkerRun({
    id: 'run-2',
    workerType: 'notification-event',
    workerId: 'worker-b',
    status: 'failed',
    input: {},
    progress: {},
    error: { message: 'boom' },
    startedAt: '2026-06-18T10:02:00.000Z',
    updatedAt: '2026-06-18T10:03:00.000Z',
    heartbeatAt: '2026-06-18T10:03:00.000Z',
    finishedAt: '2026-06-18T10:03:00.000Z'
  });

  const loaded = await repository.findWorkerRun('run-1');
  const failedRuns = await repository.listWorkerRuns({ status: 'failed' });
  const operationsRuns = await repository.listWorkerRuns({ workerType: 'operations' });

  assert.equal(loaded.output.ok, true);
  assert.equal(failedRuns.length, 1);
  assert.equal(failedRuns[0].id, 'run-2');
  assert.equal(operationsRuns.length, 1);
  assert.equal(operationsRuns[0].id, 'run-1');
});
