'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { getForumAdapter } = require('../src/infrastructure/forum-adapters/registry');
const { parseSavedThread } = require('../src/application/use-cases/parseSavedThread');
const { analyzeThreadHistory } = require('../src/domain/analysis/basicHistoricalAnalyzer');
const { createTrackedSource } = require('../src/domain/models/trackedSource');
const { createFileThreadRepository } = require('../src/infrastructure/storage/fileThreadRepository');
const { createFileAnalysisReportRepository } = require('../src/infrastructure/storage/fileAnalysisReportRepository');
const { createFileSourceRepository } = require('../src/infrastructure/storage/fileSourceRepository');
const { createFileNotificationEventRepository } = require('../src/infrastructure/storage/fileNotificationEventRepository');

test('file repositories persist snapshots and reports behind application ports', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-'));
  const adapter = getForumAdapter('nga');
  const snapshot = parseSavedThread({
    adapter,
    inputPath: path.resolve(__dirname, '..', 'example', '自立自强，科学技术打头阵 NGA玩家社区.html')
  });
  const report = analyzeThreadHistory(snapshot);

  const threadRepository = createFileThreadRepository({
    baseDir: path.join(tempDir, 'threads')
  });
  const reportRepository = createFileAnalysisReportRepository({
    baseDir: path.join(tempDir, 'reports')
  });

  await threadRepository.saveSnapshot(snapshot);
  await reportRepository.saveReport(report);

  const loadedSnapshot = await threadRepository.findSnapshot({
    sourceKey: 'nga',
    sourceThreadId: '45974302'
  });
  const snapshotsByAuthor = await threadRepository.listSnapshots({
    sourceKey: 'nga',
    authorId: '150058'
  });
  const loadedReports = await reportRepository.findReports({
    sourceKey: 'nga',
    sourceThreadId: '45974302',
    reportType: 'basic-history'
  });

  assert.equal(loadedSnapshot.title, '自立自强，科学技术打头阵');
  assert.equal(snapshotsByAuthor.length, 1);
  assert.equal(loadedReports.length, 1);
  assert.equal(loadedReports[0].thread.sourceThreadId, '45974302');
});

test('file source repository atomically acquires source runs', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-source-lock-'));
  const repository = createFileSourceRepository({
    baseDir: path.join(tempDir, 'sources')
  });
  const source = createTrackedSource({
    id: 'source-1',
    sourceKey: 'custom',
    sourceType: 'custom-source',
    displayName: 'Custom source',
    location: {
      value: 'custom'
    },
    createdAt: '2026-06-19T10:00:00.000Z',
    updatedAt: '2026-06-19T10:00:00.000Z'
  });

  await repository.saveSource(source);
  const acquired = await repository.acquireSourceRun({
    sourceId: source.id,
    now: '2026-06-19T10:01:00.000Z',
    staleAfterMs: 10 * 60 * 1000
  });
  const blocked = await repository.acquireSourceRun({
    sourceId: source.id,
    now: '2026-06-19T10:02:00.000Z',
    staleAfterMs: 10 * 60 * 1000
  });
  const loaded = await repository.findSource(source.id);

  assert.equal(acquired.acquired, true);
  assert.equal(acquired.source.runState.status, 'running');
  assert.equal(blocked.acquired, false);
  assert.equal(loaded.runState.status, 'running');
  assert.equal(loaded.runState.lastStartedAt, '2026-06-19T10:01:00.000Z');
});

test('file source repository filters by source type', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-source-filter-'));
  const repository = createFileSourceRepository({
    baseDir: path.join(tempDir, 'sources')
  });

  await repository.saveSource(createTrackedSource({
    id: 'source-html',
    sourceKey: 'nga',
    sourceType: 'saved-html-directory',
    displayName: 'NGA archive',
    location: { inputDir: 'example' },
    createdAt: '2026-06-19T10:00:00.000Z',
    updatedAt: '2026-06-19T10:00:00.000Z'
  }));
  await repository.saveSource(createTrackedSource({
    id: 'source-json',
    sourceKey: 'nga',
    sourceType: 'normalized-thread-json',
    displayName: 'JSON feed',
    location: { inputFile: 'thread.json' },
    createdAt: '2026-06-19T10:00:00.000Z',
    updatedAt: '2026-06-19T10:00:00.000Z'
  }));

  const sources = await repository.listSources({
    sourceKey: 'nga',
    sourceType: 'normalized-thread-json'
  });

  assert.equal(sources.length, 1);
  assert.equal(sources[0].id, 'source-json');
});

test('file notification event repository filters by source key', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-events-'));
  const repository = createFileNotificationEventRepository({
    baseDir: path.join(tempDir, 'events')
  });

  await repository.saveEvent(notificationEvent('event-1', 'forum-a'));
  await repository.saveEvent(notificationEvent('event-2', 'forum-b'));

  const events = await repository.listEvents({
    sourceKey: 'forum-b'
  });

  assert.equal(events.length, 1);
  assert.equal(events[0].id, 'event-2');
  assert.equal(events[0].sourceKey, 'forum-b');
});

test('file notification event repository archives events inside the store', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-events-archive-'));
  const repository = createFileNotificationEventRepository({
    baseDir: path.join(tempDir, 'events')
  });

  await repository.saveEvent(notificationEvent('event-1', 'forum-a'));
  const archived = await repository.archiveEvent('event-1', {
    archivedAt: '2026-06-23T10:00:00.000Z',
    archivedBy: 'test',
    reason: 'handled',
    batchId: 'batch-1'
  });
  const activeEvents = await repository.listEvents({});
  const allEvents = await repository.listEvents({
    includeArchived: true
  });

  assert.equal(archived.id, 'event-1');
  assert.equal(archived.archivedBy, 'test');
  assert.equal(archived.archiveReason, 'handled');
  assert.equal(activeEvents.length, 0);
  assert.equal(allEvents.length, 1);
  assert.equal(allEvents[0].archivedAt, '2026-06-23T10:00:00.000Z');
});

function notificationEvent(id, sourceKey) {
  return {
    id,
    type: 'source-changed',
    severity: 'info',
    sourceId: 'source-' + sourceKey,
    sourceKey,
    title: 'Event ' + id,
    summary: 'Summary ' + id,
    createdAt: '2026-06-18T10:00:00.000Z',
    deliveryStatus: 'pending',
    deliveryAttempts: 0
  };
}
