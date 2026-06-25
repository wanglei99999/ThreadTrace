'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { setTrackedSourceSchedule } = require('../src/application/use-cases/setTrackedSourceSchedule');
const { runSetTrackedSourceScheduleTask } = require('../src/application/use-cases/runSetTrackedSourceScheduleTask');

test('set tracked source schedule defaults to dry-run without writing', async function () {
  const source = buildSource();
  const repository = createSourceRepository([source]);

  const result = await setTrackedSourceSchedule({
    sourceRepository: repository,
    sourceId: 'source-1',
    intervalMinutes: 30,
    now: '2026-06-26T10:00:00.000Z'
  });

  assert.equal(result.dryRun, true);
  assert.equal(result.executed, false);
  assert.equal(result.changed, true);
  assert.equal(result.sourceBefore.schedule.intervalMinutes, undefined);
  assert.equal(result.sourceAfter.schedule.intervalMinutes, 30);
  assert.equal(result.sourceAfter.schedule.enabled, true);
  assert.equal(repository.saved.length, 0);
});

test('set tracked source schedule executes interval and run-now update', async function () {
  const source = buildSource({
    schedule: {
      intervalMinutes: 60,
      enabled: true
    }
  });
  const repository = createSourceRepository([source]);

  const result = await setTrackedSourceSchedule({
    sourceRepository: repository,
    sourceId: 'source-1',
    intervalMinutes: 15,
    runNow: true,
    execute: true,
    now: '2026-06-26T10:00:00.000Z'
  });

  assert.equal(result.executed, true);
  assert.equal(result.changed, true);
  assert.equal(result.sourceAfter.schedule.intervalMinutes, 15);
  assert.equal(result.sourceAfter.schedule.nextRunAt, '2026-06-26T10:00:00.000Z');
  assert.equal(repository.saved.length, 1);
  assert.equal((await repository.findSource('source-1')).schedule.intervalMinutes, 15);
});

test('set tracked source schedule can clear schedule', async function () {
  const source = buildSource({
    schedule: {
      intervalMinutes: 60,
      nextRunAt: '2026-06-26T11:00:00.000Z',
      enabled: true
    }
  });
  const repository = createSourceRepository([source]);

  const result = await setTrackedSourceSchedule({
    sourceRepository: repository,
    sourceId: 'source-1',
    clearSchedule: true,
    execute: true,
    now: '2026-06-26T10:00:00.000Z'
  });

  assert.equal(result.changed, true);
  assert.equal(result.sourceAfter.schedule.intervalMinutes, undefined);
  assert.equal((await repository.findSource('source-1')).schedule, undefined);
});

test('runtime source schedule task records audit trail and replays idempotency', async function () {
  const source = buildSource();
  const sourceRepository = createSourceRepository([source]);
  const taskRepository = createTaskRepository();

  const first = await runSetTrackedSourceScheduleTask({
    taskRepository,
    sourceId: 'source-1',
    intervalMinutes: 45,
    execute: true,
    now: '2026-06-26T10:00:00.000Z',
    idempotencyKey: 'schedule-source-1',
    setTrackedSourceSchedule(request) {
      return setTrackedSourceSchedule(Object.assign({}, request, {
        sourceRepository
      }));
    }
  });
  const second = await runSetTrackedSourceScheduleTask({
    taskRepository,
    sourceId: 'source-1',
    intervalMinutes: 45,
    execute: true,
    now: '2026-06-26T10:00:00.000Z',
    idempotencyKey: 'schedule-source-1',
    setTrackedSourceSchedule(request) {
      return setTrackedSourceSchedule(Object.assign({}, request, {
        sourceRepository
      }));
    }
  });

  assert.equal(first.task.type, 'configure-source-schedule');
  assert.equal(first.task.status, 'completed');
  assert.equal(first.result.sourceAfter.schedule.intervalMinutes, 45);
  assert.equal(second.idempotency.reused, true);
  assert.equal(second.task.id, first.task.id);
});

function buildSource(overrides) {
  return Object.assign({
    id: 'source-1',
    sourceKey: 'nga',
    sourceType: 'saved-html-directory',
    displayName: 'NGA sample',
    enabled: true,
    runState: {
      status: 'completed',
      failureCount: 0
    },
    createdAt: '2026-06-26T09:00:00.000Z',
    updatedAt: '2026-06-26T09:00:00.000Z'
  }, overrides || {});
}

function createSourceRepository(sources) {
  const records = new Map((sources || []).map(function (source) {
    return [source.id, clone(source)];
  }));
  const saved = [];
  return {
    saved,
    async saveSource(source) {
      saved.push(clone(source));
      records.set(source.id, clone(source));
    },
    async findSource(id) {
      const source = records.get(id);
      return source ? clone(source) : undefined;
    },
    async listSources() {
      return Array.from(records.values()).map(clone);
    }
  };
}

function createTaskRepository() {
  const tasks = [];
  return {
    async saveTask(task) {
      const index = tasks.findIndex(function (item) { return item.id === task.id; });
      if (index >= 0) tasks[index] = clone(task);
      else tasks.push(clone(task));
    },
    async listTasks(query) {
      const safeQuery = query || {};
      return tasks.filter(function (task) {
        if (safeQuery.type && task.type !== safeQuery.type) return false;
        if (safeQuery.status && task.status !== safeQuery.status) return false;
        if (safeQuery.idempotencyKey && taskTraceValue(task, 'idempotencyKey') !== safeQuery.idempotencyKey) return false;
        return true;
      }).map(clone);
    },
    async findTask(id) {
      const task = tasks.find(function (item) { return item.id === id; });
      return task ? clone(task) : undefined;
    }
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function taskTraceValue(task, key) {
  return task && task.input && task.input._trace
    ? task.input._trace[key]
    : undefined;
}
