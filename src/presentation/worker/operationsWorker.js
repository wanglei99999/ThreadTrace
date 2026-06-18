'use strict';

const { createWorkerLeaseGuard } = require('./workerLeaseGuard');
const { createWorkerRunTracker } = require('./workerRunTracker');

function createOperationsWorker(options) {
  const safeOptions = options || {};
  const runtime = safeOptions.runtime;
  const logger = safeOptions.logger || console;
  const pollIntervalMs = safeOptions.pollIntervalMs || 60 * 1000;
  const defaultSourceTaskMode = safeOptions.sourceTaskMode || 'ingest';
  const leaseGuard = createWorkerLeaseGuard({
    workerType: 'operations',
    workerId: safeOptions.workerId,
    workerLeaseRepository: safeOptions.workerLeaseRepository,
    leaseKey: safeOptions.leaseKey,
    leaseTtlMs: safeOptions.leaseTtlMs,
    logger
  });
  const tracker = createWorkerRunTracker({
    workerType: 'operations',
    workerId: safeOptions.workerId,
    workerRunRepository: safeOptions.workerRunRepository,
    logger
  });
  let timer;
  let running = false;

  if (!runtime) {
    throw new Error('OperationsWorker requires runtime.');
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
    let lease;
    try {
      lease = await leaseGuard.acquire();
      if (!lease.acquired) {
        logger.warn('[worker] operations run skipped because lease is held by ' + (lease.lease && lease.lease.ownerId ? lease.lease.ownerId : 'another worker'));
        await tracker.skip('lease-held', safeRequest);
        return {
          skipped: true,
          reason: 'lease-held',
          lease: lease.lease
        };
      }
      const sourcesRequest = safeRequest.sources || {};
      const sourceTaskMode = sourcesRequest.sourceTaskMode || safeRequest.sourceTaskMode || defaultSourceTaskMode;
      workerRun = await tracker.start(Object.assign({}, safeRequest, { sourceTaskMode }));
      workerRun = await tracker.heartbeat(workerRun, { step: stepForSourceTaskMode(sourceTaskMode) });
      await leaseGuard.renew();
      const dueSources = await runDueSourceTasks(runtime, sourceTaskMode, withWorkerTrace(sourcesRequest, workerRun));
      workerRun = await tracker.heartbeat(workerRun, { step: 'dispatch-events' });
      await leaseGuard.renew();
      const events = await runtime.dispatchNotificationEvents(safeRequest.events || {});
      workerRun = await tracker.heartbeat(workerRun, { step: 'overview' });
      await leaseGuard.renew();
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
      if (lease && lease.acquired) {
        await leaseGuard.release();
      }
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

function runDueSourceTasks(runtime, sourceTaskMode, request) {
  if (sourceTaskMode === 'insight-pipeline') {
    if (typeof runtime.runDueSourceInsightPipelineTasks !== 'function') {
      throw new Error('OperationsWorker requires runtime.runDueSourceInsightPipelineTasks(request) for insight-pipeline mode.');
    }
    return runtime.runDueSourceInsightPipelineTasks(request);
  }
  if (sourceTaskMode !== 'ingest') {
    throw new Error('Unknown operations worker source task mode: ' + sourceTaskMode);
  }
  if (typeof runtime.runDueSourcesIngestTasks !== 'function') {
    throw new Error('OperationsWorker requires runtime.runDueSourcesIngestTasks(request).');
  }
  return runtime.runDueSourcesIngestTasks(request);
}

function withWorkerTrace(request, workerRun) {
  const safeRequest = request || {};
  if (safeRequest.traceId || !workerRun || !workerRun.id) return safeRequest;
  return Object.assign({}, safeRequest, {
    traceId: workerRun.id
  });
}

function stepForSourceTaskMode(sourceTaskMode) {
  if (sourceTaskMode === 'insight-pipeline') return 'insight-pipeline-due-sources';
  return 'ingest-due-sources';
}

function summarizeOperationsResult(dueSources, events, overview) {
  return {
    dueSources: {
      sourceTaskMode: dueSources.task && dueSources.task.type === 'source-insight-pipeline-due-sources' ? 'insight-pipeline' : 'ingest',
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
  createOperationsWorker,
  withWorkerTrace
};
