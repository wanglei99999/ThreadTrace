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
  const scope = contextReviewResultScope(record);
  const now = safeInput.createdAt || new Date().toISOString();
  return {
    id: safeInput.id || buildContextReviewResultEventId(record),
    type: 'context-review-result',
    severity: notification.severity || 'info',
    sourceId: scope.sourceId,
    sourceKey: scope.sourceKey,
    taskId: undefined,
    createdAt: now,
    title: 'Context review result: ' + (record.handoffId || record.id || 'unknown'),
    summary: notification.reason || summary.recommendedNextAction || 'Context review result requires attention.',
    payload: {
      recordId: record.id,
      handoffId: record.handoffId,
      sourceId: scope.sourceId,
      sourceKey: scope.sourceKey,
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

function createAuthorReviewQueueEvent(input) {
  const safeInput = input || {};
  const item = safeInput.item || {};
  const now = safeInput.createdAt || new Date().toISOString();
  return {
    id: safeInput.id || buildAuthorReviewQueueEventId(item),
    type: 'author-review-queue',
    severity: severityForAuthorReviewQueueItem(item),
    sourceId: undefined,
    sourceKey: item.sourceKey,
    taskId: undefined,
    createdAt: now,
    title: item.title || 'Author intelligence review item',
    summary: item.summary || item.nextAction || 'Author intelligence review queue item requires attention.',
    payload: {
      itemId: item.id,
      queueKey: item.queueKey,
      status: item.status,
      type: item.type,
      priority: item.priority,
      score: item.score,
      sourceKey: item.sourceKey,
      sourceThreadId: item.sourceThreadId,
      floor: item.floor,
      sourcePostId: item.sourcePostId,
      author: item.author,
      entity: item.entity,
      refs: item.refs || [],
      reason: item.reason,
      nextAction: item.nextAction,
      seenCount: item.seenCount,
      lastSeenAt: item.lastSeenAt
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

function createSourceAttentionEvent(input) {
  const safeInput = input || {};
  const item = safeInput.item || {};
  const source = item.source || {};
  const now = safeInput.createdAt || new Date().toISOString();
  return {
    id: safeInput.id || buildSourceAttentionEventId(item),
    type: 'source-attention',
    severity: severityForSourceAttentionItem(item),
    sourceId: source.id,
    sourceKey: source.sourceKey,
    taskId: undefined,
    createdAt: now,
    title: 'Source attention: ' + (source.displayName || source.id || source.sourceKey || item.key || 'unknown-source'),
    summary: sourceAttentionSummary(item),
    payload: {
      attentionKey: item.key,
      attentionRank: item.attentionRank,
      priorityScore: item.priorityScore,
      severity: item.severity,
      signalCount: item.signalCount,
      runnable: item.runnable,
      source,
      signals: item.signals || [],
      commands: item.commands || [],
      recommendedNextAction: item.recommendedNextAction || item.nextAction,
      recommendedCommand: item.recommendedCommand,
      reportGeneratedAt: safeInput.reportGeneratedAt,
      reportStatus: safeInput.reportStatus
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

function createSourceTypeOperationsEvent(input) {
  const safeInput = input || {};
  const item = safeInput.item || {};
  const now = safeInput.createdAt || new Date().toISOString();
  return {
    id: safeInput.id || buildSourceTypeOperationsEventId(item),
    type: 'source-type-operations',
    severity: severityForSourceTypeOperationsItem(item),
    sourceId: undefined,
    sourceKey: undefined,
    taskId: undefined,
    createdAt: now,
    title: 'Source type operations: ' + (item.sourceType || 'unknown'),
    summary: sourceTypeOperationsSummary(item),
    payload: {
      sourceType: item.sourceType,
      status: item.status,
      readiness: item.readiness,
      schedule: item.schedule,
      lifecycle: item.lifecycle,
      attention: item.attention,
      nextActions: item.nextActions || [],
      recommendedCommands: item.recommendedCommands || [],
      topAttention: item.topAttention || [],
      reportGeneratedAt: safeInput.reportGeneratedAt,
      reportStatus: safeInput.reportStatus
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
  const evidence = action && action.evidence || {};
  const scopedKey = evidence.sourceId || evidence.sourceKey
    ? JSON.stringify({
      key,
      sourceId: evidence.sourceId,
      sourceKey: evidence.sourceKey
    })
    : String(key);
  const digest = crypto.createHash('sha1').update(scopedKey).digest('hex').slice(0, 12);
  return 'runbook-action-' + digest;
}

function buildContextReviewResultEventId(record) {
  const scope = contextReviewResultScope(record);
  const recordKey = record && record.id ? record.id : JSON.stringify({
    handoffId: record && record.handoffId,
    submittedAt: record && record.submittedAt,
    status: record && record.status
  });
  const key = scope.sourceId || scope.sourceKey
    ? JSON.stringify({
      recordKey,
      sourceId: scope.sourceId,
      sourceKey: scope.sourceKey
    })
    : recordKey;
  const digest = crypto.createHash('sha1').update(String(key)).digest('hex').slice(0, 12);
  return 'context-review-result-' + digest;
}

function contextReviewResultScope(record) {
  const safeRecord = record || {};
  const result = safeRecord.result || {};
  const trace = safeRecord.trace || {};
  return {
    sourceId: safeRecord.sourceId || result.sourceId || trace.sourceId,
    sourceKey: safeRecord.sourceKey || result.sourceKey || result.forum || trace.sourceKey || trace.forum
  };
}

function buildAuthorReviewQueueEventId(item) {
  const key = item && item.id ? item.id : JSON.stringify({
    queueKey: item && item.queueKey,
    sourceKey: item && item.sourceKey,
    sourceThreadId: item && item.sourceThreadId,
    floor: item && item.floor,
    type: item && item.type
  });
  const digest = crypto.createHash('sha1').update(String(key)).digest('hex').slice(0, 12);
  return 'author-review-queue-' + digest;
}

function buildSourceAttentionEventId(item) {
  const source = item && item.source || {};
  const key = JSON.stringify({
    attentionKey: item && item.key,
    sourceId: source.id,
    sourceKey: source.sourceKey
  });
  const digest = crypto.createHash('sha1').update(key).digest('hex').slice(0, 12);
  return 'source-attention-' + digest;
}

function buildSourceTypeOperationsEventId(item) {
  const key = JSON.stringify({
    sourceType: item && item.sourceType
  });
  const digest = crypto.createHash('sha1').update(key).digest('hex').slice(0, 12);
  return 'source-type-operations-' + digest;
}

function severityForRunbookAction(action) {
  if (action && action.severity === 'critical') return 'critical';
  if (action && action.severity === 'warning') return 'warning';
  return 'info';
}

function severityForAuthorReviewQueueItem(item) {
  if (item && item.priority === 'high') return 'warning';
  return 'info';
}

function severityForSourceAttentionItem(item) {
  if (item && item.severity === 'critical') return 'critical';
  if (item && (item.severity === 'warning' || item.severity === 'warn')) return 'warning';
  return 'info';
}

function severityForSourceTypeOperationsItem(item) {
  if (item && item.status === 'fail') return 'critical';
  const lifecycle = item && item.lifecycle || {};
  const attention = item && item.attention || {};
  if ((attention.critical || 0) > 0) return 'critical';
  if ((attention.warning || 0) > 0 ||
    (lifecycle.disableBlocked || 0) > 0 ||
    (lifecycle.staleRunning || 0) > 0 ||
    (lifecycle.failureRetryWaiting || 0) > 0) return 'warning';
  return 'info';
}

function sourceAttentionSummary(item) {
  const signals = item.signals || [];
  const firstSignal = signals[0] || {};
  const action = item.recommendedNextAction || item.nextAction || item.recommendedCommand || firstSignal.action;
  const score = item.priorityScore === undefined ? 'unknown' : item.priorityScore;
  return 'Priority ' + score + ', rank #' + (item.attentionRank || '?') + ': ' + (action || firstSignal.summary || 'Review source attention.');
}

function sourceTypeOperationsSummary(item) {
  const lifecycle = item && item.lifecycle || {};
  const attention = item && item.attention || {};
  const schedule = item && item.schedule || {};
  const score = attention.highestPriorityScore === undefined ? 'unknown' : attention.highestPriorityScore;
  return 'status=' + (item && item.status || 'unknown') +
    ', due=' + (schedule.due || 0) +
    ', running=' + (lifecycle.running || 0) +
    ', retry=' + (lifecycle.failureRetryWaiting || 0) +
    ', attention=' + (attention.total || 0) +
    ', priority=' + score + '.';
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
  createAuthorReviewQueueEvent,
  createSourceAttentionEvent,
  createSourceTypeOperationsEvent,
  buildRunbookActionEventId,
  buildContextReviewResultEventId,
  buildAuthorReviewQueueEventId,
  buildSourceAttentionEventId,
  buildSourceTypeOperationsEventId,
  acknowledgeNotificationEvent,
  markNotificationEventDelivered,
  markNotificationEventDeliveryFailed
};
