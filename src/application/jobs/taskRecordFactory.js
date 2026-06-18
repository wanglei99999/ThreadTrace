'use strict';

const crypto = require('crypto');

function createTaskRecord(type, input) {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    type,
    status: 'queued',
    input: input || {},
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

module.exports = {
  createTaskRecord,
  markTaskRunning,
  markTaskCompleted,
  markTaskFailed
};
