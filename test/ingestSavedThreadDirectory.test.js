'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { getForumAdapter } = require('../src/infrastructure/forum-adapters/registry');
const { ingestSavedThreadDirectory } = require('../src/application/use-cases/ingestSavedThreadDirectory');
const { createFileThreadRepository } = require('../src/infrastructure/storage/fileThreadRepository');
const { createFileAnalysisReportRepository } = require('../src/infrastructure/storage/fileAnalysisReportRepository');

test('ingest use case parses, analyzes, and persists a saved thread directory', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-ingest-'));
  const result = await ingestSavedThreadDirectory({
    adapter: getForumAdapter('nga'),
    inputDir: path.resolve(__dirname, '..', 'example'),
    threadRepository: createFileThreadRepository({
      baseDir: path.join(tempDir, 'threads')
    }),
    reportRepository: createFileAnalysisReportRepository({
      baseDir: path.join(tempDir, 'reports')
    })
  });

  assert.equal(result.threadSnapshot.sourceThreadId, '45974302');
  assert.equal(result.report.thread.parsedPostCount, 20);

  const storedThreadFile = path.join(tempDir, 'threads', 'nga', '45974302.json');
  const storedThread = JSON.parse(await fs.readFile(storedThreadFile, 'utf8'));
  assert.equal(storedThread.title, '自立自强，科学技术打头阵');
});
