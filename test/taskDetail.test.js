'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { getTaskDetail, taskSourceScope } = require('../src/application/use-cases/getTaskDetail');

test('task detail returns task trace context source scope and actions', async function () {
  const tasks = [
    task('task-1', 'completed', {
      sourceId: 'source-1',
      sourceKey: 'nga',
      sourceThreadId: 'thread-1',
      _trace: {
        requestId: 'request-1',
        idempotencyKey: 'idem-1'
      }
    }),
    task('task-2', 'failed', {
      sourceId: 'source-1',
      sourceKey: 'nga',
      _trace: {
        requestId: 'request-1',
        idempotencyKey: 'idem-1'
      }
    })
  ];
  const detail = await getTaskDetail({
    taskId: 'task-1',
    now: '2026-06-25T10:00:00.000Z',
    taskRepository: repository(tasks)
  });

  assert.equal(detail.generatedAt, '2026-06-25T10:00:00.000Z');
  assert.equal(detail.task.id, 'task-1');
  assert.equal(detail.sourceScope.sourceId, 'source-1');
  assert.equal(detail.sourceScope.sourceKey, 'nga');
  assert.equal(detail.sourceScope.sourceThreadId, 'thread-1');
  assert.equal(detail.traceContext.taskCount, 2);
  assert.ok(detail.links.find(function (link) {
    return link.rel === 'trace-context' && /taskId=task-1/.test(link.href);
  }));
  assert.ok(detail.links.find(function (link) {
    return link.rel === 'source-drilldown' && /sourceId=source-1/.test(link.href);
  }));
  assert.ok(detail.nextActions.find(function (action) {
    return action.key === 'task.trace-context';
  }));
  assert.ok(detail.nextActions.find(function (action) {
    return action.key === 'task.idempotency-duplicates';
  }));
});

test('task detail reports missing task ids', async function () {
  await assert.rejects(function () {
    return getTaskDetail({
      taskId: 'missing-task',
      taskRepository: repository([])
    });
  }, function (error) {
    assert.equal(error.code, 'task_not_found');
    assert.equal(error.statusCode, 404);
    assert.deepEqual(error.details, { taskId: 'missing-task' });
    return true;
  });
});

test('task source scope falls back across input output and trace fields', function () {
  assert.deepEqual(taskSourceScope({
    input: {
      _trace: {
        sourceKey: 'trace-source'
      }
    },
    output: {
      sourceId: 'output-source-id',
      sourceType: 'thread-url',
      sourceThreadId: 'thread-2'
    }
  }), {
    sourceId: 'output-source-id',
    sourceKey: 'trace-source',
    sourceType: 'thread-url',
    sourceThreadId: 'thread-2'
  });
});

function repository(tasks) {
  return {
    async saveTask() {},
    async findTask(id) {
      return tasks.find(function (taskRecord) {
        return taskRecord.id === id;
      });
    },
    async listTasks(query) {
      const safeQuery = query || {};
      return tasks.filter(function (taskRecord) {
        const trace = taskRecord.input && taskRecord.input._trace || {};
        if (safeQuery.requestId && trace.requestId !== safeQuery.requestId) return false;
        if (safeQuery.traceId && trace.traceId !== safeQuery.traceId) return false;
        if (safeQuery.idempotencyKey && trace.idempotencyKey !== safeQuery.idempotencyKey) return false;
        return true;
      }).slice(0, safeQuery.limit || tasks.length);
    }
  };
}

function task(id, status, input) {
  return {
    id,
    type: 'source-insight-pipeline',
    status,
    input,
    output: {
      sourceId: input.sourceId,
      sourceKey: input.sourceKey,
      sourceThreadId: input.sourceThreadId
    },
    createdAt: '2026-06-25T09:00:00.000Z',
    updatedAt: '2026-06-25T09:01:00.000Z'
  };
}
