'use strict';

const { assertSourceRepository } = require('../ports/sourceRepository');
const { assertTaskRepository } = require('../ports/taskRepository');
const { buildSourceFailureRetryPlan } = require('../../domain/scheduling/trackedSourceSchedule');
const { buildDisableGuard, resolveSourceRunStaleAfterMs } = require('./setTrackedSourceEnabled');

const LIFECYCLE_TASK_TYPES = ['disable-tracked-source', 'enable-tracked-source', 'reset-tracked-source-failure'];

async function getSourceLifecycleReport(options) {
  const safeOptions = options || {};
  const now = safeOptions.now || new Date().toISOString();
  const limit = safeOptions.limit || 100;
  const taskLimit = safeOptions.taskLimit || limit;
  const sourceRepository = assertSourceRepository(safeOptions.sourceRepository);
  const taskRepository = assertTaskRepository(safeOptions.taskRepository);
  const sourceRunStaleAfterMs = resolveSourceRunStaleAfterMs(safeOptions);
  const sourceFailureRetryOptions = {
    sourceFailureRetryBackoffMs: safeOptions.sourceFailureRetryBackoffMs,
    sourceFailureMaxRetryBackoffMs: safeOptions.sourceFailureMaxRetryBackoffMs
  };

  const sources = await sourceRepository.listSources({
    sourceKey: safeOptions.sourceKey,
    enabled: safeOptions.enabled,
    limit
  });
  const lifecycleTasks = (await taskRepository.listTasks({ limit: taskLimit }))
    .filter(function (task) {
      return LIFECYCLE_TASK_TYPES.includes(task.type);
    })
    .sort(compareTaskNewestFirst);
  const sourceReports = sources.map(function (source) {
    return summarizeSourceLifecycle(source, lifecycleTasks, {
      now,
      sourceRunStaleAfterMs,
      sourceFailureRetryOptions
    });
  });

  const blocked = sourceReports.filter(function (source) {
    return source.disableGuard.blocked;
  });
  const retryWaiting = sourceReports.filter(function (source) {
    return source.failureRetry.active && !source.failureRetry.elapsed;
  });

  return {
    generatedAt: now,
    status: blocked.length > 0 || retryWaiting.length > 0 ? 'warn' : 'ok',
    windowLimit: limit,
    taskWindowLimit: taskLimit,
    sourceRunStaleAfterMs,
    summary: summarizeLifecycleSources(sourceReports),
    blockedDisables: blocked.map(function (source) {
      return {
        sourceId: source.id,
        displayName: source.displayName,
        lastStartedAt: source.runState.lastStartedAt,
        staleAfterMs: source.disableGuard.staleAfterMs,
        nextAction: source.nextAction
      };
    }),
    sources: sourceReports,
    recentLifecycleTasks: lifecycleTasks.slice(0, Math.min(taskLimit, 20)).map(summarizeLifecycleTask)
  };
}

function summarizeSourceLifecycle(source, lifecycleTasks, options) {
  const disableGuard = buildDisableGuard(source, {
    enabled: false,
    now: options.now,
    sourceRunStaleAfterMs: options.sourceRunStaleAfterMs
  });
  const failureRetry = buildSourceFailureRetryPlan(source, options.now, options.sourceFailureRetryOptions);
  const latestLifecycleTask = lifecycleTasks.find(function (task) {
    return taskSourceId(task) === source.id;
  });
  return {
    id: source.id,
    sourceKey: source.sourceKey,
    sourceType: source.sourceType,
    displayName: source.displayName,
    enabled: source.enabled !== false,
    runState: summarizeRunState(source.runState),
    disableGuard: {
      canDisable: !disableGuard.blocked,
      blocked: disableGuard.blocked,
      running: disableGuard.running,
      stale: disableGuard.stale,
      staleAfterMs: disableGuard.staleAfterMs,
      lastStartedAt: disableGuard.lastStartedAt
    },
    failureRetry: summarizeFailureRetry(failureRetry),
    latestLifecycleTask: summarizeLifecycleTask(latestLifecycleTask),
    nextAction: getNextLifecycleAction(source, disableGuard, failureRetry)
  };
}

function summarizeLifecycleSources(sources) {
  return {
    total: sources.length,
    enabled: sources.filter(function (source) { return source.enabled; }).length,
    disabled: sources.filter(function (source) { return !source.enabled; }).length,
    running: sources.filter(function (source) { return source.runState.status === 'running'; }).length,
    staleRunning: sources.filter(function (source) {
      return source.disableGuard.running && source.disableGuard.stale;
    }).length,
    failureRetryWaiting: sources.filter(function (source) {
      return source.failureRetry.active && !source.failureRetry.elapsed;
    }).length,
    disableBlocked: sources.filter(function (source) {
      return source.disableGuard.blocked;
    }).length
  };
}

function summarizeRunState(runState) {
  const safeRunState = runState || {};
  return {
    status: safeRunState.status || 'unknown',
    lastStartedAt: safeRunState.lastStartedAt,
    lastFinishedAt: safeRunState.lastFinishedAt,
    lastTaskId: safeRunState.lastTaskId,
    failureCount: safeRunState.failureCount || 0,
    lastError: safeRunState.lastError
  };
}

function summarizeLifecycleTask(task) {
  if (!task) return undefined;
  return {
    id: task.id,
    type: task.type,
    status: task.status,
    sourceId: taskSourceId(task),
    execute: task.input && task.input.execute,
    dryRun: task.input && task.input.dryRun,
    force: task.input && task.input.force,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    finishedAt: task.finishedAt,
    error: task.error ? {
      message: task.error.message
    } : undefined
  };
}

function summarizeFailureRetry(failureRetry) {
  const safeFailureRetry = failureRetry || {};
  return {
    active: safeFailureRetry.active === true,
    elapsed: safeFailureRetry.elapsed !== false,
    retryAt: safeFailureRetry.retryAt,
    failureCount: safeFailureRetry.failureCount,
    backoffMs: safeFailureRetry.backoffMs
  };
}

function getNextLifecycleAction(source, disableGuard, failureRetry) {
  if (source.enabled === false) return 'enable-source';
  if (disableGuard.blocked) return 'wait-for-run-or-force-disable';
  if (failureRetry && failureRetry.active && !failureRetry.elapsed) return 'wait-for-failure-backoff';
  if (failureRetry && failureRetry.active && failureRetry.elapsed) return 'run-due-source-task';
  if (disableGuard.running && disableGuard.stale) return 'disable-or-recover-stale-run';
  return 'disable-source';
}

function taskSourceId(task) {
  if (!task) return undefined;
  return task.input && task.input.sourceId
    || task.output && task.output.sourceAfter && task.output.sourceAfter.id
    || task.output && task.output.sourceBefore && task.output.sourceBefore.id;
}

function compareTaskNewestFirst(left, right) {
  return String(right.updatedAt || right.createdAt || '').localeCompare(String(left.updatedAt || left.createdAt || ''));
}

module.exports = {
  getSourceLifecycleReport,
  summarizeSourceLifecycle,
  summarizeLifecycleTask
};
