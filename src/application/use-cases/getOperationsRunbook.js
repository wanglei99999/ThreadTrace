'use strict';

const COMMANDS_BY_KEY = {
  'runtime.configuration': 'node src/presentation/cli/threadtrace.js runtime-diagnostics',
  'resources.storage': 'node src/presentation/cli/threadtrace.js runtime-diagnostics',
  'adapters.contract': 'node src/presentation/cli/threadtrace.js adapter-diagnostics',
  'sources.ingestConfiguration': 'node src/presentation/cli/threadtrace.js source-diagnostics',
  'workers.readiness': 'node src/presentation/cli/threadtrace.js operations-readiness',
  'notifications.channel': 'node src/presentation/cli/threadtrace.js notification-diagnostics',
  'notifications.outbox': 'node src/presentation/cli/threadtrace.js list-events --delivery-status failed',
  'llm.configuration': 'node src/presentation/cli/threadtrace.js runtime-diagnostics'
};

function getOperationsRunbook(options) {
  const safeOptions = options || {};
  const checklist = safeOptions.checklist || {};
  const pipelineRuns = safeOptions.pipelineRuns || {};
  const recentTasks = safeOptions.recentTasks ||
    (checklist.readiness && checklist.readiness.overview && checklist.readiness.overview.recent && checklist.readiness.overview.recent.tasks) ||
    [];
  const actions = checklistActions(checklist)
    .concat(idempotencyActions(recentTasks))
    .concat(pipelineRunActions(pipelineRuns.runs || []));

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

function idempotencyActions(tasks) {
  return duplicateIdempotencyGroups(tasks).slice(0, 10).map(function (group) {
    return action({
      key: 'idempotency.' + safeActionKey(group.idempotencyKey),
      severity: 'warning',
      area: 'tasks',
      title: 'Inspect duplicate task execution for an idempotency key.',
      summary: 'Idempotency key ' + group.idempotencyKey + ' has ' + group.tasks.length + ' recent task records; verify caller retry behavior and replay coverage.',
      recommendedCommand: 'node src/presentation/cli/threadtrace.js trace-context --idempotency-key ' + quoteCommandValue(group.idempotencyKey),
      evidence: {
        idempotencyKey: group.idempotencyKey,
        taskCount: group.tasks.length,
        reusableTaskId: reusableTaskId(group.tasks),
        taskIds: group.tasks.map(function (task) { return task.id; }),
        statuses: group.tasks.map(function (task) { return task.status; })
      }
    });
  });
}

function duplicateIdempotencyGroups(tasks) {
  const groups = new Map();
  (tasks || []).forEach(function (task) {
    const idempotencyKey = taskTraceValue(task, 'idempotencyKey');
    if (!idempotencyKey) return;
    if (!groups.has(idempotencyKey)) groups.set(idempotencyKey, []);
    groups.get(idempotencyKey).push(task);
  });
  return Array.from(groups.entries())
    .map(function (entry) {
      return {
        idempotencyKey: entry[0],
        tasks: entry[1]
      };
    })
    .filter(function (group) {
      return group.tasks.length > 1;
    });
}

function reusableTaskId(tasks) {
  const completed = tasks.find(function (task) {
    return task.status === 'completed';
  });
  return completed && completed.id;
}

function taskTraceValue(task, key) {
  return task && task.input && task.input._trace
    ? task.input._trace[key]
    : undefined;
}

function safeActionKey(value) {
  return String(value || 'unknown').replace(/[^a-zA-Z0-9_.-]/g, '_');
}

function quoteCommandValue(value) {
  const text = String(value || '');
  if (/^[a-zA-Z0-9_.:-]+$/.test(text)) return text;
  return '"' + text.replace(/"/g, '\\"') + '"';
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
