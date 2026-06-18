'use strict';

const { evaluateTrackedSourceSchedule } = require('../../domain/scheduling/trackedSourceSchedule');
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

async function runDueSourcesIngestTasks(options) {
  const safeOptions = options || {};
  const sourceRepository = assertSourceRepository(safeOptions.sourceRepository);
  const threadRepository = assertThreadRepository(safeOptions.threadRepository);
  const reportRepository = assertAnalysisReportRepository(safeOptions.reportRepository);
  const taskRepository = assertTaskRepository(safeOptions.taskRepository);
  const getAdapter = safeOptions.getAdapter;

  if (typeof getAdapter !== 'function') {
    throw new Error('runDueSourcesIngestTasks requires getAdapter(sourceKey).');
  }

  const checkedAt = safeOptions.now || new Date().toISOString();
  let batchTask = createTaskRecord('ingest-due-sources', {
    sourceKey: safeOptions.sourceKey,
    limit: safeOptions.limit || 50,
    checkedAt
  });
  await taskRepository.saveTask(batchTask);

  batchTask = markTaskRunning(batchTask);
  await taskRepository.saveTask(batchTask);

  try {
    const sources = await sourceRepository.listSources({
      sourceKey: safeOptions.sourceKey,
      enabled: true,
      limit: safeOptions.limit || 50
    });
    const dueSources = [];
    const skipped = [];

    sources.forEach(function (source) {
      const decision = evaluateTrackedSourceSchedule(source, checkedAt);
      if (decision.due) {
        dueSources.push({
          source,
          decision
        });
      } else {
        skipped.push({
          source,
          reason: decision.reason,
          nextRunAt: decision.nextRunAt
        });
      }
    });

    const results = [];
    for (const item of dueSources) {
      try {
        const result = await runTrackedSourceIngestTask({
          sourceId: item.source.id,
          sourceRepository,
          adapter: getAdapter(item.source.sourceKey),
          crawler: safeOptions.crawler,
          threadRepository,
          reportRepository,
          taskRepository,
          rawThreadPageRepository: safeOptions.rawThreadPageRepository,
          notificationEventRepository: safeOptions.notificationEventRepository
        });
        results.push({
          source: result.source || item.source,
          status: 'completed',
          task: result.task,
          report: result.report,
          scheduleReason: item.decision.reason
        });
      } catch (error) {
        results.push({
          source: item.source,
          status: 'failed',
          scheduleReason: item.decision.reason,
          error: {
            message: error.message
          }
        });
      }
    }

    const output = summarizeDueBatch(batchTask.startedAt, checkedAt, sources, skipped, results);
    batchTask = markTaskCompleted(batchTask, {
      checkedAt: output.checkedAt,
      sourceCount: output.sourceCount,
      dueCount: output.dueCount,
      skippedCount: output.skippedCount,
      completedCount: output.completedCount,
      failedCount: output.failedCount,
      results: output.results.map(function (result) {
        return {
          sourceId: result.source.id,
          sourceKey: result.source.sourceKey,
          status: result.status,
          scheduleReason: result.scheduleReason,
          taskId: result.task && result.task.id,
          changed: result.cursorDiff && result.cursorDiff.changed,
          newPostCount: result.cursorDiff && result.cursorDiff.newPostCount,
          error: result.error
        };
      }),
      skipped: output.skipped.map(function (item) {
        return {
          sourceId: item.source.id,
          sourceKey: item.source.sourceKey,
          reason: item.reason,
          nextRunAt: item.nextRunAt
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

function summarizeDueBatch(startedAt, checkedAt, sources, skipped, results) {
  return {
    startedAt,
    checkedAt,
    finishedAt: new Date().toISOString(),
    sourceCount: sources.length,
    dueCount: results.length,
    skippedCount: skipped.length,
    completedCount: results.filter(function (result) {
      return result.status === 'completed';
    }).length,
    failedCount: results.filter(function (result) {
      return result.status === 'failed';
    }).length,
    skipped,
    results
  };
}

module.exports = {
  runDueSourcesIngestTasks
};
