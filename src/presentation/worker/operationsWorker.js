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
      const reviewActionTask = await runReviewActionTask(runtime, safeRequest, leaseGuard, tracker, workerRun);
      const contextReviewResultEvents = await synthesizeContextReviewResultEvents(runtime, safeRequest, leaseGuard, tracker, workerRun);
      const runbookEvents = await synthesizeRunbookEvents(runtime, safeRequest, leaseGuard, tracker, workerRun);
      const authorReviewQueueEvents = await synthesizeAuthorReviewQueueEvents(runtime, safeRequest, leaseGuard, tracker, workerRun);
      workerRun = await tracker.heartbeat(workerRun, { step: 'dispatch-events' });
      await leaseGuard.renew();
      const events = await runtime.dispatchNotificationEvents(safeRequest.events || {});
      const archivedEvents = await archiveNotificationEvents(runtime, safeRequest, leaseGuard, tracker, workerRun);
      workerRun = await tracker.heartbeat(workerRun, { step: 'overview' });
      await leaseGuard.renew();
      const overview = await runtime.getOperationalOverview(safeRequest.overview || {});
      await tracker.complete(workerRun, summarizeOperationsResult(dueSources, reviewActionTask, contextReviewResultEvents, runbookEvents, authorReviewQueueEvents, events, archivedEvents, overview));
      logger.log('[worker] operations run completed: due=' + dueSources.dueCount + ', sourceFailed=' + dueSources.failedCount + ', reviewAction=' + (reviewActionTask ? reviewActionTask.report.status : 'skipped') + ', reviewResultEvents=' + (contextReviewResultEvents ? contextReviewResultEvents.eventCount : 0) + ', runbookEvents=' + (runbookEvents ? runbookEvents.eventCount : 0) + ', authorQueueEvents=' + (authorReviewQueueEvents ? authorReviewQueueEvents.eventCount : 0) + ', eventDelivered=' + events.dispatchedCount + ', eventFailed=' + events.failedCount + ', eventArchived=' + (archivedEvents ? archivedEvents.archivedCount : 0) + ', openEvents=' + overview.events.unacknowledged);
      return {
        dueSources,
        reviewActionTask,
        contextReviewResultEvents,
        runbookEvents,
        authorReviewQueueEvents,
        events,
        archivedEvents,
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

async function synthesizeRunbookEvents(runtime, request, leaseGuard, tracker, workerRun) {
  if (!request.runbookEvents) return undefined;
  if (typeof runtime.synthesizeRunbookNotificationEvents !== 'function') {
    throw new Error('OperationsWorker requires runtime.synthesizeRunbookNotificationEvents(request) when runbookEvents is enabled.');
  }
  await tracker.heartbeat(workerRun, { step: 'runbook-events' });
  await leaseGuard.renew();
  return runtime.synthesizeRunbookNotificationEvents(request.runbookEvents);
}

async function synthesizeContextReviewResultEvents(runtime, request, leaseGuard, tracker, workerRun) {
  if (!request.contextReviewResultEvents) return undefined;
  if (typeof runtime.synthesizeContextReviewResultNotificationEvents !== 'function') {
    throw new Error('OperationsWorker requires runtime.synthesizeContextReviewResultNotificationEvents(request) when contextReviewResultEvents is enabled.');
  }
  await tracker.heartbeat(workerRun, { step: 'context-review-result-events' });
  await leaseGuard.renew();
  return runtime.synthesizeContextReviewResultNotificationEvents(request.contextReviewResultEvents);
}

async function synthesizeAuthorReviewQueueEvents(runtime, request, leaseGuard, tracker, workerRun) {
  if (!request.authorReviewQueueEvents) return undefined;
  if (typeof runtime.synthesizeAuthorReviewQueueNotificationEvents !== 'function') {
    throw new Error('OperationsWorker requires runtime.synthesizeAuthorReviewQueueNotificationEvents(request) when authorReviewQueueEvents is enabled.');
  }
  await tracker.heartbeat(workerRun, { step: 'author-review-queue-events' });
  await leaseGuard.renew();
  return runtime.synthesizeAuthorReviewQueueNotificationEvents(request.authorReviewQueueEvents);
}

async function archiveNotificationEvents(runtime, request, leaseGuard, tracker, workerRun) {
  if (!request.archiveEvents) return undefined;
  if (typeof runtime.archiveNotificationEvents !== 'function') {
    throw new Error('OperationsWorker requires runtime.archiveNotificationEvents(request) when archiveEvents is enabled.');
  }
  await tracker.heartbeat(workerRun, { step: 'archive-events' });
  await leaseGuard.renew();
  return runtime.archiveNotificationEvents(request.archiveEvents);
}

async function runReviewActionTask(runtime, request, leaseGuard, tracker, workerRun) {
  if (!request.reviewAction) return undefined;
  if (typeof runtime.runContextReviewActionTask !== 'function') {
    throw new Error('OperationsWorker requires runtime.runContextReviewActionTask(request) when reviewAction is enabled.');
  }
  await tracker.heartbeat(workerRun, { step: 'review-action-apply' });
  await leaseGuard.renew();
  return runtime.runContextReviewActionTask(withWorkerTrace(request.reviewAction, workerRun));
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

function summarizeOperationsResult(dueSources, reviewActionTask, contextReviewResultEvents, runbookEvents, authorReviewQueueEvents, events, archivedEvents, overview) {
  return {
    dueSources: {
      sourceTaskMode: dueSources.task && dueSources.task.type === 'source-insight-pipeline-due-sources' ? 'insight-pipeline' : 'ingest',
      dueCount: dueSources.dueCount,
      completedCount: dueSources.completedCount,
      failedCount: dueSources.failedCount,
      skippedCount: dueSources.skippedCount
    },
    runbookEvents: runbookEvents ? {
      actionCount: runbookEvents.actionCount,
      eventCount: runbookEvents.eventCount,
      createdCount: runbookEvents.createdCount,
      updatedCount: runbookEvents.updatedCount,
      resolvedCount: runbookEvents.resolvedCount,
      reopenedCount: runbookEvents.reopenedCount,
      skippedCount: runbookEvents.skippedCount
    } : undefined,
    contextReviewResultEvents: contextReviewResultEvents ? {
      reviewResultCount: contextReviewResultEvents.reviewResultCount,
      actionCount: contextReviewResultEvents.actionCount,
      eventCount: contextReviewResultEvents.eventCount,
      createdCount: contextReviewResultEvents.createdCount,
      updatedCount: contextReviewResultEvents.updatedCount,
      skippedCount: contextReviewResultEvents.skippedCount
    } : undefined,
    authorReviewQueueEvents: authorReviewQueueEvents ? {
      itemCount: authorReviewQueueEvents.itemCount,
      actionCount: authorReviewQueueEvents.actionCount,
      eventCount: authorReviewQueueEvents.eventCount,
      createdCount: authorReviewQueueEvents.createdCount,
      updatedCount: authorReviewQueueEvents.updatedCount,
      resolvedCount: authorReviewQueueEvents.resolvedCount,
      reopenedCount: authorReviewQueueEvents.reopenedCount,
      skippedCount: authorReviewQueueEvents.skippedCount
    } : undefined,
    reviewActionTask: reviewActionTask ? {
      taskId: reviewActionTask.task && reviewActionTask.task.id,
      status: reviewActionTask.report && reviewActionTask.report.status,
      dryRun: reviewActionTask.report && reviewActionTask.report.dryRun,
      closeTaskCount: reviewActionTask.report && reviewActionTask.report.closeTaskCount,
      mergeCandidateCount: reviewActionTask.report && reviewActionTask.report.mergeCandidateCount
    } : undefined,
    events: {
      channelKey: events.channelKey,
      dispatchedCount: events.dispatchedCount,
      failedCount: events.failedCount,
      skippedCount: events.skippedCount
    },
    archivedEvents: archivedEvents ? {
      status: archivedEvents.status,
      dryRun: archivedEvents.dryRun,
      scannedCount: archivedEvents.scannedCount,
      candidateCount: archivedEvents.candidateCount,
      archivedCount: archivedEvents.archivedCount,
      skippedCount: archivedEvents.skippedCount,
      cutoffAt: archivedEvents.cutoffAt,
      batchId: archivedEvents.batchId
    } : undefined,
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
