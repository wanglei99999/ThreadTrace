'use strict';

const {
  assertNotificationEventActionExecutionRepository
} = require('../ports/notificationEventActionExecutionRepository');

async function listNotificationEventActionExecutions(options) {
  const safeOptions = options || {};
  const repository = assertNotificationEventActionExecutionRepository(safeOptions.notificationEventActionExecutionRepository);
  const now = safeOptions.now || new Date().toISOString();
  const runningStaleAfterMs = safeOptions.runningStaleAfterMs || 10 * 60 * 1000;
  const executions = await repository.listExecutions({
    eventId: safeOptions.eventId,
    actionKey: safeOptions.actionKey || safeOptions.action,
    status: safeOptions.status,
    sourceId: safeOptions.sourceId,
    sourceKey: safeOptions.sourceKey || safeOptions.forum,
    actor: safeOptions.actor,
    limit: safeOptions.limit || 50
  });
  const decorated = executions.map(function (execution) {
    return Object.assign({}, execution, {
      staleRunning: isStaleRunning(execution, now, runningStaleAfterMs),
      runningAgeMs: runningAgeMs(execution, now)
    });
  });
  const staleRunningCount = decorated.filter(function (execution) {
    return execution.staleRunning;
  }).length;
  const failedCount = decorated.filter(function (execution) {
    return execution.status === 'failed';
  }).length;

  return {
    generatedAt: now,
    status: failedCount > 0 || staleRunningCount > 0 ? 'warn' : 'ok',
    healthStatus: failedCount > 0 || staleRunningCount > 0 ? 'warn' : 'ok',
    eventId: safeOptions.eventId,
    actionKey: safeOptions.actionKey || safeOptions.action,
    sourceId: safeOptions.sourceId,
    sourceKey: safeOptions.sourceKey || safeOptions.forum,
    actor: safeOptions.actor,
    count: decorated.length,
    runningStaleAfterMs,
    runningCount: decorated.filter(function (execution) { return execution.status === 'running'; }).length,
    completedCount: decorated.filter(function (execution) { return execution.status === 'completed'; }).length,
    failedCount,
    staleRunningCount,
    executions: decorated
  };
}

function isStaleRunning(execution, now, staleAfterMs) {
  if (!execution || execution.status !== 'running') return false;
  const age = runningAgeMs(execution, now);
  return age !== undefined && age > staleAfterMs;
}

function runningAgeMs(execution, now) {
  if (!execution || execution.status !== 'running') return undefined;
  const startedAt = Date.parse(execution.updatedAt || execution.createdAt || '');
  const nowMs = Date.parse(now);
  if (!Number.isFinite(startedAt) || !Number.isFinite(nowMs)) return undefined;
  return Math.max(0, nowMs - startedAt);
}

module.exports = {
  listNotificationEventActionExecutions
};
