'use strict';

async function getOperationalReadiness(options) {
  const safeOptions = options || {};
  const overview = safeOptions.overview || await safeOptions.getOperationalOverview({
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

  return [
    check('sources.failed', sources.failed > 0 ? 'warn' : 'ok', sources.failed || 0, 'Tracked sources have failed runs.'),
    check('tasks.failed', tasks.failed > 0 ? 'warn' : 'ok', tasks.failed || 0, 'Recent task records include failures.'),
    check('events.failed', events.failed > 0 ? 'warn' : 'ok', events.failed || 0, 'Notification events failed delivery.'),
    check('events.dueForDelivery', events.dueForDelivery > 0 ? 'warn' : 'ok', events.dueForDelivery || 0, 'Notification events are due for delivery.'),
    check('workers.stale', workers.stale > 0 ? 'fail' : 'ok', workers.stale || 0, 'Worker runs are stale.'),
    check('workers.failed', workers.failed > 0 ? 'warn' : 'ok', workers.failed || 0, 'Recent worker runs failed.'),
    check('workerLeases.expired', leases.expired > 0 ? 'warn' : 'ok', leases.expired || 0, 'Worker leases are expired.')
  ];
}

function check(key, status, count, summary) {
  return {
    key,
    status,
    count,
    summary
  };
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
