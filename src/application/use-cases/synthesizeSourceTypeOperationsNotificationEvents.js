'use strict';

const { createSourceTypeOperationsEvent } = require('../../domain/events/notificationEvent');
const { assertNotificationEventRepository } = require('../ports/notificationEventRepository');
const {
  createSynthesisResultCounts,
  existingEventSkipReason,
  mergeExistingNotificationDeliveryState
} = require('./notificationSynthesisPolicy');

async function synthesizeSourceTypeOperationsNotificationEvents(options) {
  const safeOptions = options || {};
  const notificationEventRepository = assertNotificationEventRepository(safeOptions.notificationEventRepository);
  const report = await resolveSourceTypeOperationsReport(safeOptions);
  const now = safeOptions.now || report.generatedAt || new Date().toISOString();
  const execute = safeOptions.execute === true;
  const threshold = safeOptions.priorityScoreThreshold === undefined ? 70 : Number(safeOptions.priorityScoreThreshold);
  const items = (report.sourceTypes || [])
    .filter(function (item) {
      return shouldAlertForSourceTypeOperations(item, {
        priorityScoreThreshold: threshold,
        includeReadinessWarnings: safeOptions.includeReadinessWarnings === true
      });
    })
    .slice(0, safeOptions.limit || 50);
  const activeEventIds = new Set();
  const results = [];

  for (const item of items) {
    const result = await buildSourceTypeOperationsEventResult(item, {
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
      sourceType: item.sourceType,
      event: result.event,
      reason: result.reason
    });
  }

  const staleResults = safeOptions.resolveStale === false
    ? []
    : await resolveStaleSourceTypeOperationsEvents({
      notificationEventRepository,
      activeEventIds,
      execute,
      now,
      sourceType: safeOptions.sourceType,
      limit: safeOptions.staleLimit || safeOptions.limit || 100
    });
  results.push.apply(results, staleResults);
  const counts = createSynthesisResultCounts(results);

  return {
    generatedAt: now,
    status: 'ok',
    dryRun: !execute,
    executed: execute,
    sourceTypeCount: report.sourceTypes ? report.sourceTypes.length : 0,
    actionCount: items.length,
    eventCount: counts.eventCount,
    createdCount: counts.createdCount,
    updatedCount: counts.updatedCount,
    resolvedCount: counts.resolvedCount,
    reopenedCount: counts.reopenedCount,
    skippedCount: counts.skippedCount,
    priorityScoreThreshold: threshold,
    includeReadinessWarnings: safeOptions.includeReadinessWarnings === true,
    results,
    sourceTypeOperations: safeOptions.includeSourceTypeOperations === true ? report : undefined,
    recommendedNextAction: execute
      ? 'Dispatch pending source type operations notification events or inspect the source type operations matrix.'
      : 'Run with execute=true after confirming the source type operations notification preview.'
  };
}

async function resolveSourceTypeOperationsReport(options) {
  if (options.sourceTypeOperationsReport) return options.sourceTypeOperationsReport;
  if (typeof options.getSourceTypeOperationsReport === 'function') {
    return options.getSourceTypeOperationsReport(options.sourceTypeOperationsRequest || {});
  }
  throw new Error('synthesizeSourceTypeOperationsNotificationEvents requires sourceTypeOperationsReport or getSourceTypeOperationsReport(request).');
}

function shouldAlertForSourceTypeOperations(item, options) {
  if (!item) return false;
  const safeOptions = options || {};
  const lifecycle = item.lifecycle || {};
  const attention = item.attention || {};
  if (item.status === 'fail') return true;
  if ((attention.critical || 0) > 0 || (attention.warning || 0) > 0) return true;
  if ((lifecycle.disableBlocked || 0) > 0 ||
    (lifecycle.staleRunning || 0) > 0 ||
    (lifecycle.failureRetryWaiting || 0) > 0) return true;
  const threshold = safeOptions.priorityScoreThreshold === undefined ? 70 : Number(safeOptions.priorityScoreThreshold);
  if (Number(attention.highestPriorityScore || 0) >= threshold) return true;
  return safeOptions.includeReadinessWarnings === true && item.status === 'warn';
}

async function buildSourceTypeOperationsEventResult(item, options) {
  const draft = createSourceTypeOperationsEvent({
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
  if (isAutoResolvedSourceTypeOperationsEvent(existing)) {
    return {
      status: 'reopened',
      shouldSave: true,
      event: reopenAutoResolvedSourceTypeOperationsEvent(existing, draft)
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

async function resolveStaleSourceTypeOperationsEvents(options) {
  const events = await options.notificationEventRepository.listEvents({
    type: 'source-type-operations',
    acknowledged: false,
    limit: options.limit
  });
  const staleEvents = events.filter(function (event) {
    return eventMatchesSourceTypeScope(event, options) &&
      !options.activeEventIds.has(event.id) &&
      event.deliveryStatus !== 'resolved' &&
      event.deliveryStatus !== 'delivered';
  });
  const results = [];

  for (const event of staleEvents) {
    const resolvedEvent = markSourceTypeOperationsEventResolved(event, options.now);
    if (options.execute) {
      await options.notificationEventRepository.saveEvent(resolvedEvent);
    }
    results.push({
      status: 'resolved',
      sourceType: event.payload && event.payload.sourceType,
      event: resolvedEvent,
      reason: 'source-type-operations-cleared'
    });
  }

  return results;
}

function eventMatchesSourceTypeScope(event, scope) {
  const safeScope = scope || {};
  if (safeScope.sourceType && (!event.payload || event.payload.sourceType !== safeScope.sourceType)) return false;
  return true;
}

function markSourceTypeOperationsEventResolved(event, now) {
  return Object.assign({}, event, {
    deliveryStatus: 'resolved',
    nextDeliveryAt: undefined,
    acknowledgedAt: now,
    acknowledgedBy: 'source-type-operations-synthesizer',
    acknowledgementNote: 'Source type operations item is no longer active.',
    payload: Object.assign({}, event.payload || {}, {
      resolution: {
        status: 'resolved',
        resolvedAt: now,
        reason: 'source-type-operations-cleared'
      }
    })
  });
}

function isAutoResolvedSourceTypeOperationsEvent(event) {
  return event.deliveryStatus === 'resolved' && event.acknowledgedBy === 'source-type-operations-synthesizer';
}

function reopenAutoResolvedSourceTypeOperationsEvent(existing, draft) {
  return Object.assign({}, draft, {
    createdAt: existing.createdAt || draft.createdAt,
    payload: Object.assign({}, draft.payload || {}, {
      previousResolution: existing.payload && existing.payload.resolution
    })
  });
}

module.exports = {
  synthesizeSourceTypeOperationsNotificationEvents,
  shouldAlertForSourceTypeOperations,
  buildSourceTypeOperationsEventResult,
  resolveStaleSourceTypeOperationsEvents
};
