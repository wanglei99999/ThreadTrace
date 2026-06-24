'use strict';

const { getContextReviewResultActionPlan } = require('./getContextReviewResultActionPlan');

async function getContextReviewResultActionGate(options) {
  const safeOptions = options || {};
  const actionPlan = safeOptions.actionPlan || await getContextReviewResultActionPlan(safeOptions);
  const gates = buildGates(actionPlan);
  const status = aggregateStatus(gates.map(function (gate) { return gate.status; }));

  return {
    generatedAt: safeOptions.now || actionPlan.generatedAt || new Date().toISOString(),
    status,
    sourceId: actionPlan.sourceId,
    sourceKey: actionPlan.sourceKey,
    gateCount: gates.length,
    gates,
    executable: {
      canCloseTasks: status !== 'fail' && (actionPlan.closeTaskIds || []).length > 0,
      canMergeContext: status !== 'fail' && (actionPlan.mergeCandidates || []).length > 0,
      requiresHumanReview: status !== 'ok',
      closeTaskCount: (actionPlan.closeTaskIds || []).length,
      mergeCandidateCount: (actionPlan.mergeCandidates || []).length
    },
    nextActions: nextActions(gates),
    recommendedNextAction: recommendedNextAction(status, actionPlan),
    actionPlan
  };
}

function buildGates(actionPlan) {
  const attention = actionPlan.attention || {};
  const risk = actionPlan.risk || {};
  const closeTaskIds = actionPlan.closeTaskIds || [];
  const keepOpenTaskIds = actionPlan.keepOpenTaskIds || [];
  const mergeCandidates = actionPlan.mergeCandidates || [];
  const blockedTasks = actionPlan.blockedTasks || [];
  const conflictTaskIds = attention.conflictTaskIds || [];
  const sourceScope = actionPlan.sourceScope || {};

  return [
    gate('reviewResults.available', 'review-results', actionPlan.count > 0 ? 'ok' : 'warn', 'At least one submitted review result is available for closure planning.', {
      reviewResultCount: actionPlan.count || 0,
      windowLimit: actionPlan.windowLimit
    }),
    gate('reviewResults.sourceScope', 'review-results', sourceScope.mixed ? 'fail' : 'ok', 'Review action execution is scoped to one source at a time.', {
      sourceId: actionPlan.sourceId,
      sourceKey: actionPlan.sourceKey,
      sourceIds: sourceScope.sourceIds || [],
      sourceKeys: sourceScope.sourceKeys || []
    }),
    gate('reviewResults.risk', 'review-results', riskStatus(risk.level), 'Review result risk is low enough for downstream dry-run workers.', {
      level: risk.level || 'unknown',
      reasons: risk.reasons || [],
      criticalCount: attention.criticalCount || 0,
      warningCount: attention.warningCount || 0
    }),
    gate('reviewResults.conflicts', 'tasks', conflictTaskIds.length > 0 ? 'fail' : 'ok', 'No task is simultaneously marked close and keep-open.', {
      conflictTaskIds
    }),
    gate('reviewResults.blockers', 'tasks', blockedTasks.length > 0 || keepOpenTaskIds.length > 0 ? 'warn' : 'ok', 'No unresolved or blocked task requires manual follow-up.', {
      keepOpenTaskIds,
      blockedTaskIds: blockedTasks.map(function (task) { return task.taskId; }).filter(Boolean)
    }),
    gate('reviewResults.executionScope', 'execution', closeTaskIds.length > 0 || mergeCandidates.length > 0 ? 'ok' : 'warn', 'The action plan has at least one closure or merge candidate for a dry-run worker.', {
      closeTaskCount: closeTaskIds.length,
      mergeCandidateCount: mergeCandidates.length
    })
  ];
}

function riskStatus(level) {
  if (level === 'critical') return 'fail';
  if (level === 'warning') return 'warn';
  if (level === 'ok') return 'ok';
  return 'warn';
}

function nextActions(gates) {
  return gates.filter(function (gate) {
    return gate.status !== 'ok';
  }).map(function (gate) {
    return {
      key: gate.key,
      severity: gate.status === 'fail' ? 'critical' : 'warning',
      summary: gate.summary,
      commands: gate.commands || []
    };
  });
}

function recommendedNextAction(status, actionPlan) {
  if (status === 'fail') {
    return 'Do not execute closure or merge workers until critical review result gates are resolved.';
  }
  if (status === 'warn') {
    return actionPlan.recommendedNextAction || 'Review warnings, then run downstream workers in dry-run mode.';
  }
  return 'Gate is clear for a downstream closure or merge worker dry-run.';
}

function gate(key, area, status, summary, evidence, commands) {
  return {
    key,
    area,
    status,
    summary,
    evidence: evidence || {},
    commands: commands || []
  };
}

function aggregateStatus(statuses) {
  if (statuses.some(function (status) { return status === 'fail'; })) return 'fail';
  if (statuses.some(function (status) { return status === 'warn'; })) return 'warn';
  return 'ok';
}

module.exports = {
  getContextReviewResultActionGate
};
