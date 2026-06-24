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
  'reviewActions.executor': 'node src/presentation/cli/threadtrace.js review-action-executor-diagnostics',
  'reviewActions.executionLedger': 'node src/presentation/cli/threadtrace.js review-action-executions --status failed',
  'llm.configuration': 'node src/presentation/cli/threadtrace.js runtime-diagnostics'
};

function getOperationsRunbook(options) {
  const safeOptions = options || {};
  const checklist = safeOptions.checklist || {};
  const pipelineRuns = safeOptions.pipelineRuns || {};
  const recentTasks = safeOptions.recentTasks ||
    (checklist.readiness && checklist.readiness.overview && checklist.readiness.overview.recent && checklist.readiness.overview.recent.tasks) ||
    [];
  const scope = {
    sourceKey: safeOptions.sourceKey || safeOptions.forum
  };
  const actions = checklistActions(checklist, scope)
    .concat(sourceDiagnosticsActions(checklist))
    .concat(connectorModuleActions(checklist))
    .concat(sourceLifecycleActions(safeOptions.sourceLifecycleReport))
    .concat(reviewActionGateActions(safeOptions.reviewActionGate))
    .concat(notificationOutboxActions(safeOptions.notificationEventOverview || checklistNotificationEventOverview(checklist)))
    .concat(authorReviewQueueActions(safeOptions.authorReviewQueue || checklistAuthorReviewQueue(checklist)))
    .concat(idempotencyActions(recentTasks))
    .concat(pipelineRunActions(pipelineRuns.runs || []));

  return {
    generatedAt: safeOptions.now || checklist.generatedAt || new Date().toISOString(),
    status: aggregateActionStatus(actions),
    actionCount: actions.length,
    actions,
    checklist,
    sourceLifecycleReport: safeOptions.sourceLifecycleReport,
    reviewActionGate: safeOptions.reviewActionGate,
    notificationEventOverview: safeOptions.notificationEventOverview || checklistNotificationEventOverview(checklist),
    pipelineRuns
  };
}

function notificationOutboxActions(overview) {
  if (!overview) return [];
  const actions = [];
  const retryExhaustedCount = overview.retryExhaustedCount || 0;
  const failedCount = overview.failedCount || 0;
  const dueForDeliveryCount = overview.dueForDeliveryCount || 0;
  const byOpenDeliveryStatus = overview.byOpenDeliveryStatus || {};
  const deliveredOpenCount = byOpenDeliveryStatus.delivered || 0;
  const resolvedOpenCount = byOpenDeliveryStatus.resolved || 0;
  const reviewableCount = deliveredOpenCount + resolvedOpenCount;

  if (retryExhaustedCount > 0 || failedCount > 0 || dueForDeliveryCount > 0) {
    actions.push(action({
      key: 'notifications.outbox.deliveryBacklog',
      severity: retryExhaustedCount > 0 ? 'critical' : 'warning',
      area: 'notifications',
      title: 'Clear notification delivery backlog.',
      summary: 'Notification outbox has ' + dueForDeliveryCount + ' due event(s), ' + failedCount + ' failed event(s), and ' + retryExhaustedCount + ' retry-exhausted event(s).',
      recommendedCommand: retryExhaustedCount > 0
        ? 'node src/presentation/cli/threadtrace.js notification-diagnostics'
        : 'node src/presentation/cli/threadtrace.js dispatch-events',
      relatedCommands: [
        'node src/presentation/cli/threadtrace.js events-overview --acknowledged false',
        'node src/presentation/cli/threadtrace.js list-events --acknowledged false --delivery-status failed',
        'node src/presentation/cli/threadtrace.js dispatch-events'
      ],
      evidence: {
        dueForDeliveryCount,
        failedCount,
        retryExhaustedCount,
        nextDeliveryAt: overview.nextDeliveryAt,
        failedEvents: overview.attention && overview.attention.failedEvents || [],
        retryExhaustedEvents: overview.attention && overview.attention.retryExhaustedEvents || []
      }
    }));
  }

  if (reviewableCount > 0) {
    const recommendedStatus = deliveredOpenCount > 0 ? 'delivered' : 'resolved';
    actions.push(action({
      key: 'notifications.outbox.acknowledgeReviewable',
      severity: 'warning',
      area: 'notifications',
      title: 'Acknowledge delivered or resolved notification events.',
      summary: 'Notification outbox has ' + reviewableCount + ' delivered/resolved event(s) waiting for operator acknowledgement.',
      recommendedCommand: 'node src/presentation/cli/threadtrace.js ack-events --delivery-status ' + recommendedStatus + ' --dry-run true',
      relatedCommands: [
        'node src/presentation/cli/threadtrace.js events-overview --acknowledged false --delivery-status delivered',
        'node src/presentation/cli/threadtrace.js events-overview --acknowledged false --delivery-status resolved',
        'node src/presentation/cli/threadtrace.js ack-events --delivery-status delivered --execute true --by operator',
        'node src/presentation/cli/threadtrace.js ack-events --delivery-status resolved --execute true --by operator',
        'node src/presentation/cli/threadtrace.js archive-events'
      ],
      evidence: {
        deliveredOpenCount,
        resolvedOpenCount,
        reviewableCount,
        oldestUnacknowledgedAt: overview.oldestUnacknowledgedAt,
        reviewableEvents: overview.attention && overview.attention.reviewableEvents || []
      }
    }));
  }

  return actions;
}

