'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  listContextReviewActionExecutions
} = require('../src/application/use-cases/listContextReviewActionExecutions');

test('context review action execution listing marks stale running records', async function () {
  const result = await listContextReviewActionExecutions({
    now: '2026-06-21T10:10:00.000Z',
    runningStaleAfterMs: 5 * 60 * 1000,
    sourceKey: 'forum-a',
    contextReviewActionExecutionRepository: {
      async claimExecution() {},
      async completeExecution() {},
      async failExecution() {},
      async findExecution() {},
      async listExecutions(query) {
        assert.equal(query.sourceKey, 'forum-a');
        return [
          {
            key: 'context-review-action:v1:tasks.closure:old',
            action: 'tasks.closure',
            status: 'running',
            taskId: 'task-old',
            request: {
              sourceId: 'source-a',
              sourceKey: 'forum-a'
            },
            createdAt: '2026-06-21T10:00:00.000Z',
            updatedAt: '2026-06-21T10:00:00.000Z'
          },
          {
            key: 'context-review-action:v1:context.merge:fresh',
            action: 'context.merge',
            status: 'running',
            taskId: 'task-fresh',
            createdAt: '2026-06-21T10:08:00.000Z',
            updatedAt: '2026-06-21T10:08:00.000Z'
          }
        ];
      }
    }
  });

  assert.equal(result.status, 'ok');
  assert.equal(result.healthStatus, 'warn');
  assert.equal(result.staleRunningCount, 1);
  assert.equal(result.sourceKey, 'forum-a');
  assert.equal(result.executions[0].sourceId, 'source-a');
  assert.equal(result.executions[0].sourceKey, 'forum-a');
  assert.equal(result.executions[0].staleRunning, true);
  assert.equal(result.executions[0].runningAgeMs, 10 * 60 * 1000);
  assert.equal(result.executions[1].staleRunning, false);
  assert.equal(result.staleRunningExecutions[0].key, 'context-review-action:v1:tasks.closure:old');
  assert.equal(result.staleRunningExecutions[0].sourceKey, 'forum-a');
});
