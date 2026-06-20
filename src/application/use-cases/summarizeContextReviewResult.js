'use strict';

const { validateContextReviewResultPayload } = require('../../domain/contracts/contextReviewResultContract');
const { summarizeContextReviewResult: summarizeResult } = require('../../domain/analysis/contextReviewResultSummarizer');

function summarizeContextReviewResult(options) {
  const safeOptions = options || {};
  const result = safeOptions.result || safeOptions.payload || safeOptions;
  const validation = validateContextReviewResultPayload(result);
  if (!validation.valid) {
    return {
      valid: false,
      status: 'invalid',
      validation
    };
  }
  return {
    valid: true,
    status: 'ok',
    validation,
    summary: summarizeResult(result)
  };
}

module.exports = {
  summarizeContextReviewResult
};
