'use strict';

const crypto = require('crypto');

const AUTHOR_REVIEW_QUEUE_STATUSES = ['open', 'confirmed', 'ignored'];

function createAuthorReviewQueueRecord(input) {
  const safeInput = input || {};
  const item = safeInput.item || {};
  const dashboard = safeInput.dashboard || {};
  const existing = safeInput.existing;
  const now = safeInput.now || new Date().toISOString();
  const ref = firstRef(item);
  const id = authorReviewQueueItemId(item);

  return {
    id,
    queueKey: item.key,
    status: existing && existing.status || 'open',
    type: item.type || 'unknown',
    priority: item.priority || 'unknown',
    score: item.score || 0,
    title: item.title || item.key || id,
    summary: item.summary,
    reason: item.reason,
    nextAction: item.nextAction,
    sourceKey: ref.sourceKey || item.thread && item.thread.sourceKey || dashboard.sourceKey,
    sourceThreadId: ref.sourceThreadId || item.thread && item.thread.sourceThreadId,
    floor: item.floor === undefined ? ref.floor : item.floor,
    sourcePostId: item.sourcePostId || ref.sourcePostId,
    author: item.author,
    entity: item.entity,
    refs: item.refs || [],
    item,
    dashboard: {
      generatedAt: dashboard.generatedAt,
      revisionMode: dashboard.revisionMode,
      reportType: dashboard.reportType,
      reportCount: dashboard.reportCount,
      reportRevisionCount: dashboard.reportRevisionCount
    },
    firstSeenAt: existing && existing.firstSeenAt || now,
    lastSeenAt: now,
    seenCount: (existing && existing.seenCount || 0) + 1,
    createdAt: existing && existing.createdAt || now,
    updatedAt: now,
    review: existing && existing.review
  };
}

function updateAuthorReviewQueueStatus(record, input) {
  const safeInput = input || {};
  const status = safeInput.status || 'open';
  if (AUTHOR_REVIEW_QUEUE_STATUSES.indexOf(status) === -1) {
    throw new Error('Unsupported author review queue status: ' + status);
  }
  const now = safeInput.now || new Date().toISOString();
  return Object.assign({}, record, {
    status,
    updatedAt: now,
    review: status === 'open' ? undefined : {
      reviewedAt: now,
      reviewedBy: safeInput.reviewedBy || safeInput.reviewer || 'unknown',
      note: safeInput.note,
      previousStatus: record.status
    }
  });
}

function authorReviewQueueItemId(item) {
  const safeItem = item || {};
  const stableText = [
    safeItem.key,
    safeItem.type,
    safeItem.title,
    refsKey(safeItem.refs || [])
  ].filter(Boolean).join('|');
  return 'author-review:' + sha1(stableText || JSON.stringify(safeItem)).slice(0, 16);
}

function firstRef(item) {
  const refs = item && item.refs || [];
  return refs[0] || {};
}

function refsKey(refs) {
  return (refs || []).map(function (ref) {
    return [
      ref.sourceKey,
      ref.sourceThreadId,
      ref.floor,
      ref.sourcePostId
    ].filter(function (value) {
      return value !== undefined && value !== null && value !== '';
    }).join(':');
  }).join('|');
}

function sha1(text) {
  return crypto.createHash('sha1').update(String(text)).digest('hex');
}

module.exports = {
  AUTHOR_REVIEW_QUEUE_STATUSES,
  authorReviewQueueItemId,
  createAuthorReviewQueueRecord,
  updateAuthorReviewQueueStatus
};
