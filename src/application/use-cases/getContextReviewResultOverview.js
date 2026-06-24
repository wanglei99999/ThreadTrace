'use strict';

const { assertContextReviewResultRepository } = require('../ports/contextReviewResultRepository');

async function getContextReviewResultOverview(options) {
  const safeOptions = options || {};
  const repository = assertContextReviewResultRepository(safeOptions.contextReviewResultRepository);
  const now = safeOptions.now || new Date().toISOString();
  const records = await repository.listReviewResults({
    handoffId: safeOptions.handoffId,
    status: safeOptions.status,
    reviewerId: safeOptions.reviewerId,
    sourceId: safeOptions.sourceId,
    sourceKey: safeOptions.sourceKey || safeOptions.forum,
    limit: safeOptions.limit || 100
  });
  const summary = records.reduce(function (acc, record) {
    const reviewStatus = record.status || 'unknown';
    const severity = record.summary && record.summary.notification
      ? record.summary.notification.severity || 'unknown'
      : 'unknown';
    acc.byStatus[reviewStatus] = (acc.byStatus[reviewStatus] || 0) + 1;
    acc.bySeverity[severity] = (acc.bySeverity[severity] || 0) + 1;
    acc.remainingTaskCount += numeric(record.summary && record.summary.remainingCount);
    acc.resolvedTaskCount += numeric(record.summary && record.summary.resolvedCount);
    acc.mergeCandidateCount += Array.isArray(record.summary && record.summary.mergeCandidates)
      ? record.summary.mergeCandidates.length
      : 0;
    acc.blockedTaskCount += Array.isArray(record.summary && record.summary.blockedTasks)
      ? record.summary.blockedTasks.length
      : 0;
    return acc;
  }, {
    byStatus: {},
    bySeverity: {},
    remainingTaskCount: 0,
    resolvedTaskCount: 0,
    mergeCandidateCount: 0,
    blockedTaskCount: 0
  });
  const criticalRecords = records.filter(function (record) {
    return record.summary && record.summary.notification && record.summary.notification.severity === 'critical';
  });
  const warningRecords = records.filter(function (record) {
    return record.summary && record.summary.notification && record.summary.notification.severity === 'warning';
  });

  return {
    generatedAt: now,
    windowLimit: safeOptions.limit || 100,
    count: records.length,
    byStatus: summary.byStatus,
    bySeverity: summary.bySeverity,
    resolvedTaskCount: summary.resolvedTaskCount,
    remainingTaskCount: summary.remainingTaskCount,
    mergeCandidateCount: summary.mergeCandidateCount,
    blockedTaskCount: summary.blockedTaskCount,
    attention: {
      criticalCount: criticalRecords.length,
      warningCount: warningRecords.length,
      topRecords: criticalRecords.concat(warningRecords).slice(0, 10).map(summarizeAttentionRecord)
    },
    recent: records.slice(0, 10).map(summarizeRecentRecord),
    recommendedNextAction: recommendedNextAction({
      criticalCount: criticalRecords.length,
      warningCount: warningRecords.length,
      remainingTaskCount: summary.remainingTaskCount,
      mergeCandidateCount: summary.mergeCandidateCount
    })
  };
}

function summarizeRecentRecord(record) {
  return {
    id: record.id,
    status: record.status,
    handoffId: record.handoffId,
    submittedAt: record.submittedAt,
    reviewer: record.reviewer,
    notificationSeverity: record.summary && record.summary.notification && record.summary.notification.severity,
    remainingCount: record.summary && record.summary.remainingCount,
    mergeCandidateCount: Array.isArray(record.summary && record.summary.mergeCandidates)
      ? record.summary.mergeCandidates.length
      : 0
  };
}

function summarizeAttentionRecord(record) {
  return {
    id: record.id,
    status: record.status,
    handoffId: record.handoffId,
    submittedAt: record.submittedAt,
    reviewer: record.reviewer,
    severity: record.summary && record.summary.notification && record.summary.notification.severity,
    reason: record.summary && record.summary.notification && record.summary.notification.reason,
    recommendedNextAction: record.summary && record.summary.recommendedNextAction
  };
}

function recommendedNextAction(input) {
  if (input.criticalCount > 0) {
    return 'Review critical rejected results before merging any related context decisions.';
  }
  if (input.warningCount > 0 || input.remainingTaskCount > 0) {
    return 'Work through warning review results and keep unresolved tasks visible.';
  }
  if (input.mergeCandidateCount > 0) {
    return 'Merge confirmed review decisions and close resolved tasks.';
  }
  return 'No review result action is pending in the current window.';
}

function numeric(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

module.exports = {
  getContextReviewResultOverview
};
