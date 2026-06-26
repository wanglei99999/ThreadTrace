'use strict';

function getAutomationCockpitSnapshot(input) {
  const safeInput = input || {};
  const plan = safeInput.plan || {};
  const notificationOverview = safeInput.notificationOverview || {};
  const reviewActionAuditOverview = safeInput.reviewActionAuditOverview || {};
  const reviewActionExecutions = safeInput.reviewActionExecutions || {};
  const notificationDiagnostics = safeInput.notificationDiagnostics || {};
  const generatedAt = safeInput.now || plan.generatedAt || new Date().toISOString();
  const diagnosticsStatus = notificationDiagnostics.status || statusFromChecks(notificationDiagnostics.checks || []);
  const componentStatuses = [
    plan.status,
    notificationOverview.status,
    reviewActionAuditOverview.status,
    reviewActionExecutions.status,
    diagnosticsStatus
  ].filter(Boolean);
  const status = aggregateStatus(componentStatuses);
  const operatingPressure = buildOperatingPressure({
    notificationOverview,
    reviewActionAuditOverview,
    reviewActionExecutions,
    notificationDiagnostics,
    diagnosticsStatus
  });
  const operatorRunbook = buildOperatorRunbook({
    plan,
    notificationOverview,
    reviewActionAuditOverview,
    reviewActionExecutions,
    diagnosticsStatus,
    status
  });
  const freshness = buildFreshnessSummary({
    generatedAt,
    plan,
    notificationOverview,
    reviewActionAuditOverview,
    reviewActionExecutions,
    notificationDiagnostics
  });
  const attentionQueue = buildAttentionQueue({
    status,
    plan,
    operatingPressure,
    freshness,
    operatorRunbook
  });
  return {
    schemaVersion: 'automation-cockpit-snapshot.v1',
    generatedAt,
    status,
    readyForUnattendedRun: Boolean(plan.readyForUnattendedRun && status === 'ok'),
    plan,
    notificationOverview,
    reviewActionAuditOverview,
    reviewActionExecutions,
    notificationDiagnostics,
    operatingPressure,
    freshness,
    operatorRunbook,
    attentionQueue,
    summary: {
      readinessStatus: plan.status || 'unknown',
      notificationStatus: notificationOverview.status || 'unknown',
      auditStatus: reviewActionAuditOverview.status || 'unknown',
      executionStatus: reviewActionExecutions.status || 'unknown',
      diagnosticsStatus,
      openNotificationCount: firstNumber(notificationOverview.openCount, notificationOverview.unacknowledgedCount, 0),
      pendingNotificationCount: firstNumber(notificationOverview.pendingDeliveryCount, notificationOverview.pendingCount, notificationOverview.dueForDeliveryCount, 0),
      auditCount: reviewActionAuditOverview.count,
      executionCount: reviewActionExecutions.count
    }
  };
}

