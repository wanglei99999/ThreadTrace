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
  assert.deepEqual(result.report.executorReadiness.missing, ['closeTasks', 'mergeContext']);
});

test('context review action task executes context review action executor port', async function () {
  const calls = [];
  const result = await runContextReviewActionTask({
    taskRepository: taskRepository([]),
    getContextReviewResultActionGate,
    execute: true,
    contextReviewActionExecutor: {
      closeTasks: async function (request) {
        calls.push(['closure', request.closeTaskIds, request.storeDir, request.sourceKey]);
        return {
          closedTaskIds: request.closeTaskIds
        };
      },
      mergeContext: async function (request) {
        calls.push(['merge', request.mergeCandidates.map(function (candidate) { return candidate.taskId; }), request.storeDir, request.sourceKey]);
        return {
          mergedTaskIds: request.mergeCandidates.map(function (candidate) { return candidate.taskId; })
        };
      }
    },
    now: '2026-06-21T10:00:00.000Z',
    storeDir: 'store-execute'
  });

  assert.deepEqual(calls, [
    ['closure', ['task-1'], 'store-execute', 'forum-a'],
    ['merge', ['task-1'], 'store-execute', 'forum-a']
  ]);
  assert.equal(result.report.status, 'warn');
  assert.equal(result.report.dryRun, false);
  assert.equal(result.report.executed, true);
  assert.equal(result.report.applied, true);
  assert.equal(result.report.executorReadiness.ready, true);
  assert.deepEqual(result.report.executorResults.taskClosure.closedTaskIds, ['task-1']);
  assert.deepEqual(result.report.executorResults.contextMerge.mergedTaskIds, ['task-1']);
});

test('context review action task replays completed executor actions through execution ledger', async function () {
  const calls = [];
  const executionRepository = memoryExecutionRepository();
  const executor = {
    closeTasks: async function (request) {
      calls.push(['closure', request.closeTaskIds]);
      return {
        closedTaskIds: request.closeTaskIds
      };
    },
    mergeContext: async function (request) {
      calls.push(['merge', request.mergeCandidates.map(function (candidate) { return candidate.taskId; })]);
      return {
        mergedTaskIds: request.mergeCandidates.map(function (candidate) { return candidate.taskId; })
      };
    }
  };

  const first = await runContextReviewActionTask({
    taskRepository: taskRepository([]),
    getContextReviewResultActionGate,
    execute: true,
    contextReviewActionExecutor: executor,
    contextReviewActionExecutionRepository: executionRepository,
    now: '2026-06-21T10:00:00.000Z'
  });
  const second = await runContextReviewActionTask({
    taskRepository: taskRepository([]),
    getContextReviewResultActionGate,
    execute: true,
    contextReviewActionExecutor: executor,
    contextReviewActionExecutionRepository: executionRepository,
    now: '2026-06-21T10:05:00.000Z'
  });

  assert.deepEqual(calls, [
    ['closure', ['task-1']],
    ['merge', ['task-1']]
  ]);
  assert.equal(first.report.executorResults.taskClosure.executionLedger.replayed, false);
  assert.equal(second.report.executorResults.taskClosure.executionLedger.replayed, true);
  assert.equal(second.report.executorResults.contextMerge.executionLedger.replayed, true);
  assert.deepEqual(second.report.executorResults.taskClosure.closedTaskIds, ['task-1']);
  assert.deepEqual(second.report.executorResults.contextMerge.mergedTaskIds, ['task-1']);
});

