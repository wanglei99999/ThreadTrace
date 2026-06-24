'use strict';

const { createRunbookActionEvent } = require('../../domain/events/notificationEvent');
const { assertNotificationEventRepository } = require('../ports/notificationEventRepository');
const {
  createSynthesisResultCounts,
  eventMatchesSourceScope,
  existingEventSkipReason,
  isAlertSeverity,
  mergeExistingNotificationDeliveryState
} = require('./notificationSynthesisPolicy');

async function synthesizeRunbookNotificationEvents(options) {
  const safeOptions = options || {};
  const notificationEventRepository = assertNotificationEventRepository(safeOptions.notificationEventRepository);
  const runbook = await resolveRunbook(safeOptions);
  const now = safeOptions.now || runbook.generatedAt || new Date().toISOString();
  const execute = safeOptions.execute === true;
  const actions = (runbook.actions || [])
    .filter(shouldNotifyAction)
    .slice(0, safeOptions.limit || 50);
  const activeEventIds = new Set();
  const results = [];

  for (const action of actions) {
    const result = await buildRunbookEventResult(action, {
      notificationEventRepository,
      runbook,
      now
    });
    activeEventIds.add(result.event.id);
    if (execute && result.shouldSave) {
      await notificationEventRepository.saveEvent(result.event);
    }
    results.push({
      status: result.status,
      actionKey: action.key,
      event: result.event,
      reason: result.reason
    });
  }

  const staleResults = safeOptions.resolveStale === false
    ? []
    : await resolveStaleRunbookEvents({
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
    actionCount: actions.length,
    eventCount: counts.eventCount,
    createdCount: counts.createdCount,
    updatedCount: counts.updatedCount,
    resolvedCount: counts.resolvedCount,
    reopenedCount: counts.reopenedCount,
    skippedCount: counts.skippedCount,
    results,
    runbook: safeOptions.includeRunbook === true ? runbook : undefined
  };
}

async function resolveRunbook(options) {
  if (options.runbook) return options.runbook;
  if (typeof options.getOperationsRunbook === 'function') {
    return options.getOperationsRunbook(options.runbookRequest || {});
  }
  throw new Error('synthesizeRunbookNotificationEvents requires runbook or getOperationsRunbook(request).');
}

function shouldNotifyAction(action) {
  return action && isAlertSeverity(action.severity);
}

async function buildRunbookEventResult(action, options) {
  const draft = createRunbookActionEvent({
    action,
    runbookGeneratedAt: options.runbook.generatedAt,
    runbookStatus: options.runbook.status,
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
  if (isAutoResolvedRunbookEvent(existing)) {
    return {
      status: 'reopened',
      shouldSave: true,
      event: reopenAutoResolvedRunbookEvent(existing, draft)
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

async function resolveStaleRunbookEvents(options) {
  const events = await options.notificationEventRepository.listEvents({
    type: 'runbook-action',
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
    const resolvedEvent = markRunbookEventResolved(event, options.now);
    if (options.execute) {
      await options.notificationEventRepository.saveEvent(resolvedEvent);
    }
    results.push({
      status: 'resolved',
      actionKey: event.payload && event.payload.action && event.payload.action.key,
      event: resolvedEvent,
      reason: 'runbook-action-cleared'
    });
  }

  return results;
}

function markRunbookEventResolved(event, now) {
  return Object.assign({}, event, {
    deliveryStatus: 'resolved',
    nextDeliveryAt: undefined,
    acknowledgedAt: now,
    acknowledgedBy: 'runbook-synthesizer',
    acknowledgementNote: 'Runbook action is no longer active.',
    payload: Object.assign({}, event.payload || {}, {
      resolution: {
        status: 'resolved',
        resolvedAt: now,
        reason: 'runbook-action-cleared'
      }
    })
  });
}

function isAutoResolvedRunbookEvent(event) {
  return event.deliveryStatus === 'resolved' && event.acknowledgedBy === 'runbook-synthesizer';
}

function reopenAutoResolvedRunbookEvent(existing, draft) {
  return Object.assign({}, draft, {
    createdAt: existing.createdAt || draft.createdAt,
    payload: Object.assign({}, draft.payload || {}, {
      previousResolution: existing.payload && existing.payload.resolution
    })
  });
}

module.exports = {
  synthesizeRunbookNotificationEvents,
  buildRunbookEventResult,
  resolveStaleRunbookEvents
};
