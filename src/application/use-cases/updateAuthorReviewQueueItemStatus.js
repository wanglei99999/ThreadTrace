'use strict';

const { createApplicationError } = require('../errors/applicationError');
const { assertAuthorReviewQueueRepository } = require('../ports/authorReviewQueueRepository');
const { AUTHOR_REVIEW_QUEUE_STATUSES, updateAuthorReviewQueueStatus } = require('../../domain/analysis/authorReviewQueueRecord');

async function updateAuthorReviewQueueItemStatus(options) {
  const safeOptions = options || {};
  const authorReviewQueueRepository = assertAuthorReviewQueueRepository(safeOptions.authorReviewQueueRepository);
  if (!safeOptions.itemId) {
    throw createApplicationError('author_review_item_id_required', 'Author review queue item id is required.', {
      statusCode: 400
    });
  }
  if (AUTHOR_REVIEW_QUEUE_STATUSES.indexOf(safeOptions.status) === -1) {
    throw createApplicationError('author_review_status_invalid', 'Unsupported author review queue status: ' + safeOptions.status, {
      statusCode: 400,
      details: {
        allowedStatuses: AUTHOR_REVIEW_QUEUE_STATUSES
      }
    });
  }

  const existing = await authorReviewQueueRepository.findItem(safeOptions.itemId);
  if (!existing) {
    throw createApplicationError('author_review_item_not_found', 'Unknown author review queue item: ' + safeOptions.itemId, {
      statusCode: 404,
      details: {
        itemId: safeOptions.itemId
      }
    });
  }

  const item = updateAuthorReviewQueueStatus(existing, {
    status: safeOptions.status,
    reviewedBy: safeOptions.reviewedBy || safeOptions.reviewer,
    note: safeOptions.note,
    now: safeOptions.now
  });
  await authorReviewQueueRepository.saveItem(item);

  return {
    generatedAt: safeOptions.now || item.updatedAt,
    status: 'ok',
    item,
    recommendedNextAction: item.status === 'open'
      ? 'Review this author intelligence queue item before using it downstream.'
      : 'Continue working the remaining open author intelligence review queue items.'
  };
}

module.exports = {
  updateAuthorReviewQueueItemStatus
};
