'use strict';

const crypto = require('crypto');

function createSourceChangedEvent(input) {
  const safeInput = input || {};
  const now = safeInput.createdAt || new Date().toISOString();
  const cursorDiff = safeInput.cursorDiff || {};
  const cursor = safeInput.cursor || {};
  const source = safeInput.source || {};

  return {
    id: safeInput.id || crypto.randomUUID(),
    type: 'source-changed',
    severity: cursorDiff.newPostCount > 0 ? 'info' : 'debug',
    sourceId: source.id,
    sourceKey: source.sourceKey,
    taskId: safeInput.task && safeInput.task.id,
    createdAt: now,
    title: source.displayName || cursor.title || source.id,
    summary: buildSummary(source, cursorDiff, cursor),
    payload: {
      source,
      cursor,
      cursorDiff
    },
    deliveryStatus: safeInput.deliveryStatus || 'pending',
    deliveryAttempts: safeInput.deliveryAttempts || 0,
    nextDeliveryAt: safeInput.nextDeliveryAt || now,
    lastDeliveryError: safeInput.lastDeliveryError,
    lastDeliveredAt: safeInput.lastDeliveredAt,
    acknowledgedAt: safeInput.acknowledgedAt
  };
}

function createRunbookActionEvent(input) {
  const safeInput = input || {};
  const action = safeInput.action || {};
  const now = safeInput.createdAt || new Date().toISOString();
  return {
    id: safeInput.id || buildRunbookActionEventId(action),
    type: 'runbook-action',
    severity: severityForRunbookAction(action),
    sourceId: action.evidence && action.evidence.sourceId,
    sourceKey: action.evidence && action.evidence.sourceKey,
    taskId: action.evidence && action.evidence.taskId,
    createdAt: now,
    title: action.title || action.key || 'Runbook action',
    summary: action.summary || action.title || action.key || 'Runbook action requires attention.',
    payload: {
      action,
      runbookGeneratedAt: safeInput.runbookGeneratedAt,
      runbookStatus: safeInput.runbookStatus
    },
    deliveryStatus: safeInput.deliveryStatus || 'pending',
    deliveryAttempts: safeInput.deliveryAttempts || 0,
    nextDeliveryAt: safeInput.nextDeliveryAt || now,
    lastDeliveryError: safeInput.lastDeliveryError,
    lastDeliveredAt: safeInput.lastDeliveredAt,
    acknowledgedAt: safeInput.acknowledgedAt,
    acknowledgedBy: safeInput.acknowledgedBy,
    acknowledgementNote: safeInput.acknowledgementNote
  };
}

function createContextReviewResultEvent(input) {
  const safeInput = input || {};
  const record = safeInput.record || {};
  const summary = record.summary || {};
  const notification = summary.notification || {};
  const now = safeInput.createdAt || new Date().toISOString();
  return {
    id: safeInput.id || buildContextReviewResultEventId(record),
    type: 'context-review-result',
    severity: notification.severity || 'info',
    sourceId: undefined,
    sourceKey: undefined,
    taskId: undefined,
    createdAt: now,
    title: 'Context review result: ' + (record.handoffId || record.id || 'unknown'),
    summary: notification.reason || summary.recommendedNextAction || 'Context review result requires attention.',
    payload: {
      recordId: record.id,
      handoffId: record.handoffId,
      status: record.status,
      reviewer: record.reviewer,
      submittedAt: record.submittedAt,
      summary
    },
    deliveryStatus: safeInput.deliveryStatus || 'pending',
    deliveryAttempts: safeInput.deliveryAttempts || 0,
    nextDeliveryAt: safeInput.nextDeliveryAt || now,
    lastDeliveryError: safeInput.lastDeliveryError,
    lastDeliveredAt: safeInput.lastDeliveredAt,
    acknowledgedAt: safeInput.acknowledgedAt,
    acknowledgedBy: safeInput.acknowledgedBy,
    acknowledgementNote: safeInput.acknowledgementNote
  };
}

function acknowledgeNotificationEvent(event, input) {
  const safeInput = input || {};
  const now = safeInput.acknowledgedAt || new Date().toISOString();
  return Object.assign({}, event, {
    acknowledgedAt: event.acknowledgedAt || now,
    acknowledgedBy: event.acknowledgedBy || safeInput.acknowledgedBy || 'system',
    acknowledgementNote: event.acknowledgementNote || safeInput.note
  });
}

function markNotificationEventDelivered(event, deliveryResult, timestamp) {
  const now = timestamp || new Date().toISOString();
  return Object.assign({}, event, {
    deliveryStatus: 'delivered',
    deliveryAttempts: (event.deliveryAttempts || 0) + 1,
    lastDeliveredAt: now,
    lastDeliveryError: undefined,
    nextDeliveryAt: undefined,
    deliveryResult: deliveryResult || {}
  });
}

function markNotificationEventDeliveryFailed(event, error, options) {
  const safeOptions = normalizeDeliveryFailureOptions(options);
  const now = safeOptions.attemptedAt || new Date().toISOString();
  return Object.assign({}, event, {
    deliveryStatus: 'failed',
    deliveryAttempts: (event.deliveryAttempts || 0) + 1,
    lastDeliveryAttemptAt: now,
    nextDeliveryAt: safeOptions.nextDeliveryAt,
    lastDeliveryError: {
      message: error && error.message ? error.message : String(error)
    }
  });
}

function normalizeDeliveryFailureOptions(options) {
  if (!options || typeof options === 'string') {
    return {
      attemptedAt: options
    };
  }
  return options;
}

function buildRunbookActionEventId(action) {
  const key = action && action.key ? action.key : 'unknown';
  const digest = crypto.createHash('sha1').update(String(key)).digest('hex').slice(0, 12);
  return 'runbook-action-' + digest;
}

function buildContextReviewResultEventId(record) {
  const key = record && record.id ? record.id : JSON.stringify({
    handoffId: record && record.handoffId,
    submittedAt: record && record.submittedAt,
    status: record && record.status
  });
  const digest = crypto.createHash('sha1').update(String(key)).digest('hex').slice(0, 12);
  return 'context-review-result-' + digest;
}

function severityForRunbookAction(action) {
  if (action && action.severity === 'critical') return 'critical';
  if (action && action.severity === 'warning') return 'warning';
  return 'info';
}

function buildSummary(source, cursorDiff, cursor) {
  const name = source.displayName || source.id || 'source';
  if (!cursorDiff.previousPostCount) {
    return name + ' initialized with ' + (cursor.postCount || 0) + ' posts.';
  }
  if (cursorDiff.newPostCount > 0) {
    return name + ' has ' + cursorDiff.newPostCount + ' new posts, now at #' + cursorDiff.nextLastFloor + '.';
  }
  return name + ' changed without new post count growth.';
}

module.exports = {
  createSourceChangedEvent,
  createRunbookActionEvent,
  createContextReviewResultEvent,
  buildRunbookActionEventId,
  buildContextReviewResultEventId,
  acknowledgeNotificationEvent,
  markNotificationEventDelivered,
  markNotificationEventDeliveryFailed
};
