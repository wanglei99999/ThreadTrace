'use strict';

const { createSourceAttentionEvent } = require('../../domain/events/notificationEvent');
const { assertNotificationEventRepository } = require('../ports/notificationEventRepository');

async function synthesizeSourceAttentionNotificationEvents(options) {
  const safeOptions = options || {};
  const notificationEventRepository = assertNotificationEventRepository(safeOptions.notificationEventRepository);
  const report = await resolveSourceAttentionReport(safeOptions);
  const now = safeOptions.now || report.generatedAt || new Date().toISOString();
  const execute = safeOptions.execute === true;
  const threshold = safeOptions.priorityScoreThreshold === undefined ? 70 : Number(safeOptions.priorityScoreThreshold);
  const items = (report.sources || [])
    .filter(function (item) {
      return shouldNotifySourceAttention(item, threshold);
    })
    .slice(0, safeOptions.limit || 50);
  const activeEventIds = new Set();
  const results = [];

  for (const item of items) {
    const result = await buildSourceAttentionEventResult(item, {
      notificationEventRepository,
      report,
      now
    });
    activeEventIds.add(result.event.id);
    if (execute && result.shouldSave) {
      await notificationEventRepository.saveEvent(result.event);
    }
    results.push({
      status: result.status,
      attentionKey: item.key,
      event: result.event,
      reason: result.reason
    });
  }

  const staleResults = safeOptions.resolveStale === false
    ? []
    : await resolveStaleSourceAttentionEvents({
      notificationEventRepository,
      activeEventIds,
      execute,
      now,
      sourceId: safeOptions.sourceId,
      sourceKey: safeOptions.sourceKey || safeOptions.forum,
      limit: safeOptions.staleLimit || safeOptions.limit || 100
    });
  results.push.apply(results, staleResults);

  return {
    generatedAt: now,
    status: 'ok',
    dryRun: !execute,
    executed: execute,
    sourceCount: report.sources ? report.sources.length : 0,
    actionCount: items.length,
    eventCount: results.filter(isEventMutation).length,
    createdCount: countByStatus(results, 'created'),
    updatedCount: countByStatus(results, 'updated'),
    resolvedCount: countByStatus(results, 'resolved'),
    reopenedCount: countByStatus(results, 'reopened'),
    skippedCount: countByStatus(results, 'skipped'),
    priorityScoreThreshold: threshold,
    results,
    sourceAttention: safeOptions.includeSourceAttention === true ? report : undefined,
    recommendedNextAction: execute
      ? 'Dispatch pending source attention notification events or inspect the highest-priority source drill-down.'
      : 'Run with execute=true after confirming the source attention notification preview.'
  };
}

async function resolveSourceAttentionReport(options) {
  if (options.sourceAttentionReport) return options.sourceAttentionReport;
  if (typeof options.getSourceAttentionReport === 'function') {
    return options.getSourceAttentionReport(options.sourceAttentionRequest || {});
  }
  throw new Error('synthesizeSourceAttentionNotificationEvents requires sourceAttentionReport or getSourceAttentionReport(request).');
}

function shouldNotifySourceAttention(item, threshold) {
  if (!item) return false;
  if (item.severity === 'critical' || item.severity === 'warning' || item.severity === 'warn') return true;
  return (item.priorityScore || 0) >= threshold;
}

async function buildSourceAttentionEventResult(item, options) {
  const draft = createSourceAttentionEvent({
    item,
    reportGeneratedAt: options.report.generatedAt,
    reportStatus: options.report.status,
    createdAt: options.now
  });
  const existing = await options.notificationEventRepository.findEvent(draft.id);
  if (!existing) {
    return {
      status: 'created',
      shouldSave: true,
      event: draft
    };
  }
  if (isAutoResolvedSourceAttentionEvent(existing)) {
    return {
      status: 'reopened',
      shouldSave: true,
      event: reopenAutoResolvedSourceAttentionEvent(existing, draft)
    };
  }
  if (existing.acknowledgedAt) {
    return {
      status: 'skipped',
      shouldSave: false,
      reason: 'already-acknowledged',
      event: existing
    };
  }
  if (existing.deliveryStatus === 'delivered') {
    return {
      status: 'skipped',
      shouldSave: false,
      reason: 'already-delivered',
      event: existing
    };
  }
  return {
    status: 'updated',
    shouldSave: true,
    event: mergeExistingDeliveryState(existing, draft)
  };
}

async function resolveStaleSourceAttentionEvents(options) {
  const events = await options.notificationEventRepository.listEvents({
    type: 'source-attention',
    sourceId: options.sourceId,
    sourceKey: options.sourceKey,
    acknowledged: false,
    limit: options.limit
  });
  const staleEvents = events.filter(function (event) {
    return eventMatchesScope(event, options) &&
      !options.activeEventIds.has(event.id) &&
      event.deliveryStatus !== 'resolved' &&
      event.deliveryStatus !== 'delivered';
  });
  const results = [];

  for (const event of staleEvents) {
    const resolvedEvent = markSourceAttentionEventResolved(event, options.now);
    if (options.execute) {
      await options.notificationEventRepository.saveEvent(resolvedEvent);
    }
    results.push({
      status: 'resolved',
      attentionKey: event.payload && event.payload.attentionKey,
      event: resolvedEvent,
      reason: 'source-attention-cleared'
    });
  }

  return results;
}

function eventMatchesScope(event, scope) {
  if (scope.sourceId && event.sourceId !== scope.sourceId) return false;
  if (scope.sourceKey && event.sourceKey !== scope.sourceKey) return false;
  return true;
}

function markSourceAttentionEventResolved(event, now) {
  return Object.assign({}, event, {
    deliveryStatus: 'resolved',
    nextDeliveryAt: undefined,
    acknowledgedAt: now,
    acknowledgedBy: 'source-attention-synthesizer',
    acknowledgementNote: 'Source attention item is no longer active.',
    payload: Object.assign({}, event.payload || {}, {
      resolution: {
        status: 'resolved',
        resolvedAt: now,
        reason: 'source-attention-cleared'
      }
    })
  });
}

function isAutoResolvedSourceAttentionEvent(event) {
  return event.deliveryStatus === 'resolved' && event.acknowledgedBy === 'source-attention-synthesizer';
}

function reopenAutoResolvedSourceAttentionEvent(existing, draft) {
  return Object.assign({}, draft, {
    createdAt: existing.createdAt || draft.createdAt,
    payload: Object.assign({}, draft.payload || {}, {
      previousResolution: existing.payload && existing.payload.resolution
    })
  });
}

function mergeExistingDeliveryState(existing, draft) {
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

function countByStatus(results, status) {
  return results.filter(function (result) {
    return result.status === status;
  }).length;
}

function isEventMutation(result) {
  return result.status === 'created' || result.status === 'updated' || result.status === 'resolved' || result.status === 'reopened';
}

module.exports = {
  synthesizeSourceAttentionNotificationEvents,
  buildSourceAttentionEventResult,
  resolveStaleSourceAttentionEvents
};
