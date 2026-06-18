'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  createTaskRecord,
  markTaskCompleted
} = require('../src/application/jobs/taskRecordFactory');
const { findReusableCompletedTask } = require('../src/application/jobs/taskIdempotency');

test('task idempotency reuses completed task when only trace metadata differs', async function () {
  const existing = markTaskCompleted(createTaskRecord('demo-task', {
    value: 'same'
  }, {
    requestId: 'request-1',
    traceId: 'trace-1',
    idempotencyKey: 'idem-1'
  }), {});
  const proposed = createTaskRecord('demo-task', {
    value: 'same'
  }, {
    requestId: 'request-2',
    traceId: 'trace-2',
    idempotencyKey: 'idem-1'
  });

  const reusable = await findReusableCompletedTask(fakeTaskRepository([existing]), proposed);

  assert.equal(reusable.id, existing.id);
});

test('task idempotency does not reuse completed task when business input differs', async function () {
  const existing = markTaskCompleted(createTaskRecord('demo-task', {
    value: 'old'
  }, {
    idempotencyKey: 'idem-1'
  }), {});
  const proposed = createTaskRecord('demo-task', {
    value: 'new'
  }, {
    idempotencyKey: 'idem-1'
  });

  const reusable = await findReusableCompletedTask(fakeTaskRepository([existing]), proposed);

  assert.equal(reusable, undefined);
});

function fakeTaskRepository(tasks) {
  return {
    async listTasks(query) {
      return tasks.filter(function (task) {
        return task.type === query.type && task.input._trace.idempotencyKey === query.idempotencyKey;
      });
    }
  };
}
