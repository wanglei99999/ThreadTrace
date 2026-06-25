'use strict';

async function getSourceCollectionHealthProfile(options) {
  const safeOptions = options || {};
  const drilldown = safeOptions.drilldown || await resolveDrilldown(safeOptions);
  const checks = buildChecks(drilldown);
  const status = aggregateStatus(checks);
  return {
    generatedAt: safeOptions.now || drilldown.generatedAt || new Date().toISOString(),
    status,
    scope: drilldown.scope || {},
    sourceFound: Boolean(drilldown.sourceFound),
    source: summarizeSource(drilldown),
    automation: summarizeAutomation(drilldown),
    incremental: summarizeIncremental(drilldown),
    replay: summarizeReplay(drilldown),
    operations: summarizeOperations(drilldown),
    checks,
    drilldown: safeOptions.includeDrilldown === true ? drilldown : undefined,
    nextActions: buildNextActions(status, drilldown, checks)
  };
}

async function resolveDrilldown(options) {
  if (typeof options.getSourceOperationsDrilldown !== 'function') {
    throw new Error('getSourceCollectionHealthProfile requires drilldown or getSourceOperationsDrilldown(request).');
  }
  return options.getSourceOperationsDrilldown({
    sourceId: options.sourceId,
    sourceKey: options.sourceKey || options.forum,
    limit: options.limit,
    timelineLimit: options.timelineLimit,
    attentionLimit: options.attentionLimit,
    taskScanLimit: options.taskScanLimit,
    leaseScanLimit: options.leaseScanLimit,
    sourceRunStaleAfterMs: options.sourceRunStaleAfterMs,
    sourceFailureRetryBackoffMs: options.sourceFailureRetryBackoffMs,
    sourceFailureMaxRetryBackoffMs: options.sourceFailureMaxRetryBackoffMs,
    runningStaleAfterMs: options.runningStaleAfterMs,
    workerStaleAfterMs: options.workerStaleAfterMs,
    now: options.now,
    storeDir: options.storeDir
  });
}

function buildChecks(drilldown) {
  const plan = drilldown.collectionPlan || {};
  const health = drilldown.health || {};
  const source = health.source || {};
  const tasks = health.tasks || {};
  const events = health.events || {};
  const workers = health.workers || { runs: {}, leases: {} };
  const checks = [
    check('source.resolved', 'source', drilldown.sourceFound ? 'ok' : 'fail', drilldown.sourceFound ? source.displayName || scopeLabel(drilldown.scope) : scopeLabel(drilldown.scope), 'Source registration is resolved.'),
    check('source.enabled', 'source', source.enabled === false ? 'warn' : 'ok', source.enabled === false ? 'disabled' : 'enabled', 'Source is enabled for scheduled collection.'),
    check('collection.schedule', 'schedule', scheduleStatus(plan), scheduleValue(plan), 'Source has an actionable schedule or due decision.'),
    check('collection.retry', 'schedule', retryStatus(plan), retryValue(plan), 'Failure retry/backoff state is visible.'),
    check('collection.cursor', 'incremental', plan.cursor && plan.cursor.present ? 'ok' : 'warn', plan.cursor && plan.cursor.present ? plan.cursor.fingerprint : 'missing', 'Incremental cursor is recorded.'),
    check('collection.incremental', 'incremental', incrementalStatus(plan), incrementalValue(plan), 'Incremental refresh evidence is available.'),
    check('collection.replayEvidence', 'replay', plan.replay && plan.replay.available ? 'ok' : 'warn', replayValue(plan), 'Collection can be replayed from task, cursor, raw page, URL, or local source evidence.'),
    check('collection.lastRun', 'run', lastRunStatus(plan), lastRunValue(plan), 'Last source run is completed or ready for retry.'),
    check('operations.tasks', 'operations', tasks.failed > 0 ? 'warn' : 'ok', 'failed=' + (tasks.failed || 0), 'Recent source tasks are not failing.'),
    check('operations.events', 'operations', events.failed > 0 || events.dueForDelivery > 0 ? 'warn' : 'ok', 'open=' + (events.unacknowledged || 0) + ', failed=' + (events.failed || 0) + ', due=' + (events.dueForDelivery || 0), 'Source notification events are not stuck.'),
    check('workers.runs', 'workers', workers.runs && workers.runs.stale > 0 ? 'fail' : 'ok', 'stale=' + (workers.runs && workers.runs.stale || 0), 'Source-scoped worker runs are fresh.'),
    check('workers.leases', 'workers', workers.leases && workers.leases.expired > 0 ? 'warn' : 'ok', 'expired=' + (workers.leases && workers.leases.expired || 0), 'Source-scoped worker leases are active.'),
    check('operations.timeline', 'evidence', (drilldown.timeline || []).length > 0 ? 'ok' : 'warn', String((drilldown.timeline || []).length), 'Source task/event/worker timeline is available.')
  ];
  return checks;
}

