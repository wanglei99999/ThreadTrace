'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { getForumAdapter } = require('../src/infrastructure/forum-adapters/registry');
const { parseSavedThread } = require('../src/application/use-cases/parseSavedThread');
const { analyzeThreadHistory } = require('../src/domain/analysis/basicHistoricalAnalyzer');
const { createFileThreadRepository } = require('../src/infrastructure/storage/fileThreadRepository');
const { createFileAnalysisReportRepository } = require('../src/infrastructure/storage/fileAnalysisReportRepository');

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
