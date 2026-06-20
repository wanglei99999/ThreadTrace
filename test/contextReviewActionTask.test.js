'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { runContextReviewActionTask } = require('../src/application/use-cases/runContextReviewActionTask');

test('context review action task records dry-run apply audit and replays idempotency', async function () {
  const saved = [];
  const taskRepository = {
    async saveTask(task) {
      const index = saved.findIndex(function (item) { return item.id === task.id; });
      if (index === -1) saved.push(task);
      else saved[index] = task;
    },
    async findTask(id) {
      return saved.find(function (task) { return task.id === id; });
    },
    async listTasks(query) {
      return saved.filter(function (task) {
        return (!query.type || task.type === query.type) &&
          (!query.idempotencyKey || (task.input._trace && task.input._trace.idempotencyKey === query.idempotencyKey));
      });
    }
  };
  const first = await runContextReviewActionTask({
    taskRepository,
    getContextReviewResultActionGate,
    now: '2026-06-21T10:00:00.000Z',
    storeDir: 'store-a',
    requestId: 'review-action-request-1',
    idempotencyKey: 'review-action-idem-1'
  });
  const replay = await runContextReviewActionTask({
    taskRepository,
    getContextReviewResultActionGate,
    now: '2026-06-21T10:00:00.000Z',
    storeDir: 'store-a',
    requestId: 'review-action-request-2',
    idempotencyKey: 'review-action-idem-1'
  });

  assert.equal(first.task.type, 'context-review-action-apply');
  assert.equal(first.task.status, 'completed');
  assert.equal(first.report.status, 'warn');
  assert.equal(first.report.dryRun, true);
  assert.equal(first.report.executed, false);
  assert.equal(first.report.applied, false);
  assert.equal(first.report.closeTaskCount, 1);
  assert.equal(first.report.mergeCandidateCount, 1);
  assert.equal(first.task.input._trace.requestId, 'review-action-request-1');
  assert.equal(replay.task.id, first.task.id);
  assert.equal(replay.idempotency.reused, true);
});

test('context review action task reports missing executors for execute mode', async function () {
  const saved = [];
  const result = await runContextReviewActionTask({
    taskRepository: taskRepository(saved),
    getContextReviewResultActionGate,
    execute: true,
    now: '2026-06-21T10:00:00.000Z'
  });

  assert.equal(result.report.status, 'fail');
  assert.equal(result.report.dryRun, false);
  assert.equal(result.report.executed, false);
  assert.equal(result.report.steps.find(function (step) {
    return step.key === 'tasks.closure';
  }).status, 'fail');
});

function taskRepository(saved) {
  return {
    async saveTask(task) {
      saved.push(task);
    },
    async findTask() {},
    async listTasks() {
      return saved;
    }
  };
}

async function getContextReviewResultActionGate() {
  return {
    generatedAt: '2026-06-21T10:00:00.000Z',
    status: 'warn',
    gateCount: 5,
    gates: [
      { key: 'reviewResults.blockers', status: 'warn' }
    ],
    executable: {
      canCloseTasks: true,
      canMergeContext: true,
      requiresHumanReview: true,
      closeTaskCount: 1,
      mergeCandidateCount: 1
    },
    nextActions: [
      { key: 'reviewResults.blockers', severity: 'warning', summary: 'Keep unresolved tasks open.' }
    ],
    recommendedNextAction: 'Keep unresolved tasks open.',
    actionPlan: {
      count: 1,
      status: 'warn',
      closeTaskIds: ['task-1'],
      keepOpenTaskIds: ['task-2'],
      mergeCandidates: [
        { taskId: 'task-1', decision: 'confirmed' }
      ],
      blockedTasks: [
        { taskId: 'task-2', decision: 'needs-more-evidence' }
      ],
      attention: {
        conflictTaskIds: []
      },
      risk: {
        level: 'warning',
        reasons: ['tasks-still-open']
      }
    }
  };
}