function summarizeSource(drilldown) {
  const source = drilldown.source || {};
  const healthSource = drilldown.health && drilldown.health.source || {};
  return {
    id: source.id || drilldown.scope && drilldown.scope.sourceId,
    sourceKey: source.sourceKey || drilldown.scope && drilldown.scope.sourceKey,
    sourceType: source.sourceType || healthSource.sourceType,
    displayName: source.displayName || healthSource.displayName,
    enabled: healthSource.enabled,
    status: healthSource.status
  };
}

function summarizeAutomation(drilldown) {
  const plan = drilldown.collectionPlan || {};
  const schedule = plan.schedule || {};
  const decision = schedule.decision || {};
  return {
    status: plan.status || 'unknown',
    strategy: plan.strategy,
    schedule: {
      enabled: schedule.enabled,
      intervalMinutes: schedule.intervalMinutes,
      nextRunAt: schedule.nextRunAt,
      due: Boolean(decision.due),
      reason: decision.reason || 'unknown',
      retryAt: decision.retryAt,
      failureCount: decision.failureCount || 0,
      backoffMs: decision.backoffMs,
      baseReason: decision.baseReason
    },
    lastRun: plan.lastRun || {}
  };
}

function summarizeIncremental(drilldown) {
  const plan = drilldown.collectionPlan || {};
  return {
    cursor: plan.cursor || {},
    incremental: plan.incremental || {}
  };
}

function summarizeReplay(drilldown) {
  const replay = drilldown.collectionPlan && drilldown.collectionPlan.replay || {};
  return {
    available: Boolean(replay.available),
    taskId: replay.taskId,
    cursorFingerprint: replay.cursorFingerprint,
    rawPageHashCount: Array.isArray(replay.rawPageHashes) ? replay.rawPageHashes.length : 0,
    pageNumbers: replay.pageNumbers || [],
    sourceUrls: replay.sourceUrls || [],
    evidenceKinds: replay.evidenceKinds || [],
    location: replay.location || {}
  };
}

function summarizeOperations(drilldown) {
  const health = drilldown.health || {};
  const workers = health.workers || { runs: {}, leases: {} };
  return {
    drilldownStatus: drilldown.status,
    tasks: health.tasks || {},
    events: health.events || {},
    workers,
    attention: drilldown.attention,
    timelineCount: (drilldown.timeline || []).length,
    latestTimelineItem: (drilldown.timeline || [])[0]
  };
}

function buildNextActions(status, drilldown, checks) {
  const failing = checks.filter(function (item) {
    return item.status === 'fail' || item.status === 'warn';
  });
  const actions = failing.slice(0, 5).map(function (item) {
    return {
      key: 'collectionHealth.' + item.key,
      severity: item.status === 'fail' ? 'critical' : 'warning',
      summary: item.summary + ' Current value: ' + item.value + '.',
      recommendedCommand: commandForCheck(item, drilldown.scope || {})
    };
  });
  if (actions.length === 0) {
    actions.push({
      key: 'collectionHealth.ready',
      severity: 'info',
      summary: 'Source collection is ready for scheduled incremental operation.',
      recommendedCommand: scopedCommand('source-drilldown', drilldown.scope || {})
    });
  }
  (drilldown.nextActions || []).slice(0, 5).forEach(function (action) {
    actions.push(action);
  });
  return dedupeActions(actions);
}

