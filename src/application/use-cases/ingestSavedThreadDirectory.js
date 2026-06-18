'use strict';

const { assertForumAdapter } = require('../../infrastructure/forum-adapters/forumAdapter');
const { assertThreadRepository } = require('../ports/threadRepository');
const { assertAnalysisReportRepository } = require('../ports/analysisReportRepository');
const { analyzeThreadHistory } = require('../../domain/analysis/basicHistoricalAnalyzer');
const { parseSavedThreadDirectory } = require('./parseSavedThreadDirectory');

async function ingestSavedThreadDirectory(options) {
  const adapter = assertForumAdapter(options.adapter);
  const threadRepository = assertThreadRepository(options.threadRepository);
  const reportRepository = assertAnalysisReportRepository(options.reportRepository);

  const threadSnapshot = parseSavedThreadDirectory({
    adapter,
    inputDir: options.inputDir
  });
  const report = analyzeThreadHistory(threadSnapshot);

  await threadRepository.saveSnapshot(threadSnapshot);
  await reportRepository.saveReport(report);

  return {
    threadSnapshot,
    report
  };
}

module.exports = {
  ingestSavedThreadDirectory
};
