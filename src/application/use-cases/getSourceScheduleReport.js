'use strict';

const { assertSourceRepository } = require('../ports/sourceRepository');
const { buildSourceCollectionPlan } = require('./buildSourceCollectionPlan');
const { evaluateSourceRunSchedule } = require('./evaluateSourceRunSchedule');

async function getSourceScheduleReport(options) {
  const safeOptions = options || {};
  const now = safeOptions.now || new Date().toISOString();
  const limit = safeOptions.limit || 100;
  const sourceRepository = assertSourceRepository(safeOptions.sourceRepository);
  const sources = await sourceRepository.listSources({
    sourceKey: safeOptions.sourceKey,
    sourceType: safeOptions.sourceType,
    enabled: safeOptions.enabled,
    limit
  });
  const sourceReports = sources.map(function (source) {
    return summarizeSourceSchedule(source, now, safeOptions);
  });
  const filteredSourceReports = filterSourcesByCollectionStatus(sourceReports, safeOptions.collectionStatus);

  return {
    generatedAt: now,
    status: 'ok',
    windowLimit: limit,
    collectionStatus: normalizeCollectionStatusFilter(safeOptions.collectionStatus),
    sourceRunStaleAfterMs: safeOptions.sourceRunStaleAfterMs,
    sourceFailureRetryBackoffMs: safeOptions.sourceFailureRetryBackoffMs,
    sourceFailureMaxRetryBackoffMs: safeOptions.sourceFailureMaxRetryBackoffMs,
    summary: summarizeScheduleSources(filteredSourceReports),
    unfilteredSummary: summarizeScheduleSources(sourceReports),
    dueSources: filteredSourceReports.filter(function (source) {
      return source.decision.due;
    }),
    skippedSources: filteredSourceReports.filter(function (source) {
      return !source.decision.due;
    }),
    sources: filteredSourceReports
  };
}

function summarizeSourceSchedule(source, now, options) {
  const decision = evaluateSourceRunSchedule(source, now, {
    sourceRunStaleAfterMs: options.sourceRunStaleAfterMs,
    sourceFailureRetryBackoffMs: options.sourceFailureRetryBackoffMs,
    sourceFailureMaxRetryBackoffMs: options.sourceFailureMaxRetryBackoffMs
  });
  return {
    id: source.id,
    sourceKey: source.sourceKey,
    sourceType: source.sourceType,
    displayName: source.displayName,
    enabled: source.enabled !== false,
    schedule: summarizeSchedule(source.schedule),
    runState: summarizeRunState(source.runState),
    decision: summarizeDecision(decision),
    collectionPlan: buildSourceCollectionPlan(source, decision, { now })
  };
}

function summarizeScheduleSources(sources) {
  return {
    total: sources.length,
    due: sources.filter(function (source) {
      return source.decision.due;
    }).length,
    skipped: sources.filter(function (source) {
      return !source.decision.due;
    }).length,
    byReason: countByReason(sources),
    byCollectionStatus: countByCollectionStatus(sources)
  };
}

function filterSourcesByCollectionStatus(sources, filter) {
  const statuses = normalizeCollectionStatusFilter(filter);
  if (statuses.length === 0) return sources;
  const wanted = new Set(statuses);
  return sources.filter(function (source) {
    return wanted.has(source.collectionPlan && source.collectionPlan.status || 'unknown');
  });
}

function normalizeCollectionStatusFilter(filter) {
  if (!filter) return [];
  const values = Array.isArray(filter) ? filter : String(filter).split(',');
  return values.map(function (value) {
    return String(value || '').trim();
  }).filter(Boolean);
}

function summarizeDecision(decision) {
  return {
    due: decision.due,
    reason: decision.reason,
    nextRunAt: decision.nextRunAt,
    retryAt: decision.retryAt,
    failureCount: decision.failureCount,
    backoffMs: decision.backoffMs,
    baseReason: decision.baseReason
  };
}

function summarizeSchedule(schedule) {
  const safeSchedule = schedule || {};
  return {
    enabled: safeSchedule.enabled,
    intervalMinutes: safeSchedule.intervalMinutes,
    nextRunAt: safeSchedule.nextRunAt
  };
}

function summarizeRunState(runState) {
  const safeRunState = runState || {};
  return {
    status: safeRunState.status || 'unknown',
    lastStartedAt: safeRunState.lastStartedAt,
    lastFinishedAt: safeRunState.lastFinishedAt,
    lastTaskId: safeRunState.lastTaskId,
    failureCount: safeRunState.failureCount || 0
  };
}

function countByReason(sources) {
  return sources.reduce(function (result, source) {
    const reason = source.decision.reason || 'unknown';
    result[reason] = (result[reason] || 0) + 1;
    return result;
  }, {});
}

function countByCollectionStatus(sources) {
  return sources.reduce(function (result, source) {
    const status = source.collectionPlan && source.collectionPlan.status || 'unknown';
    result[status] = (result[status] || 0) + 1;
    return result;
  }, {});
}

module.exports = {
  getSourceScheduleReport,
  summarizeSourceSchedule
};
