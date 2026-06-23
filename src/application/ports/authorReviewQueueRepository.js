'use strict';

/**
 * Durable author intelligence review queue storage port. File storage is the
 * local default; production can back the same records with PostgreSQL, a task
 * tracker, or another workflow system.
 *
 * @typedef {Object} AuthorReviewQueueRepository
 * @property {(item: Object) => Promise<void>} saveItem
 * @property {(id: string) => Promise<Object|undefined>} findItem
 * @property {(query?: { status?: string, sourceKey?: string, sourceThreadId?: string, type?: string, priority?: string, limit?: number }) => Promise<Object[]>} listItems
 */

function assertAuthorReviewQueueRepository(repository) {
  if (!repository || typeof repository.saveItem !== 'function') {
    throw new Error('AuthorReviewQueueRepository must implement saveItem(item).');
  }
  if (typeof repository.findItem !== 'function') {
    throw new Error('AuthorReviewQueueRepository must implement findItem(id).');
  }
  if (typeof repository.listItems !== 'function') {
    throw new Error('AuthorReviewQueueRepository must implement listItems(query).');
  }
  return repository;
}

module.exports = {
  assertAuthorReviewQueueRepository
};
