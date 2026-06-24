'use strict';

const { createContextReviewResultEvent } = require('../../domain/events/notificationEvent');
const { assertContextReviewResultRepository } = require('../ports/contextReviewResultRepository');
const { assertNotificationEventRepository } = require('../ports/notificationEventRepository');

async function synthesizeContextReviewResultNotificationEvents(options) {
  const safeOptions = options || {};
  const contextReviewResultRepository = assertContextReviewResultRepository(safeOptions.contextReviewResultRepository);
  const notificationEventRepository = assertNotificationEventRepository(safeOptions.notificationEventRepository);
  const now = safeOptions.now || new Date().toISOString();
  const execute = safeOptions.execute === true;
  const records = await contextReviewResultRepository.listReviewResults({
    handoffId: safeOptions.handoffId,
    status: safeOptions.status,
    reviewerId: safeOptions.reviewerId,
    sourceId: safeOptions.sourceId,
    sourceKey: safeOptions.sourceKey || safeOptions.forum,
    limit: safeOptions.limit || 50
  });
  const notifyRecords = records.filter(shouldNotifyRecord);
  const results = [];

  for (const record of notifyRecords) {
    const result = await buildContextReviewResultEventResult(record, {
      notificationEventRepository,
      now
    });
    if (execute && result.shouldSave) {
      await notificationEventRepository.saveEvent(result.event);
    }
    results.push({
      status: result.status,
      recordId: record.id,
      handoffId: record.handoffId,
      sourceId: result.event.sourceId,
      sourceKey: result.event.sourceKey,
      event: result.event,
      reason: result.reason
    });
  }

  return {
    generatedAt: now,
    status: 'ok',
    dryRun: !execute,
    executed: execute,
    reviewResultCount: records.length,
    actionCount: notifyRecords.length,
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
    results
  };
}

async function buildContextReviewResultEventResult(record, options) {
  const draft = createContextReviewResultEvent({
    record,
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

function shouldNotifyRecord(record) {
  const severity = record && record.summary && record.summary.notification
    ? record.summary.notification.severity
    : undefined;
  return severity === 'critical' || severity === 'warning';
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
  synthesizeContextReviewResultNotificationEvents,
  buildContextReviewResultEventResult
};
