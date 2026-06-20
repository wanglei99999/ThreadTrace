'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  getContextReviewHandoffContract,
  validateContextReviewHandoffPayload
} = require('../src/domain/contracts/contextReviewHandoffContract');

test('context review handoff contract exposes schema and downstream hooks', function () {
  const contract = getContextReviewHandoffContract();

  assert.equal(contract.version, '1.0.0');
  assert.ok(contract.schema.required.includes('evidencePackage'));
  assert.ok(contract.schema.required.includes('openTasks'));
  assert.ok(contract.downstreamHooks.llmReview);
  assert.equal(contract.example.status, 'action-required');
});

test('context review handoff contract validates required payload fields', function () {
  const contract = getContextReviewHandoffContract();
  const valid = validateContextReviewHandoffPayload(contract.example);
  const invalid = validateContextReviewHandoffPayload({
    version: '1.0.0',
    status: 'unknown',
    openTasks: [{}]
  });

  assert.equal(valid.valid, true);
  assert.equal(valid.status, 'ok');
  assert.equal(invalid.valid, false);
  assert.ok(invalid.checks.some(function (check) {
    return check.key === 'contextReviewHandoff.status' && check.status === 'fail';
  }));
});
