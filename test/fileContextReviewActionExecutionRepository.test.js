'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  createFileContextReviewActionExecutionRepository
} = require('../src/infrastructure/storage/fileContextReviewActionExecutionRepository');

test('file context review action execution repository claims and replays completed executions', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-review-action-execution-'));
  const repository = createFileContextReviewActionExecutionRepository({
    baseDir: tempDir
  });

  const firstClaim = await repository.claimExecution({
    key: 'context-review-action:v1:tasks.closure:test',
    action: 'tasks.closure',
    taskId: 'task-1',
    requestHash: 'hash-1',
    now: '2026-06-21T10:00:00.000Z'
  });
  await repository.completeExecution(firstClaim.record.key, {
    closedTaskIds: ['task-a']
  }, {
    taskId: 'task-1',
    now: '2026-06-21T10:00:01.000Z'
  });
  const replayClaim = await repository.claimExecution({
    key: 'context-review-action:v1:tasks.closure:test',
    action: 'tasks.closure',
    taskId: 'task-2',
    requestHash: 'hash-1',
    now: '2026-06-21T10:05:00.000Z'
  });

  assert.equal(firstClaim.claimed, true);
  assert.equal(replayClaim.claimed, false);
  assert.equal(replayClaim.record.status, 'completed');
  assert.deepEqual(replayClaim.record.result.closedTaskIds, ['task-a']);

  const listed = await repository.listExecutions({
    action: 'tasks.closure',
    status: 'completed',
    limit: 5
  });
  assert.equal(listed.length, 1);
  assert.equal(listed[0].taskId, 'task-1');
  assert.match(listed[0].filePath, /context-review-action/);
});

test('file context review action execution repository blocks duplicate running claims', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-review-action-running-'));
  const repository = createFileContextReviewActionExecutionRepository({
    baseDir: tempDir
  });

  const firstClaim = await repository.claimExecution({
    key: 'context-review-action:v1:context.merge:test',
    action: 'context.merge',
    taskId: 'task-1',
    requestHash: 'hash-2',
    now: '2026-06-21T10:00:00.000Z'
  });
  const secondClaim = await repository.claimExecution({
    key: 'context-review-action:v1:context.merge:test',
    action: 'context.merge',
    taskId: 'task-2',
    requestHash: 'hash-2',
    now: '2026-06-21T10:00:02.000Z'
  });

  assert.equal(firstClaim.claimed, true);
  assert.equal(secondClaim.claimed, false);
  assert.equal(secondClaim.record.status, 'running');
  assert.equal(secondClaim.record.taskId, 'task-1');
});