function buildAttentionQueue(input) {
  const plan = input.plan || {};
  const pressure = input.operatingPressure || {};
  const freshness = input.freshness || {};
  const runbook = input.operatorRunbook || {};
  const outbox = pressure.outbox || {};
  const audit = pressure.audit || {};
  const executions = pressure.executions || {};
  const channel = pressure.channel || {};
  const items = [];

  if (normalizeStatus(plan.status) !== 'ok') {
    items.push(attentionItem('readiness', 'readiness', plan.status, 'Automation readiness', plan.readyForUnattendedRun
      ? 'Readiness has warnings even though unattended mode was requested.'
      : 'Automation is not ready for unattended operation.', firstPlanNextAction(plan), {
        targetPanel: 'automation-gates',
        actionLabel: 'Open gates',
        nextActionKey: 'refresh-automation-readiness',
        nextActionLabel: 'Refresh now'
      }));
  }
  if (normalizeStatus(outbox.status) !== 'ok') {
    items.push(attentionItem('pressure.outbox', 'notifications', outbox.status, 'Notification outbox', [
      'open=' + firstNumber(outbox.openCount, 0),
      'due=' + firstNumber(outbox.dueCount, 0),
      'failed=' + firstNumber(outbox.failedCount, 0),
      'retryExhausted=' + firstNumber(outbox.retryExhaustedCount, 0)
    ].join(' | '), outbox.recommendedNextAction || 'Review open and failed notification events.', {
      targetPanel: 'automation-pressure',
      actionLabel: 'Open pressure'
    }));
  }
  if (normalizeStatus(audit.status) !== 'ok') {
    items.push(attentionItem('pressure.audit', 'review-audit', audit.status, 'Review audit ledger', [
      'audits=' + firstNumber(audit.auditCount, 0),
      'tasks=' + firstNumber(audit.taskCount, 0),
      'plannedClosure=' + firstNumber(audit.plannedClosureCount, 0),
      'plannedMerge=' + firstNumber(audit.plannedMergeCandidateCount, 0)
    ].join(' | '), audit.recommendedNextAction || 'Review audit ledger pressure before executing actions.', {
      targetPanel: 'automation-pressure',
      actionLabel: 'Open pressure'
    }));
  }
  if (normalizeStatus(executions.status) !== 'ok') {
    items.push(attentionItem('pressure.executions', 'executions', executions.status, 'Action execution ledger', [
      'count=' + firstNumber(executions.count, 0),
      'stale=' + firstNumber(executions.staleRunningCount, 0),
      'failed=' + firstNumber(executions.failedCount, 0)
    ].join(' | '), 'Inspect stale or failed automation action executions.', {
      targetPanel: 'automation-pressure',
      actionLabel: 'Open pressure'
    }));
  }
  if (normalizeStatus(channel.status) !== 'ok') {
    items.push(attentionItem('pressure.channel', 'notifications', channel.status, 'Notification channel', [
      'channel=' + (channel.channel || 'unknown'),
      'failedChecks=' + firstNumber(channel.failedCheckCount, 0),
      'warnChecks=' + firstNumber(channel.warnCheckCount, 0)
    ].join(' | '), 'Run notification diagnostics before relying on delivery.', {
      targetPanel: 'automation-pressure',
      actionLabel: 'Open pressure'
    }));
  }
  if (normalizeStatus(freshness.status) !== 'ok') {
    items.push(attentionItem('freshness', 'freshness', freshness.status, 'Snapshot freshness', [
      'present=' + firstNumber(freshness.presentSourceCount, 0) + '/' + firstNumber(freshness.sourceCount, 0),
      'missing=' + firstNumber(freshness.missingSourceCount, 0),
      'spanMs=' + (freshness.spanMs === undefined ? 'unknown' : freshness.spanMs)
    ].join(' | '), (freshness.missingSources || []).length > 0
      ? 'Refresh missing inputs: ' + freshness.missingSources.join(', ')
      : 'Refresh stale cockpit inputs.', {
        targetPanel: 'automation-freshness',
        actionLabel: 'Open freshness',
        nextActionKey: 'refresh-automation-readiness',
        nextActionLabel: 'Refresh now'
      }));
  }
  if ((runbook.actionableCommandCount || 0) > 0) {
    items.push(attentionItem('runbook.actionable', 'runbook', runbook.status, 'Operator runbook', [
      'actionable=' + firstNumber(runbook.actionableCommandCount, 0),
      'dryRun=' + firstNumber(runbook.dryRunCommandCount, 0),
      'execute=' + firstNumber(runbook.executeCommandCount, 0)
    ].join(' | '), runbook.nextCommand && runbook.nextCommand.command || 'Review operator runbook commands.', {
      targetPanel: 'automation-runbook',
      actionLabel: 'Open runbook',
      nextActionKey: 'preview-runbook-command',
      nextActionLabel: 'Preview next'
    }));
  }

  const sortedItems = items.sort(function (left, right) {
    const severityDiff = severityRank(right.severity) - severityRank(left.severity);
    if (severityDiff !== 0) return severityDiff;
    return String(left.id).localeCompare(String(right.id));
  }).map(function (item, index) {
    return Object.assign({ rank: index + 1 }, item);
  });
  const status = sortedItems.length === 0
    ? 'ok'
    : aggregateStatus(sortedItems.map(function (item) { return item.status; }));
  return {
    status,
    itemCount: sortedItems.length,
    criticalCount: sortedItems.filter(function (item) { return item.severity === 'critical'; }).length,
    warningCount: sortedItems.filter(function (item) { return item.severity === 'warning'; }).length,
    highestSeverity: sortedItems[0] && sortedItems[0].severity || 'ok',
    nextItem: sortedItems[0],
    items: sortedItems
  };
}

function attentionItem(id, area, status, title, summary, nextAction, metadata) {
  const normalized = normalizeStatus(status);
  return Object.assign({
    id,
    area,
    status: normalized,
    severity: normalized === 'fail' ? 'critical' : normalized === 'warn' ? 'warning' : 'info',
    title,
    summary,
    nextAction
  }, metadata || {});
}

