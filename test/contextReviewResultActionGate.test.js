'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { getContextReviewResultActionGate } = require('../src/application/use-cases/getContextReviewResultActionGate');

test('context review result action gate fails conflicting plans', async function () {
  const gate = await getContextReviewResultActionGate({
    actionPlan: {
      generatedAt: '2026-06-21T12:00:00.000Z',
      sourceId: 'source-a',
      sourceKey: 'forum-a',
      count: 1,
      windowLimit: 100,
      closeTaskIds: ['task-1'],
      keepOpenTaskIds: ['task-1'],
      mergeCandidates: [{ taskId: 'task-1' }],
      blockedTasks: [],
      attention: {
        criticalCount: 0,
        warningCount: 1,
        conflictTaskIds: ['task-1']
      },
      risk: {
        level: 'critical',
        reasons: ['task-close-open-conflicts']
      },
      recommendedNextAction: 'Reconcile tasks first.'
    }
  });

  assert.equal(gate.generatedAt, '2026-06-21T12:00:00.000Z');
  assert.equal(gate.sourceId, 'source-a');
  assert.equal(gate.sourceKey, 'forum-a');
  assert.equal(gate.status, 'fail');
  assert.equal(gate.executable.canCloseTasks, false);
  assert.equal(gate.executable.canMergeContext, false);
  assert.equal(gate.executable.requiresHumanReview, true);
  assert.ok(gate.gates.some(function (item) {
    return item.key === 'reviewResults.conflicts' && item.status === 'fail';
  }));
  assert.match(gate.recommendedNextAction, /Do not execute/);
});

test('context review result action gate clears non-conflicting executable plans', async function () {
  const gate = await getContextReviewResultActionGate({
    actionPlan: {
      generatedAt: '2026-06-21T12:00:00.000Z',
      count: 1,
      windowLimit: 100,
      closeTaskIds: ['task-1'],
      keepOpenTaskIds: [],
      mergeCandidates: [{ taskId: 'task-1' }],
      blockedTasks: [],
      attention: {
        criticalCount: 0,
        warningCount: 0,
        conflictTaskIds: []
      },
      risk: {
        level: 'ok',
        reasons: []
      },
      recommendedNextAction: 'Safe to dry-run.'
    }
  });

  assert.equal(gate.status, 'ok');
  assert.equal(gate.executable.canCloseTasks, true);
  assert.equal(gate.executable.canMergeContext, true);
  assert.equal(gate.executable.requiresHumanReview, false);
  assert.equal(gate.nextActions.length, 0);
  assert.match(gate.recommendedNextAction, /Gate is clear/);
});

test('context review result action gate blocks mixed source execution windows', async function () {
  const gate = await getContextReviewResultActionGate({
    actionPlan: {
      generatedAt: '2026-06-21T12:00:00.000Z',
      count: 2,
      windowLimit: 100,
      sourceScope: {
        mixed: true,
        sourceIds: ['source-a', 'source-b'],
        sourceKeys: ['forum-a', 'forum-b']
      },
      closeTaskIds: ['task-1'],
      keepOpenTaskIds: [],
      mergeCandidates: [{ taskId: 'task-1' }],
      blockedTasks: [],
      attention: {
        criticalCount: 0,
        warningCount: 0,
        conflictTaskIds: []
      },
      risk: {
        level: 'ok',
        reasons: []
      }
    }
  });

  assert.equal(gate.status, 'fail');
  assert.equal(gate.executable.canCloseTasks, false);
  assert.ok(gate.gates.some(function (item) {
    return item.key === 'reviewResults.sourceScope' && item.status === 'fail';
  }));
});
