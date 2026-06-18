'use strict';

const { evaluateTrackedSourceSchedule } = require('../../domain/scheduling/trackedSourceSchedule');
const { assertNotificationEventRepository } = require('../ports/notificationEventRepository');
const { assertRawThreadPageRepository } = require('../ports/rawThreadPageRepository');
const { assertSourceRepository } = require('../ports/sourceRepository');
const { assertTaskRepository } = require('../ports/taskRepository');
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

  const sources = await sourceRepository.listSources({ limit });
  const recentTasks = await taskRepository.listTasks({ limit });
  const pendingEvents = await notificationEventRepository.listEvents({ deliveryStatus: 'pending', limit });
  const failedEvents = await notificationEventRepository.listEvents({ deliveryStatus: 'failed', limit });
  const unacknowledgedEvents = await notificationEventRepository.listEvents({ acknowledged: false, limit });
  const rawPages = await rawThreadPageRepository.listRawThreadPages({ limit });
  const workerRuns = workerRunRepository ? await workerRunRepository.listWorkerRuns({ limit }) : [];

  return {
    generatedAt: now,
    windowLimit: limit,
    sources: summarizeSources(sources, now),
    tasks: summarizeTasks(recentTasks),
    events: summarizeEvents(pendingEvents, failedEvents, unacknowledgedEvents, now),
    workers: summarizeWorkerRuns(workerRuns, now, safeOptions.workerStaleAfterMs),
    rawPages: summarizeRawPages(rawPages),
    recent: {
      tasks: recentTasks.slice(0, 10),
      events: unacknowledgedEvents.slice(0, 10),
      rawPages: rawPages.slice(0, 10),
      workerRuns: workerRuns.slice(0, 10)
    }
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
    })
  };
}

function summarizeEvents(pendingEvents, failedEvents, unacknowledgedEvents, now) {
  return {
    pending: pendingEvents.length,
    failed: failedEvents.length,
    unacknowledged: unacknowledgedEvents.length,
    dueForDelivery: pendingEvents.concat(failedEvents).filter(function (event) {
      return isEventDue(event, now);
    }).length,
    nextDeliveryAt: nextDeliveryAt(pendingEvents.concat(failedEvents))
  };
}

function summarizeRawPages(rawPages) {
  return {
    total: rawPages.length,
    latestFetchedAt: rawPages[0] && rawPages[0].fetchedAt,
    latest: rawPages[0]
  };
}

function summarizeWorkerRuns(workerRuns, now, staleAfterMs) {
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

module.exports = {
  getOperationalOverview
};