function commandForCheck(checkItem, scope) {
  if (checkItem.key.indexOf('workers.') === 0) return scopedCommand('worker-topology-plan', scope);
  if (checkItem.key === 'operations.tasks') return scopedCommand('trace-context', scope);
  if (checkItem.key === 'operations.events') return scopedCommand('list-events', scope);
  if (checkItem.key === 'collection.schedule') return scopedCommand('source-schedule-report', scope);
  if (checkItem.key === 'source.resolved') return scopedCommand('source-diagnostics', scope);
  return scopedCommand('source-drilldown', scope);
}

function scopedCommand(command, scope) {
  const args = [
    scope.sourceId ? '--source-id ' + scope.sourceId : undefined,
    scope.sourceKey ? '--source-key ' + scope.sourceKey : undefined
  ].filter(Boolean).join(' ');
  return 'node src/presentation/cli/threadtrace.js ' + command + (args ? ' ' + args : '');
}

function scheduleStatus(plan) {
  const schedule = plan.schedule || {};
  const decision = schedule.decision || {};
  if (plan.status === 'unscheduled' || decision.reason === 'no-schedule' || decision.reason === 'schedule-disabled') return 'warn';
  return 'ok';
}

function scheduleValue(plan) {
  const schedule = plan.schedule || {};
  const decision = schedule.decision || {};
  return [
    'status=' + (plan.status || 'unknown'),
    'due=' + Boolean(decision.due),
    'reason=' + (decision.reason || 'unknown'),
    schedule.nextRunAt ? 'next=' + schedule.nextRunAt : undefined
  ].filter(Boolean).join(', ');
}

function retryStatus(plan) {
  const lastRun = plan.lastRun || {};
  const decision = plan.schedule && plan.schedule.decision || {};
  if ((lastRun.failureCount || 0) > 0 && !decision.retryAt && !decision.backoffMs && plan.status !== 'due') return 'warn';
  return 'ok';
}

function retryValue(plan) {
  const lastRun = plan.lastRun || {};
  const decision = plan.schedule && plan.schedule.decision || {};
  return 'failureCount=' + (lastRun.failureCount || decision.failureCount || 0) + (decision.retryAt ? ', retryAt=' + decision.retryAt : '');
}

function incrementalStatus(plan) {
  const incremental = plan.incremental || {};
  if (plan.cursor && plan.cursor.present && incremental.lastChanged !== undefined) return 'ok';
  return plan.cursor && plan.cursor.present ? 'warn' : 'warn';
}

function incrementalValue(plan) {
  const incremental = plan.incremental || {};
  return 'changed=' + String(incremental.lastChanged) + ', newPosts=' + (incremental.newPostCount || 0) + ', nextPosts=' + (incremental.nextPostCount || 0);
}

function replayValue(plan) {
  const replay = plan.replay || {};
  return (replay.evidenceKinds || []).join(',') || 'none';
}

function lastRunStatus(plan) {
  const lastRun = plan.lastRun || {};
  if (lastRun.status === 'failed') return 'warn';
  if (lastRun.status === 'running') return 'warn';
  return 'ok';
}

function lastRunValue(plan) {
  const lastRun = plan.lastRun || {};
  return [
    'status=' + (lastRun.status || 'unknown'),
    lastRun.lastTaskId ? 'task=' + lastRun.lastTaskId : undefined,
    lastRun.failureCount ? 'failureCount=' + lastRun.failureCount : undefined
  ].filter(Boolean).join(', ');
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

function scopeLabel(scope) {
  const safeScope = scope || {};
  return [safeScope.sourceId, safeScope.sourceKey].filter(Boolean).join(' / ') || 'unknown-source';
}

function dedupeActions(actions) {
  const seen = new Set();
  return (actions || []).filter(function (action) {
    const key = action && action.key;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

module.exports = {
  getSourceCollectionHealthProfile
};
