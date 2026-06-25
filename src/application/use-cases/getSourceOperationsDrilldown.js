'use strict';

const { parseWorkerLeaseKey } = require('../../domain/models/workerLeaseKey');
const { deriveWorkerRunSourceScope } = require('../../domain/models/workerRun');
const { evaluateTrackedSourceSchedule } = require('../../domain/scheduling/trackedSourceSchedule');
const { assertNotificationEventRepository } = require('../ports/notificationEventRepository');
const { assertSourceRepository } = require('../ports/sourceRepository');
const { assertTaskRepository } = require('../ports/taskRepository');
const { assertWorkerLeaseRepository } = require('../ports/workerLeaseRepository');
const { assertWorkerRunRepository } = require('../ports/workerRunRepository');

async function getSourceOperationsDrilldown(options) {
  const safeOptions = options || {};
  const now = safeOptions.now || new Date().toISOString();
  const limit = safeOptions.limit || 50;
  const sourceRepository = assertSourceRepository(safeOptions.sourceRepository);
  const taskRepository = assertTaskRepository(safeOptions.taskRepository);
  const notificationEventRepository = assertNotificationEventRepository(safeOptions.notificationEventRepository);
  const workerRunRepository = safeOptions.workerRunRepository
    ? assertWorkerRunRepository(safeOptions.workerRunRepository)
    : undefined;
  const workerLeaseRepository = safeOptions.workerLeaseRepository
    ? assertWorkerLeaseRepository(safeOptions.workerLeaseRepository)
    : undefined;

  const sourceResolution = await resolveSourceScope(sourceRepository, safeOptions, limit);
  const scope = sourceResolution.scope;
  const taskScanLimit = safeOptions.taskScanLimit || Math.max(limit * 5, 100);
  const tasks = filterTasksByScope(await taskRepository.listTasks({ limit: taskScanLimit }), scope).slice(0, limit);
  const events = await listScopedEvents(notificationEventRepository, scope, limit, now);
  const workerRuns = workerRunRepository ? await listScopedWorkerRuns(workerRunRepository, scope, limit) : [];
  const workerLeases = workerLeaseRepository
    ? filterLeasesByScope(await workerLeaseRepository.listWorkerLeases({ limit: safeOptions.leaseScanLimit || Math.max(limit * 5, 100) }), scope, now).slice(0, limit)
    : [];
  const authorReviewQueue = safeOptions.authorReviewQueue || {};
  const reviewActions = summarizeReviewActions(safeOptions.reviewActionAuditOverview, safeOptions.reviewActionExecutions);
  const notificationEventActions = summarizeActionExecutions(safeOptions.notificationEventActionExecutions);
  const attention = summarizeSourceAttention(safeOptions.sourceAttentionReport, scope);
  const summaries = {
    source: summarizeSource(sourceResolution.source, now),
    tasks: summarizeTasks(tasks),
    events: summarizeEvents(events.all, now),
    workers: summarizeWorkers(workerRuns, workerLeases, now, safeOptions.workerStaleAfterMs),
    authorReviewQueue: summarizeAuthorReviewQueue(authorReviewQueue),
    reviewActions,
    notificationEventActions
  };
  const status = resolveStatus(sourceResolution, summaries);

  return {
    generatedAt: now,
    status,
    scope,
    source: sourceResolution.source,
    sourceCandidates: sourceResolution.candidates,
    sourceFound: Boolean(sourceResolution.source),
    health: summaries,
    attention,
    nextActions: buildNextActions(sourceResolution, summaries, attention),
    recent: {
      tasks: tasks.slice(0, 10).map(summarizeTask),
      events: events.all.slice(0, 10),
      workerRuns: workerRuns.slice(0, 10).map(summarizeWorkerRun),
      workerLeases: workerLeases.slice(0, 10),
      authorReviewQueue: (authorReviewQueue.items || []).slice(0, 10),
      reviewActionExecutions: (safeOptions.reviewActionExecutions && safeOptions.reviewActionExecutions.executions || []).slice(0, 10),
      notificationEventActionExecutions: (safeOptions.notificationEventActionExecutions && safeOptions.notificationEventActionExecutions.executions || []).slice(0, 10)
    }
  };
}

