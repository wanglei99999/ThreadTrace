'use strict';

/**
 * Notification event storage port. File storage is used locally; production can
 * route the same events to a queue, webhook, mailer, or database outbox.
 *
 * @typedef {Object} NotificationEventRepository
 * @property {(event: Object) => Promise<void>} saveEvent
 * @property {(id: string) => Promise<Object|undefined>} findEvent
 * @property {(query?: { type?: string, sourceId?: string, sourceKey?: string, acknowledged?: boolean, deliveryStatus?: string, dueBefore?: string, includeArchived?: boolean, limit?: number }) => Promise<Object[]>} listEvents
 * @property {((eventId: string, metadata?: Object) => Promise<Object|undefined>)} [archiveEvent]
 */

function assertNotificationEventRepository(repository) {
  if (!repository || typeof repository.saveEvent !== 'function') {
    throw new Error('NotificationEventRepository must implement saveEvent(event).');
  }
  if (typeof repository.findEvent !== 'function') {
    throw new Error('NotificationEventRepository must implement findEvent(id).');
  }
  if (typeof repository.listEvents !== 'function') {
    throw new Error('NotificationEventRepository must implement listEvents(query).');
  }
  if (repository.archiveEvent !== undefined && typeof repository.archiveEvent !== 'function') {
    throw new Error('NotificationEventRepository archiveEvent must be a function when provided.');
  }
  return repository;
}

module.exports = {
  assertNotificationEventRepository
};
