'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  synthesizeAuthorReviewQueueNotificationEvents
} = require('../src/application/use-cases/synthesizeAuthorReviewQueueNotificationEvents');
const { createAuthorReviewQueueEvent } = require('../src/domain/events/notificationEvent');

test('author review queue notification synthesis defaults to dry-run', async function () {
  const saved = [];
  const result = await synthesizeAuthorReviewQueueNotificationEvents({
    authorReviewQueueRepository: queueRepository([
      queueItem('item-1', { priority: 'high' }),
      queueItem('item-2', { priority: 'medium' })
    ]),
    notificationEventRepository: eventRepository([], saved),
    now: '2026-06-23T10:00:00.000Z'
  });

  assert.equal(result.dryRun, true);
  assert.equal(result.itemCount, 2);
  assert.equal(result.actionCount, 2);
  assert.equal(result.createdCount, 2);
  assert.equal(result.eventCount, 2);
  assert.equal(saved.length, 0);
  assert.equal(result.results[0].event.type, 'author-review-queue');
  assert.equal(result.results[0].event.severity, 'warning');
  assert.equal(result.results[0].event.deliveryStatus, 'pending');
  assert.equal(result.results[0].event.nextDeliveryAt, '2026-06-23T10:00:00.000Z');
});

test('author review queue notification synthesis executes stable outbox events', async function () {
  const saved = [];
  const item = queueItem('item-1', {
    priority: 'high',
    sourceThreadId: 'thread-9',
    floor: 12
  });
  const result = await synthesizeAuthorReviewQueueNotificationEvents({
    authorReviewQueueRepository: queueRepository([item]),
    notificationEventRepository: eventRepository([], saved),
    execute: true,
    now: '2026-06-23T10:00:00.000Z'
  });

  assert.equal(result.dryRun, false);
  assert.equal(result.createdCount, 1);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].id, result.results[0].event.id);
  assert.equal(saved[0].sourceKey, 'forum-a');
  assert.equal(saved[0].payload.itemId, 'item-1');
  assert.equal(saved[0].payload.sourceThreadId, 'thread-9');
  assert.equal(saved[0].payload.floor, 12);
});

test('author review queue notification synthesis skips acknowledged and delivered events', async function () {
  const firstItem = queueItem('item-1', { priority: 'high' });
  const secondItem = queueItem('item-2', { priority: 'medium' });
  const existing = [
    Object.assign(existingEvent(firstItem), {
      acknowledgedAt: '2026-06-23T09:00:00.000Z'
    }),
    Object.assign(existingEvent(secondItem), {
      deliveryStatus: 'delivered'
    })
  ];
  const saved = [];
  const result = await synthesizeAuthorReviewQueueNotificationEvents({
    authorReviewQueueRepository: queueRepository([firstItem, secondItem]),
    notificationEventRepository: eventRepository(existing, saved),
    execute: true,
    now: '2026-06-23T10:00:00.000Z'
  });

  assert.equal(result.skippedCount, 2);
  assert.deepEqual(result.results.map(function (item) { return item.reason; }), ['already-acknowledged', 'already-delivered']);
  assert.equal(saved.length, 0);
});

test('author review queue notification synthesis updates pending event payload without resetting delivery state', async function () {
  const saved = [];
  const item = queueItem('item-1', { summary: 'Original summary.' });
  const existing = Object.assign(existingEvent(item), {
    deliveryStatus: 'failed',
    deliveryAttempts: 2,
    nextDeliveryAt: '2026-06-23T10:05:00.000Z',
    lastDeliveryError: {
      message: 'temporary outage'
    }
  });
  const result = await synthesizeAuthorReviewQueueNotificationEvents({
    authorReviewQueueRepository: queueRepository([
      Object.assign({}, item, {
        summary: 'Updated summary.'
      })
    ]),
    notificationEventRepository: eventRepository([existing], saved),
    execute: true,
    now: '2026-06-23T10:00:00.000Z'
  });

  assert.equal(result.updatedCount, 1);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].summary, 'Updated summary.');
  assert.equal(saved[0].deliveryStatus, 'failed');
  assert.equal(saved[0].deliveryAttempts, 2);
  assert.equal(saved[0].nextDeliveryAt, '2026-06-23T10:05:00.000Z');
  assert.equal(saved[0].lastDeliveryError.message, 'temporary outage');
});

