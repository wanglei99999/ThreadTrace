'use strict';

const crypto = require('crypto');

function createTaskRecord(type, input, options) {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    type,
    status: 'queued',
    input: attachTaskTrace(input, options),
    createdAt: now,
    updatedAt: now
  };
}

function markTaskRunning(task) {
  const now = new Date().toISOString();
  return Object.assign({}, task, {
    status: 'running',
    startedAt: task.startedAt || now,
    updatedAt: now
  });
}

function markTaskCompleted(task, output) {
  const now = new Date().toISOString();
  return Object.assign({}, task, {
    status: 'completed',
    output: output || {},
    finishedAt: now,
    updatedAt: now
  });
}

function markTaskFailed(task, error) {
  const now = new Date().toISOString();
  return Object.assign({}, task, {
    status: 'failed',
    error: {
      message: error && error.message ? error.message : String(error),
      stack: error && error.stack
    },
    finishedAt: now,
    updatedAt: now
  });
}

function attachTaskTrace(input, options) {
  const safeInput = input || {};
  const safeOptions = options || {};
  const trace = {};
  if (safeOptions.requestId) trace.requestId = safeOptions.requestId;
  if (safeOptions.traceId) trace.traceId = safeOptions.traceId;
  if (safeOptions.idempotencyKey) trace.idempotencyKey = safeOptions.idempotencyKey;
  if (Object.keys(trace).length === 0) return safeInput;
  return Object.assign({}, safeInput, {
    _trace: Object.assign({}, safeInput._trace || {}, trace)
  });
}

module.exports = {
  createTaskRecord,
  markTaskRunning,
  markTaskCompleted,
  markTaskFailed,
  attachTaskTrace
};
