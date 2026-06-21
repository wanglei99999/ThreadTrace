'use strict';

/**
 * Read model for review-action executor audit records. These records are
 * produced by executor adapters and kept separate from task records so
 * downstream mutation attempts can be inspected independently.
 *
 * @typedef {Object} ContextReviewActionAuditRepository
 * @property {(query?: { action?: string, taskId?: string, limit?: number }) => Promise<Object[]>} listActionAudits
 */

function assertContextReviewActionAuditRepository(repository) {
  if (!repository || typeof repository.listActionAudits !== 'function') {
    throw new Error('ContextReviewActionAuditRepository must implement listActionAudits(query).');
  }
  return repository;
}

module.exports = {
  assertContextReviewActionAuditRepository
};