async function resolveSourceScope(sourceRepository, options, limit) {
  const sourceId = normalize(options.sourceId);
  const sourceKey = normalize(options.sourceKey || options.forum);
  let source;
  let candidates = [];
  if (sourceId) {
    source = await sourceRepository.findSource(sourceId);
    if (source) candidates = [source];
  }
  if (!source && sourceKey) {
    candidates = await sourceRepository.listSources({ sourceKey, limit });
    source = candidates[0];
  }
  const scope = {
    sourceId: sourceId || source && source.id,
    sourceKey: sourceKey || source && source.sourceKey
  };
  return {
    source,
    candidates,
    scope: removeEmpty(scope)
  };
}

async function listScopedEvents(repository, scope, limit, now) {
  const all = await listEventWindow(repository, scope, { limit });
  const pending = await listEventWindow(repository, scope, {
    deliveryStatus: 'pending',
    acknowledged: false,
    limit
  });
  const failed = await listEventWindow(repository, scope, {
    deliveryStatus: 'failed',
    acknowledged: false,
    limit
  });
  const unacknowledged = await listEventWindow(repository, scope, {
    acknowledged: false,
    limit
  });
  return {
    all: mergeById(all.concat(pending, failed, unacknowledged)).filter(function (event) {
      return matchesScope(event, scope);
    }).sort(compareCreatedDesc).slice(0, limit),
    pending,
    failed,
    unacknowledged,
    now
  };
}

async function listEventWindow(repository, scope, query) {
  const events = [];
  if (scope.sourceId) {
    events.push.apply(events, await repository.listEvents(Object.assign({}, query, { sourceId: scope.sourceId })));
  }
  if (scope.sourceKey) {
    events.push.apply(events, await repository.listEvents(Object.assign({}, query, { sourceKey: scope.sourceKey })));
  }
  if (!scope.sourceId && !scope.sourceKey) {
    events.push.apply(events, await repository.listEvents(query));
  }
  return mergeById(events)
    .filter(function (event) { return matchesScope(event, scope); })
    .sort(compareCreatedDesc)
    .slice(0, query.limit || events.length);
}

async function listScopedWorkerRuns(repository, scope, limit) {
  const runs = [];
  if (scope.sourceId) {
    runs.push.apply(runs, await repository.listWorkerRuns({ sourceId: scope.sourceId, limit }));
  }
  if (scope.sourceKey) {
    runs.push.apply(runs, await repository.listWorkerRuns({ sourceKey: scope.sourceKey, limit }));
  }
  if (!scope.sourceId && !scope.sourceKey) {
    runs.push.apply(runs, await repository.listWorkerRuns({ limit }));
  }
  return mergeById(runs)
    .filter(function (run) { return matchesScope(deriveWorkerRunSourceScope(run), scope); })
    .sort(compareStartedDesc)
    .slice(0, limit);
}

function filterTasksByScope(tasks, scope) {
  return (tasks || []).filter(function (task) {
    return matchesScope(taskScope(task), scope);
  });
}

function filterLeasesByScope(leases, scope, now) {
  return (leases || []).map(function (lease) {
    const parsed = parseWorkerLeaseKey(lease && lease.leaseKey);
    return Object.assign({}, lease, {
      scope: parsed.scope,
      scoped: parsed.scoped,
      expired: isExpiredLease(lease, now)
    });
  }).filter(function (lease) {
    return matchesScope(lease.scope, scope);
  });
}

