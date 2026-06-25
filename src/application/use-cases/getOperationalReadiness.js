'use strict';

async function getOperationalReadiness(options) {
  const safeOptions = options || {};
  const overview = safeOptions.overview || await safeOptions.getOperationalOverview({
    sourceId: safeOptions.sourceId,
    sourceKey: safeOptions.sourceKey || safeOptions.forum,
    sourceType: safeOptions.sourceType,
    enabled: safeOptions.enabled,
    now: safeOptions.now,
    limit: safeOptions.limit,
    storeDir: safeOptions.storeDir,
    workerStaleAfterMs: safeOptions.workerStaleAfterMs
  });
  const checks = buildReadinessChecks(overview);
  const diagnostics = safeOptions.diagnostics;
  const diagnosticChecks = diagnostics && Array.isArray(diagnostics.checks)
    ? diagnostics.checks.map(toReadinessCheck)
    : [];
  const allChecks = checks.concat(diagnosticChecks);
  return {
    generatedAt: overview.generatedAt,
    status: aggregateStatus(allChecks),
    checks: allChecks,
    diagnostics,
    overview
  };
}

function buildReadinessChecks(overview) {
  const sources = overview.sources || {};
  const tasks = overview.tasks || {};
  const events = overview.events || {};
  const workers = overview.workers || {};
  const leases = workers.leases || {};
  const reviewActions = overview.reviewActions || {};
  const reviewActionExecutions = reviewActions.executions || {};

  return [
    check('sources.failed', sources.failed > 0 ? 'warn' : 'ok', sources.failed || 0, 'Tracked sources have failed runs.'),
    check('tasks.failed', tasks.failed > 0 ? 'warn' : 'ok', tasks.failed || 0, 'Recent task records include failures.'),
    check('events.failed', events.failed > 0 ? 'warn' : 'ok', events.failed || 0, 'Notification events failed delivery.'),
    check('events.dueForDelivery', events.dueForDelivery > 0 ? 'warn' : 'ok', events.dueForDelivery || 0, 'Notification events are due for delivery.'),
    check('workers.stale', workers.stale > 0 ? 'fail' : 'ok', workers.stale || 0, 'Worker runs are stale.'),
    check('workers.failed', workers.failed > 0 ? 'warn' : 'ok', workers.failed || 0, 'Recent worker runs failed.'),
    check('workerLeases.expired', leases.expired > 0 ? 'warn' : 'ok', leases.expired || 0, 'Worker leases are expired.'),
    check(
      'reviewActions.executionLedger',
      reviewActionExecutionReadinessStatus(reviewActionExecutions),
      reviewActionExecutionAttentionCount(reviewActionExecutions),
      'Review action execution ledger has no failed or stale downstream mutations.',
      {
        sourceId: reviewActionExecutions.sourceId || reviewActions.sourceId,
        sourceKey: reviewActionExecutions.sourceKey || reviewActions.sourceKey,
        count: reviewActionExecutions.count || 0,
        running: reviewActionExecutions.running || 0,
        staleRunning: reviewActionExecutions.staleRunning || 0,
        failed: reviewActionExecutions.failed || 0,
        bySourceKey: reviewActionExecutions.bySourceKey || {},
        staleRunningBySourceKey: reviewActionExecutions.staleRunningBySourceKey || {}
      }
    )
  ];
}

function reviewActionExecutionReadinessStatus(executions) {
  const safeExecutions = executions || {};
  if ((safeExecutions.failed || 0) > 0) return 'fail';
  if ((safeExecutions.staleRunning || 0) > 0) return 'fail';
  if ((safeExecutions.running || 0) > 0) return 'warn';
  if (safeExecutions.status === 'warn') return 'warn';
  return 'ok';
}

function reviewActionExecutionAttentionCount(executions) {
  const safeExecutions = executions || {};
  return (safeExecutions.failed || 0) + Math.max(safeExecutions.running || 0, safeExecutions.staleRunning || 0);
}

function check(key, status, count, summary, value) {
  const result = {
    key,
    status,
    count,
    summary
  };
  if (value !== undefined) result.value = value;
  return result;
}

function toReadinessCheck(item) {
  return {
    key: item.key,
    status: item.status,
    count: typeof item.value === 'number' ? item.value : undefined,
    value: item.value,
    summary: item.summary
  };
}

function aggregateStatus(checks) {
  if (checks.some(function (item) { return item.status === 'fail'; })) return 'fail';
  if (checks.some(function (item) { return item.status === 'warn'; })) return 'warn';
  return 'ok';
}

module.exports = {
  getOperationalReadiness,
  buildReadinessChecks
};
