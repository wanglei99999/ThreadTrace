'use strict';

const { assertSourceRepository } = require('../ports/sourceRepository');
const { assertThreadRepository } = require('../ports/threadRepository');
const { assertAnalysisReportRepository } = require('../ports/analysisReportRepository');
const { assertTaskRepository } = require('../ports/taskRepository');
const { runTrackedSourceIngestTask } = require('./runTrackedSourceIngestTask');
const {
  createTaskRecord,
  markTaskCompleted,
  markTaskFailed,
  markTaskRunning
} = require('../jobs/taskRecordFactory');

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

  let batchTask = createTaskRecord('ingest-enabled-sources', {
    sourceKey: safeOptions.sourceKey,
    limit: safeOptions.limit || 50
  });
  await taskRepository.saveTask(batchTask);

  batchTask = markTaskRunning(batchTask);
  await taskRepository.saveTask(batchTask);

  try {
    const startedAt = batchTask.startedAt;
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
          source: result.source || source,
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

    const output = summarizeBatch(startedAt, sources, results);
    batchTask = markTaskCompleted(batchTask, {
      sourceCount: output.sourceCount,
      completedCount: output.completedCount,
      failedCount: output.failedCount,
      results: output.results.map(function (result) {
        return {
          sourceId: result.source.id,
          sourceKey: result.source.sourceKey,
          status: result.status,
          taskId: result.task && result.task.id,
          changed: result.cursorDiff && result.cursorDiff.changed,
          newPostCount: result.cursorDiff && result.cursorDiff.newPostCount,
          error: result.error
        };
      })
    });
    await taskRepository.saveTask(batchTask);
    return Object.assign({
      task: batchTask
    }, output);
  } catch (error) {
    batchTask = markTaskFailed(batchTask, error);
    await taskRepository.saveTask(batchTask);
    throw error;
  }
}

function summarizeBatch(startedAt, sources, results) {
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
