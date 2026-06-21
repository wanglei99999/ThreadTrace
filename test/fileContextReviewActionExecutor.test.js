'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { createFileContextReviewActionExecutor } = require('../src/infrastructure/review-actions/fileContextReviewActionExecutor');
const { createFileContextReviewActionAuditRepository } = require('../src/infrastructure/storage/fileContextReviewActionAuditRepository');

test('file context review action executor writes closure and merge audit records', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-review-action-audit-'));
  const executor = createFileContextReviewActionExecutor({
    baseDir: tempDir
  });

  const closure = await executor.closeTasks({
    taskId: 'task-audit-1',
    closeTaskIds: ['task-1'],
    now: '2026-06-21T10:00:00.000Z',
    actionGate: actionGate()
  });
  const merge = await executor.mergeContext({
    taskId: 'task-audit-1',
    mergeCandidates: [{ taskId: 'task-1', decision: 'confirmed' }],
    now: '2026-06-21T10:00:00.000Z',
    actionGate: actionGate()
  });

  const closureRecord = JSON.parse(await fs.readFile(closure.auditFile, 'utf8'));
  const mergeRecord = JSON.parse(await fs.readFile(merge.auditFile, 'utf8'));

  assert.equal(closure.adapter, 'file-audit');
  assert.equal(closure.changed, false);
  assert.deepEqual(closure.closeTaskIds, ['task-1']);
  assert.equal(closureRecord.action, 'tasks.closure');
  assert.equal(closureRecord.request.taskId, 'task-audit-1');
  assert.deepEqual(closureRecord.request.closeTaskIds, ['task-1']);
  assert.equal(merge.adapter, 'file-audit');
  assert.equal(merge.changed, false);
  assert.equal(merge.mergeCandidateCount, 1);
  assert.equal(mergeRecord.action, 'context.merge');
  assert.equal(mergeRecord.request.mergeCandidates[0].taskId, 'task-1');
});

test('file context review action audit repository lists and filters audit records', async function () {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threadtrace-review-action-audit-list-'));
  const executor = createFileContextReviewActionExecutor({
    baseDir: tempDir
  });
  const repository = createFileContextReviewActionAuditRepository({
    baseDir: tempDir
  });

  await executor.closeTasks({
    taskId: 'task-audit-2',
    closeTaskIds: ['task-2'],
    now: '2026-06-21T10:00:00.000Z',
    actionGate: actionGate()
  });
  await executor.mergeContext({
    taskId: 'task-audit-2',
    mergeCandidates: [{ taskId: 'task-2', decision: 'confirmed' }],
    now: '2026-06-21T11:00:00.000Z',
    actionGate: actionGate()
  });

  const all = await repository.listActionAudits({ limit: 10 });
  const closure = await repository.listActionAudits({ action: 'tasks.closure' });
  const byTask = await repository.listActionAudits({ taskId: 'task-audit-2' });

  assert.equal(all.length, 2);
  assert.equal(all[0].action, 'context.merge');
  assert.equal(closure.length, 1);
  assert.equal(closure[0].request.closeTaskIds[0], 'task-2');
  assert.equal(byTask.length, 2);
  assert.ok(byTask[0].filePath);
});

function actionGate() {
  return {
    generatedAt: '2026-06-21T10:00:00.000Z',
    status: 'warn',
    gateCount: 1,
    executable: {
      canCloseTasks: true,
      canMergeContext: true
    },
    recommendedNextAction: 'Review dry-run output before execution.',
    actionPlan: {
      count: 1,
      status: 'warn',
      closeTaskIds: ['task-1'],
      mergeCandidates: [{ taskId: 'task-1', decision: 'confirmed' }],
      risk: {
        level: 'warning',
        reasons: ['tasks-still-open']
      }
    }
  };
}
