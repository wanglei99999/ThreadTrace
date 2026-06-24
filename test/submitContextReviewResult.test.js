'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { getContextReviewResultContract } = require('../src/domain/contracts/contextReviewResultContract');
const { submitContextReviewResult } = require('../src/application/use-cases/submitContextReviewResult');
const { listContextReviewResults } = require('../src/application/use-cases/listContextReviewResults');

test('submit context review result validates, summarizes, and stores record', async function () {
  const saved = [];
  const repository = {
    async saveReviewResult(record) {
      saved.push(record);
    },
    async findReviewResult() {},
    async listReviewResults() {
      return saved;
    }
  };
  const result = await submitContextReviewResult({
    id: 'review-result-1',
    now: '2026-06-21T10:00:00.000Z',
    contextReviewResultRepository: repository,
    result: getContextReviewResultContract().example,
    requestId: 'request-1',
    idempotencyKey: 'idem-1'
  });
  const listed = await listContextReviewResults({
    contextReviewResultRepository: repository
  });

  assert.equal(result.valid, true);
  assert.equal(result.status, 'stored');
  assert.equal(saved.length, 1);
  assert.equal(saved[0].id, 'review-result-1');
  assert.equal(saved[0].submittedAt, '2026-06-21T10:00:00.000Z');
  assert.equal(saved[0].sourceId, 'tracked-source-nga-001');
  assert.equal(saved[0].sourceKey, 'nga');
  assert.equal(saved[0].summary.notification.severity, 'warning');
  assert.equal(saved[0].trace.requestId, 'request-1');
  assert.equal(saved[0].trace.idempotencyKey, 'idem-1');
  assert.equal(listed.count, 1);
});

test('submit context review result rejects invalid payloads without storing', async function () {
  let saveCount = 0;
  const repository = {
    async saveReviewResult() {
      saveCount += 1;
    },
    async findReviewResult() {},
    async listReviewResults() {
      return [];
    }
  };
  const result = await submitContextReviewResult({
    contextReviewResultRepository: repository,
    result: {
      version: '1.0.0',
      handoffVersion: '1.0.0',
      status: 'bad-status',
      decisions: []
    }
  });

  assert.equal(result.valid, false);
  assert.equal(result.status, 'invalid');
  assert.equal(saveCount, 0);
});
