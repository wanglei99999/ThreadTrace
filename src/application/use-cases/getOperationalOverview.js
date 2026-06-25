'use strict';

const { parseWorkerLeaseKey } = require('../../domain/models/workerLeaseKey');
const { deriveWorkerRunSourceScope } = require('../../domain/models/workerRun');
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

  const sources = await resolveScopedSources(sourceRepository, safeOptions, limit);
  const scope = buildOverviewScope(safeOptions, sources);
  const recentTasks = filterTasksByOverviewScope(await taskRepository.listTasks({ limit }), scope);
  const pendingEvents = filterEventsByOverviewScope(await notificationEventRepository.listEvents({ deliveryStatus: 'pending', acknowledged: false, limit }), scope);
  const failedEvents = filterEventsByOverviewScope(await notificationEventRepository.listEvents({ deliveryStatus: 'failed', acknowledged: false, limit }), scope);
  const unacknowledgedEvents = filterEventsByOverviewScope(await notificationEventRepository.listEvents({ acknowledged: false, limit }), scope);
  const rawPages = await rawThreadPageRepository.listRawThreadPages({ limit });
  const workerRuns = workerRunRepository ? filterWorkerRunsByOverviewScope(await workerRunRepository.listWorkerRuns({ limit }), scope) : [];
  const workerLeases = workerLeaseRepository ? filterWorkerLeasesByOverviewScope(await workerLeaseRepository.listWorkerLeases({ limit }), scope) : [];

  return {
    generatedAt: now,
    windowLimit: limit,
    scope,
    sources: summarizeSources(sources, now),
    tasks: summarizeTasks(recentTasks),
    events: summarizeEvents(pendingEvents, failedEvents, unacknowledgedEvents, now),
    workers: summarizeWorkers(workerRuns, workerLeases, now, safeOptions.workerStaleAfterMs),
    rawPages: summarizeRawPages(rawPages),
    authorReviewQueue: summarizeAuthorReviewQueue(safeOptions.authorReviewQueue),
    reviewActions: summarizeReviewActions({
      auditOverview: safeOptions.reviewActionAuditOverview,
      executions: safeOptions.reviewActionExecutions
    }),
    recent: {
      tasks: recentTasks.slice(0, 10).map(summarizeRecentTask),
      events: unacknowledgedEvents.slice(0, 10),
      rawPages: rawPages.slice(0, 10),
      authorReviewQueue: recentAuthorReviewQueueItems(safeOptions.authorReviewQueue),
      workerRuns: workerRuns.slice(0, 10).map(summarizeWorkerRun),
      workerLeases: workerLeases.slice(0, 10).map(function (lease) {
        return summarizeWorkerLease(lease, now);
      })
    }
  };
}

async function resolveScopedSources(sourceRepository, options, limit) {
  if (options.sourceId) {
    const source = await sourceRepository.findSource(options.sourceId);
    if (!source) return [];
    if (options.sourceKey && source.sourceKey !== options.sourceKey) return [];
    if (options.sourceType && source.sourceType !== options.sourceType) return [];
    if (typeof options.enabled === 'boolean' && source.enabled !== options.enabled) return [];
    return [source];
  }
  return sourceRepository.listSources({
    sourceKey: options.sourceKey || options.forum,
    sourceType: options.sourceType,
    enabled: options.enabled,
    limit
  });
}

function buildOverviewScope(options, sources) {
  const sourceIds = unique((sources || []).map(function (source) { return source.id; }));
  const sourceKeys = unique((sources || []).map(function (source) { return source.sourceKey; }));
  return {
    sourceId: options.sourceId,
    sourceKey: options.sourceKey || options.forum,
    sourceType: options.sourceType,
    sourceIds,
    sourceKeys,
    scoped: Boolean(options.sourceId || options.sourceKey || options.forum || options.sourceType)
  };
}

