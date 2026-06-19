'use strict';

const DEFAULT_SOURCE_FAILURE_RETRY_BACKOFF_MS = 60 * 1000;
const DEFAULT_SOURCE_FAILURE_MAX_RETRY_BACKOFF_MS = 60 * 60 * 1000;

function evaluateTrackedSourceSchedule(source, now, options) {
  const checkedAt = now ? new Date(now) : new Date();
  const safeSource = source || {};
  const schedule = safeSource.schedule || {};
  const runState = safeSource.runState || {};

  if (safeSource.enabled === false) {
    return notDue('source-disabled');
  }
  if (runState.status === 'running') {
    return notDue('source-running');
  }

  return applyFailureRetryPolicy(evaluateBaseSchedule(schedule, runState, checkedAt), safeSource, checkedAt, options);
}

function evaluateBaseSchedule(schedule, runState, checkedAt) {
  if (!schedule.enabled && !schedule.intervalMinutes && !schedule.nextRunAt) {
    return notDue('no-schedule');
  }
  if (schedule.enabled === false) {
    return notDue('schedule-disabled');
  }
  if (schedule.nextRunAt) return evaluateNextRunAtSchedule(schedule.nextRunAt, checkedAt);
  if (schedule.intervalMinutes) return evaluateIntervalSchedule(schedule.intervalMinutes, runState, checkedAt);
  return notDue('no-schedule');
}

function evaluateNextRunAtSchedule(value, checkedAt) {
  const nextRunAt = new Date(value);
  if (Number.isNaN(nextRunAt.getTime())) {
    return notDue('invalid-next-run-at');
  }
  if (checkedAt >= nextRunAt) {
    return due('next-run-at', {
      nextRunAt: nextRunAt.toISOString()
    });
  }
  return notDue('waiting-next-run-at', {
    nextRunAt: nextRunAt.toISOString()
  });
}

function evaluateIntervalSchedule(value, runState, checkedAt) {
  const intervalMs = Number(value) * 60 * 1000;
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    return notDue('invalid-interval');
  }
  if (!runState.lastFinishedAt) {
    return due('never-finished');
  }
  const nextRunAt = new Date(new Date(runState.lastFinishedAt).getTime() + intervalMs);
  if (Number.isNaN(nextRunAt.getTime())) {
    return due('invalid-last-finished-at');
  }
  if (checkedAt >= nextRunAt) {
    return due('interval-elapsed', {
      nextRunAt: nextRunAt.toISOString()
    });
  }
  return notDue('waiting-interval', {
    nextRunAt: nextRunAt.toISOString()
  });
}

function applyFailureRetryPolicy(decision, source, checkedAt, options) {
  if (!decision.due) return decision;
  const retryPlan = buildSourceFailureRetryPlan(source, checkedAt, options);
  if (!retryPlan.active) return decision;
  if (!retryPlan.elapsed) {
    return notDue('waiting-failure-backoff', {
      nextRunAt: retryPlan.retryAt,
      retryAt: retryPlan.retryAt,
      failureCount: retryPlan.failureCount,
      backoffMs: retryPlan.backoffMs,
      baseReason: decision.reason
    });
  }
  return due('failure-backoff-elapsed-' + decision.reason, {
    nextRunAt: decision.nextRunAt,
    retryAt: retryPlan.retryAt,
    failureCount: retryPlan.failureCount,
    backoffMs: retryPlan.backoffMs,
    baseReason: decision.reason
  });
}

function buildSourceFailureRetryPlan(source, now, options) {
  const safeSource = source || {};
  const runState = safeSource.runState || {};
  const failureCount = Number(runState.failureCount || 0);
  if (runState.status !== 'failed' || !Number.isFinite(failureCount) || failureCount <= 0) {
    return inactiveRetryPlan();
  }

  const retryBackoffMs = resolvePositiveNumber(
    options && options.sourceFailureRetryBackoffMs,
    DEFAULT_SOURCE_FAILURE_RETRY_BACKOFF_MS
  );
  if (retryBackoffMs <= 0) return inactiveRetryPlan();
  const maxRetryBackoffMs = resolvePositiveNumber(
    options && options.sourceFailureMaxRetryBackoffMs,
    DEFAULT_SOURCE_FAILURE_MAX_RETRY_BACKOFF_MS
  );
  const failureTime = Date.parse(runState.lastFinishedAt || safeSource.updatedAt);
  const nowTime = now instanceof Date ? now.getTime() : Date.parse(now || new Date().toISOString());
  if (Number.isNaN(failureTime) || Number.isNaN(nowTime)) return inactiveRetryPlan();

  const exponent = Math.max(failureCount - 1, 0);
  const backoffMs = Math.min(retryBackoffMs * Math.pow(2, exponent), maxRetryBackoffMs);
  const retryTime = failureTime + backoffMs;
  return {
    active: true,
    elapsed: nowTime >= retryTime,
    failureCount,
    backoffMs,
    retryAt: new Date(retryTime).toISOString()
  };
}

function inactiveRetryPlan() {
  return {
    active: false,
    elapsed: true
  };
}

function resolvePositiveNumber(value, defaultValue) {
  if (value === undefined || value === null || value === '') return defaultValue;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return defaultValue;
  return Math.max(parsed, 0);
}

function due(reason, details) {
  const safeDetails = details || {};
  return {
    due: true,
    reason,
    nextRunAt: safeDetails.nextRunAt,
    retryAt: safeDetails.retryAt,
    failureCount: safeDetails.failureCount,
    backoffMs: safeDetails.backoffMs,
    baseReason: safeDetails.baseReason
  };
}

function notDue(reason, details) {
  const safeDetails = typeof details === 'string' ? {
    nextRunAt: details
  } : (details || {});
  return {
    due: false,
    reason,
    nextRunAt: safeDetails.nextRunAt,
    retryAt: safeDetails.retryAt,
    failureCount: safeDetails.failureCount,
    backoffMs: safeDetails.backoffMs,
    baseReason: safeDetails.baseReason
  };
}

module.exports = {
  DEFAULT_SOURCE_FAILURE_MAX_RETRY_BACKOFF_MS,
  DEFAULT_SOURCE_FAILURE_RETRY_BACKOFF_MS,
  buildSourceFailureRetryPlan,
  evaluateTrackedSourceSchedule
};
