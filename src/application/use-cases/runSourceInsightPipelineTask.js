'use strict';

const { assertAnalysisReportRepository } = require('../ports/analysisReportRepository');
const { assertLlmProvider } = require('../ports/llmProvider');
const { assertRawThreadPageRepository } = require('../ports/rawThreadPageRepository');
const { assertSourceRepository } = require('../ports/sourceRepository');
const { assertTaskRepository } = require('../ports/taskRepository');
const { assertThreadRepository } = require('../ports/threadRepository');
const {
  createTaskRecord,
  markTaskCompleted,
  markTaskFailed,
  markTaskRunning
} = require('../jobs/taskRecordFactory');
const { runSemanticEnrichmentTask } = require('./runSemanticEnrichmentTask');
const { runTrackedSourceIngestTask } = require('./runTrackedSourceIngestTask');

async function runSourceInsightPipelineTask(options) {
  const safeOptions = options || {};
  const sourceRepository = assertSourceRepository(safeOptions.sourceRepository);
  const threadRepository = assertThreadRepository(safeOptions.threadRepository);
  const reportRepository = assertAnalysisReportRepository(safeOptions.reportRepository);
  const taskRepository = assertTaskRepository(safeOptions.taskRepository);
  const rawThreadPageRepository = safeOptions.rawThreadPageRepository
    ? assertRawThreadPageRepository(safeOptions.rawThreadPageRepository)
    : undefined;
  const sourceId = safeOptions.sourceId;

  if (!sourceId) {
    throw new Error('runSourceInsightPipelineTask requires sourceId.');
  }

  let task = createTaskRecord('source-insight-pipeline', {
    sourceId,
    semanticEnrichment: buildSemanticOptions(safeOptions.semanticEnrichment)
  }, safeOptions);
  await taskRepository.saveTask(task);

  task = markTaskRunning(task);
  await taskRepository.saveTask(task);

  try {
    const ingest = await runTrackedSourceIngestTask({
      sourceId,
      sourceRepository,
      getAdapter: safeOptions.getAdapter,
      adapter: safeOptions.adapter,
      crawler: safeOptions.crawler,
      threadRepository,
      reportRepository,
      taskRepository,
      rawThreadPageRepository,
      notificationEventRepository: safeOptions.notificationEventRepository,
      sourceIngestHandlerRegistry: safeOptions.sourceIngestHandlerRegistry,
      sourceRunStaleAfterMs: safeOptions.sourceRunStaleAfterMs,
      now: safeOptions.now,
      requestId: safeOptions.requestId,
      traceId: safeOptions.traceId,
      idempotencyKey: safeOptions.idempotencyKey
    });
    const semantic = await maybeRunSemanticEnrichment({
      ingest,
      semanticEnrichment: buildSemanticOptions(safeOptions.semanticEnrichment),
      llmProvider: safeOptions.llmProvider,
      reportRepository,
      taskRepository,
      requestId: safeOptions.requestId,
      traceId: safeOptions.traceId,
      idempotencyKey: safeOptions.idempotencyKey
    });

    task = markTaskCompleted(task, {
      sourceId,
      sourceKey: ingest.source.sourceKey,
      sourceThreadId: ingest.cursor.sourceThreadId,
      ingestTaskId: ingest.task.id,
      cursorDiff: ingest.cursorDiff,
      semantic
    });
    await taskRepository.saveTask(task);

    return {
      task,
      ingest,
      semantic
    };
  } catch (error) {
    task = markTaskFailed(task, error);
    await taskRepository.saveTask(task);
    throw error;
  }
}

async function maybeRunSemanticEnrichment(options) {
  const semanticOptions = options.semanticEnrichment;
  if (semanticOptions.enabled === false) {
    return {
      status: 'skipped',
      reason: 'disabled'
    };
  }
  if (semanticOptions.skipIfUnchanged !== false && options.ingest.cursorDiff && options.ingest.cursorDiff.changed === false) {
    return {
      status: 'skipped',
      reason: 'unchanged'
    };
  }
  const llmProvider = assertLlmProvider(options.llmProvider);
  const result = await runSemanticEnrichmentTask({
    sourceKey: options.ingest.cursor.sourceKey,
    sourceThreadId: options.ingest.cursor.sourceThreadId,
    baseReportType: semanticOptions.baseReportType,
    providerKey: semanticOptions.provider,
    traceId: semanticOptions.traceId,
    reportRepository: options.reportRepository,
    taskRepository: options.taskRepository,
    llmProvider,
    requestId: options.requestId,
    idempotencyKey: options.idempotencyKey
  });
  return {
    status: 'completed',
    taskId: result.task.id,
    reportType: result.report.reportType,
    provider: result.report.semanticInsights.provider,
    traceId: result.report.semanticInsights.traceId,
    summary: result.report.semanticInsights.summary
  };
}

function buildSemanticOptions(value) {
  const safeValue = value || {};
  return {
    enabled: safeValue.enabled !== false,
    skipIfUnchanged: safeValue.skipIfUnchanged !== false,
    baseReportType: safeValue.baseReportType || 'basic-history',
    provider: safeValue.provider || 'mock',
    traceId: safeValue.traceId
  };
}

module.exports = {
  runSourceInsightPipelineTask
};
