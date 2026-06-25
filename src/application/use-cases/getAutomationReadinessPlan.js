'use strict';

function getAutomationReadinessPlan(options) {
  const safeOptions = options || {};
  const sourceScheduleReport = safeOptions.sourceScheduleReport || {};
  const sourceOperationsCockpit = safeOptions.sourceOperationsCockpit || {};
  const sourceCollectionHealthProfile = safeOptions.sourceCollectionHealthProfile;
  const workerTopologyPlan = safeOptions.workerTopologyPlan || {};
  const llmReadinessProfile = safeOptions.llmReadinessProfile || {};
  const demoCycle = safeOptions.demoCycle;
  const scope = normalizeScope(safeOptions);
  const checks = buildChecks({
    sourceScheduleReport,
    sourceOperationsCockpit,
    sourceCollectionHealthProfile,
    workerTopologyPlan,
    llmReadinessProfile,
    demoCycle
  });
  const status = aggregateStatus(checks);

  return {
    generatedAt: safeOptions.now || sourceScheduleReport.generatedAt || new Date().toISOString(),
    status,
    scope,
    readyForUnattendedRun: status === 'ok',
    summary: buildSummary({
      sourceScheduleReport,
      sourceOperationsCockpit,
      sourceCollectionHealthProfile,
      workerTopologyPlan,
      llmReadinessProfile,
      demoCycle
    }),
    automation: buildAutomationPlan({
      sourceScheduleReport,
      sourceCollectionHealthProfile,
      workerTopologyPlan
    }),
    checks,
    inputs: {
      scheduleGeneratedAt: sourceScheduleReport.generatedAt,
      cockpitGeneratedAt: sourceOperationsCockpit.generatedAt,
      collectionHealthGeneratedAt: sourceCollectionHealthProfile && sourceCollectionHealthProfile.generatedAt,
      workerTopologyGeneratedAt: workerTopologyPlan.generatedAt,
      llmReadinessGeneratedAt: llmReadinessProfile.generatedAt,
      demoCycleGeneratedAt: demoCycle && demoCycle.generatedAt
    },
    sourceScheduleReport: safeOptions.includeInputs === true ? sourceScheduleReport : undefined,
    sourceOperationsCockpit: safeOptions.includeInputs === true ? sourceOperationsCockpit : undefined,
    sourceCollectionHealthProfile: safeOptions.includeInputs === true ? sourceCollectionHealthProfile : undefined,
    workerTopologyPlan: safeOptions.includeInputs === true ? workerTopologyPlan : undefined,
    llmReadinessProfile: safeOptions.includeInputs === true ? llmReadinessProfile : undefined,
    demoCycle: safeOptions.includeInputs === true ? demoCycle : undefined,
    nextActions: buildNextActions(status, checks, {
      sourceScheduleReport,
      sourceOperationsCockpit,
      sourceCollectionHealthProfile,
      workerTopologyPlan,
      llmReadinessProfile,
      scope
    })
  };
}

function buildChecks(input) {
  const scheduleSummary = input.sourceScheduleReport.summary || input.sourceScheduleReport.unfilteredSummary || {};
  const unfilteredSummary = input.sourceScheduleReport.unfilteredSummary || scheduleSummary;
  const collectionCounts = unfilteredSummary.byCollectionStatus || {};
  const totalSources = unfilteredSummary.total || 0;
  const scheduledCount = totalSources - (collectionCounts.unscheduled || 0);
  const dueCount = scheduleSummary.due || 0;
  const cockpitSummary = input.sourceOperationsCockpit.summary || {};
  const workerCount = Array.isArray(input.workerTopologyPlan.workers) ? input.workerTopologyPlan.workers.length : 0;
  const llmProvider = input.llmReadinessProfile.provider || 'unknown';
  const collectionHealthStatus = input.sourceCollectionHealthProfile && input.sourceCollectionHealthProfile.status;
  const demoClosure = input.demoCycle && input.demoCycle.closure || {};

  return [
    check('automation.sources.registered', 'sources', totalSources > 0 ? 'ok' : 'fail', 'total=' + totalSources, 'At least one tracked source is registered.'),
    check('automation.sources.scheduled', 'sources', scheduledCount > 0 || dueCount > 0 ? 'ok' : (totalSources > 0 ? 'warn' : 'fail'), 'scheduled=' + scheduledCount + ', due=' + dueCount, 'At least one source has schedule or due automation work.'),
    check('automation.source.collectionHealth', 'sources', collectionHealthStatus || 'warn', collectionHealthStatus || 'not-evaluated', 'A representative source collection health profile is available.'),
    check('automation.operations.cockpit', 'operations', input.sourceOperationsCockpit.status || 'warn', 'queue=' + (cockpitSummary.total || 0) + ', runnable=' + (cockpitSummary.runnable || 0), 'Operations cockpit can prioritize source work and blockers.'),
    check('automation.workers.topology', 'workers', input.workerTopologyPlan.status || 'warn', 'topology=' + (input.workerTopologyPlan.topology || 'unknown') + ', workers=' + workerCount, 'Worker topology is planned for long-running automation.'),
    check('automation.llm.readiness', 'llm', input.llmReadinessProfile.status || 'warn', 'provider=' + llmProvider + ', mode=' + (input.llmReadinessProfile.mode || 'unknown'), 'LLM provider readiness is visible before semantic automation.'),
    check('automation.demo.closure', 'demo', demoClosure.status ? (demoClosure.readyForDailyUse ? 'ok' : demoClosure.status === 'fail' ? 'fail' : 'warn') : 'warn', demoClosure.status || 'not-run', 'End-to-end demo cycle closure has been run and reviewed.')
  ];
}