function authorReviewQueueActions(queue) {
  if (!queue || !queue.openCount) return [];
  const highPriorityOpenCount = queue.highPriorityOpenCount || 0;
  return [
    action({
      key: 'authorReviewQueue.open',
      severity: 'warning',
      area: 'intelligence',
      title: 'Review open author intelligence queue items.',
      summary: 'Author intelligence has ' + queue.openCount + ' open review item(s)' +
        (highPriorityOpenCount > 0 ? ', including ' + highPriorityOpenCount + ' high-priority item(s).' : '.'),
      recommendedCommand: 'node src/presentation/cli/threadtrace.js list-author-review-queue --status open',
      relatedCommands: [
        'node src/presentation/cli/threadtrace.js sync-author-review-queue',
        'node src/presentation/cli/threadtrace.js synthesize-author-review-queue-events',
        'node src/presentation/worker/operationsWorkerMain.js --once --author-review-queue-events true',
        'node src/presentation/cli/threadtrace.js author-intelligence'
      ],
      evidence: {
        openCount: queue.openCount,
        highPriorityOpenCount,
        byPriority: queue.byPriority || {},
        byType: queue.byType || {},
        latestUpdatedAt: queue.latestUpdatedAt
      }
    })
  ];
}

function checklistAuthorReviewQueue(checklist) {
  return checklist && checklist.readiness && checklist.readiness.overview
    ? checklist.readiness.overview.authorReviewQueue
    : undefined;
}

function checklistNotificationEventOverview(checklist) {
  return checklist && checklist.readiness && checklist.readiness.notificationEventOverview;
}

function checklistActions(checklist, scope) {
  return (checklist.items || []).filter(function (item) {
    return item.status !== 'ok';
  }).map(function (item) {
    return action({
      key: 'checklist.' + item.key,
      severity: item.status === 'fail' ? 'critical' : 'warning',
      area: item.area,
      title: titleForChecklistItem(item),
      summary: item.summary,
      recommendedCommand: recommendedCommandForChecklistItem(item),
      relatedCommands: relatedCommandsForChecklistItem(item),
      evidence: checklistActionEvidence(item, scope)
    });
  });
}

function checklistActionEvidence(item, scope) {
  const evidence = Object.assign({}, item.evidence || {});
  const sourceKey = evidence.sourceKey || scope && scope.sourceKey;
  if (item.area === 'sources' && sourceKey) {
    evidence.sourceKey = sourceKey;
  }
  return evidence;
}

