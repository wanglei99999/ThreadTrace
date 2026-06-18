'use strict';

const COMMANDS_BY_KEY = {
  'runtime.configuration': 'node src/presentation/cli/threadtrace.js runtime-diagnostics',
  'resources.storage': 'node src/presentation/cli/threadtrace.js runtime-diagnostics',
  'adapters.contract': 'node src/presentation/cli/threadtrace.js adapter-diagnostics',
  'sources.ingestConfiguration': 'node src/presentation/cli/threadtrace.js source-diagnostics',
  'workers.readiness': 'node src/presentation/cli/threadtrace.js operations-readiness',
  'notifications.outbox': 'node src/presentation/cli/threadtrace.js list-events --delivery-status failed',
  'llm.configuration': 'node src/presentation/cli/threadtrace.js runtime-diagnostics'
};

function getOperationsRunbook(options) {
  const safeOptions = options || {};
  const checklist = safeOptions.checklist || {};
  const pipelineRuns = safeOptions.pipelineRuns || {};
  const actions = checklistActions(checklist).concat(pipelineRunActions(pipelineRuns.runs || []));

  return {
    generatedAt: safeOptions.now || checklist.generatedAt || new Date().toISOString(),
    status: aggregateActionStatus(actions),
    actionCount: actions.length,
    actions,
    checklist,
    pipelineRuns
  };
}

function checklistActions(checklist) {
  return (checklist.items || []).filter(function (item) {
    return item.status !== 'ok';
  }).map(function (item) {
    return action({
      key: 'checklist.' + item.key,
      severity: item.status === 'fail' ? 'critical' : 'warning',
      area: item.area,
      title: titleForChecklistItem(item),
      summary: item.summary,
      recommendedCommand: COMMANDS_BY_KEY[item.key],
      evidence: item.evidence
    });
  });
}

function pipelineRunActions(runs) {
  return runs.filter(function (run) {
    return run.status === 'failed' || (run.semantic && run.semantic.status === 'failed');
  }).slice(0, 10).map(function (run) {
    return action({
      key: 'pipeline.' + run.taskId,
      severity: run.status === 'failed' ? 'critical' : 'warning',
      area: 'pipelines',
      title: 'Inspect failed source insight pipeline run.',
      summary: (run.source && run.source.displayName || run.sourceId || 'Unknown source') + ' has a failed or partially failed pipeline run.',
      recommendedCommand: 'node src/presentation/cli/threadtrace.js list-tasks --type source-insight-pipeline',
      evidence: {
        taskId: run.taskId,
        sourceId: run.sourceId,
        status: run.status,
        semanticStatus: run.semantic && run.semantic.status,
        finishedAt: run.finishedAt
      }
    });
  });
}

function action(input) {
  return {
    key: input.key,
    severity: input.severity,
    area: input.area,
    title: input.title,
    summary: input.summary,
    recommendedCommand: input.recommendedCommand,
    evidence: input.evidence || {}
  };
}

function titleForChecklistItem(item) {
  if (item.status === 'fail') return 'Fix failing ' + item.area + ' readiness check.';
  return 'Review warning in ' + item.area + ' readiness check.';
}

function aggregateActionStatus(actions) {
  if (actions.some(function (item) { return item.severity === 'critical'; })) return 'fail';
  if (actions.some(function (item) { return item.severity === 'warning'; })) return 'warn';
  return 'ok';
}

module.exports = {
  getOperationsRunbook
};
