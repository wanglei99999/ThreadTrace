'use strict';

function createNotificationEventWorker(options) {
  const safeOptions = options || {};
  const runtime = safeOptions.runtime;
  const logger = safeOptions.logger || console;
  const pollIntervalMs = safeOptions.pollIntervalMs || 60 * 1000;
  let timer;
  let running = false;

  if (!runtime || typeof runtime.dispatchNotificationEvents !== 'function') {
    throw new Error('NotificationEventWorker requires runtime.dispatchNotificationEvents(request).');
  }

  async function runOnce(request) {
    if (running) {
      logger.warn('[worker] notification-event run skipped because a previous run is still active');
      return {
        skipped: true,
        reason: 'already-running'
      };
    }

    running = true;
    try {
      const result = await runtime.dispatchNotificationEvents(request || {});
      logger.log('[worker] notification-event run completed: delivered=' + result.dispatchedCount + ', failed=' + result.failedCount + ', skipped=' + result.skippedCount);
      return result;
    } finally {
      running = false;
    }
  }

  function start(request) {
    if (timer) return;
    timer = setInterval(function () {
      runOnce(request).catch(function (error) {
        logger.error('[worker] notification-event run failed: ' + (error && error.stack ? error.stack : error));
      });
    }, pollIntervalMs);
    runOnce(request).catch(function (error) {
      logger.error('[worker] notification-event run failed: ' + (error && error.stack ? error.stack : error));
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
  createNotificationEventWorker
};
