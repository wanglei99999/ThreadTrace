'use strict';

/**
 * Storage port for submitted context review results. Review results are kept
 * separate from analysis reports so audit trails can preserve reviewer input.
 *
 * @typedef {Object} ContextReviewResultRepository
 * @property {(record: Object) => Promise<void>} saveReviewResult
 * @property {(id: string) => Promise<Object | undefined>} findReviewResult
 * @property {(query?: { handoffId?: string, status?: string, reviewerId?: string, sourceId?: string, sourceKey?: string, limit?: number }) => Promise<Object[]>} listReviewResults
 */

function assertContextReviewResultRepository(repository) {
  if (!repository || typeof repository.saveReviewResult !== 'function') {
    throw new Error('ContextReviewResultRepository must implement saveReviewResult(record).');
  }
  if (typeof repository.findReviewResult !== 'function') {
    throw new Error('ContextReviewResultRepository must implement findReviewResult(id).');
  }
  if (typeof repository.listReviewResults !== 'function') {
    throw new Error('ContextReviewResultRepository must implement listReviewResults(query).');
  }
  return repository;
}

module.exports = {
  assertContextReviewResultRepository
};