function sourceDiagnosticsActions(checklist) {
  const sourceDiagnostics = checklist && checklist.sourceDiagnostics || {};
  const nextActions = Array.isArray(sourceDiagnostics.nextActions)
    ? sourceDiagnostics.nextActions
    : [];
  return nextActions.slice(0, 10).map(function (item) {
    const commands = uniqueCommands((item.commands || []).concat([
      'node src/presentation/cli/threadtrace.js source-diagnostics'
    ]));
    return action({
      key: 'sourceDiagnostics.' + safeActionKey(item.key) + '.' + safeActionKey(item.sourceId),
      severity: item.severity === 'critical' ? 'critical' : 'warning',
      area: 'sources',
      title: titleForSourceDiagnosticAction(item),
      summary: item.summary || 'Resolve tracked source diagnostic action.',
      recommendedCommand: commands[0],
      relatedCommands: commands.slice(1),
      evidence: Object.assign({}, item.evidence || {}, {
        sourceId: item.sourceId || item.evidence && item.evidence.sourceId,
        diagnosticKey: item.key,
        evidenceSummary: item.evidenceSummary
      }),
      evidenceSummary: item.evidenceSummary
    });
  });
}

function titleForSourceDiagnosticAction(item) {
  const titles = {
    'source.handler': 'Fix tracked source ingest handler.',
    'source.adapter': 'Fix tracked source adapter coverage.',
    'source.location': 'Fix tracked source location.',
    'source.enabled': 'Review disabled tracked source.'
  };
  return titles[item.key] || 'Resolve tracked source diagnostic.';
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
        sourceKey: run.sourceKey || run.source && run.source.sourceKey,
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
    const commands = lifecycleActionCommands(source, [
      'node src/presentation/cli/threadtrace.js source-lifecycle-report',
      'node src/presentation/cli/threadtrace.js list-sources',
      'node src/presentation/cli/threadtrace.js disable-source --source-id ' + quoteCommandValue(source.sourceId) + ' --force true --execute true'
    ]);
    return action({
      key: 'sourceLifecycle.disableBlocked.' + safeActionKey(source.sourceId),
      severity: 'warning',
      area: 'sources',
      title: 'Wait for active source run before disabling.',
      summary: (source.displayName || source.sourceId || 'Unknown source') + ' is still running and normal disable is blocked until the run finishes or becomes stale.',
      recommendedCommand: commands[0],
      relatedCommands: commands.slice(1),
      evidence: {
        sourceId: source.sourceId,
        sourceKey: source.sourceKey,
        lastStartedAt: source.lastStartedAt,
        staleAfterMs: source.staleAfterMs,
        nextAction: source.nextAction
      }
    });
  });
  const retryWaitingActions = (report.sources || []).filter(function (source) {
    return source.failureRetry && source.failureRetry.active && !source.failureRetry.elapsed;
  }).slice(0, 10).map(function (source) {
    const commands = lifecycleActionCommands(source, [
      'node src/presentation/cli/threadtrace.js source-lifecycle-report',
      'node src/presentation/cli/threadtrace.js source-diagnostics',
      'node src/presentation/cli/threadtrace.js run-due-sources-task',
      'node src/presentation/cli/threadtrace.js reset-source-failure --source-id ' + quoteCommandValue(source.id) + ' --retry-now true --execute true'
    ]);
    return action({
      key: 'sourceLifecycle.failureRetry.' + safeActionKey(source.id),
      severity: 'warning',
      area: 'sources',
      title: 'Wait for failed source retry backoff.',
      summary: (source.displayName || source.id || 'Unknown source') + ' failed recently and will be skipped until ' + (source.failureRetry.retryAt || 'the retry window elapses') + '.',
      recommendedCommand: commands[0],
      relatedCommands: commands.slice(1),
      evidence: {
        sourceId: source.id,
        sourceKey: source.sourceKey,
        retryAt: source.failureRetry.retryAt,
        failureCount: source.failureRetry.failureCount,
        backoffMs: source.failureRetry.backoffMs,
        nextAction: source.nextAction
      }
    });
  });
  return blockedDisableActions.concat(retryWaitingActions);
}

