'use strict';

const {
  markNotificationEventDelivered,
  markNotificationEventDeliveryFailed
} = require('../../domain/events/notificationEvent');
const { assertNotificationEventRepository } = require('../ports/notificationEventRepository');
const { assertNotificationChannel } = require('../ports/notificationChannel');

async function dispatchPendingNotificationEvents(options) {
  const safeOptions = options || {};
  const notificationEventRepository = assertNotificationEventRepository(safeOptions.notificationEventRepository);
  const notificationChannel = assertNotificationChannel(safeOptions.notificationChannel);
  const limit = safeOptions.limit || 50;
  const maxAttempts = safeOptions.maxAttempts || 3;
  const now = safeOptions.now || new Date().toISOString();
  const retryBackoffMs = safeOptions.retryBackoffMs || 60 * 1000;
  const maxRetryBackoffMs = safeOptions.maxRetryBackoffMs || 60 * 60 * 1000;
  const pendingEvents = await notificationEventRepository.listEvents({
    deliveryStatus: 'pending',
    dueBefore: now,
    limit
  });
  const failedEvents = safeOptions.includeFailed === false
    ? []
    : await notificationEventRepository.listEvents({
      deliveryStatus: 'failed',
      dueBefore: now,
      limit
    });
  const events = pendingEvents.concat(failedEvents)
    .filter(function (event) {
      return (event.deliveryAttempts || 0) < maxAttempts && isEventDue(event, now);
    })
    .slice(0, limit);
  const results = [];

  for (const event of events) {
    try {
      const deliveryResult = await notificationChannel.deliver(event);
      const deliveredEvent = markNotificationEventDelivered(event, deliveryResult);
      await notificationEventRepository.saveEvent(deliveredEvent);
      results.push({
        event: deliveredEvent,
        status: 'delivered',
        deliveryResult
      });
    } catch (error) {
      const failedEvent = markNotificationEventDeliveryFailed(event, error, {
        attemptedAt: now,
        nextDeliveryAt: nextRetryAt(event, {
          maxAttempts,
          now,
          retryBackoffMs,
          maxRetryBackoffMs
        })
      });
      await notificationEventRepository.saveEvent(failedEvent);
      results.push({
        event: failedEvent,
        status: 'failed',
        error: {
          message: error.message
        }
      });
    }
  }

  return {
    channelKey: notificationChannel.channelKey || 'unknown',
    dispatchedCount: results.filter(function (result) {
      return result.status === 'delivered';
    }).length,
    failedCount: results.filter(function (result) {
      return result.status === 'failed';
    }).length,
    skippedCount: pendingEvents.length + failedEvents.length - events.length,
    results
  };
}

function isEventDue(event, now) {
  if (!event.nextDeliveryAt) return true;
  const nextDeliveryTime = Date.parse(event.nextDeliveryAt);
  if (Number.isNaN(nextDeliveryTime)) return true;
  return nextDeliveryTime <= Date.parse(now);
}

function nextRetryAt(event, options) {
  const attemptsAfterFailure = (event.deliveryAttempts || 0) + 1;
  if (attemptsAfterFailure >= options.maxAttempts) return undefined;
  const exponent = Math.max(0, attemptsAfterFailure - 1);
  const delayMs = Math.min(options.retryBackoffMs * Math.pow(2, exponent), options.maxRetryBackoffMs);
  return new Date(Date.parse(options.now) + delayMs).toISOString();
}

module.exports = {
  dispatchPendingNotificationEvents
};
