'use strict';

const { evaluateTrackedSourceSchedule } = require('../../domain/scheduling/trackedSourceSchedule');
const { assertNotificationEventRepository } = require('../ports/notificationEventRepository');
const { assertRawThreadPageRepository } = require('../ports/rawThreadPageRepository');
const { assertSourceRepository } = require('../ports/sourceRepository');
const { assertTaskRepository } = require('../ports/taskRepository');
const { assertWorkerLeaseRepository } = require('../ports/workerLeaseRepository');
const { assertWorkerRunRepository } = require('../ports/workerRunRepository');

async function getOperationalOverview(options) {
  const safeOptions = options || {};
  const now = safeOptions.now || new Date().toISOString();
  const limit = safeOptions.limit || 100;
  const sourceRepository = assertSourceRepository(safeOptions.sourceRepository);
  const taskRepository = assertTaskRepository(safeOptions.taskRepository);
  const notificationEventRepository = assertNotificationEventRepository(safeOptions.notificationEventRepository);
  const rawThreadPageRepository = assertRawThreadPageRepository(safeOptions.rawThreadPageRepository);
  const workerRunRepository = safeOptions.workerRunRepository
    ? assertWorkerRunRepository(safeOptions.workerRunRepository)
    : undefined;
  const workerLeaseRepository = safeOptions.workerLeaseRepository
    ? assertWorkerLeaseRepository(safeOptions.workerLeaseRepository)
    : undefined;

  const sources = await sourceRepository.listSources({ limit });
  const recentTasks = await taskRepository.listTasks({ limit });
  const pendingEvents = await notificationEventRepository.listEvents({ deliveryStatus: 'pending', acknowledged: false, limit });
  const failedEvents = await notificationEventRepository.listEvents({ deliveryStatus: 'failed', acknowledged: false, limit });
  const unacknowledgedEvents = await notificationEventRepository.listEvents({ acknowledged: false, limit });
  const rawPages = await rawThreadPageRepository.listRawThreadPages({ limit });
  const workerRuns = workerRunRepository ? await workerRunRepository.listWorkerRuns({ limit }) : [];
  const workerLeases = workerLeaseRepository ? await workerLeaseRepository.listWorkerLeases({ limit }) : [];

  return {
    generatedAt: now,
    windowLimit: limit,
    sources: summarizeSources(sources, now),
    tasks: summarizeTasks(recentTasks),
    events: summarizeEvents(pendingEvents, failedEvents, unacknowledgedEvents, now),
    workers: summarizeWorkers(workerRuns, workerLeases, now, safeOptions.workerStaleAfterMs),
    rawPages: summarizeRawPages(rawPages),
    reviewActions: summarizeReviewActions({
      auditOverview: safeOptions.reviewActionAuditOverview,
      executions: safeOptions.reviewActionExecutions
    }),
    recent: {
      tasks: recentTasks.slice(0, 10).map(summarizeRecentTask),
      events: unacknowledgedEvents.slice(0, 10),
      rawPages: rawPages.slice(0, 10),
      workerRuns: workerRuns.slice(0, 10),
      workerLeases: workerLeases.slice(0, 10)
    }
  };
}

function summarizeReviewActions(options) {
  const safeOptions = options || {};
  const overview = safeOptions.auditOverview;
  const executionOverview = summarizeReviewActionExecutions(safeOptions.executions);
  if (!overview) {
    return {
      auditCount: 0,
      taskCount: 0,
      plannedClosureCount: 0,
      plannedMergeCandidateCount: 0,
      latestGeneratedAt: undefined,
      status: 'unknown',
      executions: executionOverview
    };
  }
  return {
    status: overview.status,
    auditCount: overview.count || 0,
    taskCount: overview.taskCount || 0,
    plannedClosureCount: overview.plannedClosureCount || 0,
    plannedMergeCandidateCount: overview.plannedMergeCandidateCount || 0,
    latestGeneratedAt: overview.latestGeneratedAt,
    byAction: overview.byAction || {},
    byAdapter: overview.byAdapter || {},
    recommendedNextAction: overview.recommendedNextAction,
    executions: executionOverview
  };
}

function summarizeReviewActionExecutions(result) {
  const executions = result && Array.isArray(result.executions) ? result.executions : [];
  return {
    status: result && result.status || (result ? 'ok' : 'unknown'),
    count: result && result.count !== undefined ? result.count : executions.length,
    completed: executions.filter(function (execution) { return execution.status === 'completed'; }).length,
    running: executions.filter(function (execution) { return execution.status === 'running'; }).length,
    failed: executions.filter(function (execution) { return execution.status === 'failed'; }).length,
    latestUpdatedAt: latestTimestamp(executions.map(function (execution) {
      return execution.updatedAt || execution.completedAt || execution.failedAt || execution.createdAt;
    })),
    latestTaskId: executions[0] && executions[0].taskId,
    message: result && result.message
  };
}

function summarizeSources(sources, now) {
  const decisions = sources.map(function (source) {
    return {
      source,
      decision: evaluateTrackedSourceSchedule(source, now)
    };
  });
  return {
    total: sources.length,
    enabled: sources.filter(function (source) { return source.enabled !== false; }).length,
    disabled: sources.filter(function (source) { return source.enabled === false; }).length,
    due: decisions.filter(function (item) { return item.decision.due; }).length,
    running: sources.filter(function (source) { return source.runState && source.runState.status === 'running'; }).length,
    failed: sources.filter(function (source) { return source.runState && source.runState.status === 'failed'; }).length,
    dueSources: decisions.filter(function (item) {
      return item.decision.due;
    }).slice(0, 10).map(function (item) {
      return {
        id: item.source.id,
        displayName: item.source.displayName,
        sourceKey: item.source.sourceKey,
        sourceType: item.source.sourceType,
        reason: item.decision.reason,
        nextRunAt: item.decision.nextRunAt
      };
    })
  };
}

