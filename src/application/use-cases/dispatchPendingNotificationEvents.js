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
  const pendingEvents = await notificationEventRepository.listEvents({
    deliveryStatus: 'pending',
    limit
  });
  const failedEvents = safeOptions.includeFailed === false
    ? []
    : await notificationEventRepository.listEvents({
      deliveryStatus: 'failed',
      limit
    });
  const events = pendingEvents.concat(failedEvents)
    .filter(function (event) {
      return (event.deliveryAttempts || 0) < maxAttempts;
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
      const failedEvent = markNotificationEventDeliveryFailed(event, error);
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

module.exports = {
  dispatchPendingNotificationEvents
};
