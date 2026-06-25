'use strict';

const { assertSourceRepository } = require('../ports/sourceRepository');
const { assertThreadRepository } = require('../ports/threadRepository');
const { assertAnalysisReportRepository } = require('../ports/analysisReportRepository');
const { assertTaskRepository } = require('../ports/taskRepository');
const { runSourceInsightPipelineTask } = require('./runSourceInsightPipelineTask');
const { evaluateSourceRunSchedule } = require('./evaluateSourceRunSchedule');
const {
  createTaskRecord,
  markTaskCompleted,
  markTaskFailed,
  markTaskRunning
} = require('../jobs/taskRecordFactory');

async function runDueSourceInsightPipelineTasks(options) {
  const safeOptions = options || {};
  const sourceRepository = assertSourceRepository(safeOptions.sourceRepository);
  const threadRepository = assertThreadRepository(safeOptions.threadRepository);
  const reportRepository = assertAnalysisReportRepository(safeOptions.reportRepository);
  const taskRepository = assertTaskRepository(safeOptions.taskRepository);
  const getAdapter = safeOptions.getAdapter;

  if (typeof getAdapter !== 'function') {
    throw new Error('runDueSourceInsightPipelineTasks requires getAdapter(sourceKey).');
  }

  const checkedAt = safeOptions.now || new Date().toISOString();
  const semanticEnrichment = buildSemanticOptions(safeOptions);
  let batchTask = createTaskRecord('source-insight-pipeline-due-sources', {
    sourceId: safeOptions.sourceId,
    sourceKey: safeOptions.sourceKey,
    sourceType: safeOptions.sourceType,
    limit: safeOptions.limit || 50,
    checkedAt,
    semanticEnrichment,
    sourceRunStaleAfterMs: safeOptions.sourceRunStaleAfterMs,
    sourceFailureRetryBackoffMs: safeOptions.sourceFailureRetryBackoffMs,
    sourceFailureMaxRetryBackoffMs: safeOptions.sourceFailureMaxRetryBackoffMs
  }, safeOptions);
  await taskRepository.saveTask(batchTask);

  batchTask = markTaskRunning(batchTask);
  await taskRepository.saveTask(batchTask);

  try {
    const sources = await listCandidateSources(sourceRepository, {
      sourceId: safeOptions.sourceId,
      sourceKey: safeOptions.sourceKey,
      sourceType: safeOptions.sourceType,
      enabled: true,
      limit: safeOptions.limit || 50
    });
    const dueSources = [];
    const skipped = [];

    sources.forEach(function (source) {
      const decision = evaluateSourceRunSchedule(source, checkedAt, {
        sourceRunStaleAfterMs: safeOptions.sourceRunStaleAfterMs,
        sourceFailureRetryBackoffMs: safeOptions.sourceFailureRetryBackoffMs,
        sourceFailureMaxRetryBackoffMs: safeOptions.sourceFailureMaxRetryBackoffMs
      });
      if (decision.due) {
        dueSources.push({
          source,
          decision
        });
      } else {
        skipped.push({
          source,
          reason: decision.reason,
          nextRunAt: decision.nextRunAt,
          retryAt: decision.retryAt,
          failureCount: decision.failureCount,
          backoffMs: decision.backoffMs,
          baseReason: decision.baseReason
        });
      }
    });

    const results = [];
    for (const item of dueSources) {
      try {
        const result = await runSourceInsightPipelineTask({
          sourceId: item.source.id,
          sourceRepository,
          getAdapter,
          crawler: safeOptions.crawler,
          threadRepository,
          reportRepository,
          taskRepository,
          rawThreadPageRepository: safeOptions.rawThreadPageRepository,
          notificationEventRepository: safeOptions.notificationEventRepository,
          sourceIngestHandlerRegistry: safeOptions.sourceIngestHandlerRegistry,
          llmProvider: safeOptions.llmProvider,
          semanticEnrichment,
          sourceRunStaleAfterMs: safeOptions.sourceRunStaleAfterMs,
          now: checkedAt,
          requestId: safeOptions.requestId,
          traceId: safeOptions.traceId,
          idempotencyKey: safeOptions.idempotencyKey
        });
        results.push({
          source: result.ingest.source || item.source,
          status: 'completed',
          task: result.task,
          ingestTask: result.ingest.task,
          cursorDiff: result.ingest.cursorDiff,
          semantic: result.semantic,
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

    const output = summarizeDuePipelineBatch(batchTask.startedAt, checkedAt, sources, skipped, results);
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
          ingestTaskId: result.ingestTask && result.ingestTask.id,
          changed: result.cursorDiff && result.cursorDiff.changed,
          newPostCount: result.cursorDiff && result.cursorDiff.newPostCount,
          semantic: result.semantic,
          error: result.error
        };
      }),
      skipped: output.skipped.map(function (item) {
        return {
          sourceId: item.source.id,
          sourceKey: item.source.sourceKey,
          reason: item.reason,
          nextRunAt: item.nextRunAt,
          retryAt: item.retryAt,
          failureCount: item.failureCount,
          backoffMs: item.backoffMs,
          baseReason: item.baseReason
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

async function listCandidateSources(sourceRepository, query) {
  const safeQuery = query || {};
  if (safeQuery.sourceId) {
    const source = await sourceRepository.findSource(safeQuery.sourceId);
    if (!source) return [];
    if (safeQuery.sourceKey && source.sourceKey !== safeQuery.sourceKey) return [];
    if (safeQuery.sourceType && source.sourceType !== safeQuery.sourceType) return [];
    if (safeQuery.enabled === true && source.enabled !== true) return [];
    if (safeQuery.enabled === false && source.enabled !== false) return [];
    return [source];
  }
  const sources = await sourceRepository.listSources({
    sourceKey: safeQuery.sourceKey,
    enabled: safeQuery.enabled,
    limit: safeQuery.limit
  });
  if (!safeQuery.sourceType) return sources;
  return sources.filter(function (source) {
    return source.sourceType === safeQuery.sourceType;
  });
}

function buildSemanticOptions(options) {
  const safeOptions = options || {};
  return {
    enabled: safeOptions.semanticEnrichmentEnabled !== false,
    skipIfUnchanged: safeOptions.semanticSkipIfUnchanged !== false,
    baseReportType: safeOptions.baseReportType || 'basic-history',
    provider: safeOptions.provider || 'mock',
    traceId: safeOptions.traceId
  };
}

function summarizeDuePipelineBatch(startedAt, checkedAt, sources, skipped, results) {
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
  listCandidateSources,
  runDueSourceInsightPipelineTasks
};
