'use strict';

const { createApplicationError } = require('../errors/applicationError');
const { assertTaskRepository } = require('../ports/taskRepository');

async function getTaskTraceContext(options) {
  const safeOptions = options || {};
  const taskRepository = assertTaskRepository(safeOptions.taskRepository);
  const query = traceQuery(safeOptions);
  if (!query.requestId && !query.traceId && !query.idempotencyKey) {
    throw createApplicationError('trace_context_query_required', 'Trace context requires requestId, traceId, or idempotencyKey.', {
      statusCode: 400
    });
  }

  const tasks = await taskRepository.listTasks(Object.assign({}, query, {
    status: safeOptions.status,
    type: safeOptions.type,
    limit: safeOptions.limit || 50
  }));

  return {
    generatedAt: safeOptions.now || new Date().toISOString(),
    query,
    taskCount: tasks.length,
    summary: summarizeTasks(tasks, query),
    tasks: tasks.map(toTraceTask)
  };
}

function traceQuery(options) {
  const safeOptions = options || {};
  return {
    requestId: safeOptions.requestId,
    traceId: safeOptions.traceId,
    idempotencyKey: safeOptions.idempotencyKey
  };
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
