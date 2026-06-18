'use strict';

function createDueSourceWorker(options) {
  const safeOptions = options || {};
  const runtime = safeOptions.runtime;
  const logger = safeOptions.logger || console;
  const pollIntervalMs = safeOptions.pollIntervalMs || 5 * 60 * 1000;
  let timer;
  let running = false;

  if (!runtime || typeof runtime.runDueSourcesIngestTasks !== 'function') {
    throw new Error('DueSourceWorker requires runtime.runDueSourcesIngestTasks(request).');
  }

  async function runOnce(request) {
    if (running) {
      logger.warn('[worker] due-source run skipped because a previous run is still active');
      return {
        skipped: true,
        reason: 'already-running'
      };
    }

    running = true;
    try {
      const result = await runtime.runDueSourcesIngestTasks(request || {});
      logger.log('[worker] due-source run completed: due=' + result.dueCount + ', completed=' + result.completedCount + ', failed=' + result.failedCount);
      return result;
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

module.exports = {
  createDueSourceWorker
};