function severityRank(severity) {
  if (severity === 'critical') return 3;
  if (severity === 'warning') return 2;
  if (severity === 'info') return 1;
  return 0;
}

function firstPlanNextAction(plan) {
  const action = (plan.nextActions || [])[0];
  return action && (action.summary || action.recommendedCommand || action.command || action.key) || 'Review automation readiness checks.';
}

function buildOperatingPressure(input) {
  const notificationOverview = input.notificationOverview || {};
  const auditOverview = input.reviewActionAuditOverview || {};
  const executions = input.reviewActionExecutions || {};
  const diagnostics = input.notificationDiagnostics || {};
  const checks = diagnostics.checks || [];
  const failedCount = firstNumber(notificationOverview.failedCount, 0);
  const retryExhaustedCount = firstNumber(notificationOverview.retryExhaustedCount, 0);
  const dueCount = firstNumber(notificationOverview.dueForDeliveryCount, notificationOverview.pendingDeliveryCount, 0);
  const openCount = firstNumber(notificationOverview.openCount, notificationOverview.unacknowledgedCount, 0);
  const pendingCount = firstNumber(notificationOverview.pendingCount, notificationOverview.pendingDeliveryCount, notificationOverview.dueForDeliveryCount, 0);
  const outboxStatus = failedCount > 0 || retryExhaustedCount > 0
    ? 'fail'
    : dueCount > 0 || openCount > 0 || pendingCount > 0
      ? 'warn'
      : normalizeStatus(notificationOverview.status || 'ok');
  const staleRunningCount = firstNumber(executions.summary && executions.summary.staleRunning, executions.staleRunningCount, executions.staleRunning, 0);
  const failedExecutionCount = firstNumber(executions.summary && executions.summary.failed, executions.failedCount, executions.failed, 0);
  const executionCount = firstNumber(executions.count, executions.summary && executions.summary.count, (executions.executions || []).length, 0);
  const executionStatus = failedExecutionCount > 0 || staleRunningCount > 0
    ? 'fail'
    : normalizeStatus(executions.status || executions.healthStatus || 'ok');
  const auditCount = firstNumber(auditOverview.count, 0);
  const auditStatus = normalizeStatus(auditOverview.status || (auditCount > 0 ? 'ok' : 'warn'));
  const failedCheckCount = checks.filter(function (check) { return check.status === 'fail'; }).length;
  const warnCheckCount = checks.filter(function (check) { return check.status === 'warn'; }).length;
  const channelStatus = failedCheckCount > 0
    ? 'fail'
    : warnCheckCount > 0
      ? 'warn'
      : normalizeStatus(input.diagnosticsStatus || diagnostics.status || 'ok');
  return {
    status: aggregateStatus([outboxStatus, auditStatus, executionStatus, channelStatus]),
    outbox: {
      status: outboxStatus,
      eventCount: firstNumber(notificationOverview.eventCount, 0),
      openCount,
      pendingCount,
      dueCount,
      failedCount,
      retryExhaustedCount,
      recommendedNextAction: notificationOverview.recommendedNextAction
    },
    audit: {
      status: auditStatus,
      auditCount,
      taskCount: firstNumber(auditOverview.taskCount, 0),
      plannedClosureCount: firstNumber(auditOverview.plannedClosureCount, 0),
      plannedMergeCandidateCount: firstNumber(auditOverview.plannedMergeCandidateCount, 0),
      recommendedNextAction: auditOverview.recommendedNextAction
    },
    executions: {
      status: executionStatus,
      count: executionCount,
      staleRunningCount,
      failedCount: failedExecutionCount
    },
    channel: {
      status: channelStatus,
      channel: diagnostics.channel || 'unknown',
      checkCount: checks.length,
      failedCheckCount,
      warnCheckCount
    }
  };
}

