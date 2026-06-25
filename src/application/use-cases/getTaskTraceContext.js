'use strict';

const { createApplicationError } = require('../errors/applicationError');
const { assertTaskRepository } = require('../ports/taskRepository');

async function getTaskTraceContext(options) {
  const safeOptions = options || {};
  const taskRepository = assertTaskRepository(safeOptions.taskRepository);
  const query = await resolveTraceQuery(taskRepository, safeOptions);
  if (!query.taskId && !query.requestId && !query.traceId && !query.idempotencyKey) {
    throw createApplicationError('trace_context_query_required', 'Trace context requires taskId, requestId, traceId, or idempotencyKey.', {
      statusCode: 400
    });
  }

  const tasks = await findTraceTasks(taskRepository, query, safeOptions);

  return {
    generatedAt: safeOptions.now || new Date().toISOString(),
    query: publicTraceQuery(query),
    taskCount: tasks.length,
    summary: summarizeTasks(tasks, query),
    tasks: tasks.map(toTraceTask)
  };
}

function traceQuery(options) {
  const safeOptions = options || {};
  return {
    taskId: safeOptions.taskId,
    requestId: safeOptions.requestId,
    traceId: safeOptions.traceId,
    idempotencyKey: safeOptions.idempotencyKey
  };
}

function publicTraceQuery(query) {
  return {
    taskId: query.taskId,
    requestId: query.requestId,
    traceId: query.traceId,
    idempotencyKey: query.idempotencyKey
  };
}

async function resolveTraceQuery(taskRepository, options) {
  const query = traceQuery(options);
  if (!query.taskId) return query;

  const anchorTask = await taskRepository.findTask(query.taskId);
  if (!anchorTask) {
    throw createApplicationError('trace_context_task_not_found', 'Trace context task was not found.', {
      statusCode: 404,
      details: {
        taskId: query.taskId
      }
    });
  }

  const trace = taskTraceMetadata(anchorTask);
  return Object.assign({}, query, {
    requestId: query.requestId || trace.requestId,
    traceId: query.traceId || trace.traceId,
    idempotencyKey: query.idempotencyKey || trace.idempotencyKey,
    anchorTask
  });
}

async function findTraceTasks(taskRepository, query, options) {
  const hasTraceQuery = Boolean(query.requestId || query.traceId || query.idempotencyKey);
  const listQuery = {
    requestId: query.requestId,
    traceId: query.traceId,
    idempotencyKey: query.idempotencyKey,
    status: options.status,
    type: options.type,
    limit: options.limit || 50
  };
  if (!hasTraceQuery) {
    return query.anchorTask && matchesTaskFilters(query.anchorTask, options) ? [query.anchorTask] : [];
  }

  const tasks = await taskRepository.listTasks(listQuery);
  if (query.anchorTask && matchesTaskFilters(query.anchorTask, options) && matchesTraceQuery(query.anchorTask, query)) {
    return includeTask(tasks, query.anchorTask);
  }
  return tasks;
}

function matchesTaskFilters(task, options) {
  if (options.status && task.status !== options.status) return false;
  if (options.type && task.type !== options.type) return false;
  return true;
}

function matchesTraceQuery(task, query) {
  if (query.requestId && taskTraceValue(task, 'requestId') !== query.requestId) return false;
  if (query.traceId && taskTraceValue(task, 'traceId') !== query.traceId) return false;
  if (query.idempotencyKey && taskTraceValue(task, 'idempotencyKey') !== query.idempotencyKey) return false;
  return true;
}

function includeTask(tasks, task) {
  const seen = {};
  return [task].concat(tasks).filter(function (item) {
    if (!item || seen[item.id]) return false;
    seen[item.id] = true;
    return true;
  }).sort(function (a, b) {
    return String(b.createdAt).localeCompare(String(a.createdAt));
  });
}

function summarizeTasks(tasks, query) {
  return {
    byStatus: countBy(tasks, 'status'),
    byType: countBy(tasks, 'type'),
    latestTask: tasks[0] ? toTraceTask(tasks[0]) : undefined,
    idempotency: summarizeIdempotency(tasks, query)
  };
}

function countBy(items, key) {
  return items.reduce(function (counts, item) {
    const value = item[key] || 'unknown';
    counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, {});
}

function toTraceTask(task) {
  return {
    id: task.id,
    type: task.type,
    status: task.status,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    startedAt: task.startedAt,
    finishedAt: task.finishedAt,
    trace: task.input && task.input._trace,
    output: task.output,
    error: task.error
  };
}

function taskTraceMetadata(task) {
  return task && task.input && task.input._trace || {};
}

function taskTraceValue(task, key) {
  return taskTraceMetadata(task)[key];
}

function summarizeIdempotency(tasks, query) {
  const idempotencyKey = query && query.idempotencyKey;
  if (!idempotencyKey) return undefined;
  const completedTasks = tasks.filter(function (task) {
    return task.status === 'completed';
  });
  return {
    idempotencyKey,
    taskCount: tasks.length,
    completedCount: completedTasks.length,
    duplicateExecutionRisk: tasks.length > 1,
    taskIds: tasks.map(function (task) { return task.id; }),
    reusableTaskId: completedTasks[0] && completedTasks[0].id
  };
}

module.exports = {
  getTaskTraceContext,
  summarizeTasks,
  summarizeIdempotency
};
