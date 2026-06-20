'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { getContextReviewHandoffContract } = require('../src/domain/contracts/contextReviewHandoffContract');
const { validateContextReviewHandoff } = require('../src/application/use-cases/validateContextReviewHandoff');

test('validate context review handoff accepts wrapped payloads', function () {
  const contract = getContextReviewHandoffContract();
  const result = validateContextReviewHandoff({
    handoff: contract.example
  });

  assert.equal(result.valid, true);
  assert.equal(result.status, 'ok');
});

test('validate context review handoff rejects invalid payloads', function () {
  const result = validateContextReviewHandoff({
    payload: {
      version: '1.0.0',
      status: 'bad-status',
      openTasks: []
    }
  });

  assert.equal(result.valid, false);
  assert.equal(result.status, 'fail');
});
