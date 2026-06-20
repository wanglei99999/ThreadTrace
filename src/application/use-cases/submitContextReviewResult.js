'use strict';

const crypto = require('crypto');
const { assertContextReviewResultRepository } = require('../ports/contextReviewResultRepository');
const { summarizeContextReviewResult } = require('./summarizeContextReviewResult');

async function submitContextReviewResult(options) {
  const safeOptions = options || {};
  const repository = assertContextReviewResultRepository(safeOptions.contextReviewResultRepository);
  const result = safeOptions.result || safeOptions.payload || {};
  const summaryResult = summarizeContextReviewResult({
    result
  });
  if (!summaryResult.valid) {
    return summaryResult;
  }

  const now = safeOptions.now || new Date().toISOString();
  const record = {
    id: safeOptions.id || result.id || crypto.randomUUID(),
    status: result.status,
    handoffId: result.handoffId,
    handoffVersion: result.handoffVersion,
    reviewer: result.reviewer,
    submittedAt: now,
    result,
    validation: summaryResult.validation,
    summary: summaryResult.summary,
    trace: buildTrace(safeOptions)
  };
  await repository.saveReviewResult(record);

  return {
    valid: true,
    status: 'stored',
    record,
    summary: record.summary
  };
}

function buildTrace(options) {
  const trace = {};
  if (options.requestId) trace.requestId = options.requestId;
  if (options.traceId) trace.traceId = options.traceId;
  if (options.idempotencyKey) trace.idempotencyKey = options.idempotencyKey;
  return Object.keys(trace).length > 0 ? trace : undefined;
}

module.exports = {
  submitContextReviewResult
};
