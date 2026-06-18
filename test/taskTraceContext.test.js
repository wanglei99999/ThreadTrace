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