function buildFreshnessSummary(input) {
  const plan = input.plan || {};
  const planInputs = plan.inputs || {};
  const sources = [
    freshnessSource('snapshot', input.generatedAt),
    freshnessSource('readiness', plan.generatedAt),
    freshnessSource('schedule', planInputs.scheduleGeneratedAt),
    freshnessSource('sourceOperationsCockpit', planInputs.cockpitGeneratedAt),
    freshnessSource('collectionHealth', planInputs.collectionHealthGeneratedAt),
    freshnessSource('workerTopology', planInputs.workerTopologyGeneratedAt),
    freshnessSource('llmReadiness', planInputs.llmReadinessGeneratedAt),
    freshnessSource('demoCycle', planInputs.demoCycleGeneratedAt),
    freshnessSource('notificationOverview', input.notificationOverview && input.notificationOverview.generatedAt),
    freshnessSource('reviewActionAuditOverview', input.reviewActionAuditOverview && input.reviewActionAuditOverview.generatedAt),
    freshnessSource('reviewActionExecutions', input.reviewActionExecutions && input.reviewActionExecutions.generatedAt),
    freshnessSource('notificationDiagnostics', input.notificationDiagnostics && input.notificationDiagnostics.generatedAt)
  ];
  const presentSources = sources.filter(function (source) {
    return source.present;
  });
  const timestamps = presentSources.map(function (source) {
    return source.epochMs;
  }).filter(Number.isFinite);
  const oldestEpochMs = timestamps.length > 0 ? Math.min.apply(Math, timestamps) : undefined;
  const newestEpochMs = timestamps.length > 0 ? Math.max.apply(Math, timestamps) : undefined;
  const missingSources = sources.filter(function (source) {
    return !source.present;
  }).map(function (source) {
    return source.key;
  });
  return {
    status: missingSources.length > 0 ? 'warn' : 'ok',
    sourceCount: sources.length,
    presentSourceCount: presentSources.length,
    missingSourceCount: missingSources.length,
    missingSources,
    oldestGeneratedAt: formatIsoFromEpoch(oldestEpochMs),
    newestGeneratedAt: formatIsoFromEpoch(newestEpochMs),
    spanMs: Number.isFinite(oldestEpochMs) && Number.isFinite(newestEpochMs) ? newestEpochMs - oldestEpochMs : undefined,
    sources
  };
}

function freshnessSource(key, generatedAt) {
  const epochMs = Date.parse(generatedAt || '');
  return {
    key,
    generatedAt,
    present: Boolean(generatedAt),
    epochMs: Number.isFinite(epochMs) ? epochMs : undefined
  };
}

function formatIsoFromEpoch(epochMs) {
  if (!Number.isFinite(epochMs)) return undefined;
  return new Date(epochMs).toISOString();
}

function buildOperatorRunbook(input) {
  const plan = input.plan || {};
  const automation = plan.automation || {};
  const remediation = plan.remediation || {};
  const workerCommands = (automation.workerCommands || []).filter(function (worker) {
    return worker && worker.command;
  });
  const remediationCommands = [];
  (remediation.actions || []).forEach(function (action) {
    if (action.command) {
      remediationCommands.push(commandItem('schedule.preview.' + (action.key || remediationCommands.length), 'Preview schedule remediation', action.command, {
        sourceId: action.scope && action.scope.sourceId,
        sourceKey: action.scope && action.scope.sourceKey,
        severity: action.severity || 'warning',
        intent: scheduleIntent(action, action.dryRun, false)
      }));
    }
    if (action.executeCommand) {
      remediationCommands.push(commandItem('schedule.execute.' + (action.key || remediationCommands.length), 'Execute schedule remediation', action.executeCommand, {
        sourceId: action.scope && action.scope.sourceId,
        sourceKey: action.scope && action.scope.sourceKey,
        severity: action.severity || 'warning',
        intent: scheduleIntent(action, action.execute, true)
      }));
    }
  });
  const manualCommands = (remediation.manualActions || []).filter(function (action) {
    return action && action.command;
  }).map(function (action, index) {
    return commandItem('manual.' + (action.key || action.checkKey || index), action.summary || action.checkKey || 'Manual review', action.command, {
      severity: action.severity || 'warning'
    });
  });
  const validationCommands = [
    commandItem('validate.snapshot', 'Read Automation Cockpit snapshot', 'node src/presentation/cli/threadtrace.js automation-cockpit --json true', { severity: 'info' }),
    commandItem('validate.web', 'Verify Automation Cockpit browser surface', 'npm run verify:web:automation-cockpit', { severity: 'info' })
  ];
  const sections = [
    section('workers', 'Start long-running workers', statusFromWorkers(plan), workerCommands.map(function (worker, index) {
      return commandItem('worker.' + (worker.key || worker.workerType || index), worker.workerType || worker.key || 'worker', worker.command, {
        leaseKey: worker.leaseKey,
        intervalMs: worker.intervalMs,
        severity: statusFromWorkers(plan) === 'fail' ? 'critical' : 'info'
      });
    })),
    section('schedule', 'Close schedule gaps', remediationCommands.length > 0 ? 'warn' : 'ok', remediationCommands),
    section('manual-review', 'Manual readiness checks', manualCommands.length > 0 ? 'warn' : 'ok', manualCommands),
    section('verification', 'Verify cockpit health', input.status === 'fail' ? 'fail' : input.status === 'warn' ? 'warn' : 'ok', validationCommands)
  ];
  const commandCount = sections.reduce(function (total, item) {
    return total + item.commands.length;
  }, 0);
  const intentSummary = summarizeRunbookIntents(sections);
  return {
    status: commandCount > 0 ? input.status : 'ok',
    commandCount,
    actionableCommandCount: intentSummary.actionable,
    dryRunCommandCount: intentSummary.dryRun,
    executeCommandCount: intentSummary.execute,
    copyOnlyCommandCount: commandCount - intentSummary.actionable,
    sections,
    nextCommand: firstActionableCommand(sections) || firstCommand(sections)
  };
}

