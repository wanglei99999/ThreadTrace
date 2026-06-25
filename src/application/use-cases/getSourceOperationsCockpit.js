'use strict';

function getSourceOperationsCockpit(options) {
  const safeOptions = options || {};
  const generatedAt = safeOptions.now || safeOptions.generatedAt || new Date().toISOString();
  const limit = safeOptions.cockpitLimit || safeOptions.limit || 25;
  const sourceAttentionReport = safeOptions.sourceAttentionReport || safeOptions.attention || {};
  const sourceTypeOperationsReport = safeOptions.sourceTypeOperationsReport || safeOptions.sourceTypeOperations || {};
  const operationsRunbook = safeOptions.operationsRunbook || safeOptions.runbook || {};
  const sourceScheduleReport = safeOptions.sourceScheduleReport || safeOptions.schedule || {};
  const sourceLifecycleReport = safeOptions.sourceLifecycleReport || safeOptions.lifecycle || {};

  const queue = dedupeQueueItems([]
    .concat(buildSourceAttentionItems(sourceAttentionReport))
    .concat(buildSourceTypeItems(sourceTypeOperationsReport))
    .concat(buildRunbookItems(operationsRunbook))
    .concat(buildFallbackDueItems(sourceScheduleReport, sourceAttentionReport)))
    .sort(compareQueueItems)
    .slice(0, limit)
    .map(function (item, index) {
      return Object.assign({}, item, {
        rank: index + 1
      });
    });

  return {
    generatedAt,
    status: summarizeStatus(queue),
    windowLimit: limit,
    summary: summarizeQueue(queue, {
      sourceAttentionReport,
      sourceTypeOperationsReport,
      operationsRunbook,
      sourceScheduleReport,
      sourceLifecycleReport
    }),
    queue,
    nextActions: buildNextActions(queue),
    inputs: {
      attentionGeneratedAt: sourceAttentionReport.generatedAt,
      sourceTypeOperationsGeneratedAt: sourceTypeOperationsReport.generatedAt,
      runbookGeneratedAt: operationsRunbook.generatedAt,
      scheduleGeneratedAt: sourceScheduleReport.generatedAt,
      lifecycleGeneratedAt: sourceLifecycleReport.generatedAt
    }
  };
}

function buildSourceAttentionItems(report) {
  return (report.sources || []).map(function (item) {
    const source = item.source || {};
    const title = source.displayName || source.id || source.sourceKey || item.key || 'Unknown source';
    return {
      id: 'source-attention:' + (item.key || source.id || source.sourceKey || title),
      kind: 'source-attention',
      scope: 'source',
      severity: normalizeSeverity(item.severity),
      priorityScore: Number(item.priorityScore || 0),
      title: title,
      summary: summarizeSignals(item.signals) || 'Source requires operator attention.',
      source: compactObject({
        id: source.id,
        sourceKey: source.sourceKey,
        sourceType: source.sourceType,
        displayName: source.displayName,
        enabled: source.enabled
      }),
      signalCount: item.signalCount || (item.signals || []).length,
      signals: (item.signals || []).slice(0, 5),
      runnable: item.runnable === true,
      recommendedNextAction: item.recommendedNextAction || item.nextAction,
      recommendedCommand: item.recommendedCommand,
      relatedCommands: uniqueText(item.commands || [])
    };
  });
}

