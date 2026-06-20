'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { getContextReviewResultContract } = require('../src/domain/contracts/contextReviewResultContract');
const { summarizeContextReviewResult } = require('../src/application/use-cases/summarizeContextReviewResult');

test('summarize context review result validates and returns summary', function () {
  const result = summarizeContextReviewResult({
    result: getContextReviewResultContract().example
  });

  assert.equal(result.valid, true);
  assert.equal(result.status, 'ok');
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.taskClosure.closeTaskIds.length, 1);
  assert.equal(result.summary.notification.severity, 'warning');
});

test('summarize context review result rejects invalid payloads', function () {
  const result = summarizeContextReviewResult({
    payload: {
      version: '1.0.0',
      handoffVersion: '1.0.0',
      status: 'bad-status',
      decisions: []
    }
  });

  assert.equal(result.valid, false);
  assert.equal(result.status, 'invalid');
  assert.equal(result.validation.status, 'fail');
  assert.equal(result.summary, undefined);
});
