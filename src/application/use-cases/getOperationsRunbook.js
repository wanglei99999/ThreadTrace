'use strict';

const COMMANDS_BY_KEY = {
  'runtime.configuration': 'node src/presentation/cli/threadtrace.js runtime-diagnostics',
  'resources.storage': 'node src/presentation/cli/threadtrace.js runtime-diagnostics',
  'adapters.contract': 'node src/presentation/cli/threadtrace.js adapter-diagnostics',
  'connectors.readiness': 'node src/presentation/cli/threadtrace.js connector-rollout-plan --dry-run-ingest true',
  'sources.ingestConfiguration': 'node src/presentation/cli/threadtrace.js source-ingest-dry-run',
  'workers.readiness': 'node src/presentation/cli/threadtrace.js worker-topology-plan',
  'notifications.channel': 'node src/presentation/cli/threadtrace.js notification-diagnostics',
  'notifications.outbox': 'node src/presentation/cli/threadtrace.js operations-overview',
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
    .concat(connectorModuleActions(checklist))
    .concat(sourceLifecycleActions(safeOptions.sourceLifecycleReport))
    .concat(idempotencyActions(recentTasks))
    .concat(pipelineRunActions(pipelineRuns.runs || []));

  return {
    generatedAt: safeOptions.now || checklist.generatedAt || new Date().toISOString(),
    status: aggregateActionStatus(actions),
    actionCount: actions.length,
    actions,
    checklist,
    sourceLifecycleReport: safeOptions.sourceLifecycleReport,
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
      relatedCommands: relatedCommandsForChecklistItem(item),
      evidence: item.evidence
    });
  });
}

function connectorModuleActions(checklist) {
  const connectorDiagnostics = checklist && checklist.diagnostics && checklist.diagnostics.configuration
    ? checklist.diagnostics.configuration.connectors || {}
    : {};
  const errors = connectorDiagnostics.errors || [];
  if (errors.length === 0) return [];
  return [
    action({
      key: 'connectors.modules.loadFailures',
      severity: 'critical',
      area: 'connectors',
      title: 'Fix failed external connector modules.',
      summary: errors.length + ' configured external connector module(s) failed to load; built-in connectors remain available while external coverage is degraded.',
      recommendedCommand: 'node src/presentation/cli/threadtrace.js connector-rollout-plan --module-path <file> --dry-run-ingest true',
      relatedCommands: [
        'node src/presentation/cli/threadtrace.js connector-readiness',
        'node src/presentation/cli/threadtrace.js validate-connector-module --module-path <file>'
      ],
      evidence: {
        errorCount: errors.length,
        errors: errors.slice(0, 10)
      }
    })
  ];
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
      relatedCommands: [
        'node src/presentation/cli/threadtrace.js source-ingest-dry-run'
      ],
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

function sourceLifecycleActions(report) {
  if (!report) return [];
  const blockedDisableActions = (report.blockedDisables || []).slice(0, 10).map(function (source) {
    return action({
      key: 'sourceLifecycle.disableBlocked.' + safeActionKey(source.sourceId),
      severity: 'warning',
      area: 'sources',
      title: 'Wait for active source run before disabling.',
      summary: (source.displayName || source.sourceId || 'Unknown source') + ' is still running and normal disable is blocked until the run finishes or becomes stale.',
      recommendedCommand: 'node src/presentation/cli/threadtrace.js source-lifecycle-report',
      relatedCommands: [
        'node src/presentation/cli/threadtrace.js list-sources',
        'node src/presentation/cli/threadtrace.js disable-source --source-id ' + quoteCommandValue(source.sourceId) + ' --execute true --force true'
      ],
      evidence: {
        sourceId: source.sourceId,
        lastStartedAt: source.lastStartedAt,
        staleAfterMs: source.staleAfterMs,
        nextAction: source.nextAction
      }
    });
  });
  const retryWaitingActions = (report.sources || []).filter(function (source) {
    return source.failureRetry && source.failureRetry.active && !source.failureRetry.elapsed;
  }).slice(0, 10).map(function (source) {
    return action({
      key: 'sourceLifecycle.failureRetry.' + safeActionKey(source.id),
      severity: 'warning',
      area: 'sources',
      title: 'Wait for failed source retry backoff.',
      summary: (source.displayName || source.id || 'Unknown source') + ' failed recently and will be skipped until ' + (source.failureRetry.retryAt || 'the retry window elapses') + '.',
      recommendedCommand: 'node src/presentation/cli/threadtrace.js source-lifecycle-report',
      relatedCommands: [
        'node src/presentation/cli/threadtrace.js source-diagnostics',
        'node src/presentation/cli/threadtrace.js run-due-sources-task',
        'node src/presentation/cli/threadtrace.js reset-source-failure --source-id ' + quoteCommandValue(source.id) + ' --retry-now true --execute true'
      ],
      evidence: {
        sourceId: source.id,
        retryAt: source.failureRetry.retryAt,
        failureCount: source.failureRetry.failureCount,
        backoffMs: source.failureRetry.backoffMs,
        nextAction: source.nextAction
      }
    });
  });
  return blockedDisableActions.concat(retryWaitingActions);
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
      relatedCommands: [
        'node src/presentation/cli/threadtrace.js operations-readiness'
      ],
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

function relatedCommandsForChecklistItem(item) {
  const commands = {
    'connectors.readiness': [
      'node src/presentation/cli/threadtrace.js connector-readiness',
      'node src/presentation/cli/threadtrace.js validate-connector-module --module-path <file>'
    ],
    'sources.ingestConfiguration': [
      'node src/presentation/cli/threadtrace.js source-diagnostics',
      'node src/presentation/cli/threadtrace.js source-onboarding-preflight'
    ],
    'workers.readiness': [
      'node src/presentation/cli/threadtrace.js operations-readiness',
      'node src/presentation/worker/operationsWorkerMain.js --once'
    ],
    'notifications.outbox': [
      'node src/presentation/cli/threadtrace.js list-events --acknowledged false --delivery-status failed',
      'node src/presentation/cli/threadtrace.js dispatch-events'
    ]
  };
  return commands[item.key] || [];
}

function action(input) {
  return {
    key: input.key,
    severity: input.severity,
    area: input.area,
    title: input.title,
    summary: input.summary,
    recommendedCommand: input.recommendedCommand,
    relatedCommands: input.relatedCommands || [],
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
