'use strict';

const { parseWorkerLeaseKey } = require('../../domain/models/workerLeaseKey');
const { deriveWorkerRunSourceScope } = require('../../domain/models/workerRun');
const { evaluateSourceRunSchedule } = require('./evaluateSourceRunSchedule');
const { createApplicationError } = require('../errors/applicationError');
const { assertNotificationEventRepository } = require('../ports/notificationEventRepository');
const { assertSourceRepository } = require('../ports/sourceRepository');
const { assertTaskRepository } = require('../ports/taskRepository');
const { assertWorkerLeaseRepository } = require('../ports/workerLeaseRepository');
const { assertWorkerRunRepository } = require('../ports/workerRunRepository');

async function getSourceTypeOperationsDrilldown(options) {
  const safeOptions = options || {};
  const sourceType = normalize(safeOptions.sourceType);
  if (!sourceType) {
    throw createApplicationError('source_type_required', 'Source type operations drilldown requires sourceType.', {
      statusCode: 400
    });
  }

  const now = safeOptions.now || new Date().toISOString();
  const limit = safeOptions.limit || 50;
  const scanLimit = safeOptions.scanLimit || Math.max(limit * 5, 100);
  const sourceRepository = assertSourceRepository(safeOptions.sourceRepository);
  const taskRepository = assertTaskRepository(safeOptions.taskRepository);
  const notificationEventRepository = assertNotificationEventRepository(safeOptions.notificationEventRepository);
  const workerRunRepository = safeOptions.workerRunRepository
    ? assertWorkerRunRepository(safeOptions.workerRunRepository)
    : undefined;
  const workerLeaseRepository = safeOptions.workerLeaseRepository
    ? assertWorkerLeaseRepository(safeOptions.workerLeaseRepository)
    : undefined;

  const sources = await sourceRepository.listSources({
    sourceKey: safeOptions.sourceKey || safeOptions.forum,
    sourceType,
    enabled: safeOptions.enabled,
    limit
  });
  const scope = buildSourceTypeScope(sourceType, sources);
  const operationsReport = await resolveSourceTypeOperationsReport(safeOptions, sourceType);
  const operationsItem = findOperationsItem(operationsReport, sourceType);
  const taskWindow = await taskRepository.listTasks({ limit: scanLimit });
  const eventWindow = await notificationEventRepository.listEvents({ limit: scanLimit });
  const workerRuns = workerRunRepository ? await workerRunRepository.listWorkerRuns({ limit: scanLimit }) : [];
  const workerLeases = workerLeaseRepository ? await workerLeaseRepository.listWorkerLeases({ limit: scanLimit }) : [];

  const tasks = filterTasksBySourceType(taskWindow, scope).slice(0, limit);
  const events = filterEventsBySourceType(eventWindow, scope).slice(0, limit);
  const runs = filterWorkerRunsBySourceType(workerRuns, scope).slice(0, limit);
  const leases = filterWorkerLeasesBySourceType(workerLeases, scope, now).slice(0, limit);
  const health = {
    sources: summarizeSources(sources, now, safeOptions),
    tasks: summarizeTasks(tasks),
    events: summarizeEvents(events, now),
    workers: summarizeWorkers(runs, leases, now, safeOptions.workerStaleAfterMs),
    operations: summarizeOperationsItem(operationsItem)
  };
  const status = resolveStatus(health);

  return {
    generatedAt: now,
    status,
    sourceType,
    sourceKey: safeOptions.sourceKey || safeOptions.forum,
    sourceFound: sources.length > 0,
    scope,
    operations: operationsItem,
    health,
    nextActions: buildNextActions(sourceType, health, operationsItem),
    recent: {
      sources: sources.slice(0, 10).map(function (source) {
        return summarizeSource(source, now, safeOptions);
      }),
      tasks: tasks.slice(0, 10).map(summarizeTask),
      events: events.slice(0, 10),
      workerRuns: runs.slice(0, 10).map(summarizeWorkerRun),
      workerLeases: leases.slice(0, 10)
    },
    sourceTypeOperations: safeOptions.includeSourceTypeOperations === true ? operationsReport : undefined
  };
}

