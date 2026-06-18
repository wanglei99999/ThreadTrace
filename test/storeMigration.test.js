'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { migrateStoreRecords } = require('../src/application/use-cases/migrateStoreRecords');
const { createThreadTraceRuntime } = require('../src/runtime/threadTraceRuntime');

test('migrate store records supports dry-run and writes through repository ports', async function () {
  const sourceRepositories = fakeRepositorySet({
    sources: [{ id: 'source-1' }],
    snapshots: [{ sourceKey: 'nga', sourceThreadId: 'thread-1' }],
    reports: [{ reportType: 'basic-history', thread: { sourceKey: 'nga', sourceThreadId: 'thread-1' } }],
    tasks: [{ id: 'task-1' }],
    events: [{ id: 'event-1' }],
    rawPages: [{ sourceKey: 'nga', contentSha1: 'raw-1' }],
    workerRuns: [{ id: 'worker-run-1' }]
  });
  const targetRepositories = fakeRepositorySet({});

  const dryRun = await migrateStoreRecords({
    sourceRepositories,
    targetRepositories,
    dryRun: true
  });
  const migrated = await migrateStoreRecords({
    sourceRepositories,
    targetRepositories,
    dryRun: false
  });

  assert.equal(dryRun.migrated.sources, 1);
  assert.equal(targetRepositories.saved.sources.length, 1);
  assert.equal(targetRepositories.saved.snapshots.length, 1);
  assert.equal(targetRepositories.saved.reports.length, 1);
  assert.equal(targetRepositories.saved.tasks.length, 1);
  assert.equal(targetRepositories.saved.events.length, 1);
  assert.equal(targetRepositories.saved.rawPages.length, 1);
  assert.equal(targetRepositories.saved.workerRuns.length, 1);
  assert.equal(migrated.dryRun, false);
});

test('runtime migrates a file store into another file store', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-migrate-store-'));
  const sourceStoreDir = path.join(tempDir, 'source-store');
  const targetStoreDir = path.join(tempDir, 'target-store');
  const runtime = createThreadTraceRuntime({
    defaultInputDir: path.resolve(__dirname, '..', 'example'),
    storeDir: sourceStoreDir
  });
  const source = await runtime.registerSource({
    forum: 'nga',
    displayName: 'Migration source',
    inputDir: path.resolve(__dirname, '..', 'example')
  });
  await runtime.runSourceIngestTask({
    sourceId: source.source.id
  });

  const dryRun = await runtime.migrateStore({
    fromStoreDir: sourceStoreDir,
    toStoreDir: targetStoreDir,
    dryRun: true
  });
  const migrated = await runtime.migrateStore({
    fromStoreDir: sourceStoreDir,
    toStoreDir: targetStoreDir,
    dryRun: false
  });
  const targetRuntime = createThreadTraceRuntime({
    storeDir: targetStoreDir
  });
  const targetSources = await targetRuntime.listSources({});
  const targetTasks = await targetRuntime.listTasks({});
  const targetReports = await targetRuntime.createRepositories(targetStoreDir).reportRepository.listReports({});

  assert.equal(dryRun.migrated.sources, 1);
  assert.equal(dryRun.migrated.threadSnapshots, 1);
  assert.equal(dryRun.migrated.analysisReports, 1);
  assert.equal(migrated.dryRun, false);
  assert.equal(targetSources.length, 1);
  assert.equal(targetTasks.length, 1);
  assert.equal(targetReports.length, 1);
});

function fakeRepositorySet(records) {
  const safeRecords = records || {};
  const saved = {
    sources: [],
    snapshots: [],
    reports: [],
    tasks: [],
    events: [],
    rawPages: [],
    workerRuns: []
  };

  return {
    saved,
    sourceRepository: {
      async saveSource(source) { saved.sources.push(source); },
      async findSource() {},
      async listSources() { return safeRecords.sources || []; }
    },
    threadRepository: {
      async saveSnapshot(snapshot) { saved.snapshots.push(snapshot); },
      async findSnapshot() {},
      async listSnapshots() { return safeRecords.snapshots || []; }
    },
    reportRepository: {
      async saveReport(report) { saved.reports.push(report); },
      async findReports() { return []; },
      async listReports() { return safeRecords.reports || []; }
    },
    taskRepository: {
      async saveTask(task) { saved.tasks.push(task); },
      async findTask() {},
      async listTasks() { return safeRecords.tasks || []; }
    },
    notificationEventRepository: {
      async saveEvent(event) { saved.events.push(event); },
      async findEvent() {},
      async listEvents() { return safeRecords.events || []; }
    },
    rawThreadPageRepository: {
      async saveRawThreadPage(page) { saved.rawPages.push(page); },
      async findRawThreadPageByHash() {},
      async listRawThreadPages() { return safeRecords.rawPages || []; }
    },
    workerRunRepository: {
      async saveWorkerRun(run) { saved.workerRuns.push(run); },
      async findWorkerRun() {},
      async listWorkerRuns() { return safeRecords.workerRuns || []; }
    }
  };
}
