'use strict';

const os = require('os');
const {
  createWorkerRun,
  markWorkerRunHeartbeat,
  markWorkerRunCompleted,
  markWorkerRunFailed,
  createSkippedWorkerRun
} = require('../../domain/models/workerRun');

function createWorkerRunTracker(options) {
  const safeOptions = options || {};
  const repository = safeOptions.workerRunRepository;
  const logger = safeOptions.logger || console;
  const workerType = safeOptions.workerType;
  const workerId = safeOptions.workerId || defaultWorkerId(workerType);

  async function start(input) {
    if (!repository) return undefined;
    const run = createWorkerRun({
      workerType,
      workerId,
      input: input || {}
    });
    await safeSave(run);
    return run;
  }

  async function heartbeat(run, progress) {
    if (!repository || !run) return run;
    const updated = markWorkerRunHeartbeat(run, progress || {});
    await safeSave(updated);
    return updated;
  }

  async function complete(run, output) {
    if (!repository || !run) return run;
    const updated = markWorkerRunCompleted(run, output || {});
    await safeSave(updated);
    return updated;
  }

  async function fail(run, error) {
    if (!repository || !run) return run;
    const updated = markWorkerRunFailed(run, error);
    await safeSave(updated);
    return updated;
  }

  async function skip(reason, input) {
    if (!repository) return undefined;
    const run = createSkippedWorkerRun({
      workerType,
      workerId,
      reason,
      input: input || {}
    });
    await safeSave(run);
    return run;
  }

  async function safeSave(run) {
    try {
      await repository.saveWorkerRun(run);
    } catch (error) {
      if (logger && typeof logger.warn === 'function') {
        logger.warn('[worker] worker-run record failed: ' + (error && error.message ? error.message : error));
      }
    }
  }

  return {
    start,
    heartbeat,
    complete,
    fail,
    skip
  };
}

function defaultWorkerId(workerType) {
  return [workerType || 'worker', os.hostname(), process.pid].join(':');
}

module.exports = {
  createWorkerRunTracker
};
