'use strict';

function getAutomationCockpitSnapshot(input) {
  const safeInput = input || {};
  const plan = safeInput.plan || {};
  const notificationOverview = safeInput.notificationOverview || {};
  const reviewActionAuditOverview = safeInput.reviewActionAuditOverview || {};
  const reviewActionExecutions = safeInput.reviewActionExecutions || {};
  const notificationDiagnostics = safeInput.notificationDiagnostics || {};
  const diagnosticsStatus = notificationDiagnostics.status || statusFromChecks(notificationDiagnostics.checks || []);
  const componentStatuses = [
    plan.status,
    notificationOverview.status,
    reviewActionAuditOverview.status,
    reviewActionExecutions.status,
    diagnosticsStatus
  ].filter(Boolean);
  const status = aggregateStatus(componentStatuses);
  return {
    schemaVersion: 'automation-cockpit-snapshot.v1',
    generatedAt: safeInput.now || plan.generatedAt || new Date().toISOString(),
    status,
    readyForUnattendedRun: Boolean(plan.readyForUnattendedRun && status === 'ok'),
    plan,
    notificationOverview,
    reviewActionAuditOverview,
    reviewActionExecutions,
    notificationDiagnostics,
    summary: {
      readinessStatus: plan.status || 'unknown',
      notificationStatus: notificationOverview.status || 'unknown',
      auditStatus: reviewActionAuditOverview.status || 'unknown',
      executionStatus: reviewActionExecutions.status || 'unknown',
      diagnosticsStatus,
      openNotificationCount: firstNumber(notificationOverview.openCount, notificationOverview.unacknowledgedCount, 0),
      pendingNotificationCount: firstNumber(notificationOverview.pendingDeliveryCount, notificationOverview.pendingCount, notificationOverview.dueForDeliveryCount, 0),
      auditCount: reviewActionAuditOverview.count,
      executionCount: reviewActionExecutions.count
    }
  };
}

function firstNumber() {
  for (let index = 0; index < arguments.length; index += 1) {
    const value = arguments[index];
    if (Number.isFinite(value)) return value;
  }
  return undefined;
}

function statusFromChecks(checks) {
  if (!checks || checks.length === 0) return 'unknown';
  return aggregateStatus(checks.map(function (check) {
    return check && check.status;
  }).filter(Boolean));
}

function aggregateStatus(statuses) {
  if (!statuses || statuses.length === 0) return 'warn';
  if (statuses.some(function (status) { return normalizeStatus(status) === 'fail'; })) return 'fail';
  if (statuses.some(function (status) { return normalizeStatus(status) === 'warn'; })) return 'warn';
  return 'ok';
}

function normalizeStatus(status) {
  if (status === 'fail' || status === 'failed' || status === 'critical' || status === 'error') return 'fail';
  if (status === 'warn' || status === 'warning' || status === 'degraded' || status === 'pending') return 'warn';
  if (status === 'ok' || status === 'ready' || status === 'healthy') return 'ok';
  return 'warn';
}

module.exports = {
  getAutomationCockpitSnapshot
};
