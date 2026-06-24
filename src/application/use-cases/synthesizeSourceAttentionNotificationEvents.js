'use strict';

const { createSourceAttentionEvent } = require('../../domain/events/notificationEvent');
const { assertNotificationEventRepository } = require('../ports/notificationEventRepository');
const {
  createSynthesisResultCounts,
  eventMatchesSourceScope,
  existingEventSkipReason,
  mergeExistingNotificationDeliveryState,
  shouldAlertForSourceAttention
} = require('./notificationSynthesisPolicy');

async function synthesizeSourceAttentionNotificationEvents(options) {
  const safeOptions = options || {};
  const notificationEventRepository = assertNotificationEventRepository(safeOptions.notificationEventRepository);
  const report = await resolveSourceAttentionReport(safeOptions);
  const now = safeOptions.now || report.generatedAt || new Date().toISOString();
  const execute = safeOptions.execute === true;
  const threshold = safeOptions.priorityScoreThreshold === undefined ? 70 : Number(safeOptions.priorityScoreThreshold);
  const items = (report.sources || [])
    .filter(function (item) {
      return shouldAlertForSourceAttention(item, {
        priorityScoreThreshold: threshold
      });
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
  const counts = createSynthesisResultCounts(results);

  return {
    generatedAt: now,
    status: 'ok',
    dryRun: !execute,
    executed: execute,
    sourceCount: report.sources ? report.sources.length : 0,
    actionCount: items.length,
    eventCount: counts.eventCount,
    createdCount: counts.createdCount,
    updatedCount: counts.updatedCount,
    resolvedCount: counts.resolvedCount,
    reopenedCount: counts.reopenedCount,
    skippedCount: counts.skippedCount,
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
  const skipReason = existingEventSkipReason(existing);
  if (skipReason) {
    return {
      status: 'skipped',
      shouldSave: false,
      reason: skipReason,
      event: existing
    };
  }
  return {
    status: 'updated',
    shouldSave: true,
    event: mergeExistingNotificationDeliveryState(existing, draft)
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
    return eventMatchesSourceScope(event, options) &&
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

module.exports = {
  synthesizeSourceAttentionNotificationEvents,
  buildSourceAttentionEventResult,
  resolveStaleSourceAttentionEvents
};
