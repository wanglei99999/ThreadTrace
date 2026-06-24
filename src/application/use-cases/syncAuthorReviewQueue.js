'use strict';

const { assertAuthorReviewQueueRepository } = require('../ports/authorReviewQueueRepository');
const { getAuthorIntelligenceDashboard } = require('./getAuthorIntelligenceDashboard');
const { createAuthorReviewQueueRecord, authorReviewQueueItemId } = require('../../domain/analysis/authorReviewQueueRecord');

async function syncAuthorReviewQueue(options) {
  const safeOptions = options || {};
  const authorReviewQueueRepository = assertAuthorReviewQueueRepository(safeOptions.authorReviewQueueRepository);
  const now = safeOptions.now || new Date().toISOString();
  const dashboard = safeOptions.dashboard || await getAuthorIntelligenceDashboard(safeOptions);
  const reviewItems = (dashboard.reviewQueue || []).slice(0, safeOptions.reviewQueueLimit || dashboard.reviewQueue.length || 20);
  const records = [];
  let createdCount = 0;
  let updatedCount = 0;

  for (const item of reviewItems) {
    const id = authorReviewQueueItemId(item);
    const existing = await authorReviewQueueRepository.findItem(id);
    const record = createAuthorReviewQueueRecord({
      item,
      dashboard,
      existing,
      now
    });
    await authorReviewQueueRepository.saveItem(record);
    records.push(record);
    if (existing) updatedCount += 1;
    else createdCount += 1;
  }

  const summary = queueSummary(records);
  return {
    generatedAt: now,
    status: dashboard.status,
    dashboard: {
      generatedAt: dashboard.generatedAt,
      sourceKey: dashboard.sourceKey,
      sourceThreadId: dashboard.sourceThreadId,
      revisionMode: dashboard.revisionMode,
      reportCount: dashboard.reportCount,
      reportRevisionCount: dashboard.reportRevisionCount,
      recommendedNextAction: dashboard.recommendedNextAction
    },
    createdCount,
    updatedCount,
    itemCount: records.length,
    summary,
    items: records,
    recommendedNextAction: records.length > 0
      ? 'Review open author intelligence queue items, then mark each confirmed or ignored.'
      : dashboard.recommendedNextAction || 'No author intelligence review queue items were generated.'
  };
}

function queueSummary(items) {
  const sourceHotspots = sourceQueueHotspots(items);
  return {
    byStatus: countBy(items, function (item) { return item.status || 'unknown'; }),
    byPriority: countBy(items, function (item) { return item.priority || 'unknown'; }),
    byType: countBy(items, function (item) { return item.type || 'unknown'; }),
    bySourceKey: countBy(items, function (item) { return item.sourceKey || 'unknown-source'; }),
    openBySourceKey: countBy((items || []).filter(function (item) {
      return item.status === 'open';
    }), function (item) { return item.sourceKey || 'unknown-source'; }),
    highPriorityOpenBySourceKey: countBy((items || []).filter(function (item) {
      return item.status === 'open' && item.priority === 'high';
    }), function (item) { return item.sourceKey || 'unknown-source'; }),
    sourceHotspots,
    openCount: (items || []).filter(function (item) { return item.status === 'open'; }).length
  };
}

function sourceQueueHotspots(items) {
  const bySource = new Map();
  (items || []).forEach(function (item) {
    const sourceKey = item.sourceKey || 'unknown-source';
    if (!bySource.has(sourceKey)) {
      bySource.set(sourceKey, {
        sourceKey,
        itemCount: 0,
        openCount: 0,
        highPriorityOpenCount: 0,
        byType: {},
        latestUpdatedAt: undefined,
        sourceThreadIds: new Set()
      });
    }
    const summary = bySource.get(sourceKey);
    summary.itemCount += 1;
    if (item.status === 'open') summary.openCount += 1;
    if (item.status === 'open' && item.priority === 'high') summary.highPriorityOpenCount += 1;
    summary.byType[item.type || 'unknown'] = (summary.byType[item.type || 'unknown'] || 0) + 1;
    summary.latestUpdatedAt = latestTimestamp([summary.latestUpdatedAt, item.updatedAt || item.lastSeenAt]);
    if (item.sourceThreadId) summary.sourceThreadIds.add(item.sourceThreadId);
  });
  return Array.from(bySource.values()).map(function (summary) {
    return Object.assign({}, summary, {
      sourceThreadIds: Array.from(summary.sourceThreadIds).slice(0, 8)
    });
  }).sort(function (a, b) {
    return b.highPriorityOpenCount - a.highPriorityOpenCount
      || b.openCount - a.openCount
      || b.itemCount - a.itemCount
      || String(a.sourceKey).localeCompare(String(b.sourceKey));
  });
}

function countBy(items, keySelector) {
  return (items || []).reduce(function (counts, item) {
    const key = keySelector(item);
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

function latestTimestamp(values) {
  return (values || []).filter(Boolean).sort().reverse()[0];
}

module.exports = {
  syncAuthorReviewQueue,
  queueSummary
};
