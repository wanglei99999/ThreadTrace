'use strict';

const { createApplicationError } = require('../errors/applicationError');
const { assertTaskRepository } = require('../ports/taskRepository');
const { getTaskTraceContext } = require('./getTaskTraceContext');

async function getTaskDetail(options) {
  const safeOptions = options || {};
  const taskRepository = assertTaskRepository(safeOptions.taskRepository);
  const taskId = String(safeOptions.taskId || '').trim();
  if (!taskId) {
    throw createApplicationError('task_id_required', 'Task detail requires taskId.', {
      statusCode: 400
    });
  }

  const task = await taskRepository.findTask(taskId);
  if (!task) {
    throw createApplicationError('task_not_found', 'Task was not found.', {
      statusCode: 404,
      details: {
        taskId
      }
    });
  }

  const traceContext = await getTaskTraceContext({
    taskRepository,
    taskId,
    limit: safeOptions.traceLimit || safeOptions.limit || 20,
    now: safeOptions.now
  });
  const sourceScope = taskSourceScope(task);

  return {
    generatedAt: safeOptions.now || new Date().toISOString(),
    task,
    sourceScope,
    traceContext,
    links: taskDetailLinks(task, traceContext, sourceScope),
    nextActions: taskDetailActions(task, traceContext, sourceScope)
  };
}

function taskSourceScope(task) {
  const input = task && task.input || {};
  const output = task && task.output || {};
  const trace = input._trace || {};
  const inputSource = input.source || {};
  const outputSource = output.source || {};
  return compactObject({
    sourceId: firstValue(input.sourceId, output.sourceId, trace.sourceId, inputSource.id, outputSource.id),
    sourceKey: firstValue(input.sourceKey, input.forum, output.sourceKey, output.forum, trace.sourceKey, trace.forum, inputSource.sourceKey, outputSource.sourceKey),
    sourceType: firstValue(input.sourceType, output.sourceType, inputSource.sourceType, outputSource.sourceType),
    sourceThreadId: firstValue(input.sourceThreadId, output.sourceThreadId, input.threadId, output.threadId)
  });
}

function taskDetailLinks(task, traceContext, sourceScope) {
  const links = [
    {
      rel: 'self',
      method: 'GET',
      href: '/api/tasks/' + encodeURIComponent(task.id)
    },
    {
      rel: 'trace-context',
      method: 'GET',
      href: '/api/operations/trace-context?taskId=' + encodeURIComponent(task.id)
    }
  ];
  if (sourceScope.sourceId || sourceScope.sourceKey) {
    links.push({
      rel: 'source-drilldown',
      method: 'GET',
      href: '/api/operations/source-drilldown?' + sourceDrilldownQuery(sourceScope)
    });
  }
  const idempotencyKey = traceContext && traceContext.query && traceContext.query.idempotencyKey;
  if (idempotencyKey) {
    links.push({
      rel: 'idempotency-context',
      method: 'GET',
      href: '/api/operations/trace-context?idempotencyKey=' + encodeURIComponent(idempotencyKey)
    });
  }
  return links;
}

function taskDetailActions(task, traceContext, sourceScope) {
  const actions = [
    {
      key: 'task.trace-context',
      severity: 'info',
      summary: 'Inspect request, trace, and idempotency-correlated tasks.',
      command: 'node src/presentation/cli/threadtrace.js trace-context --task-id ' + quoteCommandValue(task.id)
    }
  ];
  if (sourceScope.sourceId || sourceScope.sourceKey) {
    actions.push({
      key: 'task.source-drilldown',
      severity: 'info',
      summary: 'Inspect source-scoped workers, leases, tasks, events, and review records.',
      command: sourceDrilldownCommand(sourceScope),
      evidence: sourceScope
    });
  }
  const idempotency = traceContext && traceContext.summary && traceContext.summary.idempotency;
  if (idempotency && idempotency.duplicateExecutionRisk) {
    actions.push({
      key: 'task.idempotency-duplicates',
      severity: 'warning',
      summary: 'Multiple tasks share this idempotency key; inspect caller retry behavior before enabling replay.',
      command: 'node src/presentation/cli/threadtrace.js trace-context --idempotency-key ' + quoteCommandValue(idempotency.idempotencyKey),
      evidence: {
        idempotencyKey: idempotency.idempotencyKey,
        taskIds: idempotency.taskIds
      }
    });
  }
  if (task.status === 'failed') {
    actions.push({
      key: 'task.failure-review',
      severity: 'warning',
      summary: 'Review task error output and source scope before replaying or resetting downstream state.',
      evidence: {
        error: task.error,
        sourceScope
      }
    });
  }
  return actions;
}

function sourceDrilldownQuery(sourceScope) {
  const query = new URLSearchParams();
  if (sourceScope.sourceId) query.set('sourceId', sourceScope.sourceId);
  if (sourceScope.sourceKey) query.set('sourceKey', sourceScope.sourceKey);
  query.set('limit', '50');
  return query.toString();
}

function sourceDrilldownCommand(sourceScope) {
  const parts = ['node src/presentation/cli/threadtrace.js source-drilldown'];
  if (sourceScope.sourceId) parts.push('--source-id ' + quoteCommandValue(sourceScope.sourceId));
  if (sourceScope.sourceKey) parts.push('--source-key ' + quoteCommandValue(sourceScope.sourceKey));
  return parts.join(' ');
}

function compactObject(value) {
  return Object.keys(value).reduce(function (result, key) {
    if (value[key] !== undefined && value[key] !== '') result[key] = value[key];
    return result;
  }, {});
}

function firstValue() {
  for (let index = 0; index < arguments.length; index += 1) {
    if (arguments[index] !== undefined && arguments[index] !== '') return arguments[index];
  }
  return undefined;
}

function quoteCommandValue(value) {
  return '"' + String(value).replace(/"/g, '\\"') + '"';
}

module.exports = {
  getTaskDetail,
  taskSourceScope,
  taskDetailLinks,
  taskDetailActions
};
