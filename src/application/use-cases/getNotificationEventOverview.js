'use strict';

const { assertNotificationEventRepository } = require('../ports/notificationEventRepository');

async function getNotificationEventOverview(options) {
  const safeOptions = options || {};
  const notificationEventRepository = assertNotificationEventRepository(safeOptions.notificationEventRepository);
  const now = safeOptions.now || new Date().toISOString();
  const limit = safeOptions.limit || 200;
  const maxAttempts = safeOptions.maxAttempts || 3;
  const query = {
    type: safeOptions.type,
    sourceId: safeOptions.sourceId,
    sourceKey: safeOptions.sourceKey,
    acknowledged: safeOptions.acknowledged,
    deliveryStatus: safeOptions.deliveryStatus,
    limit
  };
  const events = await notificationEventRepository.listEvents(query);
  const unacknowledgedEvents = events.filter(function (event) {
    return !event.acknowledgedAt;
  });
  const failedEvents = unacknowledgedEvents.filter(function (event) {
    return event.deliveryStatus === 'failed';
  });
  const pendingEvents = unacknowledgedEvents.filter(function (event) {
    return (event.deliveryStatus || 'pending') === 'pending';
  });
  const dueEvents = unacknowledgedEvents.filter(function (event) {
    return isDeliverableStatus(event) && isEventDue(event, now);
  });
  const exhaustedEvents = failedEvents.filter(function (event) {
    return (event.deliveryAttempts || 0) >= maxAttempts;
  });

  return {
    generatedAt: now,
    status: statusForOverview({
      failedCount: failedEvents.length,
      retryExhaustedCount: exhaustedEvents.length,
      dueForDeliveryCount: dueEvents.length
    }),
    windowLimit: limit,
    filters: cleanObject({
      type: safeOptions.type,
      sourceId: safeOptions.sourceId,
      sourceKey: safeOptions.sourceKey,
      acknowledged: safeOptions.acknowledged,
      deliveryStatus: safeOptions.deliveryStatus
    }),
    eventCount: events.length,
    pendingCount: pendingEvents.length,
    failedCount: failedEvents.length,
    unacknowledgedCount: unacknowledgedEvents.length,
    acknowledgedCount: events.length - unacknowledgedEvents.length,
    dueForDeliveryCount: dueEvents.length,
    retryExhaustedCount: exhaustedEvents.length,
    nextDeliveryAt: nextDeliveryAt(dueEvents.length ? dueEvents : unacknowledgedEvents),
    oldestUnacknowledgedAt: oldestTimestamp(unacknowledgedEvents.map(function (event) { return event.createdAt; })),
    latestCreatedAt: latestTimestamp(events.map(function (event) { return event.createdAt; })),
    byType: countBy(events, function (event) { return event.type || 'unknown'; }),
    bySeverity: countBy(events, function (event) { return event.severity || 'unknown'; }),
    byDeliveryStatus: countBy(events, function (event) { return event.deliveryStatus || 'pending'; }),
    byOpenDeliveryStatus: countBy(unacknowledgedEvents, function (event) { return event.deliveryStatus || 'pending'; }),
    byAcknowledgement: {
      acknowledged: events.length - unacknowledgedEvents.length,
      unacknowledged: unacknowledgedEvents.length
    },
    bySourceKey: countBy(events, function (event) { return event.sourceKey || 'unknown'; }),
    attention: {
      failedEvents: failedEvents.slice(0, 10).map(summarizeEvent),
      dueEvents: dueEvents.slice(0, 10).map(summarizeEvent),
      retryExhaustedEvents: exhaustedEvents.slice(0, 10).map(summarizeEvent),
      reviewableEvents: unacknowledgedEvents.filter(isReviewableEvent).slice(0, 10).map(summarizeEvent),
      unacknowledgedByType: countBy(unacknowledgedEvents, function (event) { return event.type || 'unknown'; })
    },
    recommendedNextAction: recommendedNextAction({
      failedCount: failedEvents.length,
      retryExhaustedCount: exhaustedEvents.length,
      dueForDeliveryCount: dueEvents.length,
      unacknowledgedCount: unacknowledgedEvents.length
    })
  };
}

function isReviewableEvent(event) {
  const status = event.deliveryStatus || 'pending';
  return status === 'delivered' || status === 'resolved';
}

function summarizeEvent(event) {
  return {
    id: event.id,
    type: event.type,
    severity: event.severity,
    sourceId: event.sourceId,
    sourceKey: event.sourceKey,
    title: event.title,
    summary: event.summary,
    createdAt: event.createdAt,
    deliveryStatus: event.deliveryStatus || 'pending',
    deliveryAttempts: event.deliveryAttempts || 0,
    nextDeliveryAt: event.nextDeliveryAt,
    lastDeliveryError: event.lastDeliveryError
  };
}

function statusForOverview(summary) {
  if (summary.retryExhaustedCount > 0) return 'fail';
  if (summary.failedCount > 0 || summary.dueForDeliveryCount > 0) return 'warn';
  return 'ok';
}

function recommendedNextAction(summary) {
  if (summary.retryExhaustedCount > 0) {
    return 'Inspect failed notification events and channel diagnostics before retrying delivery.';
  }
  if (summary.failedCount > 0) {
    return 'Dispatch failed notification events after confirming the delivery channel is healthy.';
  }
  if (summary.dueForDeliveryCount > 0) {
    return 'Run notification dispatch to deliver due pending events.';
  }
  if (summary.unacknowledgedCount > 0) {
    return 'Review and acknowledge delivered or resolved notification events.';
  }
  return 'Notification outbox is clear in the current window.';
}

function isDeliverableStatus(event) {
  const status = event.deliveryStatus || 'pending';
  return status === 'pending' || status === 'failed';
}

function isEventDue(event, now) {
  if (!event.nextDeliveryAt) return true;
  const eventTime = Date.parse(event.nextDeliveryAt);
  const nowTime = Date.parse(now);
  if (Number.isNaN(eventTime) || Number.isNaN(nowTime)) return true;
  return eventTime <= nowTime;
}

function nextDeliveryAt(events) {
  return (events || [])
    .map(function (event) { return event.nextDeliveryAt; })
    .filter(Boolean)
    .sort()[0];
}

function latestTimestamp(values) {
  return (values || [])
    .filter(Boolean)
    .sort()
    .reverse()[0];
}

function oldestTimestamp(values) {
  return (values || [])
    .filter(Boolean)
    .sort()[0];
}

function countBy(items, keySelector) {
  return (items || []).reduce(function (counts, item) {
    const key = keySelector(item);
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

function cleanObject(input) {
  return Object.keys(input).reduce(function (result, key) {
    if (input[key] !== undefined) result[key] = input[key];
    return result;
  }, {});
}

module.exports = {
  getNotificationEventOverview
};
