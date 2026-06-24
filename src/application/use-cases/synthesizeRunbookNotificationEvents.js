'use strict';

const { createRunbookActionEvent } = require('../../domain/events/notificationEvent');
const { assertNotificationEventRepository } = require('../ports/notificationEventRepository');

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

  return {
    generatedAt: now,
    status: 'ok',
    dryRun: !execute,
    executed: execute,
    actionCount: actions.length,
    eventCount: results.filter(function (result) {
      return result.status === 'created' || result.status === 'updated' || result.status === 'resolved' || result.status === 'reopened';
    }).length,
    createdCount: results.filter(function (result) {
      return result.status === 'created';
    }).length,
    updatedCount: results.filter(function (result) {
      return result.status === 'updated';
    }).length,
    resolvedCount: results.filter(function (result) {
      return result.status === 'resolved';
    }).length,
    reopenedCount: results.filter(function (result) {
      return result.status === 'reopened';
    }).length,
    skippedCount: results.filter(function (result) {
      return result.status === 'skipped';
    }).length,
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
  return action && (action.severity === 'critical' || action.severity === 'warning');
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

async function resolveStaleRunbookEvents(options) {
  const events = await options.notificationEventRepository.listEvents({
    type: 'runbook-action',
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

function eventMatchesScope(event, scope) {
  if (scope.sourceId && event.sourceId !== scope.sourceId) return false;
  if (scope.sourceKey && event.sourceKey !== scope.sourceKey) return false;
  return true;
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

module.exports = {
  synthesizeRunbookNotificationEvents,
  buildRunbookEventResult,
  resolveStaleRunbookEvents
};
