'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { getContextReviewResultContract } = require('../src/domain/contracts/contextReviewResultContract');
const { summarizeContextReviewResult } = require('../src/domain/analysis/contextReviewResultSummarizer');

test('context review result summarizer derives closure and merge signals', function () {
  const result = getContextReviewResultContract().example;
  const summary = summarizeContextReviewResult(result);

  assert.equal(summary.status, 'partially-accepted');
  assert.equal(summary.decisionCount, 2);
  assert.equal(summary.decisionCounts.confirmed, 1);
  assert.equal(summary.decisionCounts['needs-more-evidence'], 1);
  assert.equal(summary.resolvedCount, 1);
  assert.equal(summary.remainingCount, 1);
  assert.equal(summary.confidenceBand, 'medium');
  assert.equal(summary.notification.severity, 'warning');
  assert.equal(summary.taskClosure.closeTaskIds[0], result.resolvedTasks[0]);
  assert.equal(summary.taskClosure.keepOpenTaskIds[0], result.remainingTasks[0]);
  assert.equal(summary.mergeCandidates.length, 1);
  assert.equal(summary.blockedTasks.length, 1);
});

test('context review result summarizer marks rejected reviews as critical', function () {
  const result = Object.assign({}, getContextReviewResultContract().example, {
    status: 'rejected',
    confidence: 0.82,
    resolvedTasks: [],
    remainingTasks: ['task-1'],
    decisions: [
      {
        taskId: 'task-1',
        decision: 'rejected',
        confidence: 0.82,
        evidenceRefs: [],
        rationale: 'The evidence does not support the handoff.'
      }
    ]
  });
  const summary = summarizeContextReviewResult(result);

  assert.equal(summary.notification.severity, 'critical');
  assert.match(summary.recommendedNextAction, /Do not merge/);
  assert.equal(summary.blockedTasks[0].decision, 'rejected');
});
