'use strict';

const { createAuthorReviewQueueEvent } = require('../../domain/events/notificationEvent');
const { assertAuthorReviewQueueRepository } = require('../ports/authorReviewQueueRepository');
const { assertNotificationEventRepository } = require('../ports/notificationEventRepository');
const {
  createSynthesisResultCounts,
  existingEventSkipReason,
  mergeExistingNotificationDeliveryState
} = require('./notificationSynthesisPolicy');

async function synthesizeAuthorReviewQueueNotificationEvents(options) {
  const safeOptions = options || {};
  const authorReviewQueueRepository = assertAuthorReviewQueueRepository(safeOptions.authorReviewQueueRepository);
  const notificationEventRepository = assertNotificationEventRepository(safeOptions.notificationEventRepository);
  const now = safeOptions.now || new Date().toISOString();
  const execute = safeOptions.execute === true;
  const items = await authorReviewQueueRepository.listItems({
    status: safeOptions.status || 'open',
    sourceKey: safeOptions.sourceKey || safeOptions.forum,
    sourceThreadId: safeOptions.sourceThreadId,
    type: safeOptions.type,
    priority: safeOptions.priority,
    limit: safeOptions.limit || 50
  });
  const notifyItems = items.filter(shouldNotifyItem);
  const activeEventIds = new Set();
  const results = [];

  for (const item of notifyItems) {
    const result = await buildAuthorReviewQueueEventResult(item, {
      notificationEventRepository,
      now
    });
    activeEventIds.add(result.event.id);
    if (execute && result.shouldSave) {
      await notificationEventRepository.saveEvent(result.event);
    }
    results.push({
      status: result.status,
      itemId: item.id,
      event: result.event,
      reason: result.reason
    });
  }

  const staleResults = safeOptions.resolveStale === false
    ? []
    : await resolveStaleAuthorReviewQueueEvents({
      notificationEventRepository,
      activeEventIds,
      execute,
      now,
      scope: {
        sourceKey: safeOptions.sourceKey || safeOptions.forum,
        sourceThreadId: safeOptions.sourceThreadId,
        status: safeOptions.status || 'open',
        type: safeOptions.type,
        priority: safeOptions.priority
      },
      limit: safeOptions.staleLimit || safeOptions.limit || 100
    });
  results.push.apply(results, staleResults);
  const counts = createSynthesisResultCounts(results);

  return {
    generatedAt: now,
    status: 'ok',
    dryRun: !execute,
    executed: execute,
    itemCount: items.length,
    actionCount: notifyItems.length,
    eventCount: counts.eventCount,
    createdCount: counts.createdCount,
    updatedCount: counts.updatedCount,
    resolvedCount: counts.resolvedCount,
    reopenedCount: counts.reopenedCount,
    skippedCount: counts.skippedCount,
    results,
    recommendedNextAction: execute
      ? 'Dispatch pending notification events or continue reviewing author queue items.'
      : 'Run with execute=true after confirming the author review queue notification preview.'
  };
}

async function buildAuthorReviewQueueEventResult(item, options) {
  const draft = createAuthorReviewQueueEvent({
    item,
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
  if (isAutoResolvedAuthorReviewQueueEvent(existing)) {
    return {
      status: 'reopened',
      shouldSave: true,
      event: reopenAutoResolvedAuthorReviewQueueEvent(existing, draft)
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

async function resolveStaleAuthorReviewQueueEvents(options) {
  const events = await options.notificationEventRepository.listEvents({
    type: 'author-review-queue',
    acknowledged: false,
    limit: options.limit
  });
  const staleEvents = events.filter(function (event) {
    return eventMatchesAuthorReviewQueueScope(event, options.scope) &&
      !options.activeEventIds.has(event.id) &&
      event.deliveryStatus !== 'resolved' &&
      event.deliveryStatus !== 'delivered';
  });
  const results = [];

  for (const event of staleEvents) {
    const resolvedEvent = markAuthorReviewQueueEventResolved(event, options.now);
    if (options.execute) {
      await options.notificationEventRepository.saveEvent(resolvedEvent);
    }
    results.push({
      status: 'resolved',
      itemId: event.payload && event.payload.itemId,
      event: resolvedEvent,
      reason: 'author-review-queue-item-cleared'
    });
  }

  return results;
}

function shouldNotifyItem(item) {
  return item && item.status === 'open';
}

function eventMatchesAuthorReviewQueueScope(event, scope) {
  const safeScope = scope || {};
  const payload = event && event.payload ? event.payload : {};
  if (safeScope.sourceKey && (event.sourceKey || payload.sourceKey) !== safeScope.sourceKey) return false;
  if (safeScope.sourceThreadId && payload.sourceThreadId !== safeScope.sourceThreadId) return false;
  if (safeScope.status && payload.status !== safeScope.status) return false;
  if (safeScope.type && payload.type !== safeScope.type) return false;
  if (safeScope.priority && payload.priority !== safeScope.priority) return false;
  return true;
}

function markAuthorReviewQueueEventResolved(event, now) {
  return Object.assign({}, event, {
    deliveryStatus: 'resolved',
    nextDeliveryAt: undefined,
    acknowledgedAt: now,
    acknowledgedBy: 'author-review-queue-synthesizer',
    acknowledgementNote: 'Author review queue item is no longer open.',
    payload: Object.assign({}, event.payload || {}, {
      resolution: {
        status: 'resolved',
        resolvedAt: now,
        reason: 'author-review-queue-item-cleared'
      }
    })
  });
}

function isAutoResolvedAuthorReviewQueueEvent(event) {
  return event.deliveryStatus === 'resolved' && event.acknowledgedBy === 'author-review-queue-synthesizer';
}

function reopenAutoResolvedAuthorReviewQueueEvent(existing, draft) {
  return Object.assign({}, draft, {
    createdAt: existing.createdAt || draft.createdAt,
    payload: Object.assign({}, draft.payload || {}, {
      previousResolution: existing.payload && existing.payload.resolution
    })
  });
}

module.exports = {
  synthesizeAuthorReviewQueueNotificationEvents,
  buildAuthorReviewQueueEventResult,
  resolveStaleAuthorReviewQueueEvents,
  eventMatchesAuthorReviewQueueScope
};
