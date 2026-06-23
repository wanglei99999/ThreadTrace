'use strict';

const crypto = require('crypto');
const { assertNotificationEventRepository } = require('../ports/notificationEventRepository');

async function archiveNotificationEvents(options) {
  const safeOptions = options || {};
  const notificationEventRepository = assertNotificationEventRepository(safeOptions.notificationEventRepository);
  const now = safeOptions.now || new Date().toISOString();
  const cutoffAt = safeOptions.cutoffAt || cutoffFromDays(now, safeOptions.olderThanDays || 30);
  const scanLimit = safeOptions.scanLimit || safeOptions.limit || 500;
  const archiveLimit = safeOptions.archiveLimit || safeOptions.limit || 100;
  const deliveryStatuses = normalizeDeliveryStatuses(safeOptions.deliveryStatuses);
  const requireAcknowledged = safeOptions.requireAcknowledged !== false;
  const execute = safeOptions.execute === true;
  const batchId = safeOptions.batchId || buildBatchId(now);
  const events = await notificationEventRepository.listEvents({
    type: safeOptions.type,
    sourceId: safeOptions.sourceId,
    sourceKey: safeOptions.sourceKey,
    includeArchived: false,
    limit: scanLimit
  });
  const candidates = events.filter(function (event) {
    return isArchiveCandidate(event, {
      cutoffAt,
      deliveryStatuses,
      requireAcknowledged
    });
  }).slice(0, archiveLimit);
  const results = [];

  if (execute && candidates.length > 0 && typeof notificationEventRepository.archiveEvent !== 'function') {
    throw new Error('NotificationEventRepository must implement archiveEvent(eventId, metadata) for execute=true.');
  }

  if (execute) {
    for (const event of candidates) {
      const archivedEvent = await notificationEventRepository.archiveEvent(event.id, {
        archivedAt: now,
        archivedBy: safeOptions.archivedBy || 'retention-policy',
        reason: safeOptions.reason || 'Notification event retention policy.',
        batchId
      });
      results.push(archivedEvent ? {
        eventId: event.id,
        status: 'archived',
        event: summarizeEvent(archivedEvent)
      } : {
        eventId: event.id,
        status: 'skipped',
        reason: 'not-found'
      });
    }
  }

  return {
    generatedAt: now,
    status: statusForPlan(candidates, execute, results),
    dryRun: !execute,
    execute,
    batchId,
    cutoffAt,
    olderThanDays: safeOptions.olderThanDays || 30,
    scanLimit,
    archiveLimit,
    scannedCount: events.length,
    candidateCount: candidates.length,
    archivedCount: results.filter(function (item) { return item.status === 'archived'; }).length,
    skippedCount: results.filter(function (item) { return item.status !== 'archived'; }).length,
    filters: cleanObject({
      type: safeOptions.type,
      sourceId: safeOptions.sourceId,
      sourceKey: safeOptions.sourceKey,
      deliveryStatuses,
      requireAcknowledged
    }),
    candidates: candidates.map(summarizeEvent),
    results,
    recommendedNextAction: recommendedNextAction({
      execute,
      candidateCount: candidates.length,
      archivedCount: results.filter(function (item) { return item.status === 'archived'; }).length
    })
  };
}

function isArchiveCandidate(event, options) {
  if (!event || event.archivedAt) return false;
  const deliveryStatus = event.deliveryStatus || 'pending';
  if (options.deliveryStatuses.indexOf(deliveryStatus) === -1) return false;
  if (options.requireAcknowledged && !event.acknowledgedAt) return false;
  const retentionTimestamp = event.acknowledgedAt || event.lastDeliveredAt || event.createdAt;
  return isOlderThan(retentionTimestamp, options.cutoffAt);
}

function summarizeEvent(event) {
  return {
    id: event.id,
    type: event.type,
    severity: event.severity,
    sourceId: event.sourceId,
    sourceKey: event.sourceKey,
    title: event.title,
    summary: event.summary,
    createdAt: event.createdAt,
    deliveryStatus: event.deliveryStatus || 'pending',
    acknowledgedAt: event.acknowledgedAt,
    acknowledgedBy: event.acknowledgedBy,
    archivedAt: event.archivedAt,
    archivedBy: event.archivedBy,
    archiveReason: event.archiveReason,
    archiveBatchId: event.archiveBatchId
  };
}

function normalizeDeliveryStatuses(value) {
  if (Array.isArray(value) && value.length > 0) {
    return value.map(String).map(function (item) { return item.trim(); }).filter(Boolean);
  }
  if (typeof value === 'string' && value.trim()) {
    return value.split(',').map(function (item) { return item.trim(); }).filter(Boolean);
  }
  return ['delivered', 'resolved'];
}

function cutoffFromDays(now, olderThanDays) {
  const nowTime = Date.parse(now);
  const days = Number(olderThanDays);
  if (Number.isNaN(nowTime) || !Number.isFinite(days)) return now;
  return new Date(nowTime - Math.max(0, days) * 24 * 60 * 60 * 1000).toISOString();
}

function isOlderThan(value, cutoffAt) {
  const valueTime = Date.parse(value);
  const cutoffTime = Date.parse(cutoffAt);
  if (Number.isNaN(valueTime) || Number.isNaN(cutoffTime)) return false;
  return valueTime <= cutoffTime;
}

function statusForPlan(candidates, execute, results) {
  if (!execute) return candidates.length > 0 ? 'actionable' : 'ok';
  if (results.some(function (item) { return item.status === 'skipped'; })) return 'warn';
  return candidates.length > 0 ? 'ok' : 'noop';
}

function recommendedNextAction(summary) {
  if (!summary.execute && summary.candidateCount > 0) {
    return 'Review candidates and rerun with execute=true to archive handled notification events.';
  }
  if (summary.execute && summary.archivedCount > 0) {
    return 'Verify active outbox overview after archiving handled notification events.';
  }
  return 'No handled notification events are past the retention window.';
}

function buildBatchId(now) {
  const digest = crypto.createHash('sha1').update(String(now)).digest('hex').slice(0, 8);
  return 'notification-event-archive-' + String(now).replace(/[^0-9T]/g, '').slice(0, 15) + '-' + digest;
}

function cleanObject(input) {
  return Object.keys(input).reduce(function (result, key) {
    if (input[key] !== undefined) result[key] = input[key];
    return result;
  }, {});
}

module.exports = {
  archiveNotificationEvents
};