function summarizeSource(source, now) {
  if (!source) {
    return {
      status: 'missing',
      schedule: { due: false, reason: 'source-not-found' }
    };
  }
  const decision = evaluateTrackedSourceSchedule(source, now);
  return {
    status: source.enabled === false ? 'disabled' : source.runState && source.runState.status || 'unknown',
    enabled: source.enabled !== false,
    sourceType: source.sourceType,
    displayName: source.displayName,
    runState: source.runState || {},
    schedule: decision
  };
}

function summarizeTasks(tasks) {
  return {
    total: tasks.length,
    running: countByStatus(tasks, 'running'),
    queued: countByStatus(tasks, 'queued'),
    completed: countByStatus(tasks, 'completed'),
    failed: countByStatus(tasks, 'failed'),
    latest: summarizeTask(tasks[0]),
    latestFailure: summarizeTask(tasks.find(function (task) { return task.status === 'failed'; }))
  };
}

function summarizeTask(task) {
  if (!task) return undefined;
  return {
    id: task.id,
    type: task.type,
    status: task.status,
    sourceId: taskScope(task).sourceId,
    sourceKey: taskScope(task).sourceKey,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    startedAt: task.startedAt,
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
    latest: events[0]
  };
}

function summarizeWorkers(workerRuns, workerLeases, now, staleAfterMs) {
  const staleWindowMs = staleAfterMs || 5 * 60 * 1000;
  const runs = workerRuns.map(summarizeWorkerRun);
  const running = runs.filter(function (run) { return run.status === 'running'; });
  const stale = running.filter(function (run) { return isStaleWorkerRun(run, now, staleWindowMs); });
  const expiredLeases = workerLeases.filter(function (lease) { return lease.expired; });
  return {
    runs: {
      total: runs.length,
      running: running.length,
      stale: stale.length,
      completed: countByStatus(runs, 'completed'),
      failed: countByStatus(runs, 'failed'),
      byWorkerType: countBy(runs, function (run) { return run.workerType || 'unknown'; }),
      latest: runs[0],
      staleRuns: stale.slice(0, 10)
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

function summarizeAuthorReviewQueue(result) {
  const items = result && Array.isArray(result.items) ? result.items : [];
  const summary = result && result.summary || {};
  return {
    itemCount: result && result.itemCount !== undefined ? result.itemCount : items.length,
    openCount: summary.openCount !== undefined ? summary.openCount : items.filter(function (item) { return item.status === 'open'; }).length,
    highPriorityOpenCount: items.filter(function (item) { return item.status === 'open' && item.priority === 'high'; }).length,
    byStatus: summary.byStatus || countBy(items, function (item) { return item.status || 'unknown'; }),
    byPriority: summary.byPriority || countBy(items, function (item) { return item.priority || 'unknown'; }),
    byType: summary.byType || countBy(items, function (item) { return item.type || 'unknown'; })
  };
}

function summarizeReviewActions(auditOverview, executionsResult) {
  return {
    auditCount: auditOverview && auditOverview.count || 0,
    taskCount: auditOverview && auditOverview.taskCount || 0,
    plannedClosureCount: auditOverview && auditOverview.plannedClosureCount || 0,
    plannedMergeCandidateCount: auditOverview && auditOverview.plannedMergeCandidateCount || 0,
    executions: summarizeActionExecutions(executionsResult)
  };
}

function summarizeActionExecutions(executionsResult) {
  const executions = executionsResult && Array.isArray(executionsResult.executions) ? executionsResult.executions : [];
  const staleRunning = executionsResult && Array.isArray(executionsResult.staleRunningExecutions)
    ? executionsResult.staleRunningExecutions
    : executions.filter(function (execution) { return execution.staleRunning; });
  return {
    count: executionsResult && executionsResult.count !== undefined ? executionsResult.count : executions.length,
    running: executions.filter(function (execution) { return execution.status === 'running'; }).length,
    completed: executions.filter(function (execution) { return execution.status === 'completed'; }).length,
    failed: executions.filter(function (execution) { return execution.status === 'failed'; }).length,
    staleRunning: executionsResult && executionsResult.staleRunningCount !== undefined ? executionsResult.staleRunningCount : staleRunning.length
  };
}

function summarizeSourceAttention(sourceAttentionReport, scope) {
  if (!sourceAttentionReport) return undefined;
  const item = findSourceAttentionItem(sourceAttentionReport.sources || [], scope);
  if (!item) {
    return {
      status: sourceAttentionReport.status,
      found: false,
      reportSummary: summarizeAttentionReport(sourceAttentionReport)
    };
  }
  return {
    status: sourceAttentionReport.status,
    found: true,
    key: item.key,
    attentionRank: item.attentionRank,
    priorityScore: item.priorityScore,
    severity: item.severity,
    signalCount: item.signalCount,
    runnable: item.runnable,
    recommendedNextAction: item.recommendedNextAction || item.nextAction,
    recommendedCommand: item.recommendedCommand || firstText(item.commands),
    signals: (item.signals || []).slice(0, 5),
    commands: (item.commands || []).slice(0, 5),
    reportSummary: summarizeAttentionReport(sourceAttentionReport)
  };
}

function findSourceAttentionItem(items, scope) {
  if (!scope || (!scope.sourceId && !scope.sourceKey)) return undefined;
  return (items || []).find(function (item) {
    const source = item.source || {};
    return scope.sourceId && source.id === scope.sourceId;
  }) || (items || []).find(function (item) {
    const source = item.source || {};
    return scope.sourceKey && source.sourceKey === scope.sourceKey;
  });
}

function summarizeAttentionReport(sourceAttentionReport) {
  const summary = sourceAttentionReport.summary || {};
  return {
    total: summary.total || 0,
    critical: summary.critical || 0,
    warning: summary.warning || 0,
    actionable: summary.actionable || 0,
    highestPriorityScore: summary.highestPriorityScore || 0
  };
}

function resolveStatus(sourceResolution, summaries) {
  if (!sourceResolution.source) return 'warn';
  if (summaries.workers.runs.stale > 0 ||
    summaries.reviewActions.executions.staleRunning > 0 ||
    summaries.notificationEventActions.staleRunning > 0) return 'fail';
  if (summaries.source.status === 'failed' || summaries.source.status === 'disabled') return 'warn';
  if (summaries.tasks.failed > 0 || summaries.events.failed > 0 || summaries.workers.leases.expired > 0 || summaries.authorReviewQueue.highPriorityOpenCount > 0) return 'warn';
  return 'ok';
}

function buildNextActions(sourceResolution, summaries, attention) {
  const scope = sourceResolution.scope;
  const commands = scopedCommands(scope);
  const actions = [];
  if (!sourceResolution.source) {
    actions.push(action('source.resolve', 'warning', 'Resolve the source registration before running source-scoped operations.', commands.sourceDiagnostics));
  }
  if (attention && attention.found && (attention.recommendedCommand || attention.recommendedNextAction)) {
    actions.push(action(
      'sourceAttention.priority',
      normalizeActionSeverity(attention.severity),
      'Handle source attention #' + (attention.attentionRank || '?') + ' with priority ' + (attention.priorityScore || 0) + ': ' + (attention.recommendedNextAction || 'review-source-attention') + '.',
      attention.recommendedCommand || commands.operationsOverview
    ));
  }
  if (summaries.workers.runs.stale > 0) {
    actions.push(action('workers.stale', 'critical', 'Inspect stale source-scoped worker runs and restart the owning worker if needed.', commands.workerTopology));
  }
  if (summaries.workers.leases.expired > 0) {
    actions.push(action('workers.expiredLease', 'warning', 'Inspect expired worker leases for this source shard.', commands.operationsOverview));
  }
  if (summaries.tasks.failed > 0) {
    actions.push(action('tasks.failed', 'warning', 'Inspect recent failed tasks for this source.', commands.traceContext));
  }
  if (summaries.events.failed > 0 || summaries.events.dueForDelivery > 0) {
    actions.push(action('events.delivery', 'warning', 'Dispatch or acknowledge due notification events scoped to this source.', commands.dispatchEvents));
  }
  if (summaries.reviewActions.executions.staleRunning > 0 || summaries.reviewActions.executions.failed > 0) {
    actions.push(action('reviewActions.executionLedger', summaries.reviewActions.executions.staleRunning > 0 ? 'critical' : 'warning', 'Inspect review action execution ledger records for this source.', commands.reviewActionExecutions));
  }
  if (summaries.notificationEventActions.staleRunning > 0 || summaries.notificationEventActions.failed > 0) {
    actions.push(action('notificationEventActions.executionLedger', summaries.notificationEventActions.staleRunning > 0 ? 'critical' : 'warning', 'Inspect notification event action execution ledger records for this source.', commands.notificationEventActionExecutions));
  }
  if (summaries.authorReviewQueue.highPriorityOpenCount > 0) {
    actions.push(action('authorReviewQueue.highPriority', 'warning', 'Review high-priority author intelligence queue items for this source.', commands.authorQueue));
  }
  return actions;
}

function normalizeActionSeverity(severity) {
  if (severity === 'critical') return 'critical';
  if (severity === 'warning' || severity === 'warn') return 'warning';
  return 'info';
}

function scopedCommands(scope) {
  const args = [
    scope.sourceId ? '--source-id ' + scope.sourceId : undefined,
    scope.sourceKey ? '--source-key ' + scope.sourceKey : undefined
  ].filter(Boolean).join(' ');
  const suffix = args ? ' ' + args : '';
  return {
    sourceDiagnostics: 'node src/presentation/cli/threadtrace.js source-diagnostics' + suffix,
    operationsOverview: 'node src/presentation/cli/threadtrace.js operations-overview' + suffix,
    workerTopology: 'node src/presentation/cli/threadtrace.js worker-topology-plan' + suffix,
    traceContext: 'node src/presentation/cli/threadtrace.js trace-context' + suffix,
    dispatchEvents: 'node src/presentation/cli/threadtrace.js dispatch-events' + suffix,
    reviewActionExecutions: 'node src/presentation/cli/threadtrace.js review-action-executions' + suffix,
    notificationEventActionExecutions: 'node src/presentation/cli/threadtrace.js event-action-executions' + suffix,
    authorQueue: 'node src/presentation/cli/threadtrace.js author-review-queue' + suffix
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

function firstText(items) {
  return (items || []).find(function (item) {
    return typeof item === 'string' && item.length > 0;
  });
}

function taskScope(task) {
  const input = task && task.input || {};
  const output = task && task.output || {};
  const source = output.source || input.source || {};
  return removeEmpty({
    sourceId: input.sourceId || output.sourceId || source.id || source.sourceId,
    sourceKey: input.sourceKey || input.forum || output.sourceKey || output.forum || source.sourceKey || source.forum
  });
}

function matchesScope(value, scope) {
  const safeValue = value || {};
  if (scope.sourceId && safeValue.sourceId === scope.sourceId) return true;
  if (scope.sourceKey && safeValue.sourceKey === scope.sourceKey) return true;
  return !scope.sourceId && !scope.sourceKey;
}

function mergeById(items) {
  const seen = new Set();
  return (items || []).filter(function (item) {
    const id = item && (item.id || item.leaseKey);
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
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

function compareCreatedDesc(a, b) {
  return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
}

function compareStartedDesc(a, b) {
  return String(b.startedAt || '').localeCompare(String(a.startedAt || ''));
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

function removeEmpty(value) {
  return Object.keys(value || {}).reduce(function (result, key) {
    const normalized = normalize(value[key]);
    if (normalized) result[key] = normalized;
    return result;
  }, {});
}

function normalize(value) {
  const text = String(value || '').trim();
  return text || undefined;
}

module.exports = {
  getSourceOperationsDrilldown
};
