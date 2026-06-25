'use strict';

function getSourceTypeOperationsReport(options) {
  const safeOptions = options || {};
  const readiness = safeOptions.sourceTypeReadiness || safeOptions.readiness || {};
  const schedule = safeOptions.sourceScheduleReport || safeOptions.scheduleReport || safeOptions.schedule || {};
  const lifecycle = safeOptions.sourceLifecycleReport || safeOptions.lifecycleReport || safeOptions.lifecycle || {};
  const attention = safeOptions.sourceAttentionReport || safeOptions.attentionReport || safeOptions.attention || {};
  const sourceTypeFilter = safeOptions.sourceType ? String(safeOptions.sourceType) : undefined;
  const limit = safeOptions.limit || 100;
  const state = createSourceTypeState(readiness);
  const sourceTypeLookup = buildSourceTypeLookup(readiness, schedule, lifecycle);

  (schedule.sources || []).forEach(function (source) {
    const item = ensureSourceType(state, resolveSourceType(source, sourceTypeLookup));
    item.schedule.total += 1;
    if (source.decision && source.decision.due) item.schedule.due += 1;
    if (source.decision && !source.decision.due) item.schedule.skipped += 1;
    const reason = source.decision && source.decision.reason || 'unknown';
    item.schedule.byReason[reason] = (item.schedule.byReason[reason] || 0) + 1;
  });

  (lifecycle.sources || []).forEach(function (source) {
    const item = ensureSourceType(state, resolveSourceType(source, sourceTypeLookup));
    item.lifecycle.total += 1;
    if (source.enabled !== false) item.lifecycle.enabled += 1;
    if (source.enabled === false) item.lifecycle.disabled += 1;
    if (source.runState && source.runState.status === 'running') item.lifecycle.running += 1;
    if (source.disableGuard && source.disableGuard.running && source.disableGuard.stale) item.lifecycle.staleRunning += 1;
    if (source.disableGuard && source.disableGuard.blocked) item.lifecycle.disableBlocked += 1;
    if (source.failureRetry && source.failureRetry.active && !source.failureRetry.elapsed) item.lifecycle.failureRetryWaiting += 1;
  });

  (attention.sources || []).forEach(function (attentionItem) {
    const source = attentionItem.source || {};
    const item = ensureSourceType(state, resolveSourceType(source, sourceTypeLookup));
    item.attention.total += 1;
    if (attentionItem.severity === 'critical') item.attention.critical += 1;
    if (attentionItem.severity === 'warning' || attentionItem.severity === 'warn') item.attention.warning += 1;
    if (attentionItem.severity === 'info') item.attention.info += 1;
    if (attentionItem.severity === 'muted') item.attention.muted += 1;
    if (attentionItem.runnable) item.attention.runnable += 1;
    if (attentionItem.runnable || attentionItem.recommendedCommand || attentionItem.recommendedNextAction) item.attention.actionable += 1;
    item.attention.highestPriorityScore = Math.max(item.attention.highestPriorityScore, attentionItem.priorityScore || 0);
    (attentionItem.commands || []).forEach(function (command) {
      item.commands.push(command);
    });
    if (attentionItem.recommendedCommand) item.commands.push(attentionItem.recommendedCommand);
    item.topAttention.push({
      key: attentionItem.key,
      source: source,
      severity: attentionItem.severity,
      priorityScore: attentionItem.priorityScore || 0,
      signalCount: attentionItem.signalCount || 0,
      recommendedCommand: attentionItem.recommendedCommand,
      recommendedNextAction: attentionItem.recommendedNextAction
    });
  });

  const sourceTypes = Array.from(state.items.values())
    .map(finalizeSourceTypeOperations)
    .filter(function (item) {
      return !sourceTypeFilter || item.sourceType === sourceTypeFilter;
    })
    .sort(compareSourceTypeOperations)
    .slice(0, limit);

  return {
    generatedAt: safeOptions.now || readiness.generatedAt || schedule.generatedAt || lifecycle.generatedAt || attention.generatedAt || new Date().toISOString(),
    status: aggregateStatus(sourceTypes.map(function (item) { return item.status; })),
    windowLimit: limit,
    summary: summarizeSourceTypes(sourceTypes),
    sourceTypes,
    inputs: {
      readinessGeneratedAt: readiness.generatedAt,
      scheduleGeneratedAt: schedule.generatedAt,
      lifecycleGeneratedAt: lifecycle.generatedAt,
      attentionGeneratedAt: attention.generatedAt
    }
  };
}