function summarizeAuthorReviewQueue(result) {
  const items = result && Array.isArray(result.items) ? result.items : [];
  const summary = result && result.summary || {};
  const byStatus = summary.byStatus || countBy(items, function (item) { return item.status || 'unknown'; });
  const byPriority = summary.byPriority || countBy(items, function (item) { return item.priority || 'unknown'; });
  const byType = summary.byType || countBy(items, function (item) { return item.type || 'unknown'; });
  const openItems = items.filter(function (item) {
    return item.status === 'open';
  });
  const highPriorityOpenItems = openItems.filter(function (item) {
    return item.priority === 'high';
  });
  return {
    itemCount: result && result.itemCount !== undefined ? result.itemCount : items.length,
    openCount: summary.openCount !== undefined ? summary.openCount : (byStatus.open || 0),
    highPriorityOpenCount: summary.highPriorityOpenCount !== undefined
      ? summary.highPriorityOpenCount
      : highPriorityOpenCountFromSummary(summary) || highPriorityOpenItems.length,
    byStatus,
    byPriority,
    byType,
    bySourceKey: summary.bySourceKey || countBy(items, function (item) { return item.sourceKey || 'unknown-source'; }),
    openBySourceKey: summary.openBySourceKey || countBy(openItems, function (item) { return item.sourceKey || 'unknown-source'; }),
    highPriorityOpenBySourceKey: summary.highPriorityOpenBySourceKey || countBy(highPriorityOpenItems, function (item) { return item.sourceKey || 'unknown-source'; }),
    sourceHotspots: summary.sourceHotspots || sourceQueueHotspots(items),
    latestUpdatedAt: latestTimestamp(items.map(function (item) {
      return item.updatedAt || item.lastSeenAt;
    }))
  };
}

function highPriorityOpenCountFromSummary(summary) {
  const counts = summary && summary.highPriorityOpenBySourceKey || {};
  return Object.keys(counts).reduce(function (total, key) {
    return total + (counts[key] || 0);
  }, 0);
}

function sourceQueueHotspots(items) {
  const bySource = new Map();
  (items || []).forEach(function (item) {
    const sourceKey = item.sourceKey || 'unknown-source';
    if (!bySource.has(sourceKey)) {
      bySource.set(sourceKey, {
        sourceKey,
        itemCount: 0,
        openCount: 0,
        highPriorityOpenCount: 0,
        byType: {},
        latestUpdatedAt: undefined,
        sourceThreadIds: new Set()
      });
    }
    const hotspot = bySource.get(sourceKey);
    hotspot.itemCount += 1;
    if (item.status === 'open') hotspot.openCount += 1;
    if (item.status === 'open' && item.priority === 'high') hotspot.highPriorityOpenCount += 1;
    hotspot.byType[item.type || 'unknown'] = (hotspot.byType[item.type || 'unknown'] || 0) + 1;
    hotspot.latestUpdatedAt = latestTimestamp([hotspot.latestUpdatedAt, item.updatedAt || item.lastSeenAt]);
    if (item.sourceThreadId) hotspot.sourceThreadIds.add(item.sourceThreadId);
  });
  return Array.from(bySource.values()).map(function (hotspot) {
    return Object.assign({}, hotspot, {
      sourceThreadIds: Array.from(hotspot.sourceThreadIds).slice(0, 8)
    });
  }).sort(function (a, b) {
    return b.highPriorityOpenCount - a.highPriorityOpenCount
      || b.openCount - a.openCount
      || b.itemCount - a.itemCount
      || String(a.sourceKey).localeCompare(String(b.sourceKey));
  });
}

function recentAuthorReviewQueueItems(result) {
  return result && Array.isArray(result.items) ? result.items.slice(0, 10) : [];
}

function summarizeReviewActions(options) {
  const safeOptions = options || {};
  const overview = safeOptions.auditOverview;
  const executionOverview = summarizeReviewActionExecutions(safeOptions.executions);
  if (!overview) {
    return {
      sourceId: undefined,
      sourceKey: undefined,
      auditCount: 0,
      taskCount: 0,
      plannedClosureCount: 0,
      plannedMergeCandidateCount: 0,
      latestGeneratedAt: undefined,
      status: 'unknown',
      byAction: {},
      byAdapter: {},
      bySourceKey: {},
      bySourceId: {},
      executions: executionOverview
    };
  }
  return {
    status: overview.status,
    sourceId: overview.sourceId,
    sourceKey: overview.sourceKey,
    auditCount: overview.count || 0,
    taskCount: overview.taskCount || 0,
    plannedClosureCount: overview.plannedClosureCount || 0,
    plannedMergeCandidateCount: overview.plannedMergeCandidateCount || 0,
    latestGeneratedAt: overview.latestGeneratedAt,
    byAction: overview.byAction || {},
    byAdapter: overview.byAdapter || {},
    bySourceKey: overview.bySourceKey || {},
    bySourceId: overview.bySourceId || {},
    recommendedNextAction: overview.recommendedNextAction,
    executions: executionOverview
  };
}

