'use strict';

const crypto = require('crypto');

function createWorkerRun(options) {
  const safeOptions = options || {};
  const now = safeOptions.now || new Date().toISOString();
  return {
    id: safeOptions.id || crypto.randomUUID(),
    workerType: safeOptions.workerType,
    workerId: safeOptions.workerId || 'local',
    status: safeOptions.status || 'running',
    input: safeOptions.input || {},
    progress: safeOptions.progress || {},
    startedAt: safeOptions.startedAt || now,
    updatedAt: now,
    heartbeatAt: safeOptions.heartbeatAt || now,
    finishedAt: safeOptions.finishedAt
  };
}

function markWorkerRunHeartbeat(run, progress, now) {
  const timestamp = now || new Date().toISOString();
  return Object.assign({}, run, {
    progress: Object.assign({}, run.progress || {}, progress || {}),
    heartbeatAt: timestamp,
    updatedAt: timestamp
  });
}

function markWorkerRunCompleted(run, output, now) {
  const timestamp = now || new Date().toISOString();
  return Object.assign({}, run, {
    status: 'completed',
    output: output || {},
    finishedAt: timestamp,
    updatedAt: timestamp,
    heartbeatAt: timestamp
  });
}

function markWorkerRunFailed(run, error, now) {
  const timestamp = now || new Date().toISOString();
  return Object.assign({}, run, {
    status: 'failed',
    error: {
      message: error && error.message ? error.message : String(error),
      stack: error && error.stack
    },
    finishedAt: timestamp,
    updatedAt: timestamp,
    heartbeatAt: timestamp
  });
}

function createSkippedWorkerRun(options) {
  const safeOptions = options || {};
  const now = safeOptions.now || new Date().toISOString();
  return createWorkerRun(Object.assign({}, safeOptions, {
    status: 'skipped',
    progress: {
      reason: safeOptions.reason || 'skipped'
    },
    startedAt: now,
    heartbeatAt: now,
    finishedAt: now
  }));
}

module.exports = {
  createWorkerRun,
  markWorkerRunHeartbeat,
  markWorkerRunCompleted,
  markWorkerRunFailed,
  createSkippedWorkerRun
};
