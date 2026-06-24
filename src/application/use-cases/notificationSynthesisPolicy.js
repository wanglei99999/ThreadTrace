'use strict';

const DEFAULT_ALERT_SEVERITIES = ['critical', 'warning'];
const MUTATION_STATUSES = ['created', 'updated', 'resolved', 'reopened'];

function normalizeAlertSeverity(severity) {
  if (severity === 'warn') return 'warning';
  return severity || 'info';
}

function isAlertSeverity(severity, options) {
  const safeOptions = options || {};
  const severities = safeOptions.alertSeverities || DEFAULT_ALERT_SEVERITIES;
  const normalized = normalizeAlertSeverity(severity);
  return severities.indexOf(normalized) !== -1;
}

function shouldAlertForSourceAttention(item, options) {
  if (!item) return false;
  const safeOptions = options || {};
  if (isAlertSeverity(item.severity, safeOptions)) return true;
  const threshold = safeOptions.priorityScoreThreshold === undefined
    ? 70
    : Number(safeOptions.priorityScoreThreshold);
  return Number(item.priorityScore || 0) >= threshold;
}

function existingEventSkipReason(event) {
  if (!event) return undefined;
  if (event.acknowledgedAt) return 'already-acknowledged';
  if (event.deliveryStatus === 'delivered') return 'already-delivered';
  return undefined;
}

function mergeExistingNotificationDeliveryState(existing, draft) {
  return Object.assign({}, draft, {
    createdAt: existing.createdAt || draft.createdAt,
    deliveryStatus: existing.deliveryStatus || draft.deliveryStatus,
    deliveryAttempts: existing.deliveryAttempts || 0,
    deliveryResult: existing.deliveryResult,
    lastDeliveryError: existing.lastDeliveryError,
    lastDeliveryAttemptAt: existing.lastDeliveryAttemptAt,
    lastDeliveredAt: existing.lastDeliveredAt,
    nextDeliveryAt: existing.nextDeliveryAt || draft.nextDeliveryAt,
    acknowledgedAt: existing.acknowledgedAt,
    acknowledgedBy: existing.acknowledgedBy,
    acknowledgementNote: existing.acknowledgementNote
  });
}

function eventMatchesSourceScope(event, scope) {
  const safeScope = scope || {};
  if (safeScope.sourceId && event.sourceId !== safeScope.sourceId) return false;
  if (safeScope.sourceKey && event.sourceKey !== safeScope.sourceKey) return false;
  return true;
}

function isSynthesisEventMutation(result) {
  return result && MUTATION_STATUSES.indexOf(result.status) !== -1;
}

function countSynthesisResultsByStatus(results, status) {
  return (results || []).filter(function (result) {
    return result.status === status;
  }).length;
}

function createSynthesisResultCounts(results) {
  const safeResults = results || [];
  return {
    eventCount: safeResults.filter(isSynthesisEventMutation).length,
    createdCount: countSynthesisResultsByStatus(safeResults, 'created'),
    updatedCount: countSynthesisResultsByStatus(safeResults, 'updated'),
    resolvedCount: countSynthesisResultsByStatus(safeResults, 'resolved'),
    reopenedCount: countSynthesisResultsByStatus(safeResults, 'reopened'),
    skippedCount: countSynthesisResultsByStatus(safeResults, 'skipped')
  };
}

module.exports = {
  DEFAULT_ALERT_SEVERITIES,
  normalizeAlertSeverity,
  isAlertSeverity,
  shouldAlertForSourceAttention,
  existingEventSkipReason,
  mergeExistingNotificationDeliveryState,
  eventMatchesSourceScope,
  isSynthesisEventMutation,
  countSynthesisResultsByStatus,
  createSynthesisResultCounts
};