async function resolveSourceTypeOperationsReport(options, sourceType) {
  if (options.sourceTypeOperationsReport) return options.sourceTypeOperationsReport;
  if (typeof options.getSourceTypeOperationsReport === 'function') {
    return options.getSourceTypeOperationsReport({
      sourceType,
      sourceKey: options.sourceKey || options.forum,
      enabled: options.enabled,
      limit: options.sourceTypeLimit || options.limit || 100,
      now: options.now
    });
  }
  return undefined;
}

function findOperationsItem(report, sourceType) {
  return (report && report.sourceTypes || []).find(function (item) {
    return item.sourceType === sourceType;
  });
}

function buildSourceTypeScope(sourceType, sources) {
  return {
    sourceType,
    sourceIds: unique((sources || []).map(function (source) { return source.id; })),
    sourceKeys: unique((sources || []).map(function (source) { return source.sourceKey; }))
  };
}

function summarizeSources(sources, now, options) {
  const summaries = (sources || []).map(function (source) {
    return summarizeSource(source, now, options);
  });
  return {
    total: summaries.length,
    enabled: summaries.filter(function (source) { return source.enabled; }).length,
    disabled: summaries.filter(function (source) { return !source.enabled; }).length,
    due: summaries.filter(function (source) { return source.schedule.due; }).length,
    running: summaries.filter(function (source) { return source.runState.status === 'running'; }).length,
    failed: summaries.filter(function (source) { return source.runState.status === 'failed'; }).length,
    bySourceKey: countBy(summaries, function (source) { return source.sourceKey || 'unknown'; }),
    byRunStatus: countBy(summaries, function (source) { return source.runState.status || 'unknown'; }),
    byScheduleReason: countBy(summaries, function (source) { return source.schedule.reason || 'unknown'; })
  };
}

function summarizeSource(source, now, options) {
  const decision = evaluateSourceRunSchedule(source, now, {
    sourceRunStaleAfterMs: options.sourceRunStaleAfterMs,
    sourceFailureRetryBackoffMs: options.sourceFailureRetryBackoffMs,
    sourceFailureMaxRetryBackoffMs: options.sourceFailureMaxRetryBackoffMs
  });
  return {
    id: source.id,
    sourceKey: source.sourceKey,
    sourceType: source.sourceType,
    displayName: source.displayName,
    enabled: source.enabled !== false,
    runState: source.runState || {},
    schedule: {
      due: decision.due,
      reason: decision.reason,
      nextRunAt: decision.nextRunAt,
      retryAt: decision.retryAt,
      failureCount: decision.failureCount,
      backoffMs: decision.backoffMs
    }
  };
}

function summarizeTasks(tasks) {
  return {
    total: tasks.length,
    running: countByStatus(tasks, 'running'),
    queued: countByStatus(tasks, 'queued'),
    completed: countByStatus(tasks, 'completed'),
    failed: countByStatus(tasks, 'failed'),
    byType: countBy(tasks, function (task) { return task.type || 'unknown'; }),
    latest: summarizeTask(tasks[0]),
    latestFailure: summarizeTask(tasks.find(function (task) { return task.status === 'failed'; }))
  };
}

function summarizeTask(task) {
  if (!task) return undefined;
  const scope = taskScope(task);
  return {
    id: task.id,
    type: task.type,
    status: task.status,
    sourceId: scope.sourceId,
    sourceKey: scope.sourceKey,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    finishedAt: task.finishedAt,
    error: task.error ? { message: task.error.message } : undefined
  };
}

function summarizeEvents(events, now) {
  const open = (events || []).filter(function (event) { return !event.acknowledgedAt; });
  const pending = open.filter(function (event) { return event.deliveryStatus === 'pending'; });
  const failed = open.filter(function (event) { return event.deliveryStatus === 'failed'; });
  return {
    total: events.length,
    unacknowledged: open.length,
    pending: pending.length,
    failed: failed.length,
    dueForDelivery: pending.concat(failed).filter(function (event) { return isEventDue(event, now); }).length,
    byType: countBy(events, function (event) { return event.type || 'unknown'; }),
    latest: events[0]
  };
}

