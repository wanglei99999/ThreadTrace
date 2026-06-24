'use strict';

/**
 * Idempotency ledger for executor-backed review actions. It records each
 * logical downstream mutation before the adapter is called so retries can
 * avoid duplicate task closures or context merges.
 *
 * @typedef {Object} ContextReviewActionExecutionRepository
 * @property {(record: Object) => Promise<{ claimed: boolean, record: Object }>} claimExecution
 * @property {(key: string, result: Object, metadata?: Object) => Promise<Object>} completeExecution
 * @property {(key: string, error: Error, metadata?: Object) => Promise<Object>} failExecution
 * @property {(key: string) => Promise<Object | undefined>} findExecution
 * @property {(query?: { action?: string, status?: string, taskId?: string, sourceId?: string, sourceKey?: string, limit?: number }) => Promise<Object[]>} listExecutions
 */

function assertContextReviewActionExecutionRepository(repository) {
  if (!repository) return undefined;
  if (typeof repository.claimExecution !== 'function') {
    throw new Error('ContextReviewActionExecutionRepository must implement claimExecution(record).');
  }
  if (typeof repository.completeExecution !== 'function') {
    throw new Error('ContextReviewActionExecutionRepository must implement completeExecution(key, result, metadata).');
  }
  if (typeof repository.failExecution !== 'function') {
    throw new Error('ContextReviewActionExecutionRepository must implement failExecution(key, error, metadata).');
  }
  if (typeof repository.findExecution !== 'function') {
    throw new Error('ContextReviewActionExecutionRepository must implement findExecution(key).');
  }
  if (typeof repository.listExecutions !== 'function') {
    throw new Error('ContextReviewActionExecutionRepository must implement listExecutions(query).');
  }
  return repository;
}

module.exports = {
  assertContextReviewActionExecutionRepository
};
