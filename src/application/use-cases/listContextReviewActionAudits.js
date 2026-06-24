'use strict';

const {
  assertContextReviewActionAuditRepository
} = require('../ports/contextReviewActionAuditRepository');
const {
  auditSourceId,
  auditSourceKey
} = require('../../domain/review-actions/contextReviewActionAuditScope');

async function listContextReviewActionAudits(options) {
  const safeOptions = options || {};
  const repository = assertContextReviewActionAuditRepository(safeOptions.contextReviewActionAuditRepository);
  const audits = await repository.listActionAudits({
    action: safeOptions.action,
    taskId: safeOptions.taskId,
    sourceId: safeOptions.sourceId,
    sourceKey: safeOptions.sourceKey || safeOptions.forum,
    limit: safeOptions.limit || 50
  });
  const enrichedAudits = audits.map(withSourceScope);

  return {
    generatedAt: safeOptions.now || new Date().toISOString(),
    sourceId: safeOptions.sourceId,
    sourceKey: safeOptions.sourceKey || safeOptions.forum,
    count: enrichedAudits.length,
    audits: enrichedAudits
  };
}

function withSourceScope(audit) {
  return Object.assign({}, audit, {
    sourceId: auditSourceId(audit),
    sourceKey: auditSourceKey(audit)
  });
}

module.exports = {
  listContextReviewActionAudits
};
