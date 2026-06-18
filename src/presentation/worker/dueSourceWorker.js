'use strict';

const { createWorkerRunTracker } = require('./workerRunTracker');

function createDueSourceWorker(options) {
  const safeOptions = options || {};
  const runtime = safeOptions.runtime;
  const logger = safeOptions.logger || console;
  const pollIntervalMs = safeOptions.pollIntervalMs || 5 * 60 * 1000;
  const tracker = createWorkerRunTracker({
    workerType: 'due-source',
    workerId: safeOptions.workerId,
    workerRunRepository: safeOptions.workerRunRepository,
    logger
  });
  let timer;
  let running = false;

  if (!runtime || typeof runtime.runDueSourcesIngestTasks !== 'function') {
    throw new Error('DueSourceWorker requires runtime.runDueSourcesIngestTasks(request).');
  }

  async function runOnce(request) {
    const safeRequest = request || {};
    if (running) {
      logger.warn('[worker] due-source run skipped because a previous run is still active');
      await tracker.skip('already-running', safeRequest);
      return {
        skipped: true,
        reason: 'already-running'
      };
    }

    running = true;
    let workerRun;
    try {
      workerRun = await tracker.start(safeRequest);
      workerRun = await tracker.heartbeat(workerRun, { step: 'ingest-due-sources' });
      const result = await runtime.runDueSourcesIngestTasks(safeRequest);
      await tracker.complete(workerRun, summarizeDueSourceResult(result));
      logger.log('[worker] due-source run completed: due=' + result.dueCount + ', completed=' + result.completedCount + ', failed=' + result.failedCount);
      return result;
    } catch (error) {
      await tracker.fail(workerRun, error);
      throw error;
    } finally {
      running = false;
    }
  }

  function start(request) {
    if (timer) return;
    timer = setInterval(function () {
      runOnce(request).catch(function (error) {
        logger.error('[worker] due-source run failed: ' + (error && error.stack ? error.stack : error));
      });
    }, pollIntervalMs);
    runOnce(request).catch(function (error) {
      logger.error('[worker] due-source run failed: ' + (error && error.stack ? error.stack : error));
    });
  }

  function stop() {
    if (!timer) return;
    clearInterval(timer);
    timer = undefined;
  }

  return {
    runOnce,
    start,
    stop,
    isRunning: function () {
      return running;
    }
  };
}

function summarizeDueSourceResult(result) {
  return {
    dueCount: result.dueCount,
    completedCount: result.completedCount,
    failedCount: result.failedCount,
    skippedCount: result.skippedCount
  };
}

module.exports = {
  createDueSourceWorker
};