function summarizeWorkers(workerRuns, workerLeases, now, staleAfterMs) {
  const staleWindowMs = staleAfterMs || 5 * 60 * 1000;
  const runs = (workerRuns || []).map(summarizeWorkerRun);
  const running = runs.filter(function (run) { return run.status === 'running'; });
  const staleRuns = running.filter(function (run) { return isStaleWorkerRun(run, now, staleWindowMs); });
  const expiredLeases = (workerLeases || []).filter(function (lease) { return lease.expired; });
  return {
    runs: {
      total: runs.length,
      running: running.length,
      stale: staleRuns.length,
      failed: countByStatus(runs, 'failed'),
      byWorkerType: countBy(runs, function (run) { return run.workerType || 'unknown'; }),
      latest: runs[0],
      staleRuns: staleRuns.slice(0, 10)
    },
    leases: {
      total: workerLeases.length,
      active: workerLeases.length - expiredLeases.length,
      expired: expiredLeases.length,
      byWorkerType: countBy(workerLeases, function (lease) { return lease.workerType || 'unknown'; }),
      latest: workerLeases[0],
      expiredLeases: expiredLeases.slice(0, 10)
    }
  };
}

function summarizeWorkerRun(run) {
  if (!run) return undefined;
  const scope = deriveWorkerRunSourceScope(run);
  return Object.assign({}, run, {
    scope,
    scoped: Boolean(scope.sourceId || scope.sourceKey)
  });
}

function summarizeOperationsItem(item) {
  if (!item) {
    return {
      found: false,
      status: 'unknown'
    };
  }
  return {
    found: true,
    status: item.status,
    readiness: item.readiness,
    schedule: item.schedule,
    lifecycle: item.lifecycle,
    attention: item.attention,
    recommendedCommands: item.recommendedCommands || [],
    topAttention: item.topAttention || []
  };
}

function resolveStatus(health) {
  if (health.workers.runs.stale > 0) return 'fail';
  if (health.operations.status === 'fail') return 'fail';
  if (health.operations.status === 'warn' ||
    health.sources.failed > 0 ||
    health.tasks.failed > 0 ||
    health.events.failed > 0 ||
    health.events.dueForDelivery > 0 ||
    health.workers.leases.expired > 0) return 'warn';
  return 'ok';
}

function buildNextActions(sourceType, health, operationsItem) {
  const commands = sourceTypeCommands(sourceType);
  const actions = [];
  if (health.sources.total === 0) {
    actions.push(action('sourceType.onboarding', 'warning', 'Register or repair sources for this source type before scheduling work.', commands.onboarding));
  }
  if (operationsItem && operationsItem.status && operationsItem.status !== 'ok') {
    actions.push(action('sourceType.operations', operationsItem.status === 'fail' ? 'critical' : 'warning', 'Inspect the source type operations matrix and create alerts for active connector-family pressure.', commands.operationsEvents));
  }
  if (health.sources.due > 0) {
    actions.push(action('sources.due', 'info', 'Run due source work for this connector family or inspect source scheduling.', commands.schedule));
  }
  if (health.sources.failed > 0 || health.tasks.failed > 0) {
    actions.push(action('sources.failed', 'warning', 'Inspect failed source runs and reset individual sources only after operator review.', commands.lifecycle));
  }
  if (health.events.failed > 0 || health.events.dueForDelivery > 0) {
    actions.push(action('events.delivery', 'warning', 'Dispatch or acknowledge due notification events for this connector family.', commands.events));
  }
  if (health.workers.runs.stale > 0 || health.workers.leases.expired > 0) {
    actions.push(action('workers.sourceType', health.workers.runs.stale > 0 ? 'critical' : 'warning', 'Inspect source-scoped workers serving this connector family.', commands.workerTopology));
  }
  return actions;
}

