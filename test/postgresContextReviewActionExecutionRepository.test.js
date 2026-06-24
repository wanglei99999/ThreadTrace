'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  createPostgresContextReviewActionExecutionRepository,
  rowToExecution
} = require('../src/infrastructure/postgres/postgresContextReviewActionExecutionRepository');
const { createPostgresRepositories } = require('../src/infrastructure/postgres/postgresRepositories');

test('postgres context review action execution repository claims new executions', async function () {
  const queries = [];
  const repository = createPostgresContextReviewActionExecutionRepository({
    client: {
      async query(sql, params) {
        queries.push({ sql, params });
        return {
          rows: [
            {
              execution_key: params[0],
              action: params[1],
              status: 'running',
              task_id: params[3],
              request_hash: params[4],
              request: params[5],
              attempt_count: 1,
              created_at: params[7],
              updated_at: params[8]
            }
          ]
        };
      }
    }
  });

  const result = await repository.claimExecution({
    key: 'context-review-action:v1:tasks.closure:hash',
    action: 'tasks.closure',
    taskId: 'task-1',
    requestHash: 'hash',
    request: { closeTaskIds: ['task-a'] },
    now: '2026-06-21T10:00:00.000Z'
  });

  assert.equal(result.claimed, true);
  assert.equal(result.record.key, 'context-review-action:v1:tasks.closure:hash');
  assert.equal(result.record.status, 'running');
  assert.match(queries[0].sql, /on conflict \(execution_key\) do nothing/);
});

test('postgres context review action execution repository replays completed claims', async function () {
  const rowsByKey = new Map([
    ['context-review-action:v1:context.merge:hash', {
      execution_key: 'context-review-action:v1:context.merge:hash',
      action: 'context.merge',
      status: 'completed',
      task_id: 'task-1',
      request_hash: 'hash',
      request: { mergeCandidates: [{ taskId: 'task-a' }] },
      result: { mergedTaskIds: ['task-a'] },
      attempt_count: 1,
      created_at: '2026-06-21T10:00:00.000Z',
      updated_at: '2026-06-21T10:01:00.000Z',
      completed_at: '2026-06-21T10:01:00.000Z'
    }]
  ]);
  const repository = createPostgresContextReviewActionExecutionRepository({
    client: {
      async query(sql, params) {
        if (/insert into context_review_action_executions/.test(sql)) return { rows: [] };
        if (/select \* from context_review_action_executions where execution_key/.test(sql)) {
          return { rows: [rowsByKey.get(params[0])] };
        }
        throw new Error('Unexpected SQL: ' + sql);
      }
    }
  });

  const result = await repository.claimExecution({
    key: 'context-review-action:v1:context.merge:hash',
    action: 'context.merge',
    taskId: 'task-2',
    requestHash: 'hash',
    request: {},
    now: '2026-06-21T10:05:00.000Z'
  });

  assert.equal(result.claimed, false);
  assert.equal(result.record.status, 'completed');
  assert.deepEqual(result.record.result.mergedTaskIds, ['task-a']);
});

test('postgres context review action execution row mapper normalizes timestamps', function () {
  const execution = rowToExecution({
    execution_key: 'key-1',
    action: 'tasks.closure',
    status: 'failed',
    task_id: 'task-1',
    request_hash: 'hash',
    request: {},
    error: { message: 'boom' },
    attempt_count: 2,
    created_at: new Date('2026-06-21T10:00:00.000Z'),
    updated_at: new Date('2026-06-21T10:01:00.000Z'),
    failed_at: new Date('2026-06-21T10:01:00.000Z')
  });

  assert.equal(execution.key, 'key-1');
  assert.equal(execution.attemptCount, 2);
  assert.equal(execution.createdAt, '2026-06-21T10:00:00.000Z');
  assert.equal(execution.failedAt, '2026-06-21T10:01:00.000Z');
});

test('postgres context review action execution repository filters by source scope', async function () {
  const queries = [];
  const repository = createPostgresContextReviewActionExecutionRepository({
    client: {
      async query(sql, params) {
        queries.push({ sql, params });
        return {
          rows: [
            {
              execution_key: 'context-review-action:v1:tasks.closure:hash',
              action: 'tasks.closure',
              status: 'completed',
              task_id: 'task-1',
              request_hash: 'hash',
              request: {
                sourceId: 'source-a',
                sourceKey: 'forum-a'
              },
              attempt_count: 1,
              created_at: '2026-06-21T10:00:00.000Z',
              updated_at: '2026-06-21T10:01:00.000Z'
            }
          ]
        };
      }
    }
  });

  const executions = await repository.listExecutions({
    action: 'tasks.closure',
    status: 'completed',
    taskId: 'task-1',
    sourceId: 'source-a',
    sourceKey: 'forum-a',
    limit: 5
  });

  assert.match(queries[0].sql, /action = \$1/);
  assert.match(queries[0].sql, /status = \$2/);
  assert.match(queries[0].sql, /task_id = \$3/);
  assert.match(queries[0].sql, /request->>'sourceId'/);
  assert.match(queries[0].sql, /request->>'sourceKey'/);
  assert.deepEqual(queries[0].params, ['tasks.closure', 'completed', 'task-1', 'source-a', 'forum-a', 5]);
  assert.equal(executions[0].request.sourceKey, 'forum-a');
});

test('postgres repository factory exposes context review action execution repository', function () {
  const repositories = createPostgresRepositories({
    client: {
      async query() {
        return { rows: [] };
      }
    }
  });

  assert.equal(typeof repositories.contextReviewActionExecutionRepository.claimExecution, 'function');
  assert.equal(typeof repositories.contextReviewActionExecutionRepository.listExecutions, 'function');
});
