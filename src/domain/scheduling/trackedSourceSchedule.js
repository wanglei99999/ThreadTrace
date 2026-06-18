'use strict';

function evaluateTrackedSourceSchedule(source, now) {
  const checkedAt = now ? new Date(now) : new Date();
  const schedule = source.schedule || {};
  const runState = source.runState || {};

  if (source.enabled === false) {
    return notDue('source-disabled');
  }
  if (runState.status === 'running') {
    return notDue('source-running');
  }
  if (!schedule.enabled && !schedule.intervalMinutes && !schedule.nextRunAt) {
    return notDue('no-schedule');
  }
  if (schedule.enabled === false) {
    return notDue('schedule-disabled');
  }
  if (schedule.nextRunAt) {
    const nextRunAt = new Date(schedule.nextRunAt);
    if (Number.isNaN(nextRunAt.getTime())) {
      return notDue('invalid-next-run-at');
    }
    if (checkedAt >= nextRunAt) {
      return due('next-run-at', nextRunAt.toISOString());
    }
    return notDue('waiting-next-run-at', nextRunAt.toISOString());
  }
  if (schedule.intervalMinutes) {
    const intervalMs = Number(schedule.intervalMinutes) * 60 * 1000;
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
      return due('interval-elapsed', nextRunAt.toISOString());
    }
    return notDue('waiting-interval', nextRunAt.toISOString());
  }

  return notDue('no-schedule');
}

function due(reason, nextRunAt) {
  return {
    due: true,
    reason,
    nextRunAt
  };
}

function notDue(reason, nextRunAt) {
  return {
    due: false,
    reason,
    nextRunAt
  };
}

module.exports = {
  evaluateTrackedSourceSchedule
};
