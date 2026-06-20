'use strict';

const { assertContextReviewResultRepository } = require('../ports/contextReviewResultRepository');

async function getContextReviewResultActionPlan(options) {
  const safeOptions = options || {};
  const repository = assertContextReviewResultRepository(safeOptions.contextReviewResultRepository);
  const now = safeOptions.now || new Date().toISOString();
  const records = await repository.listReviewResults({
    handoffId: safeOptions.handoffId,
    status: safeOptions.status,
    reviewerId: safeOptions.reviewerId,
    limit: safeOptions.limit || 100
  });
  const collected = collectPlanInputs(records);
  const conflictTaskIds = intersection(collected.resolvedTaskIds, collected.keepOpenTaskIds);
  const keepOpenTaskIds = union(collected.keepOpenTaskIds, collected.blockedTaskIds);
  const closeTaskIds = collected.resolvedTaskIds.filter(function (taskId) {
    return keepOpenTaskIds.indexOf(taskId) === -1 && conflictTaskIds.indexOf(taskId) === -1;
  });
  const mergeCandidates = collected.mergeCandidates.filter(function (candidate) {
    return keepOpenTaskIds.indexOf(candidate.taskId) === -1 && conflictTaskIds.indexOf(candidate.taskId) === -1;
  });
  const attention = buildAttention({
    records,
    closeTaskIds,
    keepOpenTaskIds,
    mergeCandidates,
    blockedTasks: collected.blockedTasks,
    conflictTaskIds
  });

  return {
    generatedAt: now,
    status: attention.risk.level === 'ok' ? 'ok' : 'warn',
    windowLimit: safeOptions.limit || 100,
    count: records.length,
    closeTaskIds,
    keepOpenTaskIds,
    mergeCandidates,
    blockedTasks: collected.blockedTasks,
    records: records.map(summarizeRecordPlan),
    attention: {
      criticalCount: attention.criticalCount,
      warningCount: attention.warningCount,
      conflictTaskIds,
      lowConfidenceRecordIds: attention.lowConfidenceRecordIds
    },
    risk: attention.risk,
    recommendedNextAction: recommendedNextAction({
      criticalCount: attention.criticalCount,
      warningCount: attention.warningCount,
      conflictTaskIds,
      closeTaskIds,
      keepOpenTaskIds,
      mergeCandidates
    })
  };
}

function collectPlanInputs(records) {
  return records.reduce(function (acc, record) {
    const summary = record.summary || {};
    const taskClosure = summary.taskClosure || {};
    const resolvedTasks = firstArray(taskClosure.closeTaskIds, record.result && record.result.resolvedTasks);
    const remainingTasks = firstArray(taskClosure.keepOpenTaskIds, record.result && record.result.remainingTasks);
    const severity = summary.notification && summary.notification.severity;
    const blockedTasks = firstArray(summary.blockedTasks);
    const mergeCandidates = firstArray(summary.mergeCandidates);
    const unsafeRecord = severity === 'critical' || record.status === 'rejected';

    acc.resolvedTaskIds = unsafeRecord ? acc.resolvedTaskIds : union(acc.resolvedTaskIds, resolvedTasks);
    acc.keepOpenTaskIds = union(acc.keepOpenTaskIds, unsafeRecord ? resolvedTasks.concat(remainingTasks) : remainingTasks);
    acc.blockedTaskIds = union(acc.blockedTaskIds, blockedTasks.map(function (task) {
      return task && task.taskId;
    }));
    acc.blockedTasks = acc.blockedTasks.concat(blockedTasks.map(function (task) {
      return Object.assign({}, task, sourceRecordFields(record, severity));
    }));
    acc.mergeCandidates = acc.mergeCandidates.concat(mergeCandidates.map(function (candidate) {
      return Object.assign({}, candidate, sourceRecordFields(record, severity));
    }).filter(function (candidate) {
      return hasText(candidate.taskId) && candidate.severity !== 'critical' && record.status !== 'rejected';
    }));
    return acc;
  }, {
    resolvedTaskIds: [],
    keepOpenTaskIds: [],
    blockedTaskIds: [],
    blockedTasks: [],
    mergeCandidates: []
  });
}