function lifecycleActionCommands(source, fallbackCommands) {
  return uniqueCommands((source.recommendedCommands || []).concat(fallbackCommands || []));
}

function uniqueCommands(commands) {
  const seen = new Set();
  return (commands || []).filter(function (command) {
    if (!command || seen.has(command)) return false;
    seen.add(command);
    return true;
  });
}

function reviewActionGateActions(gateReport) {
  if (!gateReport || gateReport.status === 'ok') return [];
  const actionPlan = gateReport.actionPlan || {};
  if (!actionPlan.count) return [];
  const executable = gateReport.executable || {};
  return [
    action({
      key: 'reviewResults.actionGate',
      severity: gateReport.status === 'fail' ? 'critical' : 'warning',
      area: 'review-results',
      title: gateReport.status === 'fail'
        ? 'Resolve blocked review result action gate.'
        : 'Review pending context review closure actions.',
      summary: gateReport.recommendedNextAction || 'Review result action gate requires attention before downstream workers execute.',
      recommendedCommand: 'node src/presentation/cli/threadtrace.js review-action-gate',
      relatedCommands: [
        'node src/presentation/cli/threadtrace.js review-action-apply',
        'node src/presentation/cli/threadtrace.js review-action-plan'
      ],
      evidence: {
        gateStatus: gateReport.status,
        reviewResultCount: actionPlan.count || 0,
        closeTaskCount: executable.closeTaskCount || 0,
        mergeCandidateCount: executable.mergeCandidateCount || 0,
        nextActionCount: (gateReport.nextActions || []).length,
        failingGates: (gateReport.gates || []).filter(function (gate) {
          return gate.status === 'fail';
        }).map(function (gate) {
          return gate.key;
        }),
        warningGates: (gateReport.gates || []).filter(function (gate) {
          return gate.status === 'warn';
        }).map(function (gate) {
          return gate.key;
        })
      }
    })
  ];
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
      'node src/presentation/cli/threadtrace.js events-overview --acknowledged false',
      'node src/presentation/cli/threadtrace.js list-events --acknowledged false --delivery-status failed',
      'node src/presentation/cli/threadtrace.js dispatch-events',
      'node src/presentation/cli/threadtrace.js ack-events --delivery-status delivered --dry-run true'
    ],
    'reviewActions.executor': [
      'node src/presentation/cli/threadtrace.js review-action-audit-overview',
      'node src/presentation/cli/threadtrace.js review-action-apply --execute true'
    ],
    'reviewActions.executionLedger': [
      'node src/presentation/cli/threadtrace.js review-action-executions --status running',
      'node src/presentation/cli/threadtrace.js review-action-gate',
      'node src/presentation/cli/threadtrace.js review-action-apply'
    ]
  };
  return commands[item.key] || [];
}

function recommendedCommandForChecklistItem(item) {
  if (item.key === 'reviewActions.executionLedger') {
    const evidence = item.evidence || {};
    if ((evidence.staleRunning || 0) > 0 && !(evidence.failed > 0)) {
      return 'node src/presentation/cli/threadtrace.js review-action-executions --status running';
    }
  }
  return COMMANDS_BY_KEY[item.key];
}

function action(input) {
  const result = {
    key: input.key,
    severity: input.severity,
    area: input.area,
    title: input.title,
    summary: input.summary,
    recommendedCommand: input.recommendedCommand,
    relatedCommands: input.relatedCommands || [],
    evidence: input.evidence || {}
  };
  if (input.evidenceSummary) {
    result.evidenceSummary = input.evidenceSummary;
  }
  return result;
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
