'use strict';

const { validateContextReviewResultPayload } = require('../../domain/contracts/contextReviewResultContract');

function validateContextReviewResult(options) {
  const safeOptions = options || {};
  const payload = safeOptions.payload || safeOptions.result || safeOptions;
  return validateContextReviewResultPayload(payload);
}

module.exports = {
  validateContextReviewResult
};
