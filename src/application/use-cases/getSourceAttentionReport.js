'use strict';

function getSourceAttentionReport(options) {
  const safeOptions = options || {};
  const generatedAt = safeOptions.now || safeOptions.generatedAt || new Date().toISOString();
  const limit = safeOptions.limit || 100;
  const state = createAttentionState();
  const schedule = safeOptions.scheduleReport || safeOptions.schedule || {};
  const lifecycle = safeOptions.lifecycleReport || safeOptions.lifecycle || {};
  const runbook = safeOptions.operationsRunbook || safeOptions.runbook || {};

  (schedule.dueSources || []).forEach(function (source) {
    addSourceAttention(state, source, {
      severity: 'info',
      label: 'due',
      summary: 'Scheduled source work is due now.',
      reason: source.decision && source.decision.reason,
      runnable: true
    });
  });

  (schedule.skippedSources || []).forEach(function (source) {
    const decision = source.decision || {};
    if (decision.reason !== 'waiting-failure-backoff') return;
    addSourceAttention(state, source, {
      severity: 'warning',
      label: 'retry wait',
      summary: 'Failed source is waiting for retry backoff.',
      reason: decision.reason,
      retryAt: decision.retryAt,
      backoffMs: decision.backoffMs
    });
  });

  (lifecycle.sources || []).forEach(function (source) {
    const guard = source.disableGuard || {};
    const retry = source.failureRetry || {};
    if (guard.blocked) {
      addSourceAttention(state, source, {
        severity: 'warning',
        label: 'disable blocked',
        summary: 'Disable is blocked by an active source run.',
        action: source.nextAction
      });
    }
    if (guard.stale) {
      addSourceAttention(state, source, {
        severity: 'warning',
        label: 'stale run',
        summary: 'Source run looks stale and needs operator review.',
        action: source.nextAction
      });
    }
    if (retry.active && !retry.elapsed) {
      addSourceAttention(state, source, {
        severity: 'warning',
        label: 'retry wait',
        summary: 'Failure retry window has not elapsed.',
        action: source.nextAction,
        retryAt: retry.retryAt,
        backoffMs: retry.backoffMs
      });
    }
    if (source.enabled === false) {
      addSourceAttention(state, source, {
        severity: 'muted',
        label: 'disabled',
        summary: 'Source is disabled.',
        action: source.nextAction
      });
    }
  });

  (runbook.actions || []).filter(function (action) {
    return action.area === 'sources';
  }).forEach(function (action) {
    const evidence = action.evidence || {};
    addSourceAttention(state, {
      id: evidence.sourceId,
      sourceKey: evidence.sourceKey,
      displayName: evidence.sourceName || evidence.displayName || evidence.sourceId || evidence.sourceKey
    }, {
      severity: action.severity || 'warning',
      label: 'runbook',
      summary: action.title || action.summary || 'Source runbook action requires attention.',
      command: action.recommendedCommand,
      actionKey: action.key
    });
  });

  const sources = Array.from(state.items.values())
    .map(finalizeAttentionItem)
    .sort(compareSourceAttention)
    .slice(0, limit);

  return {
    generatedAt,
    status: summarizeStatus(sources),
    windowLimit: limit,
    summary: summarizeAttentionSources(sources),
    sources,
    inputs: {
      scheduleGeneratedAt: schedule.generatedAt,
      lifecycleGeneratedAt: lifecycle.generatedAt,
      runbookGeneratedAt: runbook.generatedAt
    }
  };
}

function createAttentionState() {
  return {
    items: new Map(),
    aliases: new Map()
  };
}

function addSourceAttention(state, source, signal) {
  const aliases = sourceAttentionAliases(source);
  if (aliases.length === 0) return;
  let item = findAttentionItem(state, aliases);
  if (!item) {
    item = {
      key: aliases[0],
      aliases: aliases.slice(),
      source: normalizeAttentionSource(source),
      severity: 'muted',
      signals: [],
      runnable: false,
      commands: []
    };
    state.items.set(item.key, item);
  } else {
    item.source = mergeAttentionSource(item.source, source);
    item.aliases = uniqueText(item.aliases.concat(aliases));
  }
  item.aliases.forEach(function (alias) {
    state.aliases.set(alias, item.key);
  });
  item.severity = higherAttentionSeverity(item.severity, signal.severity);
  item.runnable = item.runnable || signal.runnable === true;
  if (signal.command) item.commands.push(signal.command);
  item.signals.push({
    severity: signal.severity || 'info',
    label: signal.label || 'attention',
    summary: signal.summary,
    reason: signal.reason,
    action: signal.action,
    actionKey: signal.actionKey,
    retryAt: signal.retryAt,
    backoffMs: signal.backoffMs
  });
}

