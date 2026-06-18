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
