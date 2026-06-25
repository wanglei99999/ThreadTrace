'use strict';

function getDeploymentChecklist(options) {
  const safeOptions = options || {};
  const diagnostics = safeOptions.diagnostics || {};
  const adapterDiagnostics = safeOptions.adapterDiagnostics || {};
  const connectorReadiness = safeOptions.connectorReadiness || {};
  const notificationDiagnostics = safeOptions.notificationDiagnostics || {};
  const reviewActionExecutorDiagnostics = safeOptions.reviewActionExecutorDiagnostics || {};
  const reviewActionExecutionSummary = summarizeActionExecutions(safeOptions.reviewActionExecutions);
  const notificationEventActionExecutionSummary = summarizeActionExecutions(safeOptions.notificationEventActionExecutions);
  const sourceDiagnostics = safeOptions.sourceDiagnostics || {};
  const readiness = safeOptions.readiness || {};
  const sourceScope = {
    sourceKey: safeOptions.sourceKey || safeOptions.forum,
    sourceType: safeOptions.sourceType
  };
  const items = [
    item('runtime.configuration', 'runtime', diagnostics.status || 'fail', 'Runtime configuration and resource diagnostics are available.', {
      generatedAt: diagnostics.generatedAt,
      storageMode: diagnostics.configuration && diagnostics.configuration.storageMode
    }),
    item('resources.storage', 'resources', aggregateChecks(diagnostics.checks, /^resources\./), 'Primary storage resources are reachable.', {
      checks: selectCheckKeys(diagnostics.checks, /^resources\./)
    }),
    item('adapters.contract', 'adapters', adapterDiagnostics.status || 'fail', 'Forum adapters satisfy the ThreadTrace adapter contract.', {
      adapterCount: adapterDiagnostics.adapterCount
    }),
    item('connectors.readiness', 'connectors', connectorReadiness.status || 'fail', 'Source connector catalog, modules, and adapter coverage are ready.', {
      connectorCount: connectorReadiness.connectorCount,
      sourceCount: connectorReadiness.sourceCount,
      modules: connectorReadiness.modules
    }),
    item('sources.ingestConfiguration', 'sources', sourceDiagnostics.status || 'fail', 'Tracked sources have usable locations, handlers, and adapters.', {
      sourceKey: sourceScope.sourceKey,
      sourceType: sourceScope.sourceType,
      sourceCount: sourceDiagnostics.sourceCount,
      summary: summarizeSourceDiagnostics(sourceDiagnostics)
    }),
    item('workers.readiness', 'workers', readiness.status || 'fail', 'Background workers and leases are ready for production traffic.', {
      checks: selectCheckKeys(readiness.checks, /^workers\.|^workerLeases\./)
    }),
    item('notifications.channel', 'notifications', aggregateChecks(notificationDiagnostics.checks, /^notifications\./), 'Notification delivery channel is configured and locally valid.', {
      channel: notificationDiagnostics.channel,
      checks: selectCheckKeys(notificationDiagnostics.checks, /^notifications\./)
    }),
    item('notifications.outbox', 'notifications', aggregateChecks(readiness.checks, /^events\./), 'Notification outbox has no unacknowledged failures or due delivery backlog.', {
      checks: selectCheckKeys(readiness.checks, /^events\./)
    }),
    item('notificationEventActions.executionLedger', 'notifications', actionExecutionStatus(notificationEventActionExecutionSummary), 'Notification event action execution ledger prevents duplicate operator-triggered event mutations.', {
      status: notificationEventActionExecutionSummary.status,
      count: notificationEventActionExecutionSummary.count,
      completed: notificationEventActionExecutionSummary.completed,
      running: notificationEventActionExecutionSummary.running,
      staleRunning: notificationEventActionExecutionSummary.staleRunning,
      failed: notificationEventActionExecutionSummary.failed,
      latestUpdatedAt: notificationEventActionExecutionSummary.latestUpdatedAt,
      runningStaleAfterMs: notificationEventActionExecutionSummary.runningStaleAfterMs,
      sourceId: notificationEventActionExecutionSummary.sourceId,
      sourceKey: notificationEventActionExecutionSummary.sourceKey,
      bySourceKey: notificationEventActionExecutionSummary.bySourceKey,
      bySourceId: notificationEventActionExecutionSummary.bySourceId,
      staleRunningBySourceKey: notificationEventActionExecutionSummary.staleRunningBySourceKey,
      failedExecutions: notificationEventActionExecutionSummary.failedExecutions,
      staleRunningExecutions: notificationEventActionExecutionSummary.staleRunningExecutions,
      message: notificationEventActionExecutionSummary.message
    }),
    item('reviewActions.executor', 'review-actions', reviewActionExecutorDiagnostics.status || 'warn', 'Review action executor mode and readiness are visible before execute=true.', {
      mode: reviewActionExecutorDiagnostics.mode,
      ready: reviewActionExecutorDiagnostics.ready,
      dryRunOnly: reviewActionExecutorDiagnostics.dryRunOnly,
      mutatesSourceTruth: reviewActionExecutorDiagnostics.mutatesSourceTruth,
      audit: reviewActionExecutorDiagnostics.audit,
      checks: selectCheckKeys(reviewActionExecutorDiagnostics.checks, /^reviewActionExecutor\./)
    }),
    item('reviewActions.executionLedger', 'review-actions', actionExecutionStatus(reviewActionExecutionSummary), 'Review action execution ledger prevents duplicate downstream mutations.', {
      status: reviewActionExecutionSummary.status,
      count: reviewActionExecutionSummary.count,
      completed: reviewActionExecutionSummary.completed,
      running: reviewActionExecutionSummary.running,
      staleRunning: reviewActionExecutionSummary.staleRunning,
      failed: reviewActionExecutionSummary.failed,
      latestUpdatedAt: reviewActionExecutionSummary.latestUpdatedAt,
      runningStaleAfterMs: reviewActionExecutionSummary.runningStaleAfterMs,
      sourceId: reviewActionExecutionSummary.sourceId,
      sourceKey: reviewActionExecutionSummary.sourceKey,
      bySourceKey: reviewActionExecutionSummary.bySourceKey,
      bySourceId: reviewActionExecutionSummary.bySourceId,
      staleRunningBySourceKey: reviewActionExecutionSummary.staleRunningBySourceKey,
      failedExecutions: reviewActionExecutionSummary.failedExecutions,
      staleRunningExecutions: reviewActionExecutionSummary.staleRunningExecutions,
      message: reviewActionExecutionSummary.message
    }),
    item('llm.configuration', 'llm', aggregateChecks(diagnostics.checks, /^config\.llm\./), 'LLM provider configuration is ready for the selected provider.', {
      provider: diagnostics.configuration && diagnostics.configuration.llm && diagnostics.configuration.llm.provider,
      checks: selectCheckKeys(diagnostics.checks, /^config\.llm\./)
    })
  ];

  return {
    generatedAt: safeOptions.now || diagnostics.generatedAt || readiness.generatedAt || new Date().toISOString(),
    status: aggregateStatuses(items.map(function (check) { return check.status; })),
    items,
    diagnostics,
    adapterDiagnostics,
    connectorReadiness,
    notificationDiagnostics,
    reviewActionExecutorDiagnostics,
    reviewActionExecutions: reviewActionExecutionSummary,
    notificationEventActionExecutions: notificationEventActionExecutionSummary,
    sourceDiagnostics,
    readiness
  };
}

