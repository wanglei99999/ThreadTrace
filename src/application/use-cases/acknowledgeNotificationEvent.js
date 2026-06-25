'use strict';

const { acknowledgeNotificationEvent: acknowledgeEvent } = require('../../domain/events/notificationEvent');
const { assertNotificationEventRepository } = require('../ports/notificationEventRepository');

async function acknowledgeNotificationEvent(options) {
  const safeOptions = options || {};
  const notificationEventRepository = assertNotificationEventRepository(safeOptions.notificationEventRepository);
  const event = await notificationEventRepository.findEvent(safeOptions.eventId);

  if (!event) {
    throw new Error('Unknown notification event: ' + safeOptions.eventId);
  }

  const acknowledgedEvent = acknowledgeEvent(event, {
    acknowledgedBy: safeOptions.acknowledgedBy,
    note: safeOptions.note,
    acknowledgedAt: safeOptions.acknowledgedAt || safeOptions.now
  });
  await notificationEventRepository.saveEvent(acknowledgedEvent);

  return {
    event: acknowledgedEvent
  };
}

module.exports = {
  acknowledgeNotificationEvent
};