test('author review queue notification synthesis resolves stale scoped events', async function () {
  const saved = [];
  const staleEvent = existingEvent(queueItem('stale-1', {
    sourceKey: 'forum-a',
    sourceThreadId: 'thread-1',
    priority: 'high'
  }));
  const otherSourceEvent = existingEvent(queueItem('stale-2', {
    sourceKey: 'forum-b',
    sourceThreadId: 'thread-2',
    priority: 'high'
  }));
  const result = await synthesizeAuthorReviewQueueNotificationEvents({
    authorReviewQueueRepository: queueRepository([]),
    notificationEventRepository: eventRepository([staleEvent, otherSourceEvent], saved),
    sourceKey: 'forum-a',
    execute: true,
    now: '2026-06-23T10:00:00.000Z'
  });

  assert.equal(result.resolvedCount, 1);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].id, staleEvent.id);
  assert.equal(saved[0].deliveryStatus, 'resolved');
  assert.equal(saved[0].acknowledgedAt, '2026-06-23T10:00:00.000Z');
  assert.equal(saved[0].acknowledgedBy, 'author-review-queue-synthesizer');
  assert.equal(saved[0].payload.resolution.reason, 'author-review-queue-item-cleared');
});

test('author review queue notification synthesis reopens auto-resolved items when they return', async function () {
  const saved = [];
  const item = queueItem('item-1', { priority: 'high' });
  const resolved = Object.assign(existingEvent(item), {
    deliveryStatus: 'resolved',
    nextDeliveryAt: undefined,
    acknowledgedAt: '2026-06-23T09:00:00.000Z',
    acknowledgedBy: 'author-review-queue-synthesizer',
    acknowledgementNote: 'Author review queue item is no longer open.'
  });
  resolved.payload = Object.assign({}, resolved.payload, {
    resolution: {
      status: 'resolved',
      resolvedAt: '2026-06-23T09:00:00.000Z',
      reason: 'author-review-queue-item-cleared'
    }
  });

  const result = await synthesizeAuthorReviewQueueNotificationEvents({
    authorReviewQueueRepository: queueRepository([item]),
    notificationEventRepository: eventRepository([resolved], saved),
    execute: true,
    now: '2026-06-23T10:00:00.000Z'
  });

  assert.equal(result.reopenedCount, 1);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].deliveryStatus, 'pending');
  assert.equal(saved[0].deliveryAttempts, 0);
  assert.equal(saved[0].nextDeliveryAt, '2026-06-23T10:00:00.000Z');
  assert.equal(saved[0].acknowledgedAt, undefined);
  assert.equal(saved[0].payload.previousResolution.reason, 'author-review-queue-item-cleared');
});

function queueItem(id, overrides) {
  const safeOverrides = overrides || {};
  return Object.assign({
    id,
    queueKey: 'queue:' + id,
    status: 'open',
    type: 'high-confidence-opinion',
    priority: 'medium',
    score: 78,
    title: 'Validate high-confidence opinion from Alice',
    summary: 'Alpha looks strong.',
    reason: 'high-confidence-opinion',
    nextAction: 'Confirm the cited floor.',
    sourceKey: 'forum-a',
    sourceThreadId: 'thread-1',
    floor: 3,
    sourcePostId: 'thread-1-p3',
    author: {
      sourceAuthorId: 'author-1',
      displayName: 'Alice'
    },
    refs: [
      {
        sourceKey: 'forum-a',
        sourceThreadId: 'thread-1',
        floor: 3
      }
    ],
    seenCount: 1,
    lastSeenAt: '2026-06-23T09:59:00.000Z'
  }, safeOverrides);
}

function existingEvent(item, overrides) {
  return Object.assign(createAuthorReviewQueueEvent({
    item,
    createdAt: '2026-06-23T09:00:00.000Z'
  }), overrides || {});
}

function queueRepository(items) {
  return {
    async saveItem() {},
    async findItem(id) {
      return items.find(function (item) {
        return item.id === id;
      });
    },
    async listItems(query) {
      const safeQuery = query || {};
      return items.filter(function (item) {
        if (safeQuery.status && item.status !== safeQuery.status) return false;
        if (safeQuery.sourceKey && item.sourceKey !== safeQuery.sourceKey) return false;
        if (safeQuery.sourceThreadId && item.sourceThreadId !== safeQuery.sourceThreadId) return false;
        if (safeQuery.type && item.type !== safeQuery.type) return false;
        if (safeQuery.priority && item.priority !== safeQuery.priority) return false;
        return true;
      }).slice(0, safeQuery.limit || items.length);
    }
  };
}

function eventRepository(events, saved) {
  return {
    async saveEvent(event) {
      saved.push(event);
    },
    async findEvent(id) {
      return events.find(function (event) {
        return event.id === id;
      });
    },
    async listEvents(query) {
      const safeQuery = query || {};
      return events.filter(function (event) {
        if (safeQuery.type && event.type !== safeQuery.type) return false;
        if (typeof safeQuery.acknowledged === 'boolean') {
          const acknowledged = Boolean(event.acknowledgedAt);
          if (acknowledged !== safeQuery.acknowledged) return false;
        }
        if (safeQuery.deliveryStatus && event.deliveryStatus !== safeQuery.deliveryStatus) return false;
        return true;
      }).slice(0, safeQuery.limit || events.length);
    }
  };
}