function summarizeActionExecutions(result) {
  const executions = result && Array.isArray(result.executions) ? result.executions : [];
  const staleRunningExecutions = result && Array.isArray(result.staleRunningExecutions)
    ? result.staleRunningExecutions
    : executions.filter(function (execution) { return execution.staleRunning; }).slice(0, 10);
  const failedExecutions = executions.filter(function (execution) {
    return execution.status === 'failed';
  }).slice(0, 10);
  return {
    status: result && result.status || (result ? 'ok' : 'warn'),
    healthStatus: result && result.healthStatus,
    count: result && result.count !== undefined ? result.count : executions.length,
    completed: executions.filter(function (execution) { return execution.status === 'completed'; }).length,
    running: executions.filter(function (execution) { return execution.status === 'running'; }).length,
    staleRunning: result && result.staleRunningCount !== undefined
      ? result.staleRunningCount
      : staleRunningExecutions.length,
    failed: executions.filter(function (execution) { return execution.status === 'failed'; }).length,
    latestUpdatedAt: latestTimestamp(executions.map(function (execution) {
      return execution.updatedAt || execution.completedAt || execution.failedAt || execution.createdAt;
    })),
    sourceId: result && result.sourceId,
    sourceKey: result && result.sourceKey,
    bySourceKey: result && result.bySourceKey || countBy(executions, function (execution) { return execution.sourceKey || 'unknown'; }),
    bySourceId: result && result.bySourceId || countBy(executions, function (execution) { return execution.sourceId || 'unknown'; }),
    staleRunningBySourceKey: result && result.staleRunningBySourceKey || countBy(staleRunningExecutions, function (execution) { return execution.sourceKey || 'unknown'; }),
    runningStaleAfterMs: result && result.runningStaleAfterMs,
    failedExecutions,
    staleRunningExecutions,
    message: result && result.message
  };
}