function createSourceTypeState(readiness) {
  const state = {
    items: new Map()
  };
  (readiness.sourceTypes || []).concat(readiness.unknownSourceTypes || []).forEach(function (sourceType) {
    const item = ensureSourceType(state, sourceType.sourceType || 'unknown');
    item.description = sourceType.description;
    item.readinessStatus = sourceType.status || 'unknown';
    item.readiness = {
      status: sourceType.status || 'unknown',
      sourceCount: sourceType.sourceCount || 0,
      enabledSourceCount: sourceType.enabledSourceCount || 0,
      statusCounts: sourceType.statusCounts || {},
      unknown: (readiness.unknownSourceTypes || []).indexOf(sourceType) !== -1,
      compatibleSourceKeys: sourceType.compatibleSourceKeys || []
    };
    item.nextActions = item.nextActions.concat(sourceType.nextActions || []);
  });
  return state;
}

function ensureSourceType(state, sourceType) {
  const key = sourceType || 'unknown';
  if (!state.items.has(key)) {
    state.items.set(key, {
      sourceType: key,
      description: undefined,
      readinessStatus: 'unknown',
      readiness: {
        status: 'unknown',
        sourceCount: 0,
        enabledSourceCount: 0,
        statusCounts: {},
        unknown: key === 'unknown',
        compatibleSourceKeys: []
      },
      schedule: {
        total: 0,
        due: 0,
        skipped: 0,
        byReason: {}
      },
      lifecycle: {
        total: 0,
        enabled: 0,
        disabled: 0,
        running: 0,
        staleRunning: 0,
        disableBlocked: 0,
        failureRetryWaiting: 0
      },
      attention: {
        total: 0,
        critical: 0,
        warning: 0,
        info: 0,
        muted: 0,
        runnable: 0,
        actionable: 0,
        highestPriorityScore: 0
      },
      nextActions: [],
      commands: [],
      topAttention: []
    });
  }
  return state.items.get(key);
}

function buildSourceTypeLookup(readiness, schedule, lifecycle) {
  const bySourceId = new Map();
  const bySourceKey = new Map();
  (readiness.sourceTypes || []).concat(readiness.unknownSourceTypes || []).forEach(function (sourceType) {
    (sourceType.sources || []).forEach(function (source) {
      addSourceLookup(bySourceId, bySourceKey, source, sourceType.sourceType);
    });
  });
  (schedule.sources || []).forEach(function (source) {
    addSourceLookup(bySourceId, bySourceKey, source, source.sourceType);
  });
  (lifecycle.sources || []).forEach(function (source) {
    addSourceLookup(bySourceId, bySourceKey, source, source.sourceType);
  });
  return {
    bySourceId,
    bySourceKey
  };
}

function addSourceLookup(bySourceId, bySourceKey, source, sourceType) {
  if (!sourceType) return;
  const safeSource = source || {};
  const sourceId = safeSource.id || safeSource.sourceId;
  if (sourceId) bySourceId.set(sourceId, sourceType);
  if (safeSource.sourceKey) {
    const current = bySourceKey.get(safeSource.sourceKey);
    bySourceKey.set(safeSource.sourceKey, current && current !== sourceType ? undefined : sourceType);
  }
}

function resolveSourceType(source, lookup) {
  const safeSource = source || {};
  if (safeSource.sourceType) return safeSource.sourceType;
  const sourceId = safeSource.id || safeSource.sourceId;
  if (sourceId && lookup.bySourceId.has(sourceId)) return lookup.bySourceId.get(sourceId);
  if (safeSource.sourceKey && lookup.bySourceKey.has(safeSource.sourceKey)) return lookup.bySourceKey.get(safeSource.sourceKey);
  return 'unknown';
}

