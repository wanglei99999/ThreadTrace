'use strict';

function getAutomationCockpitSnapshot(input) {
  const safeInput = input || {};
  const plan = safeInput.plan || {};
  const notificationOverview = safeInput.notificationOverview || {};
  const reviewActionAuditOverview = safeInput.reviewActionAuditOverview || {};
  const reviewActionExecutions = safeInput.reviewActionExecutions || {};
  const notificationDiagnostics = safeInput.notificationDiagnostics || {};
  const componentStatuses = [
    plan.status,
    notificationOverview.status,
    reviewActionAuditOverview.status,
    reviewActionExecutions.status,
    notificationDiagnostics.status
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
      diagnosticsStatus: notificationDiagnostics.status || 'unknown',
      openNotificationCount: notificationOverview.openCount,
      pendingNotificationCount: notificationOverview.pendingDeliveryCount,
      auditCount: reviewActionAuditOverview.count,
      executionCount: reviewActionExecutions.count
    }
  };
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
