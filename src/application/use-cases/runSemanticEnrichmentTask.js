'use strict';

const { assertAnalysisReportRepository } = require('../ports/analysisReportRepository');
const { assertLlmProvider } = require('../ports/llmProvider');
const { assertTaskRepository } = require('../ports/taskRepository');
const {
  createTaskRecord,
  markTaskCompleted,
  markTaskFailed,
  markTaskRunning
} = require('../jobs/taskRecordFactory');
const {
  buildIdempotentReplay,
  findReusableCompletedTask
} = require('../jobs/taskIdempotency');
const { enrichAnalysisReportWithLlm } = require('./enrichAnalysisReportWithLlm');

async function runSemanticEnrichmentTask(options) {
  const safeOptions = options || {};
  const reportRepository = assertAnalysisReportRepository(safeOptions.reportRepository);
  const taskRepository = assertTaskRepository(safeOptions.taskRepository);
  const llmProvider = assertLlmProvider(safeOptions.llmProvider);
  const sourceKey = safeOptions.sourceKey || safeOptions.forum;
  const sourceThreadId = safeOptions.sourceThreadId;
  const baseReportType = safeOptions.baseReportType || 'basic-history';

  if (!sourceKey || !sourceThreadId) {
    throw new Error('runSemanticEnrichmentTask requires sourceKey and sourceThreadId.');
  }

  let task = createTaskRecord('semantic-enrichment', {
    sourceKey,
    sourceThreadId,
    baseReportType,
    provider: safeOptions.providerKey
  }, safeOptions);
  const reusableTask = await findReusableCompletedTask(taskRepository, task);
  if (reusableTask) {
    return buildReplayResult({
      task: reusableTask,
      reportRepository
    });
  }

  await taskRepository.saveTask(task);

  task = markTaskRunning(task);
  await taskRepository.saveTask(task);

  try {
    const baseReports = await reportRepository.findReports({
      sourceKey,
      sourceThreadId,
      reportType: baseReportType
    });
    const baseReport = baseReports[0];
    if (!baseReport) {
      throw new Error('No base report found for ' + sourceKey + '/' + sourceThreadId + ' type ' + baseReportType + '.');
    }

    const enriched = await enrichAnalysisReportWithLlm({
      report: baseReport,
      llmProvider,
      providerKey: safeOptions.providerKey,
      traceId: safeOptions.traceId
    });
    const semanticReport = Object.assign({}, enriched, {
      reportType: 'semantic-enrichment',
      baseReportType,
      generatedAt: enriched.semanticInsights.generatedAt
    });
    await reportRepository.saveReport(semanticReport);

    task = markTaskCompleted(task, {
      sourceKey,
      sourceThreadId,
      baseReportType,
      reportType: semanticReport.reportType,
      semanticProvider: semanticReport.semanticInsights.provider,
      semanticTraceId: semanticReport.semanticInsights.traceId,
      summary: semanticReport.semanticInsights.summary
    });
    await taskRepository.saveTask(task);

    return {
      task,
      baseReport,
      report: semanticReport
    };
  } catch (error) {
    task = markTaskFailed(task, error);
    await taskRepository.saveTask(task);
    throw error;
  }
}

async function buildReplayResult(options) {
  const task = options.task;
  const input = task.input || {};
  const output = task.output || {};
  const baseReports = input.sourceKey && input.sourceThreadId
    ? await options.reportRepository.findReports({
      sourceKey: input.sourceKey,
      sourceThreadId: input.sourceThreadId,
      reportType: input.baseReportType || 'basic-history'
    })
    : [];
  const semanticReports = output.sourceKey && output.sourceThreadId
    ? await options.reportRepository.findReports({
      sourceKey: output.sourceKey,
      sourceThreadId: output.sourceThreadId,
      reportType: output.reportType || 'semantic-enrichment'
    })
    : [];

  return {
    task,
    baseReport: baseReports[0],
    report: semanticReports[0],
    idempotency: buildIdempotentReplay(task)
  };
}

module.exports = {
  runSemanticEnrichmentTask
};