function buildAttention(input) {
  const criticalRecords = input.records.filter(function (record) {
    return notificationSeverity(record) === 'critical';
  });
  const warningRecords = input.records.filter(function (record) {
    return notificationSeverity(record) === 'warning';
  });
  const lowConfidenceRecordIds = input.records.filter(function (record) {
    return record.summary && record.summary.confidenceBand === 'low';
  }).map(function (record) {
    return record.id;
  });
  const reasons = [];
  if (criticalRecords.length > 0) reasons.push('critical-review-results');
  if (input.conflictTaskIds.length > 0) reasons.push('task-close-open-conflicts');
  if (warningRecords.length > 0) reasons.push('warning-review-results');
  if (input.keepOpenTaskIds.length > 0) reasons.push('tasks-still-open');
  if (lowConfidenceRecordIds.length > 0) reasons.push('low-confidence-results');

  return {
    criticalCount: criticalRecords.length,
    warningCount: warningRecords.length,
    lowConfidenceRecordIds,
    risk: {
      level: criticalRecords.length > 0 || input.conflictTaskIds.length > 0
        ? 'critical'
        : (warningRecords.length > 0 || input.keepOpenTaskIds.length > 0 || lowConfidenceRecordIds.length > 0 ? 'warning' : 'ok'),
      reasons
    }
  };
}

function summarizeRecordPlan(record) {
  const summary = record.summary || {};
  const taskClosure = summary.taskClosure || {};
  const closeCandidates = firstArray(taskClosure.closeTaskIds, record.result && record.result.resolvedTasks);
  const keepOpenCandidates = firstArray(taskClosure.keepOpenTaskIds, record.result && record.result.remainingTasks);
  return {
    id: record.id,
    status: record.status,
    handoffId: record.handoffId,
    submittedAt: record.submittedAt,
    reviewer: record.reviewer,
    severity: notificationSeverity(record),
    closeCandidateCount: closeCandidates.length,
    keepOpenCandidateCount: keepOpenCandidates.length,
    mergeCandidateCount: firstArray(summary.mergeCandidates).length,
    blockedTaskCount: firstArray(summary.blockedTasks).length,
    recommendedNextAction: summary.recommendedNextAction
  };
}

function sourceRecordFields(record, severity) {
  return {
    recordId: record.id,
    handoffId: record.handoffId,
    submittedAt: record.submittedAt,
    reviewer: record.reviewer,
    severity
  };
}

function recommendedNextAction(input) {
  if (input.criticalCount > 0) {
    return 'Resolve critical review results before closing tasks or merging context decisions.';
  }
  if (input.conflictTaskIds.length > 0) {
    return 'Reconcile tasks that appear in both close and keep-open sets before execution.';
  }
  if (input.warningCount > 0 || input.keepOpenTaskIds.length > 0) {
    return 'Keep unresolved tasks open, merge only non-conflicting confirmed decisions, and request more evidence where needed.';
  }
  if (input.closeTaskIds.length > 0 || input.mergeCandidates.length > 0) {
    return 'Safe to hand this plan to a closure or merge worker in dry-run mode.';
  }
  return 'No review-result closure or merge action is pending in the current window.';
}

function notificationSeverity(record) {
  return record && record.summary && record.summary.notification
    ? record.summary.notification.severity
    : undefined;
}

function firstArray() {
  for (let index = 0; index < arguments.length; index += 1) {
    if (Array.isArray(arguments[index])) return arguments[index];
  }
  return [];
}

function union(left, right) {
  const values = Array.isArray(left) ? left.slice() : [];
  (Array.isArray(right) ? right : []).forEach(function (value) {
    if (hasText(value) && values.indexOf(value) === -1) values.push(value);
  });
  return values;
}

function intersection(left, right) {
  return (Array.isArray(left) ? left : []).filter(function (value) {
    return hasText(value) && Array.isArray(right) && right.indexOf(value) !== -1;
  });
}

function hasText(value) {
  return typeof value === 'string' && value.length > 0;
}

module.exports = {
  getContextReviewResultActionPlan
};
