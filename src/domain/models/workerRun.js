'use strict';

const crypto = require('crypto');

function createWorkerRun(options) {
  const safeOptions = options || {};
  const now = safeOptions.now || new Date().toISOString();
  const input = safeOptions.input || {};
  const scope = deriveWorkerRunSourceScope({
    scope: safeOptions.scope,
    input
  });
  return {
    id: safeOptions.id || crypto.randomUUID(),
    workerType: safeOptions.workerType,
    workerId: safeOptions.workerId || 'local',
    status: safeOptions.status || 'running',
    input,
    scope,
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
      code: error && error.code,
      message: error && error.message ? error.message : String(error),
      stack: error && error.stack,
      details: error && error.details
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

function deriveWorkerRunSourceScope(runOrInput) {
  const value = runOrInput || {};
  const explicitScope = value.scope && typeof value.scope === 'object' ? value.scope : {};
  const input = value.input && typeof value.input === 'object' ? value.input : value;
  const sourceId = normalizeScopeValue(explicitScope.sourceId || value.sourceId || input.sourceId);
  const sourceKey = normalizeScopeValue(explicitScope.sourceKey || value.sourceKey || input.sourceKey || input.forum);
  const scope = {};
  if (sourceId) scope.sourceId = sourceId;
  if (sourceKey) scope.sourceKey = sourceKey;
  return scope;
}

function normalizeScopeValue(value) {
  const text = String(value || '').trim();
  return text || undefined;
}

module.exports = {
  createWorkerRun,
  markWorkerRunHeartbeat,
  markWorkerRunCompleted,
  markWorkerRunFailed,
  createSkippedWorkerRun,
  deriveWorkerRunSourceScope
};
