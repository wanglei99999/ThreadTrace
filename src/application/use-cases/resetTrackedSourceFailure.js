'use strict';

const { createApplicationError } = require('../errors/applicationError');
const { assertSourceRepository } = require('../ports/sourceRepository');
const { sourceSummary } = require('./setTrackedSourceEnabled');

async function resetTrackedSourceFailure(options) {
  const safeOptions = options || {};
  const sourceRepository = assertSourceRepository(safeOptions.sourceRepository);
  const sourceId = safeOptions.sourceId;
  if (!sourceId) {
    throw createApplicationError('source_id_required', 'Source failure reset requires sourceId.', {
      statusCode: 400
    });
  }
  const source = await sourceRepository.findSource(sourceId);
  if (!source) {
    throw createApplicationError('source_not_found', 'Unknown tracked source: ' + sourceId, {
      statusCode: 404,
      details: {
        sourceId
      }
    });
  }

  const now = safeOptions.now || new Date().toISOString();
  const execute = safeOptions.execute === true;
  const dryRun = !execute;
  const plan = buildFailureResetPlan(source, Object.assign({}, safeOptions, {
    now
  }));
  if (execute && plan.changed) {
    await sourceRepository.saveSource(plan.sourceAfter);
  }

  return {
    generatedAt: now,
    status: 'ok',
    dryRun,
    executed: execute,
    changed: plan.changed,
    reason: plan.reason,
    retryNow: plan.retryNow,
    nextRunAt: plan.nextRunAt,
    sourceBefore: sourceFailureSummary(source),
    sourceAfter: sourceFailureSummary(plan.sourceAfter)
  };
}

function buildFailureResetPlan(source, options) {
  const safeOptions = options || {};
  const runState = source.runState || {};
  const retryNow = safeOptions.retryNow === true;
  const nextRunAt = safeOptions.nextRunAt || (retryNow ? safeOptions.now : undefined);
  if (runState.status !== 'failed') {
    return {
      changed: false,
      reason: 'source-not-failed',
      retryNow,
      nextRunAt,
      sourceAfter: source
    };
  }

  const updatedRunState = Object.assign({}, runState, {
    status: safeOptions.runStatus || 'completed',
    failureCount: 0,
    lastError: undefined,
    failureResetAt: safeOptions.now,
    failureResetBy: safeOptions.resetBy || safeOptions.acknowledgedBy || 'operator'
  });
  const updatedSource = Object.assign({}, source, {
    runState: updatedRunState,
    schedule: buildUpdatedSchedule(source.schedule, nextRunAt),
    updatedAt: safeOptions.now
  });

  return {
    changed: true,
    reason: retryNow || nextRunAt ? 'failure-reset-and-requeued' : 'failure-reset',
    retryNow,
    nextRunAt,
    sourceAfter: updatedSource
  };
}

function buildUpdatedSchedule(schedule, nextRunAt) {
  if (!nextRunAt) return schedule;
  return Object.assign({}, schedule || {}, {
    nextRunAt
  });
}

function sourceFailureSummary(source) {
  const summary = sourceSummary(source);
  const runState = (source && source.runState) || {};
  const schedule = (source && source.schedule) || {};
  return Object.assign({}, summary, {
    schedule: {
      enabled: schedule.enabled,
      intervalMinutes: schedule.intervalMinutes,
      nextRunAt: schedule.nextRunAt
    },
    runState: {
      status: runState.status || 'unknown',
      lastStartedAt: runState.lastStartedAt,
      lastFinishedAt: runState.lastFinishedAt,
      lastTaskId: runState.lastTaskId,
      lastError: runState.lastError,
      failureCount: runState.failureCount || 0,
      failureResetAt: runState.failureResetAt,
      failureResetBy: runState.failureResetBy
    }
  });
}

module.exports = {
  resetTrackedSourceFailure,
  buildFailureResetPlan,
  sourceFailureSummary
};
