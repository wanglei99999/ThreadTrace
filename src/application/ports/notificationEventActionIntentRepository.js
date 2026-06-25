'use strict';

/**
 * Append-style ledger for notification event action intents. These records are
 * side-effect-free dry-run plans that can later feed an executor audit flow.
 *
 * @typedef {Object} NotificationEventActionIntentRepository
 * @property {(record: Object) => Promise<Object>} saveIntent
 * @property {(id: string) => Promise<Object | undefined>} findIntent
 * @property {(query?: { eventId?: string, actionKey?: string, status?: string, sourceId?: string, sourceKey?: string, actor?: string, limit?: number }) => Promise<Object[]>} listIntents
 */

function assertNotificationEventActionIntentRepository(repository) {
  if (!repository) return undefined;
  if (typeof repository.saveIntent !== 'function') {
    throw new Error('NotificationEventActionIntentRepository must implement saveIntent(record).');
  }
  if (typeof repository.findIntent !== 'function') {
    throw new Error('NotificationEventActionIntentRepository must implement findIntent(id).');
  }
  if (typeof repository.listIntents !== 'function') {
    throw new Error('NotificationEventActionIntentRepository must implement listIntents(query).');
  }
  return repository;
}

module.exports = {
  assertNotificationEventActionIntentRepository
};
