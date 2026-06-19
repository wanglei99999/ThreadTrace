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
  const results = [];

  for (const action of actions) {
    const result = await buildRunbookEventResult(action, {
      notificationEventRepository,
      runbook,
      now
    });
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

  return {
    generatedAt: now,
    status: 'ok',
    dryRun: !execute,
    executed: execute,
    actionCount: actions.length,
    eventCount: results.filter(function (result) {
      return result.status === 'created' || result.status === 'updated';
    }).length,
    createdCount: results.filter(function (result) {
      return result.status === 'created';
    }).length,
    updatedCount: results.filter(function (result) {
      return result.status === 'updated';
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
  buildRunbookEventResult
};