function actionExecutionStatus(summary) {
  if (!summary || summary.status === 'warn') return 'warn';
  if (summary.failed > 0) return 'fail';
  if (summary.staleRunning > 0) return 'fail';
  if (summary.running > 0) return 'warn';
  return 'ok';
}

function item(key, area, status, summary, evidence) {
  return {
    key,
    area,
    status,
    summary,
    evidence: evidence || {}
  };
}

function aggregateChecks(checks, pattern) {
  const selected = (checks || []).filter(function (check) {
    return pattern.test(check.key);
  });
  if (selected.length === 0) return 'warn';
  return aggregateStatuses(selected.map(function (check) { return check.status; }));
}

function selectCheckKeys(checks, pattern) {
  return (checks || []).filter(function (check) {
    return pattern.test(check.key);
  }).map(function (check) {
    return {
      key: check.key,
      status: check.status,
      summary: check.summary
    };
  });
}

function countBy(items, keySelector) {
  return (items || []).reduce(function (counts, item) {
    const key = keySelector(item);
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

function summarizeSourceDiagnostics(sourceDiagnostics) {
  const sources = sourceDiagnostics && Array.isArray(sourceDiagnostics.sources)
    ? sourceDiagnostics.sources
    : [];
  const actions = sourceDiagnostics && Array.isArray(sourceDiagnostics.nextActions)
    ? sourceDiagnostics.nextActions
    : sources.flatMap(function (source) {
      return source.nextActions || [];
    });
  return {
    sourceCount: sourceDiagnostics && sourceDiagnostics.sourceCount !== undefined ? sourceDiagnostics.sourceCount : sources.length,
    ok: sources.filter(function (source) { return source.status === 'ok'; }).length,
    warn: sources.filter(function (source) { return source.status === 'warn'; }).length,
    fail: sources.filter(function (source) { return source.status === 'fail'; }).length,
    nextActionCount: actions.length,
    actionDetails: actions.slice(0, 10).map(function (action) {
      return {
        key: action.key,
        sourceId: action.sourceId,
        severity: action.severity,
        summary: action.summary,
        evidenceSummary: action.evidenceSummary
      };
    }),
    failedSources: sources.filter(function (source) {
      return source.status === 'fail';
    }).slice(0, 10).map(function (source) {
      return {
        sourceId: source.sourceId,
        sourceKey: source.sourceKey,
        sourceType: source.sourceType,
        displayName: source.displayName,
        failedChecks: (source.checks || []).filter(function (check) {
          return check.status === 'fail';
        }).map(function (check) {
          return {
            key: check.key,
            summary: check.summary,
            value: check.value
          };
        })
      };
    })
  };
}

function aggregateStatuses(statuses) {
  if (statuses.some(function (status) { return status === 'fail'; })) return 'fail';
  if (statuses.some(function (status) { return status === 'warn'; })) return 'warn';
  return 'ok';
}

function latestTimestamp(values) {
  return values
    .filter(Boolean)
    .sort()
    .reverse()[0];
}

module.exports = {
  getDeploymentChecklist,
  summarizeSourceDiagnostics
};
