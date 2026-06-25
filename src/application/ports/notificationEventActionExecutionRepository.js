'use strict';

/**
 * Idempotency ledger for executor-backed notification event actions. It records
 * the downstream mutation boundary before an event action is applied so retries
 * can replay completed work instead of mutating notification state twice.
 *
 * @typedef {Object} NotificationEventActionExecutionRepository
 * @property {(record: Object) => Promise<{ claimed: boolean, record: Object }>} claimExecution
 * @property {(key: string, result: Object, metadata?: Object) => Promise<Object>} completeExecution
 * @property {(key: string, error: Error, metadata?: Object) => Promise<Object>} failExecution
 * @property {(key: string) => Promise<Object | undefined>} findExecution
 * @property {(query?: { eventId?: string, actionKey?: string, status?: string, sourceId?: string, sourceKey?: string, actor?: string, limit?: number }) => Promise<Object[]>} listExecutions
 */

function assertNotificationEventActionExecutionRepository(repository) {
  if (!repository) return undefined;
  if (typeof repository.claimExecution !== 'function') {
    throw new Error('NotificationEventActionExecutionRepository must implement claimExecution(record).');
  }
  if (typeof repository.completeExecution !== 'function') {
    throw new Error('NotificationEventActionExecutionRepository must implement completeExecution(key, result, metadata).');
  }
  if (typeof repository.failExecution !== 'function') {
    throw new Error('NotificationEventActionExecutionRepository must implement failExecution(key, error, metadata).');
  }
  if (typeof repository.findExecution !== 'function') {
    throw new Error('NotificationEventActionExecutionRepository must implement findExecution(key).');
  }
  if (typeof repository.listExecutions !== 'function') {
    throw new Error('NotificationEventActionExecutionRepository must implement listExecutions(query).');
  }
  return repository;
}

module.exports = {
  assertNotificationEventActionExecutionRepository
};
