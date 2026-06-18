'use strict';

const { createWorkerRunTracker } = require('./workerRunTracker');

function createOperationsWorker(options) {
  const safeOptions = options || {};
  const runtime = safeOptions.runtime;
  const logger = safeOptions.logger || console;
  const pollIntervalMs = safeOptions.pollIntervalMs || 60 * 1000;
  const tracker = createWorkerRunTracker({
    workerType: 'operations',
    workerId: safeOptions.workerId,
    workerRunRepository: safeOptions.workerRunRepository,
    logger
  });
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
      const dueSources = await runtime.runDueSourcesIngestTasks(safeRequest.sources || {});
      workerRun = await tracker.heartbeat(workerRun, { step: 'dispatch-events' });
      const events = await runtime.dispatchNotificationEvents(safeRequest.events || {});
      workerRun = await tracker.heartbeat(workerRun, { step: 'overview' });
      const overview = await runtime.getOperationalOverview(safeRequest.overview || {});
      await tracker.complete(workerRun, summarizeOperationsResult(dueSources, events, overview));
      logger.log('[worker] operations run completed: due=' + dueSources.dueCount + ', sourceFailed=' + dueSources.failedCount + ', eventDelivered=' + events.dispatchedCount + ', eventFailed=' + events.failedCount + ', openEvents=' + overview.events.unacknowledged);
      return {
        dueSources,
        events,
        overview
      };
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

function summarizeOperationsResult(dueSources, events, overview) {
  return {
    dueSources: {
      dueCount: dueSources.dueCount,
      completedCount: dueSources.completedCount,
      failedCount: dueSources.failedCount,
      skippedCount: dueSources.skippedCount
    },
    events: {
      channelKey: events.channelKey,
      dispatchedCount: events.dispatchedCount,
      failedCount: events.failedCount,
      skippedCount: events.skippedCount
    },
    overview: {
      openEvents: overview.events.unacknowledged,
      failedTasks: overview.tasks ? overview.tasks.failed : undefined,
      staleWorkers: overview.workers ? overview.workers.stale : undefined
    }
  };
}

module.exports = {
  createOperationsWorker
};
