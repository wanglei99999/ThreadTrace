'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { getContextReviewResultContract } = require('../src/domain/contracts/contextReviewResultContract');
const { validateContextReviewResult } = require('../src/application/use-cases/validateContextReviewResult');

test('validate context review result accepts wrapped payloads', function () {
  const contract = getContextReviewResultContract();
  const result = validateContextReviewResult({
    result: contract.example
  });

  assert.equal(result.valid, true);
  assert.equal(result.status, 'ok');
});

test('validate context review result rejects invalid payloads', function () {
  const result = validateContextReviewResult({
    payload: {
      version: '1.0.0',
      handoffVersion: '1.0.0',
      status: 'bad-status',
      decisions: []
    }
  });

  assert.equal(result.valid, false);
  assert.equal(result.status, 'fail');
});
