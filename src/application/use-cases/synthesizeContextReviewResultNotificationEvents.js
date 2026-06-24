'use strict';

const { createContextReviewResultEvent } = require('../../domain/events/notificationEvent');
const { assertContextReviewResultRepository } = require('../ports/contextReviewResultRepository');
const { assertNotificationEventRepository } = require('../ports/notificationEventRepository');
const {
  createSynthesisResultCounts,
  existingEventSkipReason,
  isAlertSeverity,
  mergeExistingNotificationDeliveryState
} = require('./notificationSynthesisPolicy');

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
  const counts = createSynthesisResultCounts(results);

  return {
    generatedAt: now,
    status: 'ok',
    dryRun: !execute,
    executed: execute,
    reviewResultCount: records.length,
    actionCount: notifyRecords.length,
    eventCount: counts.eventCount,
    createdCount: counts.createdCount,
    updatedCount: counts.updatedCount,
    skippedCount: counts.skippedCount,
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

function shouldNotifyRecord(record) {
  const severity = record && record.summary && record.summary.notification
    ? record.summary.notification.severity
    : undefined;
  return isAlertSeverity(severity);
}

module.exports = {
  synthesizeContextReviewResultNotificationEvents,
  buildContextReviewResultEventResult
};