function sourceAttentionAliases(source) {
  const safeSource = source || {};
  const sourceId = safeSource.id || safeSource.sourceId;
  if (sourceId) return ['sourceId:' + sourceId];
  if (safeSource.sourceKey) return ['sourceKey:' + safeSource.sourceKey];
  return [];
}

function findAttentionItem(state, aliases) {
  for (const alias of aliases) {
    const key = state.aliases.get(alias);
    if (key && state.items.has(key)) return state.items.get(key);
  }
  return undefined;
}

function normalizeAttentionSource(source) {
  const safeSource = source || {};
  return {
    id: safeSource.id || safeSource.sourceId,
    sourceKey: safeSource.sourceKey,
    sourceType: safeSource.sourceType,
    displayName: safeSource.displayName,
    enabled: safeSource.enabled,
    runState: safeSource.runState,
    disableGuard: safeSource.disableGuard,
    failureRetry: safeSource.failureRetry,
    nextAction: safeSource.nextAction,
    recommendedCommands: safeSource.recommendedCommands
  };
}

function mergeAttentionSource(current, next) {
  const normalized = normalizeAttentionSource(next);
  return Object.assign({}, current, Object.keys(normalized).reduce(function (result, key) {
    if (normalized[key] !== undefined) result[key] = normalized[key];
    return result;
  }, {}));
}

function finalizeAttentionItem(item) {
  return {
    key: item.key,
    source: item.source,
    severity: item.severity,
    signalCount: item.signals.length,
    runnable: item.runnable,
    signals: item.signals,
    commands: uniqueText(item.commands).slice(0, 5),
    nextAction: item.source.nextAction
  };
}

function summarizeStatus(sources) {
  if (sources.some(function (source) { return source.severity === 'critical'; })) return 'fail';
  if (sources.some(function (source) {
    return source.severity === 'warning' || source.severity === 'warn';
  })) return 'warn';
  return 'ok';
}

function summarizeAttentionSources(sources) {
  return {
    total: sources.length,
    critical: countBySeverity(sources, 'critical'),
    warning: sources.filter(function (source) {
      return source.severity === 'warning' || source.severity === 'warn';
    }).length,
    info: countBySeverity(sources, 'info'),
    muted: countBySeverity(sources, 'muted'),
    runnable: sources.filter(function (source) { return source.runnable; }).length,
    bySignal: sources.reduce(function (result, source) {
      (source.signals || []).forEach(function (signal) {
        const label = signal.label || 'attention';
        result[label] = (result[label] || 0) + 1;
      });
      return result;
    }, {}),
    bySourceKey: sources.reduce(function (result, source) {
      const sourceKey = source.source && source.source.sourceKey || 'unknown-source';
      result[sourceKey] = (result[sourceKey] || 0) + 1;
      return result;
    }, {})
  };
}

function countBySeverity(sources, severity) {
  return sources.filter(function (source) {
    return source.severity === severity;
  }).length;
}

function higherAttentionSeverity(left, right) {
  return attentionSeverityRank(right) > attentionSeverityRank(left) ? right : left;
}

function attentionSeverityRank(severity) {
  const ranks = {
    critical: 4,
    warning: 3,
    warn: 3,
    info: 2,
    ok: 1,
    muted: 0
  };
  return ranks[severity] === undefined ? 2 : ranks[severity];
}

function compareSourceAttention(left, right) {
  const severityDiff = attentionSeverityRank(right.severity) - attentionSeverityRank(left.severity);
  if (severityDiff !== 0) return severityDiff;
  const signalDiff = (right.signalCount || 0) - (left.signalCount || 0);
  if (signalDiff !== 0) return signalDiff;
  return String(left.source.displayName || left.source.id || left.source.sourceKey || '')
    .localeCompare(String(right.source.displayName || right.source.id || right.source.sourceKey || ''));
}

function uniqueText(items) {
  const seen = new Set();
  return (items || []).filter(function (item) {
    if (!item || seen.has(item)) return false;
    seen.add(item);
    return true;
  });
}

module.exports = {
  getSourceAttentionReport
};
