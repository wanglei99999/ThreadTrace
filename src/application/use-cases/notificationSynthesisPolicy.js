'use strict';

const DEFAULT_ALERT_SEVERITIES = ['critical', 'warning'];
const MUTATION_STATUSES = ['created', 'updated', 'resolved', 'reopened'];
const DEFAULT_SOURCE_ATTENTION_PRIORITY_SCORE_THRESHOLD = 70;

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
    ? DEFAULT_SOURCE_ATTENTION_PRIORITY_SCORE_THRESHOLD
    : Number(safeOptions.priorityScoreThreshold);
  return Number(item.priorityScore || 0) >= threshold;
}

function getNotificationSynthesisPolicyReport(options) {
  const safeOptions = options || {};
  const generatedAt = safeOptions.now || new Date().toISOString();
  const sourceAttentionThreshold = safeOptions.priorityScoreThreshold === undefined
    ? DEFAULT_SOURCE_ATTENTION_PRIORITY_SCORE_THRESHOLD
    : Number(safeOptions.priorityScoreThreshold);
  const eventTypes = [
    synthesisPolicyEventType({
      type: 'runbook-action',
      sourceScoped: true,
      staleResolution: true,
      reopensAutoResolved: true,
      alertRules: [
        severityRule('critical'),
        severityRule('warning')
      ]
    }),
    synthesisPolicyEventType({
      type: 'source-attention',
      sourceScoped: true,
      staleResolution: true,
      reopensAutoResolved: true,
      alertRules: [
        severityRule('critical'),
        severityRule('warning'),
        {
          key: 'priority-score-threshold',
          summary: 'Alert source attention items whose priorityScore is at or above the configured threshold.',
          threshold: sourceAttentionThreshold
        }
      ]
    }),
    synthesisPolicyEventType({
      type: 'context-review-result',
      sourceScoped: true,
      staleResolution: false,
      reopensAutoResolved: false,
      alertRules: [
        severityRule('critical'),
        severityRule('warning')
      ]
    }),
    synthesisPolicyEventType({
      type: 'author-review-queue',
      sourceScoped: true,
      staleResolution: true,
      reopensAutoResolved: true,
      alertRules: [
        {
          key: 'open-queue-item',
          summary: 'Alert durable author review queue items while status is open.'
        }
      ]
    })
  ];
  return {
    generatedAt,
    status: 'ok',
    defaults: {
      dryRun: true,
      alertSeverities: DEFAULT_ALERT_SEVERITIES.slice(),
      sourceAttentionPriorityScoreThreshold: sourceAttentionThreshold,
      immutableExistingStates: ['acknowledged', 'delivered'],
      mutationStatuses: MUTATION_STATUSES.slice()
    },
    sharedRules: [
      {
        key: 'dry-run-default',
        summary: 'Notification synthesis previews by default and only persists when execute=true or dryRun=false is supplied.'
      },
      {
        key: 'immutable-operator-or-delivered-events',
        summary: 'Acknowledged or delivered existing notification events are skipped by synthesis to preserve operator and delivery history.'
      },
      {
        key: 'preserve-delivery-state',
        summary: 'Refreshing a pending or failed event keeps delivery attempts, retry timing, errors, and acknowledgement fields.'
      },
      {
        key: 'source-scoped-stale-resolution',
        summary: 'When a source scope is supplied, stale resolution only touches events in that source scope.'
      }
    ],
    eventTypes,
    recommendedNextAction: 'Use dry-run synthesis commands before executing alerts, then dispatch and acknowledge notification events from the outbox.'
  };
}

function synthesisPolicyEventType(input) {
  return {
    type: input.type,
    sourceScoped: input.sourceScoped,
    staleResolution: input.staleResolution,
    reopensAutoResolved: input.reopensAutoResolved,
    skipsAcknowledged: true,
    skipsDelivered: true,
    preservesDeliveryState: true,
    alertRules: input.alertRules || []
  };
}

function severityRule(severity) {
  return {
    key: 'severity-' + severity,
    severity,
    summary: 'Alert when synthesized input severity is ' + severity + '.'
  };
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
  DEFAULT_SOURCE_ATTENTION_PRIORITY_SCORE_THRESHOLD,
  normalizeAlertSeverity,
  isAlertSeverity,
  shouldAlertForSourceAttention,
  getNotificationSynthesisPolicyReport,
  existingEventSkipReason,
  mergeExistingNotificationDeliveryState,
  eventMatchesSourceScope,
  isSynthesisEventMutation,
  countSynthesisResultsByStatus,
  createSynthesisResultCounts
};