function finalizeSourceTypeOperations(item) {
  const status = aggregateStatus([
    item.readiness.status,
    item.attention.critical > 0 ? 'fail' : undefined,
    item.attention.warning > 0 ? 'warn' : undefined,
    item.lifecycle.disableBlocked > 0 || item.lifecycle.failureRetryWaiting > 0 || item.lifecycle.staleRunning > 0 ? 'warn' : undefined
  ]);
  return {
    sourceType: item.sourceType,
    description: item.description,
    status,
    readiness: item.readiness,
    schedule: item.schedule,
    lifecycle: item.lifecycle,
    attention: item.attention,
    nextActions: dedupeActions(item.nextActions).slice(0, 10),
    recommendedCommands: uniqueText(item.commands).slice(0, 5),
    topAttention: item.topAttention.sort(compareTopAttention).slice(0, 5)
  };
}

function summarizeSourceTypes(sourceTypes) {
  return {
    sourceTypeCount: sourceTypes.length,
    okSourceTypeCount: sourceTypes.filter(function (item) { return item.status === 'ok'; }).length,
    warnSourceTypeCount: sourceTypes.filter(function (item) { return item.status === 'warn'; }).length,
    failSourceTypeCount: sourceTypes.filter(function (item) { return item.status === 'fail'; }).length,
    sourceCount: sourceTypes.reduce(function (total, item) { return total + Math.max(item.readiness.sourceCount || 0, item.lifecycle.total || 0, item.schedule.total || 0); }, 0),
    enabledSourceCount: sourceTypes.reduce(function (total, item) { return total + Math.max(item.readiness.enabledSourceCount || 0, item.lifecycle.enabled || 0); }, 0),
    dueSourceCount: sourceTypes.reduce(function (total, item) { return total + (item.schedule.due || 0); }, 0),
    runningSourceCount: sourceTypes.reduce(function (total, item) { return total + (item.lifecycle.running || 0); }, 0),
    staleRunningSourceCount: sourceTypes.reduce(function (total, item) { return total + (item.lifecycle.staleRunning || 0); }, 0),
    failureRetryWaitingSourceCount: sourceTypes.reduce(function (total, item) { return total + (item.lifecycle.failureRetryWaiting || 0); }, 0),
    attentionSourceCount: sourceTypes.reduce(function (total, item) { return total + (item.attention.total || 0); }, 0),
    criticalAttentionSourceCount: sourceTypes.reduce(function (total, item) { return total + (item.attention.critical || 0); }, 0),
    warningAttentionSourceCount: sourceTypes.reduce(function (total, item) { return total + (item.attention.warning || 0); }, 0),
    actionableSourceCount: sourceTypes.reduce(function (total, item) { return total + (item.attention.actionable || 0); }, 0),
    highestPriorityScore: sourceTypes.reduce(function (highest, item) { return Math.max(highest, item.attention.highestPriorityScore || 0); }, 0)
  };
}

function compareSourceTypeOperations(left, right) {
  const statusDiff = statusRank(right.status) - statusRank(left.status);
  if (statusDiff !== 0) return statusDiff;
  const priorityDiff = (right.attention.highestPriorityScore || 0) - (left.attention.highestPriorityScore || 0);
  if (priorityDiff !== 0) return priorityDiff;
  const actionDiff = (right.attention.actionable || 0) - (left.attention.actionable || 0);
  if (actionDiff !== 0) return actionDiff;
  return String(left.sourceType || '').localeCompare(String(right.sourceType || ''));
}

function compareTopAttention(left, right) {
  const priorityDiff = (right.priorityScore || 0) - (left.priorityScore || 0);
  if (priorityDiff !== 0) return priorityDiff;
  return statusRank(right.severity) - statusRank(left.severity);
}

function dedupeActions(actions) {
  const seen = new Set();
  return (actions || []).filter(function (action) {
    const key = action.key + '|' + action.summary + '|' + (action.commands || []).join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function uniqueText(items) {
  const seen = new Set();
  return (items || []).filter(function (item) {
    if (!item || seen.has(item)) return false;
    seen.add(item);
    return true;
  });
}

function aggregateStatus(statuses) {
  if ((statuses || []).some(function (status) { return status === 'fail' || status === 'critical'; })) return 'fail';
  if ((statuses || []).some(function (status) { return status === 'warn' || status === 'warning'; })) return 'warn';
  return 'ok';
}

function statusRank(status) {
  if (status === 'fail' || status === 'critical') return 3;
  if (status === 'warn' || status === 'warning') return 2;
  if (status === 'ok') return 1;
  return 0;
}

module.exports = {
  getSourceTypeOperationsReport
};