function section(key, title, status, commands) {
  return {
    key,
    title,
    status: status || 'unknown',
    commandCount: (commands || []).length,
    commands: commands || []
  };
}

function commandItem(key, title, command, metadata) {
  return Object.assign({
    key,
    title,
    command
  }, metadata || {});
}

function summarizeRunbookIntents(sections) {
  const summary = {
    actionable: 0,
    dryRun: 0,
    execute: 0
  };
  (sections || []).forEach(function (item) {
    (item.commands || []).forEach(function (command) {
      if (!command.intent) return;
      summary.actionable += 1;
      if (command.intent.execute === true) summary.execute += 1;
      else summary.dryRun += 1;
    });
  });
  return summary;
}

function scheduleIntent(action, api, execute) {
  if (!action || !action.scope || !action.scope.sourceId) return undefined;
  const command = execute === true ? action.executeCommand : action.command;
  const looksLikeScheduleAction = action.type === 'configure-source-schedule' ||
    (api && /\/schedule$/.test(api.path || '')) ||
    /configure-source-schedule/.test(command || '');
  if (!looksLikeScheduleAction) return undefined;
  const body = api && api.body || {};
  return {
    type: 'set-source-schedule',
    sourceId: action.scope.sourceId,
    sourceKey: action.scope.sourceKey,
    sourceType: action.scope.sourceType,
    execute: execute === true,
    intervalMinutes: body.intervalMinutes || 60,
    runNow: body.runNow !== false,
    scheduleEnabled: body.scheduleEnabled === undefined ? true : body.scheduleEnabled !== false
  };
}

function statusFromWorkers(plan) {
  return plan && plan.summary && plan.summary.workers && plan.summary.workers.status || 'unknown';
}

function firstCommand(sections) {
  for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex += 1) {
    const commands = sections[sectionIndex].commands || [];
    if (commands.length > 0) return commands[0];
  }
  return undefined;
}

function firstActionableCommand(sections) {
  for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex += 1) {
    const commands = sections[sectionIndex].commands || [];
    const command = commands.find(function (item) {
      return item && item.intent && item.intent.execute !== true;
    });
    if (command) return command;
  }
  return undefined;
}

function firstNumber() {
  for (let index = 0; index < arguments.length; index += 1) {
    const value = arguments[index];
    if (Number.isFinite(value)) return value;
  }
  return undefined;
}

function statusFromChecks(checks) {
  if (!checks || checks.length === 0) return 'unknown';
  return aggregateStatus(checks.map(function (check) {
    return check && check.status;
  }).filter(Boolean));
}

function aggregateStatus(statuses) {
  if (!statuses || statuses.length === 0) return 'warn';
  if (statuses.some(function (status) { return normalizeStatus(status) === 'fail'; })) return 'fail';
  if (statuses.some(function (status) { return normalizeStatus(status) === 'warn'; })) return 'warn';
  return 'ok';
}

function normalizeStatus(status) {
  if (status === 'fail' || status === 'failed' || status === 'critical' || status === 'error') return 'fail';
  if (status === 'warn' || status === 'warning' || status === 'degraded' || status === 'pending') return 'warn';
  if (status === 'ok' || status === 'ready' || status === 'healthy') return 'ok';
  return 'warn';
}

module.exports = {
  getAutomationCockpitSnapshot
};