function buildSourceTypeItems(report) {
  return (report.sourceTypes || []).filter(function (item) {
    const attention = item.attention || {};
    return item.status === 'fail' ||
      item.status === 'warn' ||
      (attention.actionable || 0) > 0 ||
      (attention.highestPriorityScore || 0) > 0;
  }).map(function (item) {
    const attention = item.attention || {};
    const lifecycle = item.lifecycle || {};
    const schedule = item.schedule || {};
    return {
      id: 'source-type-operations:' + (item.sourceType || 'unknown'),
      kind: 'source-type-operations',
      scope: 'source-type',
      severity: normalizeStatusAsSeverity(item.status),
      priorityScore: scoreSourceTypeOperations(item),
      title: item.sourceType || 'unknown source type',
      summary: [
        'sources=' + Math.max(item.readiness && item.readiness.sourceCount || 0, lifecycle.total || 0, schedule.total || 0),
        'due=' + (schedule.due || 0),
        'retry=' + (lifecycle.failureRetryWaiting || 0),
        'attention=' + (attention.total || 0),
        'actionable=' + (attention.actionable || 0)
      ].join(' | '),
      sourceType: item.sourceType,
      sourceCount: Math.max(item.readiness && item.readiness.sourceCount || 0, lifecycle.total || 0, schedule.total || 0),
      signalCount: attention.total || 0,
      runnable: (schedule.due || 0) > 0 || (attention.runnable || 0) > 0,
      recommendedCommand: firstText(item.recommendedCommands),
      relatedCommands: uniqueText(item.recommendedCommands || []),
      topAttention: (item.topAttention || []).slice(0, 3)
    };
  });
}

function buildRunbookItems(runbook) {
  return (runbook.actions || []).filter(function (action) {
    return action.area === 'sources' || action.area === 'workers' || action.area === 'notifications';
  }).map(function (action) {
    const evidence = action.evidence || {};
    const source = compactObject({
      id: evidence.sourceId,
      sourceKey: evidence.sourceKey,
      displayName: evidence.sourceName || evidence.displayName
    });
    return {
      id: 'runbook:' + (action.key || action.title || action.summary),
      kind: 'runbook',
      scope: source.id || source.sourceKey ? 'source' : (action.area || 'operations'),
      severity: normalizeSeverity(action.severity),
      priorityScore: scoreRunbookAction(action),
      title: action.title || action.key || 'Runbook action',
      summary: action.summary || action.title || 'Runbook action requires attention.',
      source,
      signalCount: 1,
      runnable: false,
      recommendedCommand: action.recommendedCommand,
      relatedCommands: uniqueText([action.recommendedCommand].concat(action.relatedCommands || [])),
      runbookKey: action.key
    };
  });
}

function buildFallbackDueItems(scheduleReport, attentionReport) {
  if ((attentionReport.sources || []).length > 0) return [];
  return (scheduleReport.dueSources || []).map(function (source) {
    const sourceId = source.id || source.sourceId;
    return {
      id: 'due-source:' + (sourceId || source.sourceKey || source.displayName || 'unknown'),
      kind: 'due-source',
      scope: 'source',
      severity: 'info',
      priorityScore: 46,
      title: source.displayName || sourceId || source.sourceKey || 'Due source',
      summary: 'Scheduled source work is due now.',
      source: compactObject({
        id: sourceId,
        sourceKey: source.sourceKey,
        sourceType: source.sourceType,
        displayName: source.displayName
      }),
      signalCount: 1,
      runnable: true,
      recommendedNextAction: 'run-source-ingest'
    };
  });
}

