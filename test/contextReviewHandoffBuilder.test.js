'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { buildContextReviewHandoff } = require('../src/domain/analysis/contextReviewHandoffBuilder');

test('context review handoff builder creates an action package for open tasks', function () {
  const handoff = buildContextReviewHandoff({
    contextReviewTasks: [
      {
        taskId: 'latest:科技',
        taskType: 'latest_attitude_confirmation',
        priority: 'high',
        title: '确认历史链最新市场态度',
        targetEntity: '科技',
        relationType: 'explicit_entity_attitude_candidate',
        reasons: ['chain_latest_attitude_unknown'],
        evidenceFloors: [0, 7],
        evidenceRefs: [
          { source: 'opinion-chain', floor: 0, evidenceLevel: 'explicit', excerpt: '科技' }
        ],
        status: 'open'
      }
    ],
    relatedEvidence: [
      { floor: 7, author: '-阿狼-', confidence: 0.8, evidenceText: '相关证据' }
    ]
  });

  assert.equal(handoff.version, '1.0.0');
  assert.equal(handoff.status, 'action-required');
  assert.equal(handoff.taskCount, 1);
  assert.equal(handoff.highPriorityTaskCount, 1);
  assert.ok(handoff.recommendedNextAction.includes('确认历史链最新市场态度'));
  assert.deepEqual(handoff.evidencePackage.floors, [0, 7]);
  assert.equal(handoff.openTasks[0].taskId, 'latest:科技');
  assert.ok(handoff.downstreamHooks.includes('llm-review'));
});

test('context review handoff builder handles reports with no review tasks', function () {
  const handoff = buildContextReviewHandoff({
    contextReviewTasks: [],
    relatedEvidence: []
  });

  assert.equal(handoff.status, 'no-action');
  assert.equal(handoff.taskCount, 0);
  assert.equal(handoff.evidencePackage.evidenceRefCount, 0);
});
