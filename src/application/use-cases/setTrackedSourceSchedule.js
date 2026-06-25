'use strict';

const { createApplicationError } = require('../errors/applicationError');
const { assertSourceRepository } = require('../ports/sourceRepository');
const { sourceSummary } = require('./setTrackedSourceEnabled');

async function setTrackedSourceSchedule(options) {
  const safeOptions = options || {};
  const sourceRepository = assertSourceRepository(safeOptions.sourceRepository);
  const sourceId = safeOptions.sourceId;
  if (!sourceId) {
    throw createApplicationError('source_id_required', 'Source schedule update requires sourceId.', {
      statusCode: 400
    });
  }
  assertScheduleUpdateRequested(safeOptions);
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
  const schedule = buildUpdatedSchedule(source.schedule, Object.assign({}, safeOptions, {
    now
  }));
  const updatedSource = Object.assign({}, source, {
    schedule,
    updatedAt: now
  });
  const changed = stableJson(source.schedule) !== stableJson(schedule);
  if (execute && changed) {
    await sourceRepository.saveSource(updatedSource);
  }

  return {
    generatedAt: now,
    status: 'ok',
    dryRun,
    executed: execute,
    changed,
    clearSchedule: safeOptions.clearSchedule === true,
    runNow: safeOptions.runNow === true,
    sourceBefore: sourceScheduleSummary(source),
    sourceAfter: sourceScheduleSummary(updatedSource)
  };
}

function assertScheduleUpdateRequested(options) {
  const requested = options.clearSchedule === true ||
    options.runNow === true ||
    options.intervalMinutes !== undefined ||
    options.nextRunAt !== undefined ||
    options.scheduleEnabled !== undefined;
  if (!requested) {
    throw createApplicationError('source_schedule_update_required', 'Source schedule update requires intervalMinutes, nextRunAt, scheduleEnabled, runNow, or clearSchedule.', {
      statusCode: 400
    });
  }
}

function buildUpdatedSchedule(schedule, options) {
  const safeOptions = options || {};
  if (safeOptions.clearSchedule === true) return undefined;

  const updated = Object.assign({}, schedule || {});
  if (safeOptions.intervalMinutes !== undefined) {
    if (safeOptions.intervalMinutes === null || safeOptions.intervalMinutes === '') {
      delete updated.intervalMinutes;
    } else {
      updated.intervalMinutes = normalizeIntervalMinutes(safeOptions.intervalMinutes);
    }
  }
  if (safeOptions.nextRunAt !== undefined) {
    if (safeOptions.nextRunAt === null || safeOptions.nextRunAt === '') {
      delete updated.nextRunAt;
    } else {
      updated.nextRunAt = normalizeIsoTimestamp(safeOptions.nextRunAt, 'nextRunAt');
    }
  }
  if (safeOptions.runNow === true) {
    updated.nextRunAt = normalizeIsoTimestamp(safeOptions.now, 'now');
  }
  if (safeOptions.scheduleEnabled !== undefined) {
    updated.enabled = safeOptions.scheduleEnabled !== false;
  } else if (!schedule && (updated.intervalMinutes || updated.nextRunAt)) {
    updated.enabled = true;
  }

  return removeUndefined(updated);
}

function normalizeIntervalMinutes(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    throw createApplicationError('invalid_source_schedule_interval', 'Source schedule intervalMinutes must be a positive number.', {
      statusCode: 400,
      details: {
        intervalMinutes: value
      }
    });
  }
  return number;
}

function normalizeIsoTimestamp(value, field) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw createApplicationError('invalid_source_schedule_time', 'Source schedule ' + field + ' must be a valid timestamp.', {
      statusCode: 400,
      details: {
        field,
        value
      }
    });
  }
  return date.toISOString();
}

function sourceScheduleSummary(source) {
  const summary = sourceSummary(source);
  const schedule = source && source.schedule || {};
  return Object.assign({}, summary, {
    schedule: {
      enabled: schedule.enabled,
      intervalMinutes: schedule.intervalMinutes,
      nextRunAt: schedule.nextRunAt
    }
  });
}

function removeUndefined(input) {
  const cleaned = Object.keys(input || {}).reduce(function (result, key) {
    if (input[key] !== undefined) result[key] = input[key];
    return result;
  }, {});
  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
}

function stableJson(value) {
  if (value === undefined) return 'undefined';
  return JSON.stringify(value, Object.keys(value || {}).sort());
}

module.exports = {
  setTrackedSourceSchedule,
  buildUpdatedSchedule,
  sourceScheduleSummary
};