function buildSummary(input) {
  const scheduleSummary = input.sourceScheduleReport.summary || input.sourceScheduleReport.unfilteredSummary || {};
  const unfilteredSummary = input.sourceScheduleReport.unfilteredSummary || scheduleSummary;
  const cockpitSummary = input.sourceOperationsCockpit.summary || {};
  const collectionHealth = input.sourceCollectionHealthProfile || {};
  const topologyWorkers = input.workerTopologyPlan.workers || [];
  return {
    sources: {
      total: unfilteredSummary.total || 0,
      due: scheduleSummary.due || 0,
      skipped: scheduleSummary.skipped || 0,
      byReason: scheduleSummary.byReason || {},
      byCollectionStatus: unfilteredSummary.byCollectionStatus || {}
    },
    operations: {
      cockpitStatus: input.sourceOperationsCockpit.status,
      queueTotal: cockpitSummary.total || 0,
      runnable: cockpitSummary.runnable || 0,
      highestPriorityScore: cockpitSummary.highestPriorityScore || 0
    },
    representativeSource: {
      status: collectionHealth.status,
      sourceFound: collectionHealth.sourceFound,
      source: collectionHealth.source,
      automation: collectionHealth.automation,
      replay: collectionHealth.replay
    },
    workers: {
      status: input.workerTopologyPlan.status,
      topology: input.workerTopologyPlan.topology,
      sourceTaskMode: input.workerTopologyPlan.sourceTaskMode,
      workerCount: topologyWorkers.length
    },
    llm: {
      status: input.llmReadinessProfile.status,
      provider: input.llmReadinessProfile.provider,
      mode: input.llmReadinessProfile.mode,
      mockMode: input.llmReadinessProfile.readiness && input.llmReadinessProfile.readiness.mockMode
    },
    demo: {
      status: input.demoCycle && input.demoCycle.status,
      closureStatus: input.demoCycle && input.demoCycle.closure && input.demoCycle.closure.status,
      readyForDailyUse: Boolean(input.demoCycle && input.demoCycle.closure && input.demoCycle.closure.readyForDailyUse)
    }
  };
}

function buildAutomationPlan(input) {
  const dueSources = (input.sourceScheduleReport.dueSources || []).slice(0, 10).map(compactSource);
  const skippedSources = (input.sourceScheduleReport.skippedSources || []).slice(0, 10).map(compactSource);
  const nextScheduledSource = findNextScheduledSource(input.sourceScheduleReport.sources || input.sourceScheduleReport.skippedSources || []);
  return {
    sourceTaskMode: input.workerTopologyPlan.sourceTaskMode,
    topology: input.workerTopologyPlan.topology,
    dueSources,
    skippedSources,
    nextScheduledSource,
    representativeSource: input.sourceCollectionHealthProfile && input.sourceCollectionHealthProfile.source,
    workerCommands: (input.workerTopologyPlan.workers || []).map(function (worker) {
      return {
        key: worker.key,
        workerType: worker.workerType,
        leaseKey: worker.leaseKey,
        intervalMs: worker.intervalMs,
        command: worker.command
      };
    })
  };
}

