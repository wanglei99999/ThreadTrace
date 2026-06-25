'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { getTaskTraceContext } = require('../src/application/use-cases/getTaskTraceContext');

test('task trace context summarizes correlated tasks', async function () {
  const tasks = [
    task('task-2', 'semantic-enrichment', 'completed', '2026-06-19T10:02:00.000Z'),
    task('task-1', 'ingest-saved-thread-directory', 'failed', '2026-06-19T10:01:00.000Z')
  ];
  const context = await getTaskTraceContext({
    now: '2026-06-19T10:03:00.000Z',
    requestId: 'request-1',
    taskRepository: {
      async saveTask() {},
      async findTask() {},
      async listTasks(query) {
        assert.equal(query.requestId, 'request-1');
        return tasks;
      }
    }
  });

  assert.equal(context.generatedAt, '2026-06-19T10:03:00.000Z');
  assert.equal(context.taskCount, 2);
  assert.equal(context.summary.byStatus.completed, 1);
  assert.equal(context.summary.byStatus.failed, 1);
  assert.equal(context.summary.byType['semantic-enrichment'], 1);
  assert.equal(context.summary.latestTask.id, 'task-2');
  assert.equal(context.tasks[0].trace.requestId, 'request-1');
});

test('task trace context reports idempotency duplicate risk', async function () {
  const tasks = [
    task('task-2', 'ingest-saved-thread-directory', 'completed', '2026-06-19T10:02:00.000Z', {
      idempotencyKey: 'idem-1'
    }),
    task('task-1', 'ingest-saved-thread-directory', 'failed', '2026-06-19T10:01:00.000Z', {
      idempotencyKey: 'idem-1'
    })
  ];
  const context = await getTaskTraceContext({
    idempotencyKey: 'idem-1',
    taskRepository: {
      async saveTask() {},
      async findTask() {},
      async listTasks(query) {
        assert.equal(query.idempotencyKey, 'idem-1');
        return tasks;
      }
    }
  });

  assert.equal(context.summary.idempotency.idempotencyKey, 'idem-1');
  assert.equal(context.summary.idempotency.taskCount, 2);
  assert.equal(context.summary.idempotency.completedCount, 1);
  assert.equal(context.summary.idempotency.duplicateExecutionRisk, true);
  assert.equal(context.summary.idempotency.reusableTaskId, 'task-2');
  assert.deepEqual(context.summary.idempotency.taskIds, ['task-2', 'task-1']);
});

test('task trace context can anchor by task id and expand trace metadata', async function () {
  const anchorTask = task('task-1', 'source-ingest', 'completed', '2026-06-19T10:01:00.000Z', {
    traceId: 'trace-1',
    idempotencyKey: 'idem-1'
  });
  const tasks = [
    task('task-2', 'semantic-enrichment', 'completed', '2026-06-19T10:02:00.000Z', {
      traceId: 'trace-1',
      idempotencyKey: 'idem-1'
    })
  ];
  const context = await getTaskTraceContext({
    taskId: 'task-1',
    taskRepository: {
      async saveTask() {},
      async findTask(id) {
        assert.equal(id, 'task-1');
        return anchorTask;
      },
      async listTasks(query) {
        assert.equal(query.requestId, 'request-1');
        assert.equal(query.traceId, 'trace-1');
        assert.equal(query.idempotencyKey, 'idem-1');
        return tasks;
      }
    }
  });

  assert.equal(context.query.taskId, 'task-1');
  assert.equal(context.query.requestId, 'request-1');
  assert.equal(context.query.traceId, 'trace-1');
  assert.equal(context.taskCount, 2);
  assert.deepEqual(context.tasks.map(function (item) { return item.id; }), ['task-2', 'task-1']);
  assert.equal(context.summary.idempotency.duplicateExecutionRisk, true);
});

test('task trace context returns an untraced task id anchor by itself', async function () {
  const anchorTask = untracedTask('task-untraced', 'manual-maintenance', 'completed', '2026-06-19T10:01:00.000Z');
  const context = await getTaskTraceContext({
    taskId: 'task-untraced',
    taskRepository: {
      async saveTask() {},
      async findTask(id) {
        assert.equal(id, 'task-untraced');
        return anchorTask;
      },
      async listTasks() {
        assert.fail('untraced task id lookups should not list correlated tasks');
      }
    }
  });

  assert.equal(context.query.taskId, 'task-untraced');
  assert.equal(context.query.requestId, undefined);
  assert.equal(context.taskCount, 1);
  assert.equal(context.tasks[0].id, 'task-untraced');
  assert.equal(context.tasks[0].trace, undefined);
});

test('task trace context reports missing task id anchors', async function () {
  await assert.rejects(function () {
    return getTaskTraceContext({
      taskId: 'missing-task',
      taskRepository: {
        async saveTask() {},
        async findTask(id) {
          assert.equal(id, 'missing-task');
          return undefined;
        },
        async listTasks() { return []; }
      }
    });
  }, function (error) {
    assert.equal(error.code, 'trace_context_task_not_found');
    assert.equal(error.statusCode, 404);
    assert.deepEqual(error.details, { taskId: 'missing-task' });
    return true;
  });
});

test('task trace context requires a trace query key', async function () {
  await assert.rejects(function () {
    return getTaskTraceContext({
      taskRepository: {
        async saveTask() {},
        async findTask() {},
        async listTasks() { return []; }
      }
    });
  }, function (error) {
    assert.equal(error.code, 'trace_context_query_required');
    assert.equal(error.statusCode, 400);
    return true;
  });
});

function task(id, type, status, createdAt, traceOverrides) {
  return {
    id,
    type,
    status,
    input: {
      _trace: {
        requestId: 'request-1',
        ...(traceOverrides || {})
      }
    },
    output: {},
    createdAt,
    updatedAt: createdAt
  };
}

function untracedTask(id, type, status, createdAt) {
  return {
    id,
    type,
    status,
    input: {},
    output: {},
    createdAt,
    updatedAt: createdAt
  };
}
