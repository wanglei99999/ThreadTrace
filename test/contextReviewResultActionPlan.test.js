'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { getContextReviewResultActionPlan } = require('../src/application/use-cases/getContextReviewResultActionPlan');

test('context review result action plan separates close, keep-open, merge, and conflicts', async function () {
  const plan = await getContextReviewResultActionPlan({
    contextReviewResultRepository: reviewRepository([
      reviewRecord({
        id: 'review-1',
        sourceId: 'source-a',
        sourceKey: 'forum-a',
        severity: 'warning',
        resolvedTasks: ['task-close', 'task-conflict'],
        remainingTasks: ['task-open', 'task-conflict'],
        mergeCandidates: [
          { taskId: 'task-close', decision: 'confirmed', confidence: 0.82 },
          { taskId: 'task-conflict', decision: 'corrected', confidence: 0.77 }
        ],
        blockedTasks: [
          { taskId: 'task-open', decision: 'needs-more-evidence', reason: 'Need another cited floor.' }
        ]
      }),
      reviewRecord({
        id: 'review-2',
        sourceId: 'source-a',
        sourceKey: 'forum-a',
        severity: 'info',
        resolvedTasks: ['task-close-2'],
        remainingTasks: [],
        mergeCandidates: [
          { taskId: 'task-close-2', decision: 'corrected', confidence: 0.91 }
        ],
        blockedTasks: []
      })
    ]),
    sourceKey: 'forum-a',
    now: '2026-06-21T12:00:00.000Z'
  });

  assert.equal(plan.generatedAt, '2026-06-21T12:00:00.000Z');
  assert.equal(plan.sourceKey, 'forum-a');
  assert.equal(plan.sourceScope.mixed, false);
  assert.deepEqual(plan.sourceScope.sourceKeys, ['forum-a']);
  assert.equal(plan.count, 2);
  assert.deepEqual(plan.closeTaskIds, ['task-close', 'task-close-2']);
  assert.deepEqual(plan.keepOpenTaskIds, ['task-open', 'task-conflict']);
  assert.deepEqual(plan.attention.conflictTaskIds, ['task-conflict']);
  assert.equal(plan.mergeCandidates.length, 2);
  assert.equal(plan.mergeCandidates[0].sourceKey, 'forum-a');
  assert.deepEqual(plan.mergeCandidates.map(function (candidate) { return candidate.taskId; }), ['task-close', 'task-close-2']);
  assert.equal(plan.blockedTasks.length, 1);
  assert.equal(plan.blockedTasks[0].recordId, 'review-1');
  assert.equal(plan.blockedTasks[0].sourceId, 'source-a');
  assert.equal(plan.risk.level, 'critical');
  assert.ok(plan.risk.reasons.includes('task-close-open-conflicts'));
  assert.match(plan.recommendedNextAction, /Reconcile/);
});

test('context review result action plan skips critical merge candidates', async function () {
  const plan = await getContextReviewResultActionPlan({
    contextReviewResultRepository: reviewRepository([
      reviewRecord({
        id: 'review-critical',
        status: 'rejected',
        severity: 'critical',
        resolvedTasks: ['task-risk'],
        remainingTasks: [],
        mergeCandidates: [
          { taskId: 'task-risk', decision: 'confirmed', confidence: 0.95 }
        ],
        blockedTasks: []
      })
    ])
  });

  assert.deepEqual(plan.mergeCandidates, []);
  assert.equal(plan.attention.criticalCount, 1);
  assert.equal(plan.status, 'warn');
  assert.match(plan.recommendedNextAction, /critical/);
});

function reviewRecord(options) {
  return {
    id: options.id,
    status: options.status || 'partially-accepted',
    handoffId: 'handoff-' + options.id,
    sourceId: options.sourceId,
    sourceKey: options.sourceKey,
    reviewer: { id: 'operator-1' },
    submittedAt: '2026-06-21T10:00:00.000Z',
    result: {
      resolvedTasks: options.resolvedTasks,
      remainingTasks: options.remainingTasks
    },
    summary: {
      confidenceBand: options.confidenceBand || 'medium',
      taskClosure: {
        closeTaskIds: options.resolvedTasks,
        keepOpenTaskIds: options.remainingTasks
      },
      mergeCandidates: options.mergeCandidates,
      blockedTasks: options.blockedTasks,
      notification: {
        severity: options.severity,
        reason: options.severity === 'critical' ? 'review-result-rejected' : 'review-has-remaining-tasks'
      },
      recommendedNextAction: 'Review action for ' + options.id
    }
  };
}

function reviewRepository(records) {
  return {
    async saveReviewResult() {},
    async findReviewResult() {},
    async listReviewResults(query) {
      assert.equal(query.limit, 100);
      return records;
    }
  };
}