function buildNextActions(status, checks, input) {
  if (status === 'ok') {
    return [{
      key: 'automationReadiness.ready',
      severity: 'info',
      summary: 'Automation readiness is green; run the planned worker command or keep the worker loop active.',
      recommendedCommand: firstWorkerCommand(input.workerTopologyPlan)
    }];
  }

  return checks.filter(function (item) {
    return item.status === 'fail' || item.status === 'warn';
  }).slice(0, 8).map(function (item) {
    return {
      key: 'automationReadiness.' + item.key,
      severity: item.status === 'fail' ? 'critical' : 'warning',
      summary: item.summary + ' Current value: ' + item.value + '.',
      recommendedCommand: commandForCheck(item, input)
    };
  });
}

function commandForCheck(checkItem, input) {
  if (checkItem.key === 'automation.sources.registered') {
    return 'node src/presentation/cli/threadtrace.js register-source --forum <source-key> --input <path> --interval-minutes 60';
  }
  if (checkItem.key === 'automation.sources.scheduled') {
    if (input.scope && input.scope.sourceId) {
      return scopedCommand('configure-source-schedule', input.scope) + ' --interval-minutes 60 --run-now true --execute true';
    }
    return 'node src/presentation/cli/threadtrace.js source-schedule-report --json true';
  }
  if (checkItem.key === 'automation.source.collectionHealth') {
    return scopedCommand('source-collection-health', input.scope);
  }
  if (checkItem.key === 'automation.operations.cockpit') {
    return 'node src/presentation/cli/threadtrace.js source-attention-report --json true';
  }
  if (checkItem.key === 'automation.workers.topology') {
    return 'node src/presentation/cli/threadtrace.js worker-topology-plan --source-task-mode insight-pipeline';
  }
  if (checkItem.key === 'automation.llm.readiness') {
    return 'node src/presentation/cli/threadtrace.js llm-readiness --llm-readiness-mode configuration --json true';
  }
  if (checkItem.key === 'automation.demo.closure') {
    return scopedCommand('run-demo-cycle', input.scope) + ' --acknowledge-events true';
  }
  return undefined;
}

function scopedCommand(command, scope) {
  const args = [
    scope && scope.sourceId ? '--source-id ' + scope.sourceId : undefined,
    scope && scope.sourceKey ? '--source-key ' + scope.sourceKey : undefined
  ].filter(Boolean).join(' ');
  return 'node src/presentation/cli/threadtrace.js ' + command + (args ? ' ' + args : '');
}

function compactSource(source) {
  const safeSource = source || {};
  return {
    id: safeSource.id || safeSource.sourceId,
    sourceKey: safeSource.sourceKey,
    sourceType: safeSource.sourceType,
    displayName: safeSource.displayName,
    due: safeSource.decision && safeSource.decision.due,
    reason: safeSource.decision && safeSource.decision.reason,
    nextRunAt: safeSource.decision && safeSource.decision.nextRunAt,
    retryAt: safeSource.decision && safeSource.decision.retryAt,
    collectionStatus: safeSource.collectionPlan && safeSource.collectionPlan.status
  };
}

function findNextScheduledSource(sources) {
  return (sources || []).map(compactSource).filter(function (source) {
    return source.nextRunAt;
  }).sort(function (left, right) {
    return String(left.nextRunAt).localeCompare(String(right.nextRunAt));
  })[0];
}

function firstWorkerCommand(workerTopologyPlan) {
  const worker = workerTopologyPlan && workerTopologyPlan.workers && workerTopologyPlan.workers[0];
  return worker && worker.command;
}

function normalizeScope(options) {
  const scope = {};
  if (options.sourceId) scope.sourceId = options.sourceId;
  if (options.sourceKey || options.forum) scope.sourceKey = options.sourceKey || options.forum;
  if (options.sourceType) scope.sourceType = options.sourceType;
  return scope;
}

function check(key, area, status, value, summary) {
  return {
    key,
    area,
    status,
    value,
    summary
  };
}

function aggregateStatus(checks) {
  if (checks.some(function (item) { return item.status === 'fail'; })) return 'fail';
  if (checks.some(function (item) { return item.status === 'warn'; })) return 'warn';
  return 'ok';
}

module.exports = {
  getAutomationReadinessPlan
};
