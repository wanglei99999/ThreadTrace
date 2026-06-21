'use strict';

const {
  assertContextReviewActionAuditRepository
} = require('../ports/contextReviewActionAuditRepository');

async function listContextReviewActionAudits(options) {
  const safeOptions = options || {};
  const repository = assertContextReviewActionAuditRepository(safeOptions.contextReviewActionAuditRepository);
  const audits = await repository.listActionAudits({
    action: safeOptions.action,
    taskId: safeOptions.taskId,
    limit: safeOptions.limit || 50
  });

  return {
    generatedAt: safeOptions.now || new Date().toISOString(),
    count: audits.length,
    audits
  };
}

module.exports = {
  listContextReviewActionAudits
};
