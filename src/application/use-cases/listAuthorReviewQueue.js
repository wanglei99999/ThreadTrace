'use strict';

const { assertAuthorReviewQueueRepository } = require('../ports/authorReviewQueueRepository');
const { queueSummary } = require('./syncAuthorReviewQueue');

async function listAuthorReviewQueue(options) {
  const safeOptions = options || {};
  const authorReviewQueueRepository = assertAuthorReviewQueueRepository(safeOptions.authorReviewQueueRepository);
  const items = await authorReviewQueueRepository.listItems({
    status: safeOptions.status,
    sourceKey: safeOptions.sourceKey || safeOptions.forum,
    sourceThreadId: safeOptions.sourceThreadId,
    type: safeOptions.type,
    priority: safeOptions.priority,
    limit: safeOptions.limit || 50
  });

  return {
    generatedAt: safeOptions.now || new Date().toISOString(),
    status: 'ok',
    itemCount: items.length,
    summary: queueSummary(items),
    items,
    recommendedNextAction: items.some(function (item) { return item.status === 'open'; })
      ? 'Work open author intelligence review queue items in priority order.'
      : 'No open author intelligence review queue items match this filter.'
  };
}

module.exports = {
  listAuthorReviewQueue
};
