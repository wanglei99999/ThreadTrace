'use strict';

const {
  assertContextReviewActionAuditRepository
} = require('../ports/contextReviewActionAuditRepository');

async function getContextReviewActionAuditOverview(options) {
  const safeOptions = options || {};
  const repository = assertContextReviewActionAuditRepository(safeOptions.contextReviewActionAuditRepository);
  const limit = safeOptions.limit || 100;
  const audits = await repository.listActionAudits({
    action: safeOptions.action,
    taskId: safeOptions.taskId,
    limit
  });

  return buildContextReviewActionAuditOverview({
    audits,
    limit,
    action: safeOptions.action,
    taskId: safeOptions.taskId,
    now: safeOptions.now
  });
}

function buildContextReviewActionAuditOverview(options) {
  const safeOptions = options || {};
  const audits = safeOptions.audits || [];
  const taskIds = unique(audits.map(function (audit) {
    return audit.request && audit.request.taskId;
  }).filter(Boolean));

  return {
    generatedAt: safeOptions.now || new Date().toISOString(),
    status: audits.length > 0 ? 'ok' : 'warn',
    query: {
      action: safeOptions.action,
      taskId: safeOptions.taskId,
      limit: safeOptions.limit
    },
    count: audits.length,
    taskCount: taskIds.length,
    byAction: countBy(audits, function (audit) { return audit.action || 'unknown'; }),
    byAdapter: countBy(audits, function (audit) { return audit.adapter || 'unknown'; }),
    plannedClosureCount: audits.reduce(function (sum, audit) {
      return sum + (((audit.request || {}).closeTaskIds || []).length);
    }, 0),
    plannedMergeCandidateCount: audits.reduce(function (sum, audit) {
      return sum + (((audit.request || {}).mergeCandidates || []).length);
    }, 0),
    latestGeneratedAt: audits.length > 0 ? audits[0].generatedAt : undefined,
    recentAudits: audits.slice(0, 10),
    recommendedNextAction: audits.length > 0
      ? 'Review recent executor audit records before enabling a mutating downstream adapter.'
      : 'Run review-action-apply with a configured executor to create audit records.'
  };
}

function countBy(items, getKey) {
  return items.reduce(function (counts, item) {
    const key = getKey(item);
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

function unique(values) {
  return Array.from(new Set(values));
}

module.exports = {
  buildContextReviewActionAuditOverview,
  getContextReviewActionAuditOverview
};
