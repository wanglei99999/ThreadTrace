'use strict';

const {
  assertContextReviewActionExecutionRepository
} = require('../ports/contextReviewActionExecutionRepository');
const {
  executionSourceId,
  executionSourceKey
} = require('../../domain/review-actions/contextReviewActionExecutionScope');

const DEFAULT_RUNNING_STALE_AFTER_MS = 10 * 60 * 1000;

async function listContextReviewActionExecutions(options) {
  const safeOptions = options || {};
  const repository = assertContextReviewActionExecutionRepository(safeOptions.contextReviewActionExecutionRepository);
  const generatedAt = safeOptions.now || new Date().toISOString();
  const runningStaleAfterMs = resolveRunningStaleAfterMs(safeOptions);
  const executions = await repository.listExecutions({
    action: safeOptions.action,
    status: safeOptions.status,
    taskId: safeOptions.taskId,
    sourceId: safeOptions.sourceId,
    sourceKey: safeOptions.sourceKey || safeOptions.forum,
    limit: safeOptions.limit || 50
  });
  const enrichedExecutions = executions.map(function (execution) {
    return enrichExecution(execution, generatedAt, runningStaleAfterMs);
  });
  const staleRunningExecutions = enrichedExecutions.filter(function (execution) {
    return execution.staleRunning;
  });

  return {
    generatedAt,
    status: 'ok',
    healthStatus: staleRunningExecutions.length > 0 ? 'warn' : 'ok',
    sourceId: safeOptions.sourceId,
    sourceKey: safeOptions.sourceKey || safeOptions.forum,
    count: enrichedExecutions.length,
    runningStaleAfterMs,
    staleRunningCount: staleRunningExecutions.length,
    staleRunningExecutions: staleRunningExecutions.slice(0, 10).map(summarizeExecution),
    executions: enrichedExecutions
  };
}

function resolveRunningStaleAfterMs(options) {
  if (options.runningStaleAfterMs !== undefined) return Number(options.runningStaleAfterMs);
  if (options.staleAfterMs !== undefined) return Number(options.staleAfterMs);
  return DEFAULT_RUNNING_STALE_AFTER_MS;
}

function enrichExecution(execution, now, staleAfterMs) {
  const runningSince = execution && execution.status === 'running'
    ? execution.updatedAt || execution.createdAt
    : undefined;
  const runningAgeMs = runningSince ? elapsedMs(runningSince, now) : undefined;
  const staleRunning = execution && execution.status === 'running'
    ? isStaleRunningExecution(runningAgeMs, staleAfterMs)
    : false;
  return Object.assign({}, execution, {
    sourceId: executionSourceId(execution),
    sourceKey: executionSourceKey(execution),
    runningAgeMs,
    staleRunning
  });
}

function isStaleRunningExecution(runningAgeMs, staleAfterMs) {
  if (runningAgeMs === undefined) return true;
  if (Number.isNaN(runningAgeMs)) return true;
  if (Number.isNaN(Number(staleAfterMs))) return false;
  return runningAgeMs > Number(staleAfterMs);
}

function elapsedMs(startedAt, now) {
  const startedTime = Date.parse(startedAt);
  const nowTime = Date.parse(now);
  if (Number.isNaN(startedTime) || Number.isNaN(nowTime)) return Number.NaN;
  return nowTime - startedTime;
}

function summarizeExecution(execution) {
  return {
    key: execution.key,
    action: execution.action,
    status: execution.status,
    taskId: execution.taskId,
    sourceId: execution.sourceId,
    sourceKey: execution.sourceKey,
    updatedAt: execution.updatedAt,
    createdAt: execution.createdAt,
    runningAgeMs: execution.runningAgeMs,
    filePath: execution.filePath
  };
}

module.exports = {
  DEFAULT_RUNNING_STALE_AFTER_MS,
  listContextReviewActionExecutions
};