test('context review action execution ledger is isolated by source scope', async function () {
  const calls = [];
  const executionRepository = memoryExecutionRepository();
  const executor = {
    closeTasks: async function (request) {
      calls.push(['closure', request.sourceKey, request.closeTaskIds]);
      return {
        closedTaskIds: request.closeTaskIds,
        sourceKey: request.sourceKey
      };
    },
    mergeContext: async function (request) {
      calls.push(['merge', request.sourceKey, request.mergeCandidates.map(function (candidate) { return candidate.taskId; })]);
      return {
        mergedTaskIds: request.mergeCandidates.map(function (candidate) { return candidate.taskId; }),
        sourceKey: request.sourceKey
      };
    }
  };

  const first = await runContextReviewActionTask({
    taskRepository: taskRepository([]),
    getContextReviewResultActionGate: getScopedContextReviewResultActionGate,
    sourceKey: 'forum-a',
    execute: true,
    contextReviewActionExecutor: executor,
    contextReviewActionExecutionRepository: executionRepository,
    now: '2026-06-21T10:00:00.000Z'
  });
  const second = await runContextReviewActionTask({
    taskRepository: taskRepository([]),
    getContextReviewResultActionGate: getScopedContextReviewResultActionGate,
    sourceKey: 'forum-b',
    execute: true,
    contextReviewActionExecutor: executor,
    contextReviewActionExecutionRepository: executionRepository,
    now: '2026-06-21T10:05:00.000Z'
  });

  assert.deepEqual(calls, [
    ['closure', 'forum-a', ['task-1']],
    ['merge', 'forum-a', ['task-1']],
    ['closure', 'forum-b', ['task-1']],
    ['merge', 'forum-b', ['task-1']]
  ]);
  assert.notEqual(first.report.executorResults.taskClosure.executionLedger.key, second.report.executorResults.taskClosure.executionLedger.key);
  assert.equal(second.report.executorResults.taskClosure.executionLedger.replayed, false);
  assert.equal(second.report.executorResults.contextMerge.executionLedger.replayed, false);
});

test('context review action task keeps legacy function executor compatibility', async function () {
  const calls = [];
  const result = await runContextReviewActionTask({
    taskRepository: taskRepository([]),
    getContextReviewResultActionGate,
    execute: true,
    taskClosureExecutor: async function (request) {
      calls.push(['legacy-closure', request.closeTaskIds]);
      return { closedTaskIds: request.closeTaskIds };
    },
    contextMergeExecutor: async function (request) {
      calls.push(['legacy-merge', request.mergeCandidates.length]);
      return { mergedTaskCount: request.mergeCandidates.length };
    },
    now: '2026-06-21T10:00:00.000Z'
  });

  assert.deepEqual(calls, [
    ['legacy-closure', ['task-1']],
    ['legacy-merge', 1]
  ]);
  assert.equal(result.report.executorReadiness.ready, true);
  assert.equal(result.report.executed, true);
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

function memoryExecutionRepository() {
  const records = new Map();
  return {
    async claimExecution(record) {
      const existing = records.get(record.key);
      if (existing && (existing.status === 'completed' || existing.status === 'running')) {
        return {
          claimed: false,
          record: existing
        };
      }
      const next = Object.assign({}, existing || {}, record, {
        status: 'running',
        attemptCount: existing ? (existing.attemptCount || 1) + 1 : 1
      });
      records.set(record.key, next);
      return {
        claimed: true,
        record: next
      };
    },
    async completeExecution(key, result, metadata) {
      const next = Object.assign({}, records.get(key) || {}, metadata || {}, {
        key,
        status: 'completed',
        result
      });
      records.set(key, next);
      return next;
    },
    async failExecution(key, error, metadata) {
      const next = Object.assign({}, records.get(key) || {}, metadata || {}, {
        key,
        status: 'failed',
        error: {
          message: error.message
        }
      });
      records.set(key, next);
      return next;
    },
    async findExecution(key) {
      return records.get(key);
    },
    async listExecutions(query) {
      const safeQuery = query || {};
      return Array.from(records.values()).filter(function (record) {
        return (!safeQuery.action || record.action === safeQuery.action) &&
          (!safeQuery.status || record.status === safeQuery.status) &&
          (!safeQuery.taskId || record.taskId === safeQuery.taskId);
      }).slice(0, safeQuery.limit || records.size);
    }
  };
}

async function getContextReviewResultActionGate() {
  return {
    generatedAt: '2026-06-21T10:00:00.000Z',
    status: 'warn',
    sourceId: 'source-a',
    sourceKey: 'forum-a',
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
      sourceId: 'source-a',
      sourceKey: 'forum-a',
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

async function getScopedContextReviewResultActionGate(request) {
  const scope = {
    sourceId: request && request.sourceId,
    sourceKey: request && request.sourceKey
  };
  const gate = await getContextReviewResultActionGate();
  return Object.assign({}, gate, scope, {
    actionPlan: Object.assign({}, gate.actionPlan, scope)
  });
}
