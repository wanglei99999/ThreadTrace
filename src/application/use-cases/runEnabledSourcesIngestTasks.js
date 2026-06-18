'use strict';

const { assertSourceRepository } = require('../ports/sourceRepository');
const { assertThreadRepository } = require('../ports/threadRepository');
const { assertAnalysisReportRepository } = require('../ports/analysisReportRepository');
const { assertTaskRepository } = require('../ports/taskRepository');
const { runTrackedSourceIngestTask } = require('./runTrackedSourceIngestTask');

async function runEnabledSourcesIngestTasks(options) {
  const safeOptions = options || {};
  const sourceRepository = assertSourceRepository(safeOptions.sourceRepository);
  const threadRepository = assertThreadRepository(safeOptions.threadRepository);
  const reportRepository = assertAnalysisReportRepository(safeOptions.reportRepository);
  const taskRepository = assertTaskRepository(safeOptions.taskRepository);
  const getAdapter = safeOptions.getAdapter;

  if (typeof getAdapter !== 'function') {
    throw new Error('runEnabledSourcesIngestTasks requires getAdapter(sourceKey).');
  }

  const startedAt = new Date().toISOString();
  const sources = await sourceRepository.listSources({
    sourceKey: safeOptions.sourceKey,
    enabled: true,
    limit: safeOptions.limit || 50
  });
  const results = [];

  for (const source of sources) {
    try {
      const result = await runTrackedSourceIngestTask({
        sourceId: source.id,
        sourceRepository,
        adapter: getAdapter(source.sourceKey),
        threadRepository,
        reportRepository,
        taskRepository
      });
      results.push({
        source,
        status: 'completed',
        task: result.task,
        report: result.report
      });
    } catch (error) {
      results.push({
        source,
        status: 'failed',
        error: {
          message: error.message
        }
      });
    }
  }

  return {
    startedAt,
    finishedAt: new Date().toISOString(),
    sourceCount: sources.length,
    completedCount: results.filter(function (result) {
      return result.status === 'completed';
    }).length,
    failedCount: results.filter(function (result) {
      return result.status === 'failed';
    }).length,
    results
  };
}

module.exports = {
  runEnabledSourcesIngestTasks
};
