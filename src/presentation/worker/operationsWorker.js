'use strict';

function createOperationsWorker(options) {
  const safeOptions = options || {};
  const runtime = safeOptions.runtime;
  const logger = safeOptions.logger || console;
  const pollIntervalMs = safeOptions.pollIntervalMs || 60 * 1000;
  let timer;
  let running = false;

  if (!runtime || typeof runtime.runDueSourcesIngestTasks !== 'function') {
    throw new Error('OperationsWorker requires runtime.runDueSourcesIngestTasks(request).');
  }
  if (typeof runtime.dispatchNotificationEvents !== 'function') {
    throw new Error('OperationsWorker requires runtime.dispatchNotificationEvents(request).');
  }
  if (typeof runtime.getOperationalOverview !== 'function') {
    throw new Error('OperationsWorker requires runtime.getOperationalOverview(request).');
  }

  async function runOnce(request) {
    const safeRequest = request || {};
    if (running) {
      logger.warn('[worker] operations run skipped because a previous run is still active');
      return {
        skipped: true,
        reason: 'already-running'
      };
    }

    running = true;
    try {
      const dueSources = await runtime.runDueSourcesIngestTasks(safeRequest.sources || {});
      const events = await runtime.dispatchNotificationEvents(safeRequest.events || {});
      const overview = await runtime.getOperationalOverview(safeRequest.overview || {});
      logger.log('[worker] operations run completed: due=' + dueSources.dueCount + ', sourceFailed=' + dueSources.failedCount + ', eventDelivered=' + events.dispatchedCount + ', eventFailed=' + events.failedCount + ', openEvents=' + overview.events.unacknowledged);
      return {
        dueSources,
        events,
        overview
      };
    } finally {
      running = false;
    }
  }

  function start(request) {
    if (timer) return;
    timer = setInterval(function () {
      runOnce(request).catch(function (error) {
        logger.error('[worker] operations run failed: ' + (error && error.stack ? error.stack : error));
      });
    }, pollIntervalMs);
    runOnce(request).catch(function (error) {
      logger.error('[worker] operations run failed: ' + (error && error.stack ? error.stack : error));
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
  createOperationsWorker
};