function sourceTypeCommands(sourceType) {
  const suffix = ' --source-type ' + sourceType;
  return {
    onboarding: 'node src/presentation/cli/threadtrace.js source-onboarding-preflight' + suffix,
    operations: 'node src/presentation/cli/threadtrace.js source-type-operations-report' + suffix,
    operationsEvents: 'node src/presentation/cli/threadtrace.js synthesize-source-type-operations-events' + suffix,
    schedule: 'node src/presentation/cli/threadtrace.js source-schedule-report' + suffix,
    lifecycle: 'node src/presentation/cli/threadtrace.js source-lifecycle-report' + suffix,
    events: 'node src/presentation/cli/threadtrace.js list-events --type source-type-operations',
    workerTopology: 'node src/presentation/cli/threadtrace.js worker-topology-plan'
  };
}

function action(key, severity, summary, recommendedCommand) {
  return {
    key,
    severity,
    summary,
    recommendedCommand
  };
}

function filterTasksBySourceType(tasks, scope) {
  return (tasks || []).filter(function (task) {
    return matchesSourceTypeScope(taskScope(task), scope);
  }).sort(compareUpdatedDesc);
}

function filterEventsBySourceType(events, scope) {
  return (events || []).filter(function (event) {
    if (event && event.type === 'source-type-operations') {
      return event.payload && event.payload.sourceType === scope.sourceType;
    }
    return matchesSourceTypeScope(event || {}, scope);
  }).sort(compareCreatedDesc);
}

function filterWorkerRunsBySourceType(workerRuns, scope) {
  return (workerRuns || []).filter(function (run) {
    return matchesSourceTypeScope(deriveWorkerRunSourceScope(run), scope);
  }).sort(compareStartedDesc);
}

function filterWorkerLeasesBySourceType(workerLeases, scope, now) {
  return (workerLeases || []).map(function (lease) {
    const parsed = parseWorkerLeaseKey(lease && lease.leaseKey);
    return Object.assign({}, lease, {
      scope: parsed.scope,
      scoped: parsed.scoped,
      expired: isExpiredLease(lease, now)
    });
  }).filter(function (lease) {
    return matchesSourceTypeScope(lease.scope, scope);
  }).sort(compareLeaseUpdatedDesc);
}

function matchesSourceTypeScope(value, scope) {
  const safeValue = value || {};
  if (safeValue.sourceId && scope.sourceIds.includes(safeValue.sourceId)) return true;
  if (safeValue.sourceKey && scope.sourceKeys.includes(safeValue.sourceKey)) return true;
  return false;
}

function taskScope(task) {
  const input = task && task.input || {};
  const output = task && task.output || {};
  const source = input.source || output.source || output.sourceAfter || output.sourceBefore || {};
  return {
    sourceId: input.sourceId || output.sourceId || source.id || source.sourceId,
    sourceKey: input.sourceKey || input.forum || output.sourceKey || output.forum || source.sourceKey || source.forum
  };
}

function countByStatus(items, status) {
  return (items || []).filter(function (item) { return item.status === status; }).length;
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

function isStaleWorkerRun(run, now, staleAfterMs) {
  const heartbeatTime = Date.parse(run.heartbeatAt || run.updatedAt || run.startedAt);
  const nowTime = Date.parse(now);
  if (Number.isNaN(heartbeatTime) || Number.isNaN(nowTime)) return false;
  return nowTime - heartbeatTime > staleAfterMs;
}

function isExpiredLease(lease, now) {
  const expiresTime = Date.parse(lease && lease.expiresAt);
  const nowTime = Date.parse(now);
  if (Number.isNaN(expiresTime) || Number.isNaN(nowTime)) return true;
  return expiresTime <= nowTime;
}

function compareUpdatedDesc(left, right) {
  return String(right.updatedAt || right.createdAt || '').localeCompare(String(left.updatedAt || left.createdAt || ''));
}

function compareCreatedDesc(left, right) {
  return String(right.createdAt || '').localeCompare(String(left.createdAt || ''));
}

function compareStartedDesc(left, right) {
  return String(right.startedAt || right.updatedAt || '').localeCompare(String(left.startedAt || left.updatedAt || ''));
}

function compareLeaseUpdatedDesc(left, right) {
  return String(right.updatedAt || '').localeCompare(String(left.updatedAt || ''));
}

function normalize(value) {
  const text = String(value || '').trim();
  return text || undefined;
}

module.exports = {
  getSourceTypeOperationsDrilldown
};
