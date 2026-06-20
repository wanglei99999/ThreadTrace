'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { planContextReviewTasks } = require('../src/domain/analysis/contextReviewPlanner');

test('context review planner creates actionable tasks from review reasons', function () {
  const tasks = planContextReviewTasks({
    contextChainMatches: [
      {
        relationType: 'explicit_entity_attitude_candidate',
        relationFamily: 'candidate',
        relationEvidenceLevel: 'mixed',
        reviewRequired: true,
        reviewReasons: ['new_post_has_implicit_reference', 'relation_uses_inference', 'chain_latest_attitude_unknown'],
        chain: {
          entity: { displayName: '科技' },
          evidenceRefs: [
            { type: 'opinion', evidenceLevel: 'explicit', floor: 0, author: '-阿狼-', excerpt: '科技...' }
          ]
        }
      },
      {
        relationType: 'implicit_reference_match',
        relationFamily: 'candidate',
        relationEvidenceLevel: 'mixed',
        reviewRequired: true,
        reviewReasons: ['new_post_has_implicit_reference'],
        chain: {
          entity: { displayName: 'AI' },
          evidenceRefs: [
            { type: 'opinion', evidenceLevel: 'explicit', floor: 3, author: '路人', excerpt: 'AI...' }
          ]
        }
      }
    ],
    relatedEvidence: [
      { floor: 0, author: '-阿狼-', confidence: 0.9, evidenceText: '历史证据' }
    ]
  });

  assert.ok(tasks.some(function (task) {
    return task.taskType === 'implicit_reference_resolution' && task.priority === 'high';
  }));
  assert.ok(tasks.some(function (task) {
    return task.taskType === 'latest_attitude_confirmation' && task.evidenceFloors.includes(0);
  }));
  assert.ok(tasks.some(function (task) {
    return task.taskType === 'inference_boundary_review';
  }));
  assert.equal(tasks[0].targetEntity, '科技');
  assert.equal(tasks[1].targetEntity, '科技');
  assert.ok(tasks.every(function (task) {
    return task.status === 'open';
  }));
});

test('context review planner falls back to historical evidence review', function () {
  const tasks = planContextReviewTasks({
    contextChainMatches: [],
    relatedEvidence: [
      { floor: 7, author: '路人', confidence: 0.6, evidenceText: '相关楼层' }
    ]
  });

  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].taskType, 'historical_evidence_review');
  assert.deepEqual(tasks[0].evidenceFloors, [7]);
});
