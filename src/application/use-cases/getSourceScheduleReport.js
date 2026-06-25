'use strict';

const { assertSourceRepository } = require('../ports/sourceRepository');
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

  return {
    generatedAt: now,
    status: 'ok',
    windowLimit: limit,
    sourceRunStaleAfterMs: safeOptions.sourceRunStaleAfterMs,
    sourceFailureRetryBackoffMs: safeOptions.sourceFailureRetryBackoffMs,
    sourceFailureMaxRetryBackoffMs: safeOptions.sourceFailureMaxRetryBackoffMs,
    summary: summarizeScheduleSources(sourceReports),
    dueSources: sourceReports.filter(function (source) {
      return source.decision.due;
    }),
    skippedSources: sourceReports.filter(function (source) {
      return !source.decision.due;
    }),
    sources: sourceReports
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
    decision: summarizeDecision(decision)
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
    byReason: countByReason(sources)
  };
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

module.exports = {
  getSourceScheduleReport,
  summarizeSourceSchedule
};