function dedupeQueueItems(items) {
  const seen = new Set();
  return items.filter(function (item) {
    const key = [
      item.kind,
      item.source && item.source.id,
      item.source && item.source.sourceKey,
      item.sourceType,
      item.runbookKey,
      item.title
    ].filter(Boolean).join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function summarizeQueue(queue, inputs) {
  return {
    total: queue.length,
    fail: queue.filter(function (item) { return item.severity === 'critical'; }).length,
    warning: queue.filter(function (item) { return item.severity === 'warning'; }).length,
    info: queue.filter(function (item) { return item.severity === 'info'; }).length,
    muted: queue.filter(function (item) { return item.severity === 'muted'; }).length,
    runnable: queue.filter(function (item) { return item.runnable; }).length,
    sourceScoped: queue.filter(function (item) { return item.scope === 'source'; }).length,
    sourceTypeScoped: queue.filter(function (item) { return item.scope === 'source-type'; }).length,
    highestPriorityScore: queue.reduce(function (highest, item) {
      return Math.max(highest, item.priorityScore || 0);
    }, 0),
    byKind: countBy(queue, 'kind'),
    inputs: {
      attention: inputs.sourceAttentionReport.status,
      sourceTypeOperations: inputs.sourceTypeOperationsReport.status,
      runbook: inputs.operationsRunbook.status,
      schedule: inputs.sourceScheduleReport.status,
      lifecycle: inputs.sourceLifecycleReport.status
    }
  };
}

function buildNextActions(queue) {
  if (queue.length === 0) {
    return [{
      key: 'sourceOperationsCockpit.ok',
      severity: 'info',
      summary: 'No source operations queue items require attention.'
    }];
  }
  return queue.slice(0, 5).map(function (item) {
    return {
      key: 'sourceOperationsCockpit.' + item.kind + '.' + item.rank,
      severity: item.severity,
      summary: item.title + ': ' + item.summary,
      recommendedCommand: item.recommendedCommand,
      source: item.source,
      sourceType: item.sourceType
    };
  });
}

function compareQueueItems(left, right) {
  const scoreDiff = (right.priorityScore || 0) - (left.priorityScore || 0);
  if (scoreDiff !== 0) return scoreDiff;
  const severityDiff = severityRank(right.severity) - severityRank(left.severity);
  if (severityDiff !== 0) return severityDiff;
  const signalDiff = (right.signalCount || 0) - (left.signalCount || 0);
  if (signalDiff !== 0) return signalDiff;
  return String(left.title || '').localeCompare(String(right.title || ''));
}

function summarizeStatus(queue) {
  if (queue.some(function (item) { return item.severity === 'critical'; })) return 'fail';
  if (queue.some(function (item) { return item.severity === 'warning'; })) return 'warn';
  return 'ok';
}

function scoreSourceTypeOperations(item) {
  const attention = item.attention || {};
  const lifecycle = item.lifecycle || {};
  const schedule = item.schedule || {};
  return statusBase(item.status) +
    Math.min(attention.highestPriorityScore || 0, 120) +
    Math.min((attention.actionable || 0) * 8, 32) +
    Math.min((schedule.due || 0) * 5, 20) +
    Math.min((lifecycle.failureRetryWaiting || 0) * 8, 24) +
    Math.min((item.recommendedCommands || []).length * 4, 12);
}

function scoreRunbookAction(action) {
  return severityBase(action.severity) +
    (action.recommendedCommand ? 10 : 0) +
    Math.min((action.relatedCommands || []).length * 4, 12);
}

function summarizeSignals(signals) {
  return (signals || []).slice(0, 3).map(function (signal) {
    return [signal.label || 'attention', signal.summary || signal.reason || signal.action].filter(Boolean).join(': ');
  }).filter(Boolean).join(' | ');
}

function normalizeStatusAsSeverity(status) {
  if (status === 'fail') return 'critical';
  if (status === 'warn') return 'warning';
  if (status === 'ok') return 'info';
  return 'muted';
}

function normalizeSeverity(severity) {
  if (severity === 'fail' || severity === 'critical') return 'critical';
  if (severity === 'warn' || severity === 'warning') return 'warning';
  if (severity === 'ok' || severity === 'info') return 'info';
  if (severity === 'muted') return 'muted';
  return 'info';
}

function statusBase(status) {
  return {
    fail: 120,
    warn: 70,
    ok: 10
  }[status] || 20;
}

function severityBase(severity) {
  return {
    critical: 120,
    fail: 120,
    warning: 70,
    warn: 70,
    info: 30,
    ok: 10,
    muted: 0
  }[severity] || 30;
}

function severityRank(severity) {
  return {
    critical: 4,
    warning: 3,
    info: 2,
    muted: 1
  }[severity] || 2;
}

function countBy(items, key) {
  return items.reduce(function (result, item) {
    const value = item[key] || 'unknown';
    result[value] = (result[value] || 0) + 1;
    return result;
  }, {});
}

function compactObject(value) {
  return Object.keys(value || {}).reduce(function (result, key) {
    if (value[key] !== undefined) result[key] = value[key];
    return result;
  }, {});
}

function uniqueText(items) {
  const seen = new Set();
  return (items || []).filter(function (item) {
    if (!item || seen.has(item)) return false;
    seen.add(item);
    return true;
  });
}

function firstText(items) {
  return (items || []).find(function (item) {
    return typeof item === 'string' && item.length > 0;
  });
}

module.exports = {
  getSourceOperationsCockpit
};
