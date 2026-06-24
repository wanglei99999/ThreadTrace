'use strict';

const { assertContextReviewResultRepository } = require('../ports/contextReviewResultRepository');

async function listContextReviewResults(options) {
  const safeOptions = options || {};
  const repository = assertContextReviewResultRepository(safeOptions.contextReviewResultRepository);
  const records = await repository.listReviewResults({
    handoffId: safeOptions.handoffId,
    status: safeOptions.status,
    reviewerId: safeOptions.reviewerId,
    sourceId: safeOptions.sourceId,
    sourceKey: safeOptions.sourceKey || safeOptions.forum,
    limit: safeOptions.limit || 50
  });

  return {
    reviewResults: records,
    count: records.length
  };
}

module.exports = {
  listContextReviewResults
};
