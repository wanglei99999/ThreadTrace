'use strict';

const { createWorkerRunTracker } = require('./workerRunTracker');

function createNotificationEventWorker(options) {
  const safeOptions = options || {};
  const runtime = safeOptions.runtime;
  const logger = safeOptions.logger || console;
  const pollIntervalMs = safeOptions.pollIntervalMs || 60 * 1000;
  const tracker = createWorkerRunTracker({
    workerType: 'notification-event',
    workerId: safeOptions.workerId,
    workerRunRepository: safeOptions.workerRunRepository,
    logger
  });
  let timer;
  let running = false;

  if (!runtime || typeof runtime.dispatchNotificationEvents !== 'function') {
    throw new Error('NotificationEventWorker requires runtime.dispatchNotificationEvents(request).');
  }

  async function runOnce(request) {
    const safeRequest = request || {};
    if (running) {
      logger.warn('[worker] notification-event run skipped because a previous run is still active');
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
      workerRun = await tracker.heartbeat(workerRun, { step: 'dispatch-events' });
      const result = await runtime.dispatchNotificationEvents(safeRequest);
      await tracker.complete(workerRun, summarizeNotificationEventResult(result));
      logger.log('[worker] notification-event run completed: delivered=' + result.dispatchedCount + ', failed=' + result.failedCount + ', skipped=' + result.skippedCount);
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

function summarizeNotificationEventResult(result) {
  return {
    channelKey: result.channelKey,
    dispatchedCount: result.dispatchedCount,
    failedCount: result.failedCount,
    skippedCount: result.skippedCount
  };
}

module.exports = {
  createNotificationEventWorker
};
