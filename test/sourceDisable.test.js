'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { disableTrackedSource } = require('../src/application/use-cases/disableTrackedSource');
const { enableTrackedSource } = require('../src/application/use-cases/enableTrackedSource');
const { createThreadTraceRuntime } = require('../src/runtime/threadTraceRuntime');

test('disable tracked source defaults to dry-run', async function () {
  const saved = [];
  const source = sampleSource();
  const result = await disableTrackedSource({
    sourceId: source.id,
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
  assert.equal(result.sourceAfter.enabled, false);
  assert.equal(saved.length, 0);
});

test('disable tracked source execute persists disabled source', async function () {
  const saved = [];
  const source = sampleSource();
  const result = await disableTrackedSource({
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

  assert.equal(result.dryRun, false);
  assert.equal(result.changed, true);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].enabled, false);
});

test('disable tracked source rejects active non-stale running source', async function () {
  const saved = [];
  const source = sampleSource({
    runState: {
      status: 'running',
      lastStartedAt: '2026-06-19T09:59:00.000Z'
    }
  });

  await assert.rejects(function () {
    return disableTrackedSource({
      sourceId: source.id,
      execute: true,
      sourceRunStaleAfterMs: 10 * 60 * 1000,
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
  }, function (error) {
    assert.equal(error.code, 'source_disable_running');
    assert.equal(error.statusCode, 409);
    assert.equal(error.details.sourceId, source.id);
    assert.equal(error.details.staleAfterMs, 10 * 60 * 1000);
    return true;
  });

  assert.equal(saved.length, 0);
});

test('disable tracked source force bypasses active running guard', async function () {
  const saved = [];
  const source = sampleSource({
    runState: {
      status: 'running',
      lastStartedAt: '2026-06-19T09:59:00.000Z'
    }
  });
  const result = await disableTrackedSource({
    sourceId: source.id,
    execute: true,
    force: true,
    sourceRunStaleAfterMs: 10 * 60 * 1000,
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
  assert.equal(result.guard.running, true);
  assert.equal(result.guard.blocked, false);
  assert.equal(result.guard.forced, true);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].enabled, false);
});

test('disable tracked source allows stale running source', async function () {
  const saved = [];
  const source = sampleSource({
    runState: {
      status: 'running',
      lastStartedAt: '2026-06-19T09:00:00.000Z'
    }
  });
  const result = await disableTrackedSource({
    sourceId: source.id,
    execute: true,
    sourceRunStaleAfterMs: 10 * 60 * 1000,
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
  assert.equal(result.guard.running, true);
  assert.equal(result.guard.stale, true);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].enabled, false);
});

test('runtime disable source task records audit trail and replays idempotency', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-source-disable-'));
  const storeDir = path.join(tempDir, 'store');
  const runtime = createThreadTraceRuntime({
    storeDir
  });
  const registered = await runtime.registerSource({
    sourceKey: 'nga',
    sourceType: 'saved-html-directory',
    displayName: 'Disable sample',
    inputDir: path.resolve(__dirname, '..', 'example'),
    storeDir
  });
  const first = await runtime.runDisableSourceTask({
    sourceId: registered.source.id,
    execute: true,
    now: '2026-06-19T10:00:00.000Z',
    storeDir,
    requestId: 'disable-request-1',
    idempotencyKey: 'disable-idem-1'
  });
  const replay = await runtime.runDisableSourceTask({
    sourceId: registered.source.id,
    execute: true,
    now: '2026-06-19T10:00:00.000Z',
    storeDir,
    requestId: 'disable-request-2',
    idempotencyKey: 'disable-idem-1'
  });
  const source = await runtime.createRepositories(storeDir).sourceRepository.findSource(registered.source.id);

  assert.equal(first.task.type, 'disable-tracked-source');
  assert.equal(first.task.status, 'completed');
  assert.equal(first.result.sourceAfter.enabled, false);
  assert.equal(source.enabled, false);
  assert.equal(replay.task.id, first.task.id);
  assert.equal(replay.idempotency.reused, true);
});

test('enable tracked source defaults to dry-run', async function () {
  const saved = [];
  const source = Object.assign({}, sampleSource(), {
    enabled: false
  });
  const result = await enableTrackedSource({
    sourceId: source.id,
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
  assert.equal(result.sourceAfter.enabled, true);
  assert.equal(saved.length, 0);
});

test('runtime enable source task records audit trail and enables source', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-source-enable-'));
  const storeDir = path.join(tempDir, 'store');
  const runtime = createThreadTraceRuntime({
    storeDir
  });
  const registered = await runtime.registerSource({
    sourceKey: 'nga',
    sourceType: 'saved-html-directory',
    displayName: 'Enable sample',
    inputDir: path.resolve(__dirname, '..', 'example'),
    enabled: false,
    storeDir
  });
  const first = await runtime.runEnableSourceTask({
    sourceId: registered.source.id,
    execute: true,
    now: '2026-06-19T10:00:00.000Z',
    storeDir,
    requestId: 'enable-request-1',
    idempotencyKey: 'enable-idem-1'
  });
  const replay = await runtime.runEnableSourceTask({
    sourceId: registered.source.id,
    execute: true,
    now: '2026-06-19T10:00:00.000Z',
    storeDir,
    requestId: 'enable-request-2',
    idempotencyKey: 'enable-idem-1'
  });
  const source = await runtime.createRepositories(storeDir).sourceRepository.findSource(registered.source.id);

  assert.equal(first.task.type, 'enable-tracked-source');
  assert.equal(first.task.status, 'completed');
  assert.equal(first.result.sourceAfter.enabled, true);
  assert.equal(source.enabled, true);
  assert.equal(replay.task.id, first.task.id);
  assert.equal(replay.idempotency.reused, true);
});

function sampleSource(overrides) {
  return Object.assign({
    id: 'source-1',
    sourceKey: 'nga',
    sourceType: 'saved-html-directory',
    displayName: 'Sample source',
    location: {
      inputDir: 'example'
    },
    enabled: true,
    createdAt: '2026-06-19T09:00:00.000Z',
    updatedAt: '2026-06-19T09:00:00.000Z'
  }, overrides);
}
