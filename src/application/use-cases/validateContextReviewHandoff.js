'use strict';

const { validateContextReviewHandoffPayload } = require('../../domain/contracts/contextReviewHandoffContract');

function validateContextReviewHandoff(options) {
  const safeOptions = options || {};
  const payload = safeOptions.payload || safeOptions.handoff || safeOptions;
  return validateContextReviewHandoffPayload(payload);
}

module.exports = {
  validateContextReviewHandoff
};
