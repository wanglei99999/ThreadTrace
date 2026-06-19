'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { resetTrackedSourceFailure } = require('../src/application/use-cases/resetTrackedSourceFailure');
const { createThreadTraceRuntime } = require('../src/runtime/threadTraceRuntime');

test('reset tracked source failure defaults to dry-run', async function () {
  const saved = [];
  const source = failedSource();
  const result = await resetTrackedSourceFailure({
    sourceId: source.id,
    retryNow: true,
    sourceRepository: {
      async saveSource(item) {
        saved.push(item);
      },
      async findSource() {
        return source;
      },
      async listSources() {
        return [source];
      }
    },
    now: '2026-06-19T10:00:00.000Z'
  });

  assert.equal(result.status, 'ok');
  assert.equal(result.dryRun, true);
  assert.equal(result.changed, true);
  assert.equal(result.reason, 'failure-reset-and-requeued');
  assert.equal(result.sourceAfter.runState.status, 'completed');
  assert.equal(result.sourceAfter.runState.failureCount, 0);
  assert.equal(result.sourceAfter.runState.lastError, undefined);
  assert.equal(result.sourceAfter.schedule.nextRunAt, '2026-06-19T10:00:00.000Z');
  assert.equal(saved.length, 0);
});

test('reset tracked source failure execute persists reset run state', async function () {
  const saved = [];
  const source = failedSource();
  const result = await resetTrackedSourceFailure({
    sourceId: source.id,
    execute: true,
    nextRunAt: '2026-06-19T10:05:00.000Z',
    resetBy: 'ops',
    sourceRepository: {
      async saveSource(item) {
        saved.push(item);
      },
      async findSource() {
        return source;
      },
      async listSources() {
        return [source];
      }
    },
    now: '2026-06-19T10:00:00.000Z'
  });

  assert.equal(result.dryRun, false);
  assert.equal(result.changed, true);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].runState.status, 'completed');
  assert.equal(saved[0].runState.failureCount, 0);
  assert.equal(saved[0].runState.lastError, undefined);
  assert.equal(saved[0].runState.failureResetAt, '2026-06-19T10:00:00.000Z');
  assert.equal(saved[0].runState.failureResetBy, 'ops');
  assert.equal(saved[0].schedule.nextRunAt, '2026-06-19T10:05:00.000Z');
});

test('reset tracked source failure is idempotent for non-failed source', async function () {
  const saved = [];
  const source = Object.assign({}, failedSource(), {
    runState: {
      status: 'completed',
      failureCount: 0
    }
  });
  const result = await resetTrackedSourceFailure({
    sourceId: source.id,
    execute: true,
    sourceRepository: {
      async saveSource(item) {
        saved.push(item);
      },
      async findSource() {
        return source;
      },
      async listSources() {
        return [source];
      }
    },
    now: '2026-06-19T10:00:00.000Z'
  });

  assert.equal(result.status, 'ok');
  assert.equal(result.changed, false);
  assert.equal(result.reason, 'source-not-failed');
  assert.equal(saved.length, 0);
});

test('runtime reset source failure task records audit trail and replays idempotency', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-source-failure-reset-'));
  const storeDir = path.join(tempDir, 'store');
  const runtime = createThreadTraceRuntime({
    storeDir
  });
  const registered = await runtime.registerSource({
    sourceKey: 'nga',
    sourceType: 'saved-html-directory',
    displayName: 'Failure reset sample',
    inputDir: path.resolve(__dirname, '..', 'example'),
    intervalMinutes: 60,
    storeDir
  });
  const repositories = runtime.createRepositories(storeDir);
  await repositories.sourceRepository.saveSource(Object.assign({}, registered.source, {
    runState: {
      status: 'failed',
      failureCount: 2,
      lastStartedAt: '2026-06-19T09:58:00.000Z',
      lastFinishedAt: '2026-06-19T09:59:00.000Z',
      lastError: {
        message: 'Temporary connector failure.'
      }
    }
  }));

  const first = await runtime.runResetSourceFailureTask({
    sourceId: registered.source.id,
    execute: true,
    retryNow: true,
    resetBy: 'test',
    now: '2026-06-19T10:00:00.000Z',
    storeDir,
    requestId: 'reset-request-1',
    idempotencyKey: 'reset-idem-1'
  });
  const replay = await runtime.runResetSourceFailureTask({
    sourceId: registered.source.id,
    execute: true,
    retryNow: true,
    resetBy: 'test',
    now: '2026-06-19T10:00:00.000Z',
    storeDir,
    requestId: 'reset-request-2',
    idempotencyKey: 'reset-idem-1'
  });
  const source = await repositories.sourceRepository.findSource(registered.source.id);

  assert.equal(first.task.type, 'reset-tracked-source-failure');
  assert.equal(first.task.status, 'completed');
  assert.equal(first.result.sourceAfter.runState.status, 'completed');
  assert.equal(first.result.sourceAfter.runState.failureCount, 0);
  assert.equal(source.runState.status, 'completed');
  assert.equal(source.runState.failureCount, 0);
  assert.equal(source.schedule.nextRunAt, '2026-06-19T10:00:00.000Z');
  assert.equal(replay.task.id, first.task.id);
  assert.equal(replay.idempotency.reused, true);
});

function failedSource(overrides) {
  return Object.assign({
    id: 'source-1',
    sourceKey: 'nga',
    sourceType: 'saved-html-directory',
    displayName: 'Sample failed source',
    location: {
      inputDir: 'example'
    },
    enabled: true,
    schedule: {
      intervalMinutes: 60,
      nextRunAt: '2026-06-19T09:00:00.000Z'
    },
    runState: {
      status: 'failed',
      failureCount: 2,
      lastStartedAt: '2026-06-19T09:58:00.000Z',
      lastFinishedAt: '2026-06-19T09:59:00.000Z',
      lastError: {
        message: 'Temporary connector failure.'
      }
    },
    createdAt: '2026-06-19T09:00:00.000Z',
    updatedAt: '2026-06-19T09:59:00.000Z'
  }, overrides);
}