function summarizeReviewActionExecutions(result) {
  const executions = result && Array.isArray(result.executions) ? result.executions : [];
  const staleRunningExecutions = result && Array.isArray(result.staleRunningExecutions)
    ? result.staleRunningExecutions
    : executions.filter(function (execution) { return execution.staleRunning; }).slice(0, 10);
  return {
    status: result && result.status || (result ? 'ok' : 'unknown'),
    healthStatus: result && result.healthStatus,
    count: result && result.count !== undefined ? result.count : executions.length,
    completed: executions.filter(function (execution) { return execution.status === 'completed'; }).length,
    running: executions.filter(function (execution) { return execution.status === 'running'; }).length,
    staleRunning: result && result.staleRunningCount !== undefined
      ? result.staleRunningCount
      : staleRunningExecutions.length,
    failed: executions.filter(function (execution) { return execution.status === 'failed'; }).length,
    latestUpdatedAt: latestTimestamp(executions.map(function (execution) {
      return execution.updatedAt || execution.completedAt || execution.failedAt || execution.createdAt;
    })),
    latestTaskId: executions[0] && executions[0].taskId,
    sourceId: result && result.sourceId,
    sourceKey: result && result.sourceKey,
    bySourceKey: countBy(executions, function (execution) { return execution.sourceKey || 'unknown'; }),
    bySourceId: countBy(executions, function (execution) { return execution.sourceId || 'unknown'; }),
    staleRunningBySourceKey: countBy(staleRunningExecutions, function (execution) { return execution.sourceKey || 'unknown'; }),
    runningStaleAfterMs: result && result.runningStaleAfterMs,
    staleRunningExecutions,
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

function filterTasksByOverviewScope(tasks, scope) {
  if (!scope.scoped) return tasks || [];
  return (tasks || []).filter(function (task) {
    return matchesOverviewScope(taskSourceScope(task), scope);
  });
}

function filterEventsByOverviewScope(events, scope) {
  if (!scope.scoped) return events || [];
  return (events || []).filter(function (event) {
    if (scope.sourceType && event && event.type === 'source-type-operations') {
      return event.payload && event.payload.sourceType === scope.sourceType;
    }
    return matchesOverviewScope(event || {}, scope);
  });
}

function filterWorkerRunsByOverviewScope(workerRuns, scope) {
  if (!scope.scoped) return workerRuns || [];
  return (workerRuns || []).filter(function (run) {
    return matchesOverviewScope(deriveWorkerRunSourceScope(run), scope);
  });
}

function filterWorkerLeasesByOverviewScope(workerLeases, scope) {
  if (!scope.scoped) return workerLeases || [];
  return (workerLeases || []).filter(function (lease) {
    const parsed = parseWorkerLeaseKey(lease && lease.leaseKey);
    return matchesOverviewScope(parsed.scope, scope);
  });
}

function taskSourceScope(task) {
  const input = task && task.input || {};
  const output = task && task.output || {};
  const source = input.source || output.source || output.sourceAfter || output.sourceBefore || {};
  return {
    sourceId: input.sourceId || output.sourceId || source.id || source.sourceId,
    sourceKey: input.sourceKey || input.forum || output.sourceKey || output.forum || source.sourceKey || source.forum
  };
}

function matchesOverviewScope(value, scope) {
  const safeValue = value || {};
  if (scope.sourceId) return safeValue.sourceId === scope.sourceId;
  if (scope.sourceIds.length > 0 && safeValue.sourceId && scope.sourceIds.includes(safeValue.sourceId)) return true;
  if (scope.sourceType) return false;
  if (scope.sourceKey) return safeValue.sourceKey === scope.sourceKey;
  if (scope.sourceKeys.length > 0 && safeValue.sourceKey && scope.sourceKeys.includes(safeValue.sourceKey)) return true;
  return false;
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
  const summarizedRuns = workerRuns.map(summarizeWorkerRun);
  const runningRuns = summarizedRuns.filter(function (run) {
    return run.status === 'running';
  });
  const staleRuns = runningRuns.filter(function (run) {
    return isStaleWorkerRun(run, now, staleWindowMs);
  });
  const sourceScopedRuns = summarizedRuns.filter(function (run) {
    return run.scoped;
  });
  return {
    total: summarizedRuns.length,
    running: runningRuns.length,
    stale: staleRuns.length,
    completed: countByStatus(summarizedRuns, 'completed'),
    failed: countByStatus(summarizedRuns, 'failed'),
    skipped: countByStatus(summarizedRuns, 'skipped'),
    sourceScoped: sourceScopedRuns.length,
    unscoped: summarizedRuns.length - sourceScopedRuns.length,
    byWorkerType: countBy(summarizedRuns, function (run) { return run.workerType || 'unknown'; }),
    bySourceId: countBy(sourceScopedRuns.filter(function (run) {
      return run.scope && run.scope.sourceId;
    }), function (run) { return run.scope.sourceId; }),
    bySourceKey: countBy(sourceScopedRuns.filter(function (run) {
      return run.scope && run.scope.sourceKey;
    }), function (run) { return run.scope.sourceKey; }),
    runningBySourceId: countBy(runningRuns.filter(function (run) {
      return run.scope && run.scope.sourceId;
    }), function (run) { return run.scope.sourceId; }),
    runningBySourceKey: countBy(runningRuns.filter(function (run) {
      return run.scope && run.scope.sourceKey;
    }), function (run) { return run.scope.sourceKey; }),
    staleBySourceId: countBy(staleRuns.filter(function (run) {
      return run.scope && run.scope.sourceId;
    }), function (run) { return run.scope.sourceId; }),
    staleBySourceKey: countBy(staleRuns.filter(function (run) {
      return run.scope && run.scope.sourceKey;
    }), function (run) { return run.scope.sourceKey; }),
    latestHeartbeatAt: latestTimestamp(summarizedRuns.map(function (run) {
      return run.heartbeatAt;
    })),
    leases: summarizeWorkerLeases(workerLeases, now),
    latestRun: summarizedRuns[0],
    staleRuns: staleRuns.slice(0, 10).map(function (run) {
      return {
        id: run.id,
        workerType: run.workerType,
        workerId: run.workerId,
        status: run.status,
        scope: run.scope,
        scoped: run.scoped,
        heartbeatAt: run.heartbeatAt,
        startedAt: run.startedAt
      };
    })
  };
}

function summarizeWorkerRun(run) {
  const scope = deriveWorkerRunSourceScope(run);
  return Object.assign({}, run, {
    scope,
    scoped: Boolean(scope.sourceId || scope.sourceKey)
  });
}

function summarizeWorkerLeases(workerLeases, now) {
  const summarized = workerLeases.map(function (lease) {
    return summarizeWorkerLease(lease, now);
  });
  const expiredLeases = summarized.filter(function (lease) { return lease.expired; });
  const sourceScopedLeases = summarized.filter(function (lease) { return lease.scoped; });
  return {
    total: workerLeases.length,
    active: workerLeases.length - expiredLeases.length,
    expired: expiredLeases.length,
    sourceScoped: sourceScopedLeases.length,
    unscoped: workerLeases.length - sourceScopedLeases.length,
    byWorkerType: countBy(summarized, function (lease) { return lease.workerType || 'unknown'; }),
    bySourceId: countBy(sourceScopedLeases.filter(function (lease) {
      return lease.scope && lease.scope.sourceId;
    }), function (lease) { return lease.scope.sourceId; }),
    bySourceKey: countBy(sourceScopedLeases.filter(function (lease) {
      return lease.scope && lease.scope.sourceKey;
    }), function (lease) { return lease.scope.sourceKey; }),
    activeBySourceId: countBy(sourceScopedLeases.filter(function (lease) {
      return !lease.expired && lease.scope && lease.scope.sourceId;
    }), function (lease) { return lease.scope.sourceId; }),
    activeBySourceKey: countBy(sourceScopedLeases.filter(function (lease) {
      return !lease.expired && lease.scope && lease.scope.sourceKey;
    }), function (lease) { return lease.scope.sourceKey; }),
    expiredBySourceId: countBy(sourceScopedLeases.filter(function (lease) {
      return lease.expired && lease.scope && lease.scope.sourceId;
    }), function (lease) { return lease.scope.sourceId; }),
    expiredBySourceKey: countBy(sourceScopedLeases.filter(function (lease) {
      return lease.expired && lease.scope && lease.scope.sourceKey;
    }), function (lease) { return lease.scope.sourceKey; }),
    latest: summarized[0],
    expiredLeases: expiredLeases.slice(0, 10),
    sourceScopedLeases: sourceScopedLeases.slice(0, 10)
  };
}

function summarizeWorkerLease(lease, now) {
  const parsed = parseWorkerLeaseKey(lease && lease.leaseKey);
  const workerType = lease && lease.workerType || parsed.workerType;
  return Object.assign({}, lease, {
    workerType,
    scope: parsed.scope,
    scoped: parsed.scoped,
    expired: isExpiredLease(lease, now)
  });
}

function countByStatus(tasks, status) {
  return tasks.filter(function (task) {
    return task.status === status;
  }).length;
}

function countBy(items, keySelector) {
  return (items || []).reduce(function (counts, item) {
    const key = keySelector(item);
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

function unique(items) {
  const seen = new Set();
  return (items || []).filter(function (item) {
    if (!item || seen.has(item)) return false;
    seen.add(item);
    return true;
  });
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