function summarizeTasks(tasks) {
  return {
    total: tasks.length,
    queued: countByStatus(tasks, 'queued'),
    running: countByStatus(tasks, 'running'),
    completed: countByStatus(tasks, 'completed'),
    failed: countByStatus(tasks, 'failed'),
    lastFailure: tasks.find(function (task) {
      return task.status === 'failed';
    }) ? summarizeRecentTask(tasks.find(function (task) {
      return task.status === 'failed';
    })) : undefined
  };
}

function summarizeRecentTask(task) {
  if (!task) return undefined;
  return {
    id: task.id,
    type: task.type,
    status: task.status,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    startedAt: task.startedAt,
    finishedAt: task.finishedAt,
    input: task.input,
    output: summarizeTaskOutput(task.output),
    error: task.error ? {
      message: task.error.message
    } : undefined
  };
}

function summarizeTaskOutput(output) {
  if (!output || typeof output !== 'object') return output;
  return {
    sourceKey: output.sourceKey,
    sourceThreadId: output.sourceThreadId,
    title: output.title,
    parsedPostCount: output.parsedPostCount,
    reportType: output.reportType,
    sourceId: output.sourceId,
    sourceCount: output.sourceCount,
    completedCount: output.completedCount,
    failedCount: output.failedCount,
    skippedCount: output.skippedCount,
    status: output.status,
    dryRun: output.dryRun,
    executed: output.executed,
    applied: output.applied,
    changed: output.changed,
    manifestName: output.manifestName,
    source: output.source,
    registration: output.registration,
    deploymentGate: output.deploymentGate
  };
}

function summarizeEvents(pendingEvents, failedEvents, unacknowledgedEvents, now) {
  const openPendingEvents = pendingEvents.filter(isUnacknowledgedEvent);
  const openFailedEvents = failedEvents.filter(isUnacknowledgedEvent);
  const deliveryEvents = openPendingEvents.concat(openFailedEvents);
  return {
    pending: openPendingEvents.length,
    failed: openFailedEvents.length,
    unacknowledged: unacknowledgedEvents.length,
    dueForDelivery: deliveryEvents.filter(function (event) {
      return isEventDue(event, now);
    }).length,
    nextDeliveryAt: nextDeliveryAt(deliveryEvents)
  };
}

function isUnacknowledgedEvent(event) {
  return !event.acknowledgedAt;
}

function summarizeRawPages(rawPages) {
  return {
    total: rawPages.length,
    latestFetchedAt: rawPages[0] && rawPages[0].fetchedAt,
    latest: rawPages[0]
  };
}

function summarizeWorkers(workerRuns, workerLeases, now, staleAfterMs) {
  const staleWindowMs = staleAfterMs || 5 * 60 * 1000;
  const runningRuns = workerRuns.filter(function (run) {
    return run.status === 'running';
  });
  const staleRuns = runningRuns.filter(function (run) {
    return isStaleWorkerRun(run, now, staleWindowMs);
  });
  return {
    total: workerRuns.length,
    running: runningRuns.length,
    stale: staleRuns.length,
    completed: countByStatus(workerRuns, 'completed'),
    failed: countByStatus(workerRuns, 'failed'),
    skipped: countByStatus(workerRuns, 'skipped'),
    latestHeartbeatAt: latestTimestamp(workerRuns.map(function (run) {
      return run.heartbeatAt;
    })),
    leases: summarizeWorkerLeases(workerLeases, now),
    latestRun: workerRuns[0],
    staleRuns: staleRuns.slice(0, 10).map(function (run) {
      return {
        id: run.id,
        workerType: run.workerType,
        workerId: run.workerId,
        status: run.status,
        heartbeatAt: run.heartbeatAt,
        startedAt: run.startedAt
      };
    })
  };
}

function summarizeWorkerLeases(workerLeases, now) {
  const expiredLeases = workerLeases.filter(function (lease) {
    return isExpiredLease(lease, now);
  });
  return {
    total: workerLeases.length,
    active: workerLeases.length - expiredLeases.length,
    expired: expiredLeases.length,
    latest: workerLeases[0],
    expiredLeases: expiredLeases.slice(0, 10)
  };
}

function countByStatus(tasks, status) {
  return tasks.filter(function (task) {
    return task.status === status;
  }).length;
}

function isEventDue(event, now) {
  if (!event.nextDeliveryAt) return true;
  const eventTime = Date.parse(event.nextDeliveryAt);
  const nowTime = Date.parse(now);
  if (Number.isNaN(eventTime) || Number.isNaN(nowTime)) return true;
  return eventTime <= nowTime;
}

function nextDeliveryAt(events) {
  return events
    .map(function (event) { return event.nextDeliveryAt; })
    .filter(Boolean)
    .sort()[0];
}

function isStaleWorkerRun(run, now, staleAfterMs) {
  const heartbeatTime = Date.parse(run.heartbeatAt || run.updatedAt || run.startedAt);
  const nowTime = Date.parse(now);
  if (Number.isNaN(heartbeatTime) || Number.isNaN(nowTime)) return false;
  return nowTime - heartbeatTime > staleAfterMs;
}

function latestTimestamp(values) {
  return values
    .filter(Boolean)
    .sort()
    .reverse()[0];
}

function isExpiredLease(lease, now) {
  const expiresTime = Date.parse(lease.expiresAt);
  const nowTime = Date.parse(now);
  if (Number.isNaN(expiresTime) || Number.isNaN(nowTime)) return true;
  return expiresTime <= nowTime;
}

module.exports = {
  getOperationalOverview
};
