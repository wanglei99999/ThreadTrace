'use strict';

function summarizeContextReviewResult(result) {
  const safeResult = result || {};
  const decisions = Array.isArray(safeResult.decisions) ? safeResult.decisions : [];
  const resolvedTasks = uniqueText(Array.isArray(safeResult.resolvedTasks) ? safeResult.resolvedTasks : []);
  const remainingTasks = uniqueText(Array.isArray(safeResult.remainingTasks) ? safeResult.remainingTasks : []);
  const decisionCounts = countBy(decisions, function (decision) {
    return decision.decision || 'unknown';
  });
  const confidenceBand = confidenceBandFor(safeResult.confidence);
  const mergeCandidates = decisions.filter(isMergeCandidate).map(summarizeMergeCandidate);
  const evidenceRefCount = countEvidenceRefs(safeResult, decisions);
  const notificationSeverity = severityFor({
    status: safeResult.status,
    remainingCount: remainingTasks.length,
    confidenceBand
  });

  return {
    status: safeResult.status || 'unknown',
    handoffVersion: safeResult.handoffVersion,
    handoffId: safeResult.handoffId,
    reviewedAt: safeResult.reviewedAt,
    reviewer: summarizeReviewer(safeResult.reviewer),
    decisionCount: decisions.length,
    decisionCounts,
    resolvedCount: resolvedTasks.length,
    remainingCount: remainingTasks.length,
    confidence: safeResult.confidence,
    confidenceBand,
    evidenceRefCount,
    taskClosure: {
      closeTaskIds: resolvedTasks,
      keepOpenTaskIds: remainingTasks
    },
    mergeCandidates,
    blockedTasks: blockedTasks(decisions, remainingTasks),
    notification: {
      severity: notificationSeverity,
      reason: notificationReason({
        status: safeResult.status,
        remainingCount: remainingTasks.length,
        confidenceBand,
        notificationSeverity
      })
    },
    recommendedNextAction: recommendedNextAction({
      status: safeResult.status,
      remainingCount: remainingTasks.length,
      mergeCandidateCount: mergeCandidates.length,
      confidenceBand
    })
  };
}

function summarizeReviewer(reviewer) {
  if (!reviewer || typeof reviewer !== 'object') return undefined;
  return {
    type: reviewer.type,
    id: reviewer.id,
    displayName: reviewer.displayName,
    model: reviewer.model
  };
}

function isMergeCandidate(decision) {
  return decision && (decision.decision === 'confirmed' || decision.decision === 'corrected');
}

function summarizeMergeCandidate(decision) {
  return {
    taskId: decision.taskId,
    taskType: decision.taskType,
    decision: decision.decision,
    targetEntity: decision.targetEntity,
    relationType: decision.relationType,
    correctedValue: decision.correctedValue,
    confidence: decision.confidence,
    evidenceRefCount: Array.isArray(decision.evidenceRefs) ? decision.evidenceRefs.length : 0,
    rationale: decision.rationale
  };
}

function blockedTasks(decisions, remainingTasks) {
  const blockedFromDecisions = decisions.filter(function (decision) {
    return decision && (decision.decision === 'rejected' || decision.decision === 'needs-more-evidence');
  }).map(function (decision) {
    return {
      taskId: decision.taskId,
      taskType: decision.taskType,
      decision: decision.decision,
      targetEntity: decision.targetEntity,
      confidence: decision.confidence,
      reason: decision.rationale
    };
  });
  const knownBlockedIds = blockedFromDecisions.map(function (task) { return task.taskId; });
  const unresolvedOnly = remainingTasks.filter(function (taskId) {
    return knownBlockedIds.indexOf(taskId) === -1;
  }).map(function (taskId) {
    return {
      taskId,
      decision: 'remaining'
    };
  });
  return blockedFromDecisions.concat(unresolvedOnly);
}

function confidenceBandFor(confidence) {
  if (typeof confidence !== 'number' || !Number.isFinite(confidence)) return 'unknown';
  if (confidence >= 0.75) return 'high';
  if (confidence >= 0.5) return 'medium';
  return 'low';
}

function severityFor(input) {
  if (input.status === 'rejected') return 'critical';
  if (input.status === 'needs-more-evidence') return 'warning';
  if (input.remainingCount > 0) return 'warning';
  if (input.confidenceBand === 'low') return 'warning';
  return 'info';
}

function notificationReason(input) {
  if (input.notificationSeverity === 'critical') return 'review-result-rejected';
  if (input.status === 'needs-more-evidence') return 'review-needs-more-evidence';
  if (input.remainingCount > 0) return 'review-has-remaining-tasks';
  if (input.confidenceBand === 'low') return 'review-low-confidence';
  return 'review-completed';
}

function recommendedNextAction(input) {
  if (input.status === 'rejected') {
    return 'Do not merge this review result; reopen the handoff or collect stronger evidence.';
  }
  if (input.status === 'needs-more-evidence' || input.remainingCount > 0) {
    return 'Keep unresolved tasks open and request more evidence before merging ambiguous decisions.';
  }
  if (input.mergeCandidateCount > 0 && input.confidenceBand !== 'low') {
    return 'Close resolved tasks and merge confirmed or corrected decisions into the context report.';
  }
  return 'Archive the review result with the handoff audit trail.';
}

function countEvidenceRefs(result, decisions) {
  const resultRefs = Array.isArray(result.evidenceRefs) ? result.evidenceRefs.length : 0;
  const decisionRefs = decisions.reduce(function (total, decision) {
    return total + (Array.isArray(decision && decision.evidenceRefs) ? decision.evidenceRefs.length : 0);
  }, 0);
  return resultRefs + decisionRefs;
}

function countBy(items, keyFn) {
  return items.reduce(function (counts, item) {
    const key = keyFn(item);
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

function uniqueText(values) {
  const seen = [];
  values.forEach(function (value) {
    if (typeof value === 'string' && value.length > 0 && seen.indexOf(value) === -1) {
      seen.push(value);
    }
  });
  return seen;
}

module.exports = {
  summarizeContextReviewResult
};
