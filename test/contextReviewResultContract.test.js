'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  getContextReviewResultContract,
  validateContextReviewResultPayload
} = require('../src/domain/contracts/contextReviewResultContract');

test('context review result contract exposes schema and downstream hooks', function () {
  const contract = getContextReviewResultContract();

  assert.equal(contract.version, '1.0.0');
  assert.ok(contract.schema.required.includes('decisions'));
  assert.ok(contract.schema.required.includes('resolvedTasks'));
  assert.ok(contract.schema.required.includes('remainingTasks'));
  assert.ok(contract.downstreamHooks.contextMerge);
  assert.equal(contract.example.status, 'partially-accepted');
});

test('context review result contract validates payload fields and task partition', function () {
  const contract = getContextReviewResultContract();
  const valid = validateContextReviewResultPayload(contract.example);
  const invalid = validateContextReviewResultPayload({
    version: '1.0.0',
    handoffVersion: '1.0.0',
    status: 'accepted',
    reviewer: {
      type: 'human',
      id: 'operator-1'
    },
    reviewedAt: '2026-06-21T10:00:00.000Z',
    decisions: [
      {
        taskId: 'task-1',
        decision: 'confirmed',
        confidence: 1.1,
        evidenceRefs: []
      }
    ],
    resolvedTasks: ['task-1'],
    remainingTasks: ['task-1'],
    confidence: 0.9,
    evidenceRefs: []
  });

  assert.equal(valid.valid, true);
  assert.equal(valid.status, 'ok');
  assert.equal(invalid.valid, false);
  assert.ok(invalid.checks.some(function (check) {
    return check.key === 'contextReviewResult.decisions[0].confidence' && check.status === 'fail';
  }));
  assert.ok(invalid.checks.some(function (check) {
    return check.key === 'contextReviewResult.taskPartition' && check.status === 'fail';
  }));
});
