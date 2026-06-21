'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  buildContextReviewActionAuditOverview,
  getContextReviewActionAuditOverview
} = require('../src/application/use-cases/getContextReviewActionAuditOverview');

test('context review action audit overview aggregates executor audit records', async function () {
  const audits = [
    audit('context.merge', 'task-1', '2026-06-21T11:00:00.000Z', { mergeCandidates: [{ taskId: 'task-1' }] }),
    audit('tasks.closure', 'task-1', '2026-06-21T10:00:00.000Z', { closeTaskIds: ['task-1'] })
  ];
  const overview = await getContextReviewActionAuditOverview({
    contextReviewActionAuditRepository: {
      async listActionAudits(query) {
        assert.equal(query.limit, 100);
        return audits;
      }
    },
    now: '2026-06-21T12:00:00.000Z'
  });

  assert.equal(overview.generatedAt, '2026-06-21T12:00:00.000Z');
  assert.equal(overview.status, 'ok');
  assert.equal(overview.count, 2);
  assert.equal(overview.taskCount, 1);
  assert.deepEqual(overview.byAction, {
    'context.merge': 1,
    'tasks.closure': 1
  });
  assert.deepEqual(overview.byAdapter, {
    'file-audit': 2
  });
  assert.equal(overview.plannedClosureCount, 1);
  assert.equal(overview.plannedMergeCandidateCount, 1);
  assert.equal(overview.latestGeneratedAt, '2026-06-21T11:00:00.000Z');
});

test('context review action audit overview warns when no audits exist', function () {
  const overview = buildContextReviewActionAuditOverview({
    audits: [],
    limit: 10,
    now: '2026-06-21T12:00:00.000Z'
  });

  assert.equal(overview.status, 'warn');
  assert.equal(overview.count, 0);
  assert.match(overview.recommendedNextAction, /review-action-apply/);
});

function audit(action, taskId, generatedAt, request) {
  return {
    version: '1.0',
    adapter: 'file-audit',
    action,
    generatedAt,
    request: Object.assign({
      taskId
    }, request)
  };
}
