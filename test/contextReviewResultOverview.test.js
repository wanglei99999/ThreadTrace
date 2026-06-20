'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { getContextReviewResultOverview } = require('../src/application/use-cases/getContextReviewResultOverview');

test('context review result overview aggregates status, severity, and tasks', async function () {
  const repository = {
    async saveReviewResult() {},
    async findReviewResult() {},
    async listReviewResults(query) {
      assert.equal(query.limit, 100);
      return [
        {
          id: 'result-1',
          status: 'partially-accepted',
          handoffId: 'handoff-1',
          reviewer: { id: 'operator-1' },
          submittedAt: '2026-06-21T10:00:00.000Z',
          summary: {
            resolvedCount: 1,
            remainingCount: 1,
            mergeCandidates: [{ taskId: 'task-1' }],
            blockedTasks: [{ taskId: 'task-2' }],
            notification: {
              severity: 'warning',
              reason: 'review-has-remaining-tasks'
            },
            recommendedNextAction: 'Keep unresolved tasks open.'
          }
        },
        {
          id: 'result-2',
          status: 'accepted',
          handoffId: 'handoff-2',
          reviewer: { id: 'operator-2' },
          submittedAt: '2026-06-21T11:00:00.000Z',
          summary: {
            resolvedCount: 2,
            remainingCount: 0,
            mergeCandidates: [{ taskId: 'task-3' }, { taskId: 'task-4' }],
            blockedTasks: [],
            notification: {
              severity: 'info',
              reason: 'review-completed'
            },
            recommendedNextAction: 'Merge confirmed review decisions.'
          }
        }
      ];
    }
  };

  const overview = await getContextReviewResultOverview({
    contextReviewResultRepository: repository,
    now: '2026-06-21T12:00:00.000Z'
  });

  assert.equal(overview.generatedAt, '2026-06-21T12:00:00.000Z');
  assert.equal(overview.count, 2);
  assert.equal(overview.byStatus['partially-accepted'], 1);
  assert.equal(overview.bySeverity.warning, 1);
  assert.equal(overview.resolvedTaskCount, 3);
  assert.equal(overview.remainingTaskCount, 1);
  assert.equal(overview.mergeCandidateCount, 3);
  assert.equal(overview.blockedTaskCount, 1);
  assert.equal(overview.attention.warningCount, 1);
  assert.match(overview.recommendedNextAction, /warning/);
});
